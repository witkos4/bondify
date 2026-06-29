<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: RLS Integration Suite Transient Resilience

- **Plan**: context/changes/integration-suite-transient-flakiness/plan.md
- **Scope**: All phases (Phase 1 + Phase 2)
- **Date**: 2026-06-29
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical | 1 warning | 3 observations

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

### F1 — Team orphaned when owner-membership insert fails

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (Data Safety)
- **Location**: tests/helpers/fixtures.ts:163-175
- **Detail**: `cleanup.registerTeam(teamId)` was placed after the membership insert. If the membership insert throws (after the team row already committed), the team is never registered for teardown — stale rows accumulate across CI runs.
- **Fix**: Move `cleanup.registerTeam(teamId)` to immediately after the team insert's error check, before the membership insert.
- **Decision**: FIXED + ACCEPTED-AS-RULE: Register Cleanup Before Secondary Inserts

### F2 — Unreachable throw after withRetry loop (dead code)

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Reliability)
- **Location**: tests/helpers/resilient.ts:59
- **Detail**: `throw new Error('withRetry exhausted ...')` after the loop is unreachable — every iteration returns or continues. Added for the TypeScript type checker but can mislead a reader.
- **Fix**: Add comment `// unreachable — every loop iteration returns or continues` to explain intent.
- **Decision**: FIXED

### F3 — Thrown exceptions from op() bypass the retry wrapper

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Reliability)
- **Location**: tests/helpers/resilient.ts (overall)
- **Detail**: `withRetry` awaits `op()` but does not catch thrown exceptions. If the Supabase JS client ever throws instead of returning `{ data, error }`, the exception propagates unretried. The client wraps most errors in the result object in practice, but this is an implicit assumption.
- **Fix**: Add comment noting this is intentional — catching throws would need separate classification logic without a PG code to discriminate on.
- **Decision**: FIXED

### F4 — `attempts < 1` guard in withRetry has no test coverage

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Reliability)
- **Location**: tests/helpers/resilient.test.ts
- **Detail**: All 6 planned test cases are implemented but the `if (attempts < 1) throw` guard on line 25 of resilient.ts has no coverage.
- **Fix**: Add a 7th test: `withRetry('x', op, 0)` should reject with the documented error message.
- **Decision**: FIXED
