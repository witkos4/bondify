# Frame Brief: RLS integration suite has no resilience to transient local-Supabase gateway errors

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

CI run `28336727030` (push of `534973e` to `main`) failed at the **Run unit +
integration tests** step. Exactly one test failed:

```
FAIL tests/rls/harness.test.ts > fixture harness >
     builds the standard two-team scenario through real RLS paths
Error: Failed to create team Bondify Test Team A 2f009e as owner-a-2f009e:
       An invalid response was received from the upstream server
  ❯ createTeamAs        tests/helpers/fixtures.ts:161:11
  ❯ setupTwoTeamScenario tests/helpers/scenario.ts:29:17
  ❯ tests/rls/harness.test.ts:13:22

Test Files  1 failed | 5 passed (6)
      Tests  1 failed | 19 passed (20)
```

Lint and build passed; Playwright steps were skipped because the test step exited 1.

## Initial Framing (preserved)

- **User's stated cause or approach**: "Fix the failing RLS harness test" — the
  defect lives in `harness.test.ts` or the team-insert path it exercises.
- **User's proposed direction**: Diagnose and fix so CI goes green.
- **Pre-dispatch narrowing**: User selected **"Not sure / haven't separated"** —
  they had not yet distinguished a one-off flake from a systemic resilience gap.
  Separating those two is the core deliverable of this brief.

## Dimension Map

The observation (`teams` insert returns a gateway "invalid response from upstream")
could originate at any of these dimensions:

1. **Harness/fixture logic bug** — `createTeamAs` or `setupTwoTeamScenario` builds
   a malformed request, or the harness test asserts wrongly.  ← initial framing
2. **RLS policy regression on `teams` insert** — `teams_insert_for_creator` changed
   or recursed, so the signed-in creator's insert is rejected.
3. **Transient infra flakiness under parallel load** — the local Supabase
   Kong/PostgREST gateway momentarily returned a 502-class "invalid response from
   upstream" under concurrent burst from parallel vitest files, and the fixtures
   have no retry to absorb it.
4. **Supabase stack not healthy / resource exhaustion in CI** — the stack wasn't
   warmed or the runner ran out of resources mid-run.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| **1. Harness/fixture logic bug** (initial framing) | `createTeamAs` (`tests/helpers/fixtures.ts:150-182`) is a single `teams` insert with `created_by: user.userId` mirroring production; the **same fixture** is used by `tests/rls/access-grants.test.ts` and `tests/rls/cross-team-denial.test.ts`, both **passed in this same run**. A logic bug would fail deterministically and in all three. | **NONE** |
| **2. RLS policy regression** | `teams_insert_for_creator` exists (`supabase/migrations/20260530090000_team_and_game_foundation.sql:228`) and is satisfied by the fixture; the insert demonstrably succeeded for `cross-team-denial` / `access-grants` in the same run. A policy rejection returns `violates row-level security policy` (a Postgres message), **not** a gateway "invalid response from upstream". No migration changed in `534973e`. | **NONE** |
| **3. Transient infra flakiness under parallel load** | Error string is a **Kong/PostgREST gateway** message, not RLS/SQL. `vitest.config.ts` sets **no** `fileParallelism: false` / pool cap → RLS files run in parallel (default forks) against one local stack; `cross-team-denial` alone runs 5.3s of concurrent writes. `createTeamAs` has **zero retry** (the only retry loop, `fixtures.ts:79`, is `waitForProfileRow` for the auth→profile trigger). Failing commit changed **only** skills/docs — code is byte-identical to 7 prior **passing** runs. | **STRONG** |
| **4. Stack unhealthy / resource exhaustion** | Build + 5 other test files (incl. 2 using the same insert) succeeded concurrently, so the stack was up and serving. Real, but a sub-facet of #3 (load-induced transient), not an independent root. | **WEAK** |

## Narrowing Signals

