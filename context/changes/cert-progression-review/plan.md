# Certification Gap-Closure Implementation Plan

## Overview

Close every remaining 10xDevs certification gap in dependency order so the project clears **Level 3 + the 10xChampion badge** by the 2026-07-05 submission. The work is one consolidated plan with four phases: repoint the dead CI trigger so CI runs at all (Phase 0), wire the test suite into the now-live CI (Phase 1), build the Champion CI/CD code-review pipeline (Phase 2), and finish three documentation fixes (Phase 3).

This plan **supersedes** `context/changes/cert-ci-test-gate/` — that plan's `npm test` steps are correct but it never fixed the branch trigger, so it would have been inert. Its content is folded into Phase 1.

## Current State Analysis

Verified 2026-06-27 against the live repo and GitHub API (see `frame.md`):

- **CI has never run.** `gh api .../actions/runs` returns `total_count: 0`. `.github/workflows/ci.yml` triggers on `branches: [master]`, but the repo's only branch is `main` (`origin/HEAD → main`; no `master` anywhere). The workflow is registered and active but has never fired.
- **No repo Actions secrets exist** (`gh secret list` is empty). The current build step references `secrets.SUPABASE_URL` / `secrets.SUPABASE_KEY`, which are unset — so the first real CI run may fail at build, and `OPENROUTER_API_KEY` (needed for Phase 2) is absent.
- **No branch protection on `main`** (`404 Branch not protected`).
- `ci.yml` runs `npm ci → npx astro sync → npm run lint → npm run build`. No `npm test`.
- Test suite is rich and passes locally: 6 Vitest integration files (`tests/**/*.test.ts`) + 2 new Playwright specs (`tests/browser/*.spec.ts`).
- `supabase` is a devDependency (`^2.101.0`) → `npx supabase start` works after `npm ci`.
- The `10x-impl-review-ci` skill is vendored in-repo at `.agents/skills/10x-impl-review-ci/` (and reachable via the `.claude/skills` junction) with a complete `references/workflow-template.yml`.
- README documents Cloudflare auto-deploy "from `master`" (lines 24, 38) — the same stale-branch mismatch.
- `lessons.md` has exactly 2 lessons; `AGENTS.md` has no "must NOT do" section; README has no screenshot.

### Key Discoveries:

- `vitest.config.ts:12` → `include: ["tests/**/*.test.ts"]`. `npm test` (`vitest run`) picks up only the 6 integration files; the Playwright `*.spec.ts` files run separately via `npm run test:e2e`. The two suites are independent in CI.
- `tests/setup/global.ts` → `ensureLocalSupabaseTestEnv()` short-circuits when `BONDIFY_TEST_SUPABASE_URL` / `BONDIFY_TEST_ANON_KEY` / `BONDIFY_TEST_SERVICE_ROLE_KEY` are already set (`tests/helpers/supabase-env.ts:43-47`) — CI only needs to inject those three; no test-helper changes.
- Playwright specs create users dynamically through the admin-client fixture helpers (`tests/browser/two-truths-round.spec.ts` uses `inviteToTeamAs`, `signInAs`); `supabase/seed.sql` seeds **no** auth users. So Playwright-in-CI needs: local Supabase up, the same `BONDIFY_TEST_*` creds the Vitest helpers use, the `dev:local` app server pointed at that same local Supabase (`SUPABASE_URL`/`SUPABASE_KEY`), and installed browsers.
- `playwright.config.ts` auto-starts the app via `webServer.command: npm run dev:local -- --host 127.0.0.1 --port 4323` with `reuseExistingServer: true`; baseURL `http://127.0.0.1:4323`.
- The skill template (`workflow-template.yml`) is **pnpm-based, gated on the `impl-review` label, uses a Claude Code Action flow, and pins actions to floating major tags** — Phase 2 adapts it to npm, the custom OpenRouter review script, and SHA pins. It mounts the skill from the PR's **base** branch into `$HOME/.claude/skills/` (user-level) because `claude-code-action@v1` quarantines the repo's `.claude/` from untrusted PR heads.

## Desired End State

