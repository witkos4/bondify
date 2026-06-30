# Regression Guardrails for Membership Schema Compatibility — Implementation Plan

## Overview

Two recent regressions motivated this change (research brief:
`context/changes/testing-regression-guardrails/research.md`):

1. the Emoji Check-In picker looked clickable but was not usable, and
2. remote environments without `team_memberships.removed_at` crashed on live
   code paths.

Since the research was written, the two highest-value guards it recommended have
**already shipped**: a browser test for the picker
(`tests/browser/emoji-check-in-picker.spec.ts`, 2 tests) and a
membership-fallback compatibility family
(`tests/services/bondify-compatibility.test.ts`, 4 tests). This plan closes the
**residual gap** the research called out and that is still open: the schema-drift
seam is exercised through the write/mutation paths but not through the plain
read-gate, and there is no structural guard stopping a new direct
`removed_at` query from silently bypassing the compatibility seam.

## Current State Analysis

The compatibility seam is centralized in three helpers and two select constants
in `src/lib/services/bondify.ts`:

- `ACTIVE_TEAM_MEMBERSHIP_SELECT` (`bondify.ts:296`) and
  `LEGACY_TEAM_MEMBERSHIP_SELECT` (`bondify.ts:297`) — the sanctioned new/old
  membership select strings.
- `isMissingColumnError(error, table, column)` (`bondify.ts:384`) — the
  discriminator that recognizes a `column ... does not exist` PostgREST error.
- `findActiveMembershipByTeamAndProfile` (`bondify.ts:452`) — selects with
  `removed_at`, and on a missing-column error retries with the legacy select
  (`bondify.ts:459` active, `bondify.ts:475` legacy).
- `hasActiveMembershipForNormalizedEmail` (`bondify.ts:487`) — the email-based
  duplicate-membership check with the same fallback.

**What is already covered** (`tests/services/bondify-compatibility.test.ts`):

- `getCurrentTeamSummaries` — the team-summary inline fallback at
  `bondify.ts:1126-1134` (select retried without `removed_at`).
- `createTeam` — membership re-read through `findActiveMembershipByTeamAndProfile`.
- `acceptInvite` — created membership re-read through the legacy fallback.
- `createPendingInvites` — duplicate check through
  `hasActiveMembershipForNormalizedEmail` (`ALREADY_TEAM_MEMBER`).

**The gap.** All four covered paths are create/accept/invite mutations or the
summary list. The plain **read-gate** — `requireMembershipAccess`
(`bondify.ts:930-942`), which every team-scoped read routes through
(`getTeamHistoryState`, `getParticipantSafeHistory`, `loadTeamGameState`,
`getEmojiCheckInTimeline`, …) — has **no** compatibility test. If a future edit
broke the fallback inside `findActiveMembershipByTeamAndProfile`, a legacy-schema
remote would deny access to legitimate members on every read path, and nothing
in the suite would catch it. This is the exact failure the change was opened for.

### Key Discoveries:

- Research recommendation #1 (picker browser test) and the bulk of #2
  (compatibility family) are **done** — re-proposing them would duplicate
  shipped work. This plan deliberately does **not** touch them.
- `getTeamHistoryState(teamId)` (`bondify.ts:3310`) is the cleanest public
  read-only entrypoint gated solely by `requireMembershipAccess` — the ideal,
  low-setup target to prove the read-gate fallback.
- The compatibility test file already mocks the missing-column error shape (the
  literal `column team_memberships.removed_at does not exist`) and the
  `.select → eq → is → maybeSingle` builder chain — the new case extends an
  established pattern rather than inventing one.
- Research recommendation #3 (structural "don't bypass the seam" guard) was
  never built — `tests/services/` contains only `bondify-compatibility.test.ts`.

## Desired End State

A legacy-schema remote (no `removed_at` column) lets a legitimate member through
the read-gate, proven by a deterministic mocked test; and a new direct
`team_memberships` select that mentions `removed_at` outside the sanctioned seam
fails a fast structural test before it can reach a remote. Verified by:
`npm test` green (the new cases included) and a green CI run.

## What We're NOT Doing

- **No** new browser test and **no** change to
  `tests/browser/emoji-check-in-picker.spec.ts` — research #1 already shipped and
  is comprehensive (count badge, max-3 lockout, no-descriptions contract,
  submit, reveal).
