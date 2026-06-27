<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Certification Gap-Closure

- **Plan**: `context/changes/cert-progression-review/plan.md`
- **Mode**: Deep
- **Date**: 2026-06-27
- **Verdict**: REVISE → **SOUND** after triage (all 5 findings resolved 2026-06-27)
- **Findings**: 0 critical · 3 warnings · 2 observations — all FIXED

## Verdicts (post-triage)

| Dimension | At review | After fixes |
|-----------|-----------|-------------|
| End-State Alignment | PASS | PASS |
| Lean Execution | WARNING (F5) | PASS |
| Architectural Fitness | WARNING (F1) | PASS |
| Blind Spots | WARNING (F2, F4) | PASS |
| Plan Completeness | PASS (F3 minor) | PASS |

## Grounding

9/9 paths ✓, configs ✓ (`astro.config.mjs`, `astro.local.config.mjs`, `vitest.config.ts`, `playwright.config.ts`), brief↔plan ✓, Progress↔Phase ✓, contract-surfaces absent (skipped).

## Findings

### F1 — promptfoo gate tests a different artifact than the live pipeline

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 — steps 1 & 3
- **Detail**: The pipeline runs `claude-code-action` + the `10x-impl-review-ci` skill (markdown report with `- **Verdict**: …`), but the promptfoo gate evals a separate `prompts/review.txt` emitting JSON. The regression gate guards a prompt that never runs in CI; drift in the real skill/action goes uncaught. Playbook D presents these as alternative review implementations; the plan mixes them.
- **Fix A ⭐ Recommended**: Scope promptfoo as a standalone DoD-prompt sanity harness, documented as NOT wired to the action.
  - Strength: Matches Playbook D's example; low effort; honors the "include promptfoo" choice.
  - Tradeoff: Doesn't protect the live pipeline's behavior.
  - Confidence: HIGH — Playbook D shows promptfoo exactly this way.
  - Blind spot: None significant.
- **Fix B**: Make the pipeline invoke the same prompt promptfoo evals (custom review script).
  - Strength: One review implementation, genuinely regression-gated.
  - Tradeoff: Abandons the ready-made action+skill; large Phase 2 expansion.
  - Confidence: MED.
  - Blind spot: Untrusted-PR handling re-solved by hand.
- **Decision**: FIXED via Fix B — Phase 2 rebuilt around a custom `npm run review` script + `prompts/review.txt` that both the pipeline and promptfoo invoke.

### F2 — Phase 0 secret premise is off; build doesn't need the secrets

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 0 — step 3 / Success Criteria
- **Detail**: `astro.config.mjs:21-22` marks `SUPABASE_URL`/`SUPABASE_KEY` `optional: true`, so `npm run build` won't fail without them — the first CI run is likely green with no secrets. GitHub secrets matter only at the deployed Worker's runtime, which per AGENTS.md uses Cloudflare Workers Secrets/.dev.vars, not GitHub. The plan frames secret-setting as a CI-green prerequisite; it isn't.
- **Fix**: Reframe Phase 0 — expect first run green without secrets; treat secret provisioning as a runtime/deploy concern, not a build gate.
  - Strength: De-risks Phase 0; avoids provisioning unused GitHub secrets.
  - Tradeoff: None real.
  - Confidence: HIGH — env schema is explicit.
  - Blind spot: Confirm the deployed Worker sources creds from Cloudflare (manual).
- **Decision**: FIXED differently — Phase 0 step 3 reworked to "locate runtime cred source (Cloudflare vs GitHub) then set there"; premise corrected (build secrets optional, not a CI-green gate); success criterion + Progress 0.6 added.

### F3 — Phase 1 fallback names the wrong creds file for dev:local

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — step 4 (Playwright)
- **Detail**: `astro.local.config.mjs` has no Cloudflare adapter; `dev:local` reads SUPABASE_URL/KEY from `.env`/process.env, not `.dev.vars`. The plan's fallback "writes a .dev.vars" targets the wrong file; the `$GITHUB_ENV` export already feeds process.env.
- **Fix**: Correct the fallback to `.env`/process.env; drop the `.dev.vars` mention.
- **Decision**: FIXED — Phase 1 step 4 now states dev:local reads `.env`/process.env (no Cloudflare adapter); `.dev.vars` removed.

### F4 — Vitest + Playwright share one local DB in a single serial job

- **Severity**: 👁 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 — single-job structure
- **Detail**: `npm test` then `npm run test:e2e` hit the same `supabase start` instance in sequence. Both mint fixtures; §6.2 uses additive UUID fixtures + cleanup so collisions are unlikely, but the ordering coupling isn't isolated and a leaked fixture or shared catalog row could make Playwright flaky.
- **Fix**: Note the shared-DB ordering risk; confirm Playwright specs self-seed + clean up. Split into a separate test job only if flakiness appears.
- **Decision**: FIXED — shared-DB ordering risk + "split only if flaky" guidance added to Phase 1 step 4.

### F5 — Phase 2 sub-step order puts badge-optional work before badge-critical

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 2 — steps 3 (promptfoo) before 4 (demo PR)
- **Detail**: The Champion badge needs the demo PR evidence, not promptfoo. The plan builds promptfoo before the demo PR, so a deadline crunch would sacrifice the badge-critical step last.
- **Fix**: Reorder so the demo PR precedes promptfoo within Phase 2.
- **Decision**: FIXED — Phase 2 reordered: demo PR is now step 4, promptfoo step 5.