- The `CI` workflow fires on every push/PR to `main`, runs `lint → build → Vitest → Playwright`, and is **green on `main`** (verifiable in the Actions tab; `gh run list` shows passing runs).
- An `AI Code Review` workflow runs a custom review script (OpenRouter API, default model `z-ai/glm-5.2`, prompt `prompts/review.txt`) against any PR labeled `ai-cr:review`, posts an LLM review comment + verdict label/status, and a dedicated demo PR has captured the three Champion-badge screenshots (pipeline view + job logs + review comment).
- A promptfoo regression gate (`promptfooconfig.yaml` + fixtures) exercises the **same** `prompts/review.txt` and passes via `npx promptfoo eval`.
- `lessons.md` has ≥3 lessons; `AGENTS.md` ends with a "must NOT do" section; README shows the shared-reveal screenshot and points to `main`.
- The Cloudflare Workers Builds branch is confirmed (manually) to watch `main`.

Verify: open the Actions tab → `CI` green on `main`; open the demo PR → review comment + `impl-review-ci/verdict` status present; `npx promptfoo eval` exits green; `lessons.md` shows 3 entries.

## What We're NOT Doing

- **Not** making any check a _required_ merge-blocking gate (no branch-protection rule) before submission — the verdict status is posted but advisory; revisit after 2026-07-05.
- **Not** migrating history to a `master` branch — `main` is the canonical default.
- **Not** auto-reviewing every PR — the Champion pipeline stays gated on the `ai-cr:review` label to control cost.
- **Not** adding Phase 2/3 of the test-plan rollout (game-rule, owner-action test phases) — separate changes.
- **Not** changing the existing test code or `vitest.config.ts` — only wiring it into CI.
- **Not** caching the Supabase Docker images in this pass (a later optimization).

## Implementation Approach

Strictly sequence the prerequisite (Phase 0) first: until the trigger points at `main` and the first run is green, nothing else CI-related is observable. Phases 1 and 2 touch disjoint files (`ci.yml` vs `review.yml` + review script + promptfoo) and may proceed in parallel after Phase 0, but each commits separately. Phase 3 is independent doc work that can land anytime. All third-party GitHub Actions are SHA-pinned (cert requirement + supply-chain hygiene). Manual prerequisites (secrets, Cloudflare branch, screenshots) are called out explicitly per phase.

## Critical Implementation Details

- **Timing & lifecycle (Phase 1):** the credential-injection step must run _after_ `supabase start` (the stack must be up to emit `supabase status -o env`) and _before_ both `npm test` and `npm run test:e2e`. Writing the vars to `$GITHUB_ENV` makes them visible to all later steps, including the Playwright `webServer` that boots `dev:local`. The app server reads `SUPABASE_URL`/`SUPABASE_KEY` via `astro:env`; the test helpers read `BONDIFY_TEST_*` — both must be exported from the local stack's values, not the production secrets.
- **Diff range (Phase 2):** the review workflow must checkout with `fetch-depth: 0` and diff with the three-dot range `origin/${base}...HEAD` — a shallow checkout leaves nothing to diff against, and the two-dot range includes unrelated base-branch churn.
- **Cost guard (Phase 2):** the review script makes a single bounded OpenRouter chat-completions call (capped `max_tokens`, no agent loop). On CI, cost multiplies per PR — never run an unbounded loop. The `ai-cr:review` label gate is the second cost control.
- **First-run fragility (Phase 0):** because CI has literally never run, treat the first green run as a real deliverable, not a formality. The build's Supabase secrets are optional (`astro.config.mjs:21-22`), so missing secrets should NOT redden it — but other latent issues (lint, `astro sync`, the Cloudflare adapter) could surface for the first time.

---

## Phase 0: Repoint CI to `main` and drive the first green run

### Overview

Make CI actually execute on the default branch and reach a green `lint`+`build` baseline — the true Level 1.6 gate. This is the prerequisite for everything else.

### Changes Required:

#### 1. CI trigger branch

**File**: `.github/workflows/ci.yml`

**Intent**: Point the `push` and `pull_request` triggers at the branch that actually exists so the workflow fires.

**Contract**: `branches: [master]` → `branches: [main]` in both the `push` and `pull_request` blocks (lines 5 and 7). No other trigger changes.

#### 2. README branch references

**File**: `README.md`

**Intent**: Make the deployment docs match reality (`main`, not `master`).

**Contract**: Update the `master` references in "Current Status" (line 24) and "Deployment Model" (line 38) to `main`. Prose only.

#### 3. Locate where runtime secrets belong, then set them there (manual)

**Intent**: The build does NOT require `SUPABASE_URL`/`SUPABASE_KEY` (`astro.config.mjs:21-22` → `optional: true`), so they are not a CI-green prerequisite — the first run should go green without them. They matter at the deployed Worker's runtime; provision them where that runtime actually reads them.

