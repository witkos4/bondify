# RLS Integration Suite Transient Resilience Implementation Plan

## Overview

The RLS integration suite has no resilience to transient local-Supabase gateway
errors: a single non-deterministic 502-class "An invalid response was received
from the upstream server" on any setup call fails the whole CI run (frame brief:
`context/changes/integration-suite-transient-flakiness/frame.md`). This plan adds
a bounded, transient-only retry wrapper to the shared test helpers so those blips
are absorbed — while **structurally guaranteeing** a real RLS/SQL denial is never
masked.

## Current State Analysis

- `tests/helpers/fixtures.ts` performs 12 PostgREST calls (reads + writes) that
  every RLS test routes through; none retry except `waitForProfileRow`
  (`fixtures.ts:79`, a poll loop for the auth→profile mirror trigger).
- `createTeamAs` (`fixtures.ts:150-182`) is the demonstrated failure site: a
  single `teams` insert that throws on the first error.
- `tests/helpers/cleanup.ts` deletes teams/users best-effort (warns, does not
  throw) — also unguarded against a transient.
- Real RLS denials in this suite **always carry a PostgREST `code`**:
  `tests/rls/cross-team-denial.test.ts:64-66,187` assert `error.code === "42501"`
  (insufficient_privilege). The transient gateway failure carried **no** code —
  it is a Kong/fetch-level error, not a Postgres error. This is the clean
  discriminator the classifier relies on.
- `vitest.config.ts` runs test files in parallel (default forks, no concurrency
  cap) against one local stack — this is the load that surfaces the transient.
  We are intentionally **keeping** full parallelism (retry is the fix, not
  serialization).
- `@supabase/supabase-js@^2.99.1`. PostgREST results are `{ data, error }` where
  `error` is a `PostgrestError` (`{ message, details, hint, code }`) for
  DB/PostgREST failures; gateway/network failures surface with an empty/absent
  `code`.

### Key Discoveries:

- Code-absence is a structural safety gate: `cross-team-denial.test.ts:64`
  proves denials are coded (`42501`), so "retry only when `!error.code`" can
  never retry — or mask — a denial.
- Fixture inserts use **pre-generated UUIDs** (`randomUUID()` at each call site,
  e.g. `fixtures.ts:152-153`). A `23505` unique_violation on a *retry* attempt
  therefore means *our own prior attempt already committed* — safe to coerce to
  success.
- Most fixture inserts are bare `.insert()` with no `.select()` and check only
  `error` — so a `23505`-as-success coercion can return `{ data: null, error:
  null }` and the caller proceeds with its known id. The only read-back is the
  `.update().select().single()` in `acceptInviteAs` (`fixtures.ts:231-240`),
  which is an update (idempotent, re-selects the row) and never produces `23505`.

## Desired End State

A transient local-Supabase gateway blip during test setup/teardown is silently
retried (with a visible `console.warn`) and the suite passes deterministically;
a genuine RLS denial or SQL error still fails the test immediately and loudly.
Verified by: the new unit test proving the classifier/wrapper behavior, the full
existing suite still green locally, and a green CI run.

## What We're NOT Doing

- **No** change to `vitest.config.ts` or test-file concurrency — retry is the
  chosen mechanism; serialization is explicitly rejected (slower, redundant).
- **No** vitest built-in `test.retry` and **no** CI step-level re-run — both
  re-run whole tests and can mask logic flakes; rejected in planning.
- **No** production, RLS-policy, migration, or `src/` change — the policies are
  sound (proven in the frame).
- **No** wrapping of the inline writes in `cross-team-denial.test.ts` — the
  shared fixtures + cleanup are the setup/teardown path; test-body writes stay
  as-is (and are already safe under the code-absence gate).
- **No** client-layer (`clients.ts`) transparent wrapper — too magical; we wrap
  explicit helper call-sites.
- **No** fault-injection integration test — non-deterministic and high-effort;
  the mock unit test proves the safety properties instead.

## Implementation Approach

Introduce one small helper, `withRetry`, in a new `tests/helpers/resilient.ts`.
It takes a label and a **thunk** that builds a fresh PostgREST query (builders
are single-use thenables, so each attempt must reconstruct the query). It awaits
the result, inspects `error`, and applies the transient-only + idempotency rules
below. Then wrap every PostgREST call in `fixtures.ts` and `cleanup.ts` with it.
Prove the logic with a DB-free mock unit test first (Phase 1), then wire the
call-sites (Phase 2).

## Critical Implementation Details

**Classifier + idempotency ordering (load-bearing — other call-sites depend on
this exact semantics).** The interaction between the code-absence gate and the
`23505`-on-retry rule is the heart of the change and is non-obvious, so the
control flow is specified here:

