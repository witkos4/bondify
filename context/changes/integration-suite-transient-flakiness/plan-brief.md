# RLS Integration Suite Transient Resilience — Plan Brief

> Full plan: `context/changes/integration-suite-transient-flakiness/plan.md`
> Frame brief: `context/changes/integration-suite-transient-flakiness/frame.md`

## What & Why

Make the RLS integration suite resilient to transient local-Supabase gateway
errors, so a single non-deterministic 502-class "An invalid response was received
from the upstream server" on a setup call no longer fails the whole CI run —
without ever masking a genuine RLS/SQL denial. (The frame proved the harness test
and RLS policies are sound; the failure is the suite's fragility, not a bug.)

## Starting Point

Every RLS test routes setup/teardown through `tests/helpers/fixtures.ts` (12
PostgREST calls) and `tests/helpers/cleanup.ts`, none of which retry except one
poll loop. A parallel vitest run drives all RLS files against one local stack;
under that burst a Kong/PostgREST gateway blip threw at `createTeamAs` and failed
CI. Real denials in this suite always carry a PostgREST `code` (`42501`) — the
transient carried none.

## Desired End State

A transient blip during setup/teardown is retried (with a visible `console.warn`)
and the suite passes deterministically; a real denial or SQL error still fails
immediately and loudly. Full parallelism is retained.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Root cause | Transient flake, not a test/RLS bug | Same fixture passed in 2 sibling files in the same run; 7 prior green runs on identical code | Frame |
| Mechanism | Fixture-level `withRetry()` wrapper | Surgical, keeps full parallelism and fast green runs, never re-runs assertions | Plan |
| Classifier | Retry only when error has **no** PostgREST `code` | Real denials are always coded (`42501`), so they're structurally excluded from retry | Plan |
| Idempotency | `23505` after a transient retry → success | A 502 may have committed; pre-generated UUIDs mean a dup is our own prior insert | Plan |
| Wrap scope | `fixtures.ts` + `cleanup.ts`, reads + writes | The shared setup/teardown path every RLS file uses; one change covers all | Plan |
| Budget | 3 attempts, ~100/200/400ms backoff + jitter | Absorbs a blip (<1s added worst case) while failing fast on a real outage | Plan |
| Observability | `console.warn` on each retry | Keeps gateway flake rate visible instead of silently absorbed | Plan |
| Testing | DB-free unit test of classifier + wrapper | Deterministically proves retry fires and masking is prevented | Plan |

## Scope

**In scope:** new `tests/helpers/resilient.ts` (`withRetry`); its unit test
`tests/helpers/resilient.test.ts`; wrapping all PostgREST calls in `fixtures.ts`
and the delete in `cleanup.ts`.

**Out of scope:** `vitest.config.ts`/concurrency changes; vitest or CI step
retry; production/RLS/migration/`src` changes; wrapping inline test-body writes;
a client-layer wrapper; fault-injection tests.

## Architecture / Approach

One helper, `withRetry(label, opThunk)`, wraps a thunk that builds a fresh
PostgREST query per attempt. It returns on success; retries only no-code
(gateway/network) errors with bounded backoff; coerces a `23505` to success only
when a prior transient already fired; and surfaces every coded error (incl.
`42501`) immediately. Phase 1 builds and unit-tests it DB-free; Phase 2 wires it
into the helper call-sites with no happy-path behavior change.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Helper + unit tests | `withRetry` + classifier, proven by a DB-free mock test | Classifier wrong → masks real errors (mitigated by the unit test asserting `42501` is never retried) |
| 2. Apply to fixtures + cleanup | All PostgREST calls in the shared helpers routed through `withRetry` | Wrapping a read breaks an assertion path (mitigated: code-absence gate preserves coded errors; full suite must stay green) |

**Prerequisites:** local Supabase stack (`npx supabase start`) for Phase 2's
integration run; Docker available.
**Estimated effort:** ~1 session across 2 phases.

## Open Risks & Assumptions

- Assumes supabase-js@2.99.1 leaves `error.code` empty for gateway/network
  failures (basis for the classifier). If a future transient arrives *with* a
  code, it won't be retried — visible as a re-emerged flake, then add that code
  to an explicit transient list.
- Assumes fixtures keep supplying explicit unique ids (they do), which is what
  makes the `23505`-as-success coercion sound.

## Success Criteria (Summary)

- The previously failing CI "Run unit + integration tests" step passes green.
- A real RLS denial still fails its test immediately (proven by the unit test and
  by `cross-team-denial.test.ts` staying green).
- `Retrying ...` warnings (when they appear) keep gateway flakiness visible.