**Contract**: Confirm the deploy path first. Per README, ongoing deploys run via Cloudflare Workers Builds (Git integration), not a GitHub deploy job — so runtime creds belong in **Cloudflare** (Workers Secrets / Workers Builds env), and the `secrets.SUPABASE_URL`/`SUPABASE_KEY` referenced in `ci.yml`'s build `env:` are optional/inert (build-only, optional schema). Set the creds in the confirmed location (values supplied by the user) and record the finding in `change.md`. Do **not** treat secret-setting as a blocker for the first green CI run.

### Success Criteria:

#### Automated Verification:

- `gh run list --branch main` shows at least one `CI` run after the push
- The latest `CI` run on `main` concludes `success` (`gh run view <id>`)
- `lint` and `build` steps both green in that run

#### Manual Verification:

- In the Cloudflare dashboard, the Workers Builds / Git integration branch is confirmed to watch `main` (not `master`); a push to `main` produces a deployment
- The live URL `https://bondify.witkos4.workers.dev` still serves the app after a `main` push
- Runtime cred source confirmed (Cloudflare Workers Builds vs GitHub secrets); `SUPABASE_URL`/`SUPABASE_KEY` set in the correct place

**Implementation Note**: After automated verification passes, pause for human confirmation of the Cloudflare branch + live-URL check before Phase 1.

---

## Phase 1: Wire the test suite into CI

### Overview

Append the Vitest integration suite **and** the Playwright E2E specs to the single `ci` job behind a local Supabase stack, and SHA-pin the existing actions. Closes Level 1.5, 1.6 (tests green), and 2.D. Folds in `cert-ci-test-gate`.

### Changes Required:

#### 1. SHA-pin existing actions

**File**: `.github/workflows/ci.yml`

**Intent**: Pin floating major tags to immutable SHAs (cert requirement + supply-chain hygiene).

**Contract**: `actions/checkout@v4` and `actions/setup-node@v4` → their SHA equivalents with a trailing `# vX.Y.Z` comment. Resolve current SHAs at implementation time (`gh api repos/actions/checkout/git/refs/tags/<tag>`).

#### 2. Supabase stack + credential injection

**File**: `.github/workflows/ci.yml`

**Intent**: Bring up the full local Supabase stack (Auth + PostgREST + DB, migrations + seed applied) and expose its credentials under the names the test helpers and the app server expect.

**Contract**: After `npm run build`, add steps: (a) `npx supabase start` (blocks until healthy; CLI comes from the devDependency); (b) a step that reads `supabase status -o env` and writes to `$GITHUB_ENV`: `BONDIFY_TEST_SUPABASE_URL`←`API_URL`, `BONDIFY_TEST_ANON_KEY`←`ANON_KEY`, `BONDIFY_TEST_SERVICE_ROLE_KEY`←`SERVICE_ROLE_KEY`, and **also** `SUPABASE_URL`←`API_URL`, `SUPABASE_KEY`←`ANON_KEY` (so the `dev:local` app server the Playwright run boots talks to the same stack). Use `cut -d= -f2-` to preserve `=` in JWTs.

```bash
STATUS=$(supabase status -o env 2>/dev/null)
get() { echo "$STATUS" | grep "^$1=" | cut -d= -f2-; }
{
  echo "BONDIFY_TEST_SUPABASE_URL=$(get API_URL)"
  echo "BONDIFY_TEST_ANON_KEY=$(get ANON_KEY)"
  echo "BONDIFY_TEST_SERVICE_ROLE_KEY=$(get SERVICE_ROLE_KEY)"
  echo "SUPABASE_URL=$(get API_URL)"
  echo "SUPABASE_KEY=$(get ANON_KEY)"
} >> "$GITHUB_ENV"
```

#### 3. Vitest step

**File**: `.github/workflows/ci.yml`

**Intent**: Run the integration suite.

**Contract**: `- name: Run unit + integration tests` → `run: npm test`. Placed after credential injection.

#### 4. Playwright step

**File**: `.github/workflows/ci.yml`

**Intent**: Run the browser E2E specs; Playwright's `webServer` auto-boots `dev:local` against the local stack.