```ts
// tests/helpers/resilient.ts
const DEFAULT_ATTEMPTS = 3;

export async function withRetry<T>(
  label: string,
  op: () => PromiseLike<{ data: T; error: PostgrestError | null }>,
  attempts = DEFAULT_ATTEMPTS,
): Promise<{ data: T; error: PostgrestError | null }> {
  let sawTransient = false;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = await op();
    const error = result.error;
    if (!error) return result;                       // success
    if (!error.code) {                               // transient: gateway/network, no PG code
      sawTransient = true;
      if (attempt < attempts) {
        console.warn(`Retrying ${label} after transient error (attempt ${attempt}): ${error.message}`);
        await backoff(attempt);                      // ~100/200ms * 2^(n-1) + jitter
        continue;
      }
      return result;                                 // budget exhausted -> caller throws its descriptive error
    }
    if (error.code === "23505" && sawTransient) {    // our own prior attempt already committed
      console.warn(`Treating duplicate on ${label} as success after a prior transient retry.`);
      return { data: result.data, error: null };
    }
    return result;                                   // any other coded error (incl. 42501) -> surface immediately
  }
  throw new Error(`withRetry exhausted for ${label}`); // unreachable; satisfies type checker
}
```

Key invariants: (1) a coded error on the **first** attempt always surfaces — a
`23505` only coerces to success when a transient already fired for this op;
(2) `42501` (and every other SQLSTATE/PGRST code) is never retried and never
coerced; (3) the thunk is re-invoked per attempt so each retry issues a fresh
request.

## Phase 1: Resilient retry helper + unit tests

### Overview

Create the `withRetry` helper and its transient classifier, and prove its
behavior with a deterministic, DB-free unit test. This phase is fully verifiable
via `npm test` without a running Supabase stack.

### Changes Required:

#### 1. Retry helper

**File**: `tests/helpers/resilient.ts` (new)

**Intent**: Provide a single bounded, transient-only retry wrapper the helpers
can apply to any PostgREST call, with visible warnings and partial-success
(`23505`) handling.

**Contract**: Export `withRetry<T>(label: string, op: () => PromiseLike<{ data:
T; error: PostgrestError | null }>, attempts?: number): Promise<{ data: T; error:
PostgrestError | null }>`. `PostgrestError` imported from `@supabase/supabase-js`.
Behavior exactly as the snippet in "Critical Implementation Details": retry only
when `!error.code`; coerce `23505` to success only after a prior transient;
default 3 attempts; exponential backoff (~100ms base, ×2 per attempt) with small
jitter; `console.warn` on each retry and on a duplicate-coercion. Keep a tiny
internal `backoff(attempt)` helper.

#### 2. Helper unit test

**File**: `tests/helpers/resilient.test.ts` (new)

**Intent**: Lock the safety-critical behavior so a future edit can't silently
make the wrapper mask real errors.

**Contract**: Drive `withRetry` with a fake `op` (a closure over a call counter
returning queued `{ data, error }` results; no network). Cover:
- transient (no `code`) twice then success → resolves with the success result and
  the op was called 3 times;
- transient on every attempt → resolves with the final error result, op called
  `attempts` times (caller is responsible for throwing);
- coded `42501` on attempt 1 → returned immediately, op called **once** (no
  retry, no coercion);
- `23505` on attempt 1 (no prior transient) → returned as an error, op called
  once;
- transient then `23505` → coerced to `{ error: null }`, treated as success;
- immediate success → passthrough, op called once.
Use fake timers or a 1ms base so backoff doesn't slow the suite.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npx astro sync && npx tsc --noEmit` (or `npm run lint`,
  which runs type-checked ESLint)
- Linting passes: `npm run lint`
- New unit test passes and the rest stay green: `npm test`
- `tests/helpers/resilient.test.ts` exercises all six cases above (transient
  retry, exhaustion, `42501` no-retry, `23505` first-attempt surfaces,
  `23505`-after-transient success, happy-path passthrough)

#### Manual Verification:

- Read `resilient.ts` and confirm a coded error on the first attempt can never be
  retried or coerced (the masking risk this whole change guards against)

**Implementation Note**: After completing this phase and all automated
verification passes, pause for manual confirmation before Phase 2. Phase blocks
use plain bullets — the `- [ ]` checkboxes live in `## Progress`.

---

## Phase 2: Apply wrapper to fixtures + cleanup

### Overview

Route every PostgREST call in `tests/helpers/fixtures.ts` (reads and writes) and
the deletes in `tests/helpers/cleanup.ts` through `withRetry`, preserving all
existing descriptive error messages and control flow. No happy-path behavior
change.

### Changes Required:

#### 1. Wrap fixture calls

**File**: `tests/helpers/fixtures.ts`

**Intent**: Make every shared setup read/write absorb a transient blip while
keeping each existing `if (error) throw new Error(...)` guard intact.

