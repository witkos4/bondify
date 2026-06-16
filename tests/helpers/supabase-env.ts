import { execSync } from "node:child_process";
import process from "node:process";

const REQUIRED_SUPABASE_ENV = {
  API_URL: "BONDIFY_TEST_SUPABASE_URL",
  ANON_KEY: "BONDIFY_TEST_ANON_KEY",
  SERVICE_ROLE_KEY: "BONDIFY_TEST_SERVICE_ROLE_KEY",
} as const;

function parseSupabaseEnv(output: string) {
  const values: Record<string, string> = {};

  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const normalizedLine = line.startsWith("export ") ? line.slice("export ".length) : line;
    const separatorIndex = normalizedLine.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = normalizedLine.slice(0, separatorIndex).trim();
    const value = normalizedLine
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");

    if (key) {
      values[key] = value;
    }
  }

  return values;
}

function buildPreflightMessage(reason: string) {
  return ["Bondify test preflight failed.", reason, "Start Docker Desktop, then run: npx supabase start"].join("\n");
}

export function ensureLocalSupabaseTestEnv() {
  const missingTargetEnv = Object.values(REQUIRED_SUPABASE_ENV).some((name) => !process.env[name]);
  if (!missingTargetEnv) {
    return;
  }

  let rawEnv = "";

  try {
    rawEnv = execSync("npx supabase status -o env", {
      encoding: "utf8",
      shell: process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "/bin/sh",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 8000,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown supabase status failure.";
    throw new Error(buildPreflightMessage(`Unable to read local Supabase status.\n${detail}`));
  }

  const parsedEnv = parseSupabaseEnv(rawEnv);
  const missingKeys = Object.keys(REQUIRED_SUPABASE_ENV).filter((key) => !parsedEnv[key]);

  if (missingKeys.length > 0) {
    throw new Error(buildPreflightMessage(`Supabase status did not return required keys: ${missingKeys.join(", ")}`));
  }

  for (const [sourceKey, targetKey] of Object.entries(REQUIRED_SUPABASE_ENV)) {
    process.env[targetKey] = parsedEnv[sourceKey];
  }
}