**Contract**: Two steps after Vitest: `npx playwright install --with-deps chromium`, then `npm run test:e2e`. The `dev:local` server (`astro.local.config.mjs`, no Cloudflare adapter) reads `SUPABASE_URL`/`SUPABASE_KEY` from `process.env`/`.env` via Vite, so the `$GITHUB_ENV` export from step 2 already feeds it — no `.dev.vars` needed (that's the Cloudflare `npm run dev` mechanism). **Risks to verify:** (a) the booted dev server actually inherits the injected env (Playwright `webServer` runs under the job env) — if not, write a `.env` from the same values; (b) Vitest and Playwright share the one `supabase start` instance (Vitest runs first), so confirm the specs self-seed + clean up — they use additive UUID fixtures per test-plan §6.2, so order-coupling shouldn't cause flakiness; split Playwright into its own job only if it does.

#### 5. Test-plan + change-record updates

**Files**: `context/foundation/test-plan.md`, `context/changes/cert-ci-test-gate/change.md`, `context/changes/testing-regression-guardrails/change.md` (if open)

**Intent**: Make the docs match the new CI reality and retire the superseded change.

**Contract**: `test-plan.md` §3 Phase 4 status → `complete` (change folder = this plan); §4 e2e row → "wired into CI (Playwright/chromium)"; fill §6.5 cookbook with the `supabase start` + cred-injection recipe. `cert-ci-test-gate/change.md` frontmatter → `status: superseded` with a note pointing to `cert-progression-review`.

### Success Criteria:

#### Automated Verification:

- The `CI` run on `main` is green with `Run unit + integration tests` showing all 6 Vitest files passing
- The Playwright step shows `two-truths-round.spec.ts` and `emoji-check-in-picker.spec.ts` passing
- `lint` and `build` still pass (no regression)

#### Manual Verification:

- Expand the CI job log → Vitest reports test counts (not just exit 0) and Playwright reports chromium results
- `test-plan.md` §3 Phase 4 reads `complete`; §6.5 is a usable recipe
- `cert-ci-test-gate/change.md` shows `superseded`

**Implementation Note**: Pause for human confirmation that the full job (incl. Playwright) is green before relying on it as the cert evidence.

---

## Phase 2: Champion CI/CD code-review pipeline

### Overview

Stand up an LLM PR-review pipeline (Level 3.B + Champion badge) built around a **single custom review prompt** that both the GHA pipeline and promptfoo invoke — so the regression gate actually guards the behavior that ships. Capture badge evidence from a dedicated demo PR. (We take Playbook D's custom-script path rather than the ready-made `claude-code-action`+skill, so the prompt under test is the prompt in production — see F1 in the plan review.)

### Changes Required:

#### 1. Review prompt (single source of truth)

**File**: `prompts/review.txt` (new)

**Intent**: The one prompt the pipeline applies and promptfoo regression-tests — no parallel copy.

**Contract**: A template taking PR title/body/diff and instructing a strict JSON verdict: `{ verdict: "APPROVED"|"NEEDS ATTENTION"|"REJECTED", score: 1-10, findings: [{severity, file, detail}] }`. Criteria with "1"/"10" anchors: correctness, idiomatic style, complexity, test/risk coverage, docs, security.

#### 2. Review script

**File**: `scripts/review.mjs` (new) + a `review` entry in `package.json` scripts

**Intent**: The runnable reviewer the workflow executes and that emits the PR comment + verdict.

**Contract**: `npm run review` reads PR title/body/diff from env/args, calls OpenRouter's OpenAI-compatible chat completions API with default model `z-ai/glm-5.2` and `prompts/review.txt`, parses the JSON verdict, posts a PR comment via `gh`, and writes the verdict to `$GITHUB_OUTPUT`. A hard cap (bounded `max_tokens`, a single non-looping call — no unbounded agent loop) guards per-PR cost. Reads `OPENROUTER_API_KEY`, `GH_TOKEN`.

#### 3. Review workflow

**File**: `.github/workflows/review.yml` (new)

**Intent**: Run the review script on labeled PRs to `main`.

**Contract**: Trigger `pull_request: [opened, synchronize, reopened, labeled]` on `main` (gated on the `ai-cr:review` label) plus `workflow_dispatch` for label-free testing. Steps: `actions/checkout` (`fetch-depth: 0`); `actions/setup-node` (node `26.2.0`, `cache: npm`); `npm ci`; compute the diff with the three-dot range `git diff origin/${{ github.base_ref }}...HEAD`; `npm run review` with PR title/body/diff in env; a final step mapping the verdict output to labels (`ai-cr:passed`/`ai-cr:failed`) and a **non-blocking** commit status. **Every `uses:` SHA-pinned.** `permissions`: `contents: read`, `pull-requests: write`, `statuses: write`.

#### 4. Demo PR for badge evidence (manual)

**Intent**: Deterministically exercise the pipeline and capture the three Champion screenshots — the badge-critical deliverable, done before the optional promptfoo gate.

**Contract**: Open a throwaway PR to `main` with a trivial change, add the `ai-cr:review` label, let `review.yml` run, then screenshot: (a) the Actions pipeline view, (b) the `review` job logs, (c) the posted LLM review comment + verdict label/status. Save under `context/changes/cert-progression-review/evidence/`. Close the demo PR afterward.

#### 5. promptfoo regression gate (wired to the live prompt)

**Files**: `promptfooconfig.yaml`, `fixtures/*.diff` (new)

**Intent**: Regression-test the **same** `prompts/review.txt` the pipeline runs, against fixture diffs (Playbook D step 8). Badge-optional — landed after the demo PR so a deadline crunch sheds it last.

**Contract**: `promptfooconfig.yaml` references `file://prompts/review.txt`, declares the OpenRouter provider `openrouter:z-ai/glm-5.2`, and defines ≥2 tests: `fixtures/sql-injection.diff` asserting `is-json` + `llm-rubric` (rejects + flags the injection) + `javascript: JSON.parse(output).score <= 3`; a clean-diff fixture asserting an APPROVED-shaped verdict. Run `npx promptfoo eval` with `OPENROUTER_API_KEY` (manual prereq, documented in `change.md`). Default absolute threshold; document the `PROMPTFOO_PASS_RATE_THRESHOLD` escape hatch.

### Success Criteria:

#### Automated Verification:

- `npm run review` runs end-to-end against a sample diff locally and emits a parseable JSON verdict
- `npx promptfoo eval` exits green against the fixtures (the same `prompts/review.txt` the pipeline uses)
- `review.yml` is active (`gh workflow view "AI Code Review"`)
- Every `uses:` in `review.yml` is pinned to a 40-char SHA (`grep -E 'uses:.*@[0-9a-f]{40}'` covers all)

#### Manual Verification:

- On the demo PR, the review posts a comment with a verdict + per-file findings, and the verdict label/status appears
- The three badge screenshots are captured and saved under `evidence/`
- The review comment quality is acceptable (GLM 5.2 output reads as a real review, not a stub)

**Implementation Note**: Pause for human confirmation after the demo PR run — the screenshots are the badge deliverable and need a human eye.

---

## Phase 3: Documentation fixes

### Overview

Three small edits closing Level 3.C, 3.D, 3.E.

### Changes Required:

#### 1. Third lesson

**File**: `context/foundation/lessons.md`

**Intent**: Capture the load-bearing lesson from this work.

**Contract**: Append a lesson "CI Configured Is Not CI Running" in the existing Context/Problem/Rule shape: a registered workflow can show 0 runs because its trigger branch doesn't match the repo's default branch; verify with `gh run list` / `actions/runs` `total_count`, not by the presence of a workflow file. Link `[[default-to-local-verification-after-user-facing-auth-and-shell-changes]]` style if applicable.

#### 2. AGENTS.md "must NOT do" section

**File**: `AGENTS.md`

**Intent**: Give the U-shaped doc a critical-constraints anchor at the very bottom (Level 3.D).

**Contract**: Add a `## What AI agents must NOT do` section **after** the `<!-- END @przeprogramowani/10x-cli -->` marker (so the CLI-managed block doesn't clobber it). 4–6 imperative bullets drawn from real repo constraints (e.g., never commit secrets to `.mcp.json`/repo; never disable RLS or weaken policies to make a test pass; never add `page.waitForTimeout`; never push to `main` without a green CI run; never unpin a GitHub Action from its SHA).

#### 3. README screenshot

**File**: `README.md` (+ image asset)

**Intent**: Demo-day readiness (Level 3.E).

**Contract**: Capture the shared-reveal moment (the core product moment per PRD) as a PNG/GIF, commit it under `docs/` or `public/`, and embed it in the README near "Product Summary". Manual capture against the running app.

### Success Criteria:

#### Automated Verification:

- `lessons.md` contains 3 `## ` lesson headings
- `AGENTS.md` contains a "must NOT do" heading after the CLI END marker
- The README image path resolves (file exists in the repo)

#### Manual Verification:

- The screenshot/GIF clearly shows the shared-reveal screen
- The 3rd lesson reads as a genuine, reusable rule

**Implementation Note**: The README screenshot needs the running app and a human capture.

---

## Testing Strategy

### Integration Tests:

The existing Vitest suite (`smoke`, `harness`, `access-grants`, `cross-team-denial`, `bondify-compatibility`, `emoji-check-in-picker.contract`) is the verification for Phase 1's CI wiring — its green run in CI _is_ the deliverable.

### E2E Tests:

`tests/browser/two-truths-round.spec.ts` and `emoji-check-in-picker.spec.ts` run under Playwright/chromium in CI against `dev:local`.

### Manual Testing Steps:

1. Push to `main`; confirm the `CI` run is green end-to-end (lint, build, Vitest, Playwright).
2. Open the demo PR with the `impl-review` label; confirm the review comment + verdict status appear.
3. Run `npx promptfoo eval`; confirm green.
4. Confirm the live URL still deploys from a `main` push.

## Migration Notes

`cert-ci-test-gate` is superseded, not deleted — its `change.md` is stamped `superseded` and points here; its plan stays as history.

## References

- Frame brief: `context/changes/cert-progression-review/frame.md`
- Superseded plan (folded in): `context/changes/cert-ci-test-gate/plan.md`
- Cert gate matrix + Playbook D: `context/foundation/checkup.md`
- Champion pipeline path: Playbook D steps 1–5 + 8 (custom review script + promptfoo) in `context/foundation/checkup.md`. The in-repo `.agents/skills/10x-impl-review-ci/references/workflow-template.yml` is retained as reference only — not used (see plan-review F1, Fix B).
- Test plan: `context/foundation/test-plan.md` (§3 Phase 4, §4, §6.5)
- CI workflow (0 runs, triggers `master`): `.github/workflows/ci.yml`
- Vitest config: `vitest.config.ts:12`; Playwright config: `playwright.config.ts`
- Test env helper: `tests/helpers/supabase-env.ts:43-47`; global setup: `tests/setup/global.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 0: Repoint CI to `main` and drive the first green run

#### Automated

- [x] 0.1 `gh run list --branch main` shows a `CI` run after the push
- [x] 0.2 Latest `CI` run on `main` concludes `success`
- [x] 0.3 `lint` and `build` steps green in that run

#### Manual

- [ ] 0.4 Cloudflare Workers Builds branch confirmed to watch `main`; push produces a deploy
- [x] 0.5 Live URL still serves the app after a `main` push
- [ ] 0.6 Runtime cred source confirmed; `SUPABASE_URL`/`SUPABASE_KEY` set in the correct location

### Phase 1: Wire the test suite into CI

#### Automated

- [x] 1.1 CI green with all 6 Vitest files passing in `Run unit + integration tests`
- [x] 1.2 Playwright step shows both `*.spec.ts` files passing
- [x] 1.3 `lint` and `build` still pass (no regression)

#### Manual

- [x] 1.4 Job log shows real Vitest test counts + chromium results
- [x] 1.5 `test-plan.md` §3 Phase 4 = `complete`; §6.5 recipe usable
- [x] 1.6 `cert-ci-test-gate/change.md` shows `superseded`

### Phase 2: Champion CI/CD code-review pipeline

#### Automated

- [ ] 2.1 `npm run review` runs end-to-end against a sample diff and emits a parseable JSON verdict
- [ ] 2.2 `npx promptfoo eval` exits green against fixtures (same `prompts/review.txt`)
- [x] 2.3 `review.yml` is active (`gh workflow view "AI Code Review"`)
- [x] 2.4 Every `uses:` in `review.yml` pinned to a 40-char SHA

#### Manual

- [ ] 2.5 Demo PR: review posts comment with verdict + per-file findings + verdict label/status
- [ ] 2.6 Three badge screenshots saved under `evidence/`
- [ ] 2.7 Review comment quality acceptable (real review, not a stub)

### Phase 3: Documentation fixes

#### Automated

- [x] 3.1 `lessons.md` has 3 lesson headings
- [x] 3.2 `AGENTS.md` has a "must NOT do" heading after the CLI END marker
- [x] 3.3 README image path resolves (file exists)

#### Manual

- [x] 3.4 Screenshot/GIF clearly shows the shared-reveal screen
- [x] 3.5 3rd lesson reads as a genuine, reusable rule
