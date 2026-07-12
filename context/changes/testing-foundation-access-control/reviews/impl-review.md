<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Test Foundation + Access-Control Critical Path

- **Plan**: context/changes/testing-foundation-access-control/plan.md
- **Scope**: All phases (1–5)
- **Date**: 2026-06-29
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical | 4 warnings | 2 observations

## Verdicts

| Dimension | Verdict |
|---|---|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — global.ts delegates to supabase-env.ts from a sibling change

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: tests/setup/global.ts
- **Detail**: The env-acquisition logic (supabase status parsing, Docker fail-fast diagnostic) lives in `tests/helpers/supabase-env.ts` which belongs to the `testing-regression-guardrails` sibling change. `global.ts` is a 3-line delegate. Functionally correct but creates an undocumented cross-change dependency.
- **Fix A ⭐**: Accept the extraction; document the dependency in `change.md`.
- **Decision**: FIXED via Fix A — dependency noted in change.md

### F2 — waitForProfileRow uses a manual loop instead of withRetry

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (Reliability)
- **Location**: tests/helpers/fixtures.ts:80-98
- **Detail**: 10×100ms hard-coded polling window (1 second total). Under CI load, trigger-created profile rows may not appear in time. Error message had no context on attempt count. Inconsistent with the `withRetry` pattern elsewhere.
- **Fix**: Raise to 20 attempts × 250ms (5 seconds total); expose as named constants; include counts in error message.
- **Decision**: FIXED

### F3 — Hardcoded team name (no UUID suffix) in access-grants.test.ts

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Test Isolation)
- **Location**: tests/rls/access-grants.test.ts:29
- **Detail**: `"Bondify Test Team A Second"` hardcoded with no UUID suffix. All other team names in the suite use UUID suffixes. Repeated runs could collide if a unique constraint exists.
- **Fix**: Append `randomUUID().slice(0, 6)` suffix.
- **Decision**: FIXED

### F4 — supabase-env.ts early-exit overwrites manually-set env vars

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Reliability)
- **Location**: tests/helpers/supabase-env.ts:44-72
- **Detail**: All-or-nothing guard: if any of the three `BONDIFY_TEST_*` vars is missing, calls `supabase status` and overwrites ALL three — including any that were already set. Partial pre-configuration is silently clobbered.
- **Fix**: Document the all-or-nothing contract with a comment.
- **Decision**: FIXED

### F5 — harness.test.ts has setup in it() body instead of beforeAll

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: tests/rls/harness.test.ts:12-13
- **Detail**: `setupTwoTeamScenario()` called inside `it()` body. `access-grants.test.ts` uses `beforeAll`. A future contributor adding a second test will have a scoping bug.
- **Fix**: Extract to `beforeAll`, declare `scenario` at suite scope.
- **Decision**: FIXED

### F6 — smoke.test.ts reimplements requireEnv locally (partial duplicate)

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: tests/rls/smoke.test.ts:11-19
- **Detail**: Local `requireEnv` partially duplicates `clients.ts` canonical version, missing `ANON_KEY` in the type union. Creates two maintenance points.
- **Fix**: Import `adminClient` from `../helpers/clients` instead of raw `createClient`.
- **Decision**: FIXED