- **No** rework of the four existing compatibility tests — they stay as-is; we
  **add** to the file.
- **No** production, RLS-policy, migration, or `src/` change — the seam helpers
  are sound; this change only adds tests around them.
- **No** local-Supabase / RLS integration test for this gap — the failure is a
  pure query-shape branch, cheapest proven with a mocked service test (matching
  the existing compatibility file), not a live stack.
- **No** broad AST/type-aware lint rule for the structural guard — keep it a
  narrow source-scan that enforces "use the seam," not a refactor freeze
  (research #3 caution).

## Implementation Approach

Two small, independent additions, each verifiable with `npm test` and **no**
running Supabase stack:

1. **Phase 1** — extend `tests/services/bondify-compatibility.test.ts` with one
   case that drives `getTeamHistoryState` through the `requireMembershipAccess`
   →`findActiveMembershipByTeamAndProfile` legacy fallback, asserting the member
   is granted access (not denied) when `removed_at` is missing.
2. **Phase 2** — add `tests/services/team-membership-query-guard.test.ts`, a
   source-scan test that allowlists the sanctioned `removed_at` membership
   selects and fails if a new direct one appears.

## Critical Implementation Details

**Phase 1 mock shape (load-bearing).** `findActiveMembershipByTeamAndProfile`
issues `.select(ACTIVE_TEAM_MEMBERSHIP_SELECT).eq(...).eq(...).is("removed_at",
null).maybeSingle()`; on a missing-column error it re-issues
`.select(LEGACY_TEAM_MEMBERSHIP_SELECT)` **without** the `.is("removed_at", …)`
filter. The `team_memberships` mock must therefore branch on whether the
selection string includes `removed_at`: return
`{ data: null, error: { message: "column team_memberships.removed_at does not
exist" } }` for the active select, and the membership row for the legacy select —
exactly the branch the four existing mocks already use. The assertion subject is
that `getTeamHistoryState` **resolves** (member granted), not that it throws
`TEAM_ACCESS_DENIED`. Mock only the tables `getTeamHistoryState` actually reads
after the gate so the test fails loudly if the gate itself regresses.

**Phase 2 guard scope (narrow on purpose).** The test reads the source text of
`src/lib/services/bondify.ts`, extracts every `.select("…")` string literal whose
selection both names membership columns and contains `removed_at`, and asserts
each is one of the sanctioned forms: `ACTIVE_TEAM_MEMBERSHIP_SELECT`'s value, the
team-summary nested select (`bondify.ts:322`), and the email-membership select
(`bondify.ts:494`). A new inline `removed_at` membership select fails the test
with a message pointing the author at the seam helpers. The guard asserts a
**known allowlist**, not a frozen count of unrelated lines, so harmless
refactors don't break it.

## Phase 1: Read-gate fallback compatibility test

### Overview

Add one case to `tests/services/bondify-compatibility.test.ts` proving a member
is granted a team-scoped read when the membership lookup must fall back to the
legacy schema. DB-free, deterministic, runs under `npm test` without a stack.

### Changes Required:

#### 1. Read-gate fallback case

**File**: `tests/services/bondify-compatibility.test.ts`

**Intent**: Pin the `requireMembershipAccess` →
`findActiveMembershipByTeamAndProfile` legacy fallback so a future edit can't
silently deny legitimate members on every read path of a legacy-schema remote.

**Contract**: Add a `createReadGateCompatibilitySupabaseMock()` factory (mirroring
the existing factories) that mocks `profiles` (member profile), the
`team_memberships` `findActiveMembershipByTeamAndProfile` chain with the
selection-string branch (active select → missing-column error; legacy select →
membership row), and the minimal tables `getTeamHistoryState` reads after the
gate. Add an `it(...)` that calls `services.getTeamHistoryState(teamId)` and
asserts it resolves with the expected team-scoped state (member granted), and —
if observable through the mock — that the active select was attempted before the
legacy select. Do not modify the four existing cases.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- `npm test` passes, including the new case (no Supabase stack needed for this
  file — it is fully mocked)
- The new case fails if the legacy fallback branch in
  `findActiveMembershipByTeamAndProfile` is removed (verify once by temporarily
  deleting the fallback, confirm red, then revert)

#### Manual Verification:

- Read the new case and confirm the assertion subject is "member granted access
  under the legacy schema", not merely "the helper was called"

**Implementation Note**: After automated verification passes, pause for manual
confirmation before Phase 2.

---

## Phase 2: Structural compatibility-seam guard test

### Overview

Add a fast source-scan test that fails when a new direct `team_memberships`
`removed_at` select appears outside the sanctioned seam.

### Changes Required:

#### 1. Seam guard test

**File**: `tests/services/team-membership-query-guard.test.ts` (new)

**Intent**: Catch a re-introduction of the schema regression at author time — a
new direct `removed_at` membership query that forgets the missing-column fallback
— before it can reach a remote.

**Contract**: Read `src/lib/services/bondify.ts` as text. Extract `.select("…")`
string literals that reference membership columns and contain `removed_at`.
Assert every match is one of the sanctioned selects: the
`ACTIVE_TEAM_MEMBERSHIP_SELECT` value, the team-summary nested membership select,
and the email-membership select. On failure, the assertion message names the
offending selection and points at the seam helpers
(`findActiveMembershipByTeamAndProfile` / `hasActiveMembershipForNormalizedEmail`).
Keep the allowlist a small named set so harmless refactors do not break it.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- `npm test` passes with the guard green against current `bondify.ts`
- The guard fails if a throwaway inline
  `.select("id, removed_at").from("team_memberships")`-style query is added
  outside the seam (verify once with a temporary edit, confirm red, then revert)

#### Manual Verification:

- Confirm the failure message is actionable (names the offending select and the
  seam helper to use instead)

**Implementation Note**: After automated verification passes, pause for manual
confirmation (and a green CI run) before considering the change complete.

---

## Testing Strategy

### Unit Tests:

- `tests/services/bondify-compatibility.test.ts` (Phase 1) — the new read-gate
  fallback case; mocked, deterministic, fast.
- `tests/services/team-membership-query-guard.test.ts` (Phase 2) — source-scan
  guard; no runtime, no stack.

### Integration Tests:

- None added. The schema-drift failure is a query-shape branch, not an RLS
  policy behavior — the cheapest high-signal layer is the mocked service test
  (test-plan §1 cost × signal; Risk #6 locally-provable part).

### Manual Testing Steps:

1. `npm test` — full suite green with both new cases.
2. Temporarily break the fallback / add an off-seam select to confirm each new
   test goes red, then revert.
3. Push the branch; confirm CI is green.

## Performance Considerations

Both additions are mocked/static — no stack, no network, negligible runtime.

## Migration Notes

None — test-only change, no data or schema impact.

## References

- Research brief: `context/changes/testing-regression-guardrails/research.md`
- Compatibility seam: `src/lib/services/bondify.ts:296-510`
  (`ACTIVE_TEAM_MEMBERSHIP_SELECT`, `findActiveMembershipByTeamAndProfile`,
  `hasActiveMembershipForNormalizedEmail`, `isMissingColumnError`)
- Read-gate: `src/lib/services/bondify.ts:930-942` (`requireMembershipAccess`),
  target entrypoint `getTeamHistoryState` (`bondify.ts:3310`)
- Existing compatibility tests: `tests/services/bondify-compatibility.test.ts`
- Already-shipped picker test (research #1): `tests/browser/emoji-check-in-picker.spec.ts`
- Test strategy / Risk #6: `context/foundation/test-plan.md`
- Test discovery: `vitest.config.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Read-gate fallback compatibility test

#### Automated

- [x] 1.1 Linting passes (`npm run lint`)
- [x] 1.2 `npm test` passes including the new read-gate fallback case
- [x] 1.3 New case fails when the legacy fallback branch is removed (verified then reverted)

#### Manual

- [x] 1.4 Confirmed the assertion subject is "member granted access under the legacy schema"

### Phase 2: Structural compatibility-seam guard test

#### Automated

- [x] 2.1 Linting passes (`npm run lint`)
- [x] 2.2 `npm test` passes with the guard green against current `bondify.ts`
- [x] 2.3 Guard fails when an off-seam `removed_at` membership select is added (verified then reverted)

#### Manual

- [x] 2.4 Confirmed the failure message names the offending select and the seam helper
- [ ] 2.5 Green CI run on the branch