- The failing commit `534973e` touched **only** `.agents/skills`, prompts,
  templates, and docs — no `tests/`, `src/`, `supabase/`, or `ci.yml` change.
  The failing code path is identical to the immediately prior **passing** runs.
- `gh run list` shows the **previous 7 CI runs on `main` all succeeded** on this
  same path. This is the **first** occurrence — the signature of a flake, not a
  regression.
- Error is a **gateway** ("invalid response from upstream"), categorically
  different from an RLS denial or SQL error — it never reached policy evaluation
  cleanly.
- Same `createTeamAs` insert **succeeded twice** in sibling files in the same run.

## Cross-System Convention

Integration suites that drive a real database over an HTTP gateway (PostgREST/Kong)
universally treat sporadic 5xx/"upstream" responses as **expected transient noise**,
absorbed with bounded retry/backoff on idempotent setup writes and/or by bounding
test-file concurrency — not as assertion failures. This project already applies the
pattern selectively: `waitForProfileRow` (`fixtures.ts:79`) polls/retries the
auth→profile mirror. The leading hypothesis matches convention; the gap is that the
**write fixtures** (`createTeamAs`, `inviteToTeamAs`, `acceptInviteAs`, `openRoundAs`,
…) were not given the same resilience.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: the RLS integration suite has **no
> resilience to transient local-Supabase gateway errors** — a single non-deterministic
> 502-class "upstream" response on any setup write fails the whole CI run, because the
> write fixtures have no retry and vitest runs the RLS files in parallel against one
> local stack.

The initial framing ("fix the failing harness test") is **misframed**: `harness.test.ts`
is not defective and the team-insert RLS path is sound — both are proven by the same
fixture passing in two sibling files in the same run and by 7 prior green runs on
identical code. The failure is a property of the **suite's fragility**, not of that one
test. Fixing only `harness.test.ts` (or blindly re-running) would leave every other
setup write (`access-grants`, `cross-team-denial`, future RLS files) exposed to the
identical flake. Addressing the real problem — bounded retry on idempotent setup writes
and/or bounding RLS-file concurrency — makes the whole suite deterministic under load.

## Confidence

**HIGH** — strong, file:line-backed evidence for dimension 3 and **none** for the two
"real bug" dimensions; matches an established cross-system convention the project
already uses elsewhere; decisive narrowing signal (docs-only commit, 7 prior green runs,
gateway-class error, sibling files green).

**Confirmed by re-run (2026-06-29):** `gh run rerun 28336727030 --failed` →
attempt 2 passed (`success`) on byte-identical code; the previously failing
"Run unit + integration tests" step and full pipeline went green. The flake did
not reproduce — exactly what dimension 3 predicts and dimensions 1/2 would not.

## What Changes for /10x-plan

Plan should target **suite-wide transient resilience**, not a one-test fix: add bounded
retry/backoff to idempotent setup-write fixtures in `tests/helpers/fixtures.ts` (and/or
bound RLS-file concurrency via vitest pool settings), with a guard that retries only
gateway/transient errors and never masks a genuine RLS denial or SQL error. Re-running
CI to confirm green is a verification step, not the fix.

## References

- Failed run: https://github.com/witkos4/bondify/actions/runs/28336727030 (step "Run unit + integration tests")
- Source files: `tests/helpers/fixtures.ts:150-182` (`createTeamAs`), `tests/helpers/fixtures.ts:79` (only existing retry), `tests/helpers/scenario.ts:29`, `tests/rls/harness.test.ts:13`, `tests/helpers/clients.ts:27-34`, `vitest.config.ts`, `.github/workflows/ci.yml:45-46`
- RLS policy: `supabase/migrations/20260530090000_team_and_game_foundation.sql:228` (`teams_insert_for_creator`)
- Sibling passing tests using same fixture: `tests/rls/access-grants.test.ts`, `tests/rls/cross-team-denial.test.ts`
- Related lesson: `context/foundation/lessons.md` → "CI Configured Is Not CI Running"
- Investigation: conducted inline (small, already-read surface) — no sub-agents dispatched