**Contract**: For each PostgREST call, replace `await user.client.from(...)...`
with `await withRetry("<descriptive label>", () => user.client.from(...)...)`,
destructuring `{ data, error }` from the wrapped result exactly as today. Applies
to all calls including: `waitForProfileRow`'s select (the existing 10× poll loop
stays — it handles trigger latency, which is orthogonal; the per-attempt select
gets wrapped), `requireTemplateBySlug`, `createTeamAs` (team + membership
inserts), `inviteToTeamAs`, `acceptInviteAs` (invite read, update-select,
membership insert), `openRoundAs`, `createEmojiSessionAs`,
`prepareTwoTruthsCollectionRound`, `prepareTwoTruthsVotingRound` (entry inserts,
include-in-voting update, phase update). Labels mirror the existing throw text
(e.g. `"create team ${name} as ${user.label}"`). No `.select()`/`.maybeSingle()`/
`.single()` typing changes — the generic `T` flows through `withRetry`.

#### 2. Wrap cleanup deletes

**File**: `tests/helpers/cleanup.ts`

**Intent**: Avoid orphaned rows when a teardown delete hits a transient.

**Contract**: Wrap the `admin.from("teams").delete().eq("id", teamId)` call
(`cleanup.ts:26`) in `withRetry("cleanup team ${teamId}", () => ...)`. Keep the
existing warn-on-error best-effort behavior (cleanup still must not throw). The
`auth.admin.deleteUser` call is not a PostgREST `{ data, error }` query and is
out of scope for this wrapper.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Full unit + integration suite passes locally against the local stack:
  `npx supabase start` then `npm test` (RLS files included)
- No `await user.client.from` / `admin.from(...).delete` call in `fixtures.ts`
  or `cleanup.ts` remains unwrapped: `grep -nE "\.(from|rpc)\(" tests/helpers/fixtures.ts tests/helpers/cleanup.ts` reviewed — every PostgREST call routes through `withRetry`

#### Manual Verification:

- A green CI run on the branch (the previously failing "Run unit + integration
  tests" step passes): push and check `gh run list`
- Spot-check CI logs for any `Retrying ...` warnings — confirms the wrapper is
  wired and shows whether the gateway actually flaked
- Confirm a deliberately broken classifier (temporarily retry coded errors) makes
  `cross-team-denial.test.ts` hang/slow on the `42501` assertions — then revert;
  proves the gate is load-bearing (optional, do in a throwaway diff)

**Implementation Note**: After automated verification passes, pause for manual
confirmation (CI green) before considering the change complete.

---

## Testing Strategy

### Unit Tests:

- `tests/helpers/resilient.test.ts` (Phase 1) — the six classifier/wrapper cases;
  DB-free, deterministic, fast.

### Integration Tests:

- The existing RLS suite (`tests/rls/*.test.ts`) is the end-to-end check: it must
  stay green with the wrapper in place, proving wrapped reads still surface coded
  errors for `toBeNull()` / `.code === "42501"` assertions.

### Manual Testing Steps:

1. `npm test` locally with the stack up — full suite green.
2. Push the branch; confirm the CI "Run unit + integration tests" step is green.
3. Inspect CI logs for `Retrying ...` warnings (visibility check).

## Performance Considerations

Worst-case added latency per call is bounded (~100+200ms backoff before a 3rd
attempt, plus jitter) and only incurred on an actual transient; green runs pay
nothing. A genuinely degraded stack still fails fast (≤ ~3 attempts per op).

## Migration Notes

None — test-infrastructure-only change, no data or schema impact.

## References

- Frame brief: `context/changes/integration-suite-transient-flakiness/frame.md`
- Failure site: `tests/helpers/fixtures.ts:150-182` (`createTeamAs`)
- Existing retry precedent: `tests/helpers/fixtures.ts:76-100` (`waitForProfileRow`)
- Denial-is-coded proof: `tests/rls/cross-team-denial.test.ts:64-66,187`
- Cleanup deletes: `tests/helpers/cleanup.ts:22-40`
- Parallelism source: `vitest.config.ts`
- Related lesson: `context/foundation/lessons.md` → "CI Configured Is Not CI Running"

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Resilient retry helper + unit tests

#### Automated

- [x] 1.1 Type checking passes (`npm run lint` / `tsc --noEmit`) — af539cf
- [x] 1.2 Linting passes (`npm run lint`) — af539cf
- [x] 1.3 New unit test passes and rest stay green (`npm test`) — af539cf
- [x] 1.4 `resilient.test.ts` exercises all six cases (transient retry, exhaustion, 42501 no-retry, 23505 first-attempt surfaces, 23505-after-transient success, happy-path passthrough) — af539cf

#### Manual

- [x] 1.5 Confirmed by reading `resilient.ts` that a first-attempt coded error can never be retried or coerced — af539cf

### Phase 2: Apply wrapper to fixtures + cleanup

#### Automated

- [x] 2.1 Linting passes (`npm run lint`) — 5cc7b91
- [x] 2.2 Full suite passes locally against the local stack (`npx supabase start` + `npm test`) — 5cc7b91
- [x] 2.3 Every PostgREST call in `fixtures.ts` and `cleanup.ts` routes through `withRetry` (grep-reviewed) — 5cc7b91

#### Manual

- [ ] 2.4 Green CI run — the previously failing "Run unit + integration tests" step passes
- [ ] 2.5 CI logs spot-checked for `Retrying ...` warnings (wrapper wired / flake visibility)
