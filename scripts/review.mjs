/* global console */
/* eslint-disable no-console, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/restrict-plus-operands, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/use-unknown-in-catch-callback-variable -- CLI script bridges untyped env, JSON, and gh output boundaries. */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { appendFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "z-ai/glm-5.2";
const DEFAULT_MAX_TOKENS = 1800;
const VALID_VERDICTS = new Set(["APPROVED", "NEEDS ATTENTION", "REJECTED"]);

function readArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      continue;
    }

    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "true";
      continue;
    }

    args[key] = next;
    index += 1;
  }

  return args;
}

function readValue({ args, argName, envName, fallback = "" }) {
  return args[argName] ?? process.env[envName] ?? fallback;
}

function readDiff(args) {
  const diffFile = readValue({ args, argName: "diff-file", envName: "REVIEW_DIFF_FILE" });
  if (diffFile) {
    return readFileSync(diffFile, "utf8");
  }

  return readValue({ args, argName: "diff", envName: "PR_DIFF" });
}

function renderPrompt(template, values) {
  return Object.entries(values).reduce((prompt, [key, value]) => {
    return prompt.replace(new RegExp(`{{\\s*${key}\\s*}}`, "g"), value || "(empty)");
  }, template);
}

function parseJsonFromText(text) {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Review response did not contain a JSON object.");
  }

  return JSON.parse(trimmed.slice(start, end + 1));
}

function validateVerdict(parsed) {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Review response JSON must be an object.");
  }

  if (!VALID_VERDICTS.has(parsed.verdict)) {
    throw new Error(`Review verdict must be one of ${[...VALID_VERDICTS].join(", ")}.`);
  }

  if (!Number.isFinite(parsed.score) || parsed.score < 1 || parsed.score > 10) {
    throw new Error("Review score must be a number from 1 to 10.");
  }

  if (!Array.isArray(parsed.findings)) {
    throw new Error("Review findings must be an array.");
  }

  return {
    verdict: parsed.verdict,
    score: parsed.score,
    findings: parsed.findings.map((finding) => ({
      severity: String(finding.severity ?? "note"),
      file: String(finding.file ?? "unknown"),
      detail: String(finding.detail ?? "").trim() || "No detail provided.",
    })),
  };
}

async function callOpenRouter(prompt) {
  const mockResponse = process.env.REVIEW_MOCK_RESPONSE;
  if (mockResponse) {
    return mockResponse;
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is required unless REVIEW_MOCK_RESPONSE is set.");
  }

  const baseUrl = process.env.OPENROUTER_BASE_URL ?? DEFAULT_OPENROUTER_BASE_URL;
  const response = await globalThis.fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "https://github.com/witkos4/bondify",
      "X-Title": process.env.OPENROUTER_APP_TITLE ?? "Bondify AI Code Review",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL,
      max_tokens: Number.parseInt(process.env.REVIEW_MAX_TOKENS ?? `${DEFAULT_MAX_TOKENS}`, 10),
      temperature: 0,
      messages: [
        {
          role: "system",
          content: "Return only strict JSON. Do not include Markdown fences or prose outside the JSON object.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const errBody = (await response.text()).slice(0, 500);
    throw new Error(`OpenRouter request failed: ${response.status} ${errBody}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("OpenRouter response did not include message content.");
  }

  return content;
}

function formatComment(result) {
  const findings =
    result.findings.length > 0
      ? result.findings.map((finding) => `- **${finding.severity}** \`${finding.file}\`: ${finding.detail}`).join("\n")
      : "- **note** `review`: No file-specific findings returned.";

  return [
    "## AI Code Review",
    "",
    `- **Verdict**: ${result.verdict}`,
    `- **Score**: ${result.score}/10`,
    "",
    "### Findings",
    "",
    findings,
    "",
    "_Generated by the Bondify AI Code Review workflow._",
  ].join("\n");
}

function postComment({ body, prNumber }) {
  if (!prNumber) {
    return false;
  }

  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GH_TOKEN or GITHUB_TOKEN is required to post a PR comment.");
  }

  const directory = mkdtempSync(join(tmpdir(), "bondify-review-"));
  const bodyFile = join(directory, "comment.md");
  writeFileSync(bodyFile, body);

  const result = spawnSync("gh", ["pr", "comment", prNumber, "--body-file", bodyFile], {
    encoding: "utf8",
    env: { GH_TOKEN: token, PATH: process.env.PATH, HOME: process.env.HOME },
  });

  if (result.status !== 0) {
    throw new Error(`Failed to post PR comment: ${result.stderr || result.stdout}`);
  }

  return true;
}

async function writeOutputs(result, commented) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (!outputFile) {
    return;
  }

  await appendFile(
    outputFile,
    [`verdict=${result.verdict}`, `score=${result.score}`, `commented=${commented ? "true" : "false"}`].join("\n") +
      "\n",
  );
}

async function main() {
  const args = readArgs(process.argv.slice(2));
  const title = readValue({ args, argName: "title", envName: "PR_TITLE", fallback: "Untitled pull request" });
  const body = readValue({ args, argName: "body", envName: "PR_BODY" });
  const diff = readDiff(args);
  const prNumber = readValue({ args, argName: "pr-number", envName: "PR_NUMBER" });

  if (!diff.trim()) {
    throw new Error("A PR diff is required via REVIEW_DIFF_FILE, PR_DIFF, --diff-file, or --diff.");
  }

  const cappedTitle = title.slice(0, 500);
  const cappedBody = (body ?? "").slice(0, 2_000);
  const cappedDiff =
    diff.length > 100_000 ? diff.slice(0, 100_000) + "\n[... diff truncated at 100 000 bytes ...]" : diff;

  const template = readFileSync(new URL("../prompts/review.txt", import.meta.url), "utf8");
  const prompt = renderPrompt(template, { title: cappedTitle, body: cappedBody, diff: cappedDiff });
  const rawResponse = await callOpenRouter(prompt);
  const result = validateVerdict(parseJsonFromText(rawResponse));
  const comment = formatComment(result);
  const shouldComment = args["no-comment"] !== "true";
  const commented = shouldComment ? postComment({ body: comment, prNumber }) : false;

  console.log(JSON.stringify(result, null, 2));
  await writeOutputs(result, commented);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
