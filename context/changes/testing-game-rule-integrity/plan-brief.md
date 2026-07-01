# Game-Rule Integrity Tests — Plan Brief

## What This Change Does

Adds 9 integration tests (2 new files) that prove the Emoji Check-In and Two Truths game rules
are enforced at the database and RLS layers, independent of any client-side guard. Test-only
change — no production code touches.

## Files Changed

| File | Action |
|------|--------|
| `tests/helpers/fixtures.ts` | Add `submitEmojiCheckInAs` + `castTwoTruthsGuessAs` builders |
| `tests/rls/emoji-check-in-rules.test.ts` | New — 3 emoji check-in integration tests |
| `tests/rls/two-truths-rules.test.ts` | New — 6 Two Truths integration tests |

## Phase Breakdown

**Phase 1 — Fixture builders** (`tests/helpers/fixtures.ts`)
- `submitEmojiCheckInAs(actor, membershipId, sessionId, emojis)` → raw INSERT into
  `emoji_check_in_submissions` via signed-in actor client
- `castTwoTruthsGuessAs(voter, voterMembershipId, roundId, targetEntryId, guessedLieIndex)` →
  raw INSERT into `two_truths_guesses` via signed-in voter client
- Both follow the existing `withRetry` + actor-client pattern

**Phase 2 — Emoji Check-In rule tests** (`tests/rls/emoji-check-in-rules.test.ts`)
1. `"rejects a duplicate submission from the same member"` → error code `23505`
2. `"stores the session date key as the requested calendar date"` → admin read-back asserts
   literal `'2000-01-01'`
3. `"DB enforces one session per team per calendar day"` → second session INSERT → `23505`

**Phase 3 — Two Truths rule tests** (`tests/rls/two-truths-rules.test.ts`)
- **during collection phase**: guess in collecting phase → RLS denial (`42501`)
- **during voting phase — denial rules**:
  - self-vote → `42501`
  - duplicate vote on same target → `23505`
  - guess on `included_in_voting=false` entry → `42501`
- **full reveal flow**:
  - lie designation unchanged after reveal → admin read-back asserts literals `1`, `2`, `3`
  - vote cast after reveal → `42501`

## Key Design Decisions

- **Raw Supabase clients only** — consistent with Phase 1 RLS tests (`tests/rls/`). Exercises
  RLS policies and DB UNIQUE constraints simultaneously via PostgREST.
- **Auto-reveal is out of scope** — auto-reveal trigger fires in `submitTwoTruthsGuess` service
  code, not in the DB. Revealed state is reached via direct owner-client DB update, matching the
  `prepareTwoTruthsVotingRound` pattern (`fixtures.ts:405-426`).
- **Lie designation asserted with literals** — `lie_statement_index` values set as `1`, `2`, `3`
  in setup; read back and asserted against those same literals. No formula copying.
- **3-person Two Truths setup** — manual inline setup (mint 3 users, invite×2, 3 entries,
  bulk-update `included_in_voting=true`, phase transition) rather than extending
  `prepareTwoTruthsVotingRound` to avoid scope creep.
- **`included_in_voting=false` isolation** — in the "voting phase denial" describe, the
  `included_in_voting=false` test reverts one entry via `adminClient()` AFTER other tests run
  (last in the describe block) so the mutation doesn't contaminate the self-vote test.

## Not In Scope

- Service-layer integration tests (requires cookie-backed JWT injection not yet in test infra)
- Auto-reveal trigger path (service-layer only)
- Partial-voting summary computation (service-layer, best tested in a mocked unit test)
- Production code changes

## Dependencies

- Local Supabase stack required: `npx supabase start`
- Phase 1 must land before Phases 2 and 3 (fixture builders needed by both test files)
