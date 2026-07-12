# Game-Rule Integrity Tests — Implementation Plan

## Overview

Integration tests for Test Plan §3 Phase 2 (Risks #3 and #4): prove that the daily Emoji
Check-In and Two Truths game rules are enforced at the database and RLS layers, independent of
any client-side guard. Test-only change — no production code modifications.

## Current State Analysis

The Phase 1 integration infrastructure (`setupTwoTeamScenario`, `withRetry`,
`createCleanupRegistry`, raw anon-key client fixtures) is fully in place and reusable. Two
fixture builders are missing:

- `submitEmojiCheckInAs` — inserts an `emoji_check_in_submissions` row as a signed-in member
- `castTwoTruthsGuessAs` — inserts a `two_truths_guesses` row as a signed-in voter

`TeamFixture.ownerMembershipId` (returned by `createTeamAs`) and
`AcceptedInviteFixture.membershipId` (returned by `acceptInviteAs`) give the required membership
IDs without extra queries.

`prepareTwoTruthsVotingRound` (`tests/helpers/fixtures.ts:357-434`) does phase transitions via
direct owner-client DB updates — not service calls. The 3-person Two Truths setup extends that
pattern with a third entry and third member.

### Key Discoveries

- `TeamFixture.ownerMembershipId` is available from `createTeamAs` — no extra lookup needed
  (`tests/helpers/fixtures.ts:31-36`)
- `prepareTwoTruthsVotingRound` advances phase by raw client UPDATE on `two_truths_rounds` and
  `two_truths_entries` — same approach used throughout Phase 3 setup
  (`tests/helpers/fixtures.ts:405-426`)
- RLS on `two_truths_guesses` INSERT blocks self-votes via
  `target_entry.author_membership_id <> memberships.id`
  (`supabase/migrations/20260610111000_two_truths_structured_round.sql:191`)
- RLS on `two_truths_guesses` INSERT blocks post-reveal votes via `structured_round.phase = 'voting'`
  (`supabase/migrations/20260611100000_team_management_soft_memberships.sql:158-185`)
- RLS on `two_truths_guesses` INSERT blocks guesses on non-included entries via
  `target_entry.included_in_voting = true`
  (same migration)
- `emoji_check_in_sessions (team_id, session_date)` is a DB UNIQUE constraint — second INSERT
  returns error code `23505`
  (`supabase/migrations/20260609100000_emoji_check_in_daily_sessions.sql:10`)
- RLS on `emoji_check_in_submissions` INSERT requires `sessions.status = 'open'` and
  `memberships.removed_at is null` — membership scope, not profile scope
  (`supabase/migrations/20260609100000_emoji_check_in_daily_sessions.sql:75-91`)
- `lie_statement_index` is a write-once `smallint NOT NULL` column — never updated by any service
  path (`supabase/migrations/20260610111000_two_truths_structured_round.sql:25,32`)

## Desired End State

`npm test` passes with 9 new integration test cases across two new files:

- `tests/rls/emoji-check-in-rules.test.ts` (3 tests)
- `tests/rls/two-truths-rules.test.ts` (6 tests across 3 describe blocks)

Verified by: lint clean, `npm test` green, local Supabase stack running (`npx supabase start`).

## What We're NOT Doing

- No production code changes — the seam helpers and enforcement logic are correct as-is
- No auto-reveal path test — `allRequiredGuessesSubmitted` (bondify.ts:3196-3200) is a
  service-layer check that fires only inside `submitTwoTruthsGuess`; it cannot be triggered via a
  raw PostgREST INSERT. Revealed state is reached for test purposes via direct owner-client DB
  update, consistent with the `prepareTwoTruthsVotingRound` fixture pattern
- No partial-voting summary service computation test — `buildTwoTruthsRevealSummary` is
  service-layer logic; verifying it requires service-context injection that is out of scope here.
  The DB state (lie index + guess rows) is asserted instead
- No service-layer integration tests — the `createBondifyServices` service context requires
  cookie-backed JWT injection not yet set up in the integration test infrastructure
- No change to existing Phase 1 test files
- No concurrency test for session creation — the retry path is a service-layer concern; sequential
  tests prove idempotency, which is sufficient at this layer

## Implementation Approach

Phase 1 adds the two missing fixture builders. Phases 2 and 3 add the test files. Each phase is
independently verifiable with `npm test`.

All tests use real Supabase clients (signed-in anon-key via `userClient()`) against the local
stack, consistent with Phase 1. This exercises RLS policies and DB constraints simultaneously.
Admin client is used only for fixture setup and zero-delta verification, matching the Phase 1
convention.

## Critical Implementation Details

**3-person Two Truths setup** follows `prepareTwoTruthsVotingRound` directly: open round →
insert `two_truths_rounds` row (`phase = 'collecting'`) → each user inserts own entry via their
client → bulk-update `included_in_voting = true` via owner client → update `two_truths_rounds`
to `phase = 'voting'`. Add the third user via `mintUser` + `inviteToTeamAs` + `acceptInviteAs`
after `createTeamAs`. The only difference from the existing 2-person helper is three entry
inserts instead of two.

**included_in_voting=false test setup**: after the full voting-phase beforeAll runs (all entries
marked true), the test that verifies the `included_in_voting` gate reverts one entry to `false`
using `adminClient()` before the assertion. This isolates the condition from the phase check
while preserving a valid voting-phase round. That test should run LAST within its describe block
since it mutates shared state.

**RLS denial shape**: raw INSERT denied by RLS returns `{ data: null, error: { code: "42501" } }`.
Duplicate-key violation returns `{ data: null, error: { code: "23505" } }`. Assert the code, not
the message string. Wrap the denial INSERT in `withRetry` only if it might transiently fail
before the expected denial — for expected denials, call without retry and assert the error
immediately.

**Lie index assertion anti-pattern**: do NOT derive expected `lie_statement_index` from the service
code. State it as a literal in the test setup and assert that same literal on read-back. For
example: owner inserts with `lie_statement_index: 3` (hardcoded in the insert call); after reveal,
admin reads the entry and asserts `lie_statement_index === 3`.

---

## Phase 1: Fixture Builders

### Overview

Add two new fixture builders to `tests/helpers/fixtures.ts` and their return-type interfaces. No
test file changes in this phase.

### Changes Required

#### 1. `EmojiCheckInSubmissionFixture` interface

**File**: `tests/helpers/fixtures.ts`

**Intent**: Declare the return type for `submitEmojiCheckInAs`, mirroring the existing fixture
interface pattern.

**Contract**: Add after `EmojiSessionFixture`:
```
interface EmojiCheckInSubmissionFixture { id: string; sessionId: string; membershipId: string; }
```
Export it alongside the other fixture interfaces.

#### 2. `TwoTruthsGuessFixture` interface

**File**: `tests/helpers/fixtures.ts`

**Intent**: Declare the return type for `castTwoTruthsGuessAs`.

**Contract**: Fields: `id: string`, `roundId: string`, `voterMembershipId: string`,
`targetEntryId: string`, `guessedLieIndex: 1 | 2 | 3`. Export it.

#### 3. `submitEmojiCheckInAs` function

**File**: `tests/helpers/fixtures.ts`

**Intent**: Insert one `emoji_check_in_submissions` row as a signed-in member, returning the
fixture for assertion use. Mirrors the DB INSERT that `submitTodayEmojiCheckIn` performs at
the service layer (`src/lib/services/bondify.ts:2378-2383`).

**Contract**: Signature:
```typescript
export async function submitEmojiCheckInAs(
  actor: TestUser,
  membershipId: string,
  sessionId: string,
  emojis: string[],
): Promise<EmojiCheckInSubmissionFixture>
```
Uses `actor.client` (signed-in anon-key), wrapped in `withRetry`. Inserts into
`emoji_check_in_submissions` with columns: `id` (randomUUID), `session_id`, `membership_id`,
`profile_id` (`actor.userId`), `emojis`. Throws on error with the label and
`error.message`. Returns `{ id, sessionId, membershipId }`.

#### 4. `castTwoTruthsGuessAs` function

**File**: `tests/helpers/fixtures.ts`

**Intent**: Insert one `two_truths_guesses` row as a signed-in voter. Mirrors the DB INSERT in
`submitTwoTruthsGuess` (`src/lib/services/bondify.ts:3171-3178`).

**Contract**: Signature:
```typescript
export async function castTwoTruthsGuessAs(
  voter: TestUser,
  voterMembershipId: string,
  roundId: string,
  targetEntryId: string,
  guessedLieIndex: 1 | 2 | 3,
): Promise<TwoTruthsGuessFixture>
```
Uses `voter.client`, wrapped in `withRetry`. Inserts into `two_truths_guesses` with columns:
`id` (randomUUID), `game_round_id`, `voter_membership_id`, `voter_profile_id` (`voter.userId`),
`target_entry_id`, `guessed_lie_index`. Throws on error. Returns the fixture object.

### Success Criteria

#### Automated Verification

- Linting passes: `npm run lint`
- `npm test` passes (no new tests yet, but the new exports must type-check cleanly)

#### Manual Verification

- Confirm the two new exports appear in `tests/helpers/fixtures.ts` with correct signatures
- Confirm both follow the `withRetry` + actor-client pattern of `prepareTwoTruthsVotingRound`

---

## Phase 2: Emoji Check-In Rule Tests

### Overview

Three integration tests prove: duplicate submission is rejected at the DB constraint layer,
the session date key is stored as given (UTC calendar date), and the DB UNIQUE constraint
enforces exactly one session per team per calendar day.

### Changes Required

#### 1. Emoji Check-In rule test file

**File**: `tests/rls/emoji-check-in-rules.test.ts` (new)

**Intent**: Cover Risk #3 — daily ritual rule break. Assert the server-side duplicate and
uniqueness constraints hold regardless of client-side guards.

**Contract**: Single top-level `describe("emoji check-in rules")` with one `beforeAll` and
three `it` cases. Use `createCleanupRegistry` + `afterAll` as in every Phase 1 test file.

**Setup** (`beforeAll`):
- `setupTwoTeamScenario(cleanup)` → `ownerA`, `memberA2`, `teamA`
- `createEmojiSessionAs(ownerA, teamA.id)` → `todaySession`
- `submitEmojiCheckInAs(ownerA, teamA.ownerMembershipId, todaySession.id, ['😄'])` — ownerA has
  already submitted once (used as prior-state for the duplicate test)

**Test cases**:

1. `"rejects a duplicate submission from the same member"`:
   - Call `submitEmojiCheckInAs(ownerA, teamA.ownerMembershipId, todaySession.id, ['🚀'])` a
     second time (ownerA already submitted in beforeAll)
   - Assert `error.code === "23505"` (do NOT call the service — this is a raw client call)

2. `"stores the session date key as the requested calendar date"`:
   - `createEmojiSessionAs(ownerA, teamA.id, '2000-01-01')` → `pastSession`
   - Admin client: SELECT from `emoji_check_in_sessions` WHERE `id = pastSession.id`
   - Assert `session_date === '2000-01-01'` — use the literal string, not `new Date()` or any
     computed value. This pins the UTC calendar-date key against a known anchor

3. `"DB enforces one session per team per calendar day"`:
   - Admin client: INSERT into `emoji_check_in_sessions` with `team_id = teamA.id` and
     `session_date = todaySession.sessionDate` (same as the session created in beforeAll)
   - Assert `error.code === "23505"`

### Success Criteria

#### Automated Verification

- Linting passes: `npm run lint`
- `npm test` passes, including all 3 new cases

#### Manual Verification

- Run `npm test -- --reporter=verbose` and confirm the 3 new cases appear under the
  `emoji check-in rules` describe
- Read test 2 and confirm the assertion uses a hardcoded date literal (`'2000-01-01'`), not a
  computed value

**Implementation Note**: Pause here after automated verification passes. Confirm the 3 cases are
visible and the date assertion uses a literal before proceeding to Phase 3.

---

## Phase 3: Two Truths Rule Tests

### Overview

Six integration tests across three describe blocks prove: guessing before voting opens is
rejected, self-votes are rejected, guessing on a non-included entry is rejected, duplicate votes
on the same target are rejected, the lie designation survives unchanged to reveal, and post-reveal
votes are rejected.

### Changes Required

#### 1. Two Truths rule test file

**File**: `tests/rls/two-truths-rules.test.ts` (new)

**Intent**: Cover Risk #4 — Two Truths rule enforcement. All six cases are RLS denials or DB
UNIQUE violations exercised via signed-in raw clients.

**Contract**: Three `describe` blocks under a single outer scope sharing one
`createCleanupRegistry()` + `afterAll`. Each describe has its own `beforeAll` with its own
independent fixture setup (mint users, create team, etc.), so failures in one block don't affect
another.

---

**describe("during collection phase")**

`beforeAll`:
- Mint 2 users: `owner`, `member1`
- `createTeamAs(owner, ...)` → `team`, `ownerMembershipId = team.ownerMembershipId`
- `inviteToTeamAs(owner, team.id, member1.email)` + `acceptInviteAs(member1, invite.id)` →
  `member1MembershipId`
- `prepareTwoTruthsCollectionRound({ owner, teamId: team.id })` → `round` (phase = 'collecting')
- Owner inserts one entry via `owner.client.from("two_truths_entries").insert({...})` with a
  known `lie_statement_index`, `author_membership_id: ownerMembershipId`,
  `author_profile_id: owner.userId`

`it("rejects a guess cast during collection phase")`:
- member1 attempts `member1.client.from("two_truths_guesses").insert({...})` targeting the
  owner's entry
- Assert `error.code === "42501"` — the `phase = 'voting'` check in the RLS INSERT policy
  denies the insert

---

**describe("during voting phase — denial rules")**

`beforeAll`:
- Mint 2 users: `owner`, `member1`
- `createTeamAs(owner, ...)` → `team`, `ownerMembershipId`
- Invite + accept member1 → `member1MembershipId`
- `prepareTwoTruthsVotingRound({ owner, ownerMembershipId, member: member1, memberMembershipId: member1MembershipId, teamId: team.id })`
  → `{ round, ownerEntryId, memberEntryId }`

`it("rejects a self-vote")`:
- owner attempts `owner.client.from("two_truths_guesses").insert({...})` with
  `voter_membership_id: ownerMembershipId` and `target_entry_id: ownerEntryId`
  (voting on own entry)
- Assert `error.code === "42501"` — the `author_membership_id <> voter_membership_id` RLS check
  fires

`it("rejects a duplicate vote on the same target")`:
- `castTwoTruthsGuessAs(member1, member1MembershipId, round.id, ownerEntryId, 1)` → succeeds
- Second `castTwoTruthsGuessAs(member1, member1MembershipId, round.id, ownerEntryId, 2)` →
  assert `error.code === "23505"` (UNIQUE `(game_round_id, voter_membership_id, target_entry_id)`)

`it("rejects a guess on an entry not included in voting")` — run LAST in this block:
- Admin client: `UPDATE two_truths_entries SET included_in_voting = false WHERE id = memberEntryId`
  (reverts the flag set by the beforeAll fixture)
- owner attempts `owner.client.from("two_truths_guesses").insert({...})` targeting `memberEntryId`
- Assert `error.code === "42501"` — the `included_in_voting = true` RLS check fires
  (phase is still 'voting', isolating this condition)

---

**describe("full reveal flow")**

`beforeAll`:
- Mint 3 users: `owner`, `member1`, `member2`
- `createTeamAs(owner, ...)` → `team`, `ownerMembershipId`
- Invite + accept member1 → `member1MembershipId`; invite + accept member2 → `member2MembershipId`
- Open round + create `two_truths_rounds (phase='collecting')`:
  `prepareTwoTruthsCollectionRound({ owner, teamId: team.id })` → `round`
- Each of the 3 users inserts own entry via their client with KNOWN literal `lie_statement_index`
  values: `owner: 1`, `member1: 2`, `member2: 3`. Record the entry IDs.
- Advance to voting phase (mirroring `prepareTwoTruthsVotingRound` lines 405-426):
  - `owner.client.from("two_truths_entries").update({ included_in_voting: true }).eq("game_round_id", round.id)`
  - `owner.client.from("two_truths_rounds").update({ phase: "voting", collection_closed_at: now, voting_started_at: now }).eq("game_round_id", round.id)`
- Advance to revealed phase (direct raw DB update via owner client):
  - `owner.client.from("two_truths_rounds").update({ phase: "revealed", voting_closed_at: now }).eq("game_round_id", round.id)`
  - `owner.client.from("game_rounds").update({ status: "revealed", revealed_at: now }).eq("id", round.id)`

`it("lie_statement_index survives unchanged from submission to reveal")`:
- Admin client: SELECT all `two_truths_entries` WHERE `game_round_id = round.id`
- For each entry, assert the `lie_statement_index` column value equals the literal set during
  beforeAll (`1` for owner, `2` for member1, `3` for member2). Use only test-setup literals — do
  NOT derive expected values from any service function

`it("rejects a guess cast after the round is revealed")`:
- member1 attempts `member1.client.from("two_truths_guesses").insert({...})` with
  `game_round_id: round.id`, `target_entry_id: ownerEntryId`
- Assert `error.code === "42501"` — the `structured_round.phase = 'voting'` RLS check fires
  (round is now 'revealed')

### Success Criteria

#### Automated Verification

- Linting passes: `npm run lint`
- `npm test` passes, including all 6 new Two Truths cases

#### Manual Verification

- Run `npm test -- --reporter=verbose` and confirm all 6 new cases appear under their respective
  describe blocks
- Read the "rejects a guess on an entry not included in voting" test and confirm the admin
  `included_in_voting = false` update runs AFTER other tests in that describe block
- Read the "lie designation" test and confirm the assertions use literals (`1`, `2`, `3`), not
  values from any service or helper function
- Push the branch and confirm CI stays green

---

## Testing Strategy

### Integration Tests

All 9 cases are integration tests against the local Supabase stack. They use signed-in
anon-key clients (real JWT + RLS) for the assertion subjects and `adminClient()` only for
fixture setup and read-back verification, matching the Phase 1 convention.

### Manual Testing Steps

1. Start local Supabase: `npx supabase start`
2. `npm test` — full suite green
3. `npm test -- --reporter=verbose` — confirm the 9 new cases are visible by name
4. Temporarily remove the `UNIQUE (team_id, session_date)` constraint guard (comment out the
   constraint in the migration and reset the local stack) — confirm test 3 goes red, then revert
5. Push branch and verify CI passes

## Performance Considerations

All tests use fresh short-lived Supabase users and teams. Cleanup via `adminClient()` ensures no
stale data. Each test file's `beforeAll` does the minimum setup for that block — no data
accumulation across runs.

## Migration Notes

None — test-only change.

## References

- Research brief: `context/changes/testing-game-rule-integrity/research.md`
- Test plan §3 Phase 2: `context/foundation/test-plan.md`
- Phase 1 integration pattern: `tests/rls/cross-team-denial.test.ts`
- Fixture builders to extend: `tests/helpers/fixtures.ts:357-434`
- Emoji check-in enforcement: `src/lib/services/bondify.ts:2358-2415`,
  `supabase/migrations/20260609100000_emoji_check_in_daily_sessions.sql`
- Two Truths enforcement: `src/lib/services/bondify.ts:3114-3205`,
  `supabase/migrations/20260610111000_two_truths_structured_round.sql`,
  `supabase/migrations/20260611100000_team_management_soft_memberships.sql:158-185`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Fixture Builders

#### Automated

- [ ] 1.1 Linting passes (`npm run lint`)
- [ ] 1.2 `npm test` passes (new exports type-check cleanly)

#### Manual

- [ ] 1.3 Confirmed `submitEmojiCheckInAs` and `castTwoTruthsGuessAs` follow the `withRetry` + actor-client pattern

### Phase 2: Emoji Check-In Rule Tests

#### Automated

- [ ] 2.1 Linting passes (`npm run lint`)
- [ ] 2.2 `npm test` passes including all 3 new Emoji Check-In cases

#### Manual

- [ ] 2.3 Confirmed the 3 cases appear in verbose output
- [ ] 2.4 Confirmed test 2 (date key) asserts a hardcoded literal, not a computed value

### Phase 3: Two Truths Rule Tests

#### Automated

- [ ] 3.1 Linting passes (`npm run lint`)
- [ ] 3.2 `npm test` passes including all 6 new Two Truths cases

#### Manual

- [ ] 3.3 Confirmed all 6 cases appear in verbose output across 3 describe blocks
- [ ] 3.4 Confirmed the `included_in_voting=false` test runs last in its describe block
- [ ] 3.5 Confirmed the lie designation test uses only literal expected values
- [ ] 3.6 Green CI run on the branch
