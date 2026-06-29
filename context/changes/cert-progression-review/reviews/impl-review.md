<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Certification Gap-Closure

- **Plan**: context/changes/cert-progression-review/plan.md
- **Scope**: All phases (0–3)
- **Date**: 2026-06-29
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical | 3 warnings | 3 observations

## Verdicts

| Dimension | Verdict |
|---|---|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Prompt injection via unsanitized PR title/body/diff

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (Security)
- **Location**: scripts/review.mjs:51-55
- **Detail**: `renderPrompt()` substituted `{{ title }}`, `{{ body }}`, `{{ diff }}` verbatim with no length caps. PR author could embed adversarial instructions to override the model's verdict.
- **Fix A ⭐ Recommended**: Add per-field length caps (title 500, body 2000, diff 100 000 bytes) in `main()` before `renderPrompt()`; wrap diff in `<diff>` XML tags in the prompt template with an instruction to treat it as untrusted data.
- **Decision**: FIXED + ACCEPTED-AS-RULE: Sanitize User-Controlled Input Before Embedding In LLM Prompts

### F2 — Unbounded diff size — no truncation before API call

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (Performance / Cost)
- **Location**: scripts/review.mjs:43-48
- **Detail**: `readDiff()` read the diff in full with no size limit. An oversized diff can exceed the model's context window.
- **Fix**: Add 100 000-byte truncation guard in `main()` before `renderPrompt()`.
- **Decision**: SKIPPED — covered by F1 fix (100k cap applied in `main()` before rendering)

### F3 — issues:write overpermission in review.yml

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Security)
- **Location**: .github/workflows/review.yml:25
- **Detail**: `issues: write` listed in permissions but the workflow only uses `pull-requests: write` and `statuses: write`. Unnecessary blast-radius widening for GITHUB_TOKEN.
- **Fix**: Remove `issues: write` from the job permissions block.
- **Decision**: FIXED

### F4 — Full OpenRouter error body logged to console

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Security)
- **Location**: scripts/review.mjs:134-135
- **Detail**: Full OpenRouter response body included in thrown error; can reveal rate-limit or quota details in public CI logs.
- **Fix**: `(await response.text()).slice(0, 500)`.
- **Decision**: FIXED

### F5 — Full process.env spread into gh subprocess

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Security)
- **Location**: scripts/review.mjs:184
- **Detail**: `spawnSync("gh", ..., { env: { ...process.env, GH_TOKEN } })` passed `OPENROUTER_API_KEY`, `PR_BODY` etc. to the subprocess unnecessarily.
- **Fix**: Pass only `{ GH_TOKEN: token, PATH: process.env.PATH, HOME: process.env.HOME }`.
- **Decision**: FIXED

### F6 — No step timeout on npx supabase start in ci.yml

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Reliability)
- **Location**: .github/workflows/ci.yml (Start local Supabase stack step)
- **Detail**: `npx supabase start` had no step-level `timeout-minutes`. A hung Docker pull consumes the full 6-hour runner timeout.
- **Fix**: Add `timeout-minutes: 5` to the step.
- **Decision**: FIXED
