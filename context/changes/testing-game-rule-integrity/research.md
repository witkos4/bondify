---
date: 2026-07-01T00:15:00+00:00
researcher: Claude Sonnet 4.6
git_commit: c2276b0c1f6d98c58f455b95cf5cf67d3151069e
branch: future-implements
repository: bondify
topic: "Game-rule integrity: Emoji Check-In and Two Truths server-side enforcement"
tags: [research, codebase, emoji-check-in, two-truths, game-rules, rls, integration-tests]
status: complete
last_updated: 2026-07-01
last_updated_by: Claude Sonnet 4.6
---

# Research: Game-rule integrity — Emoji Check-In and Two Truths server-side enforcement

**Date**: 2026-07-01  
**Researcher**: Claude Sonnet 4.6  
**Git Commit**: c2276b0c1f6d98c58f455b95cf5cf67d3151069e  
**Branch**: future-implements  
**Repository**: bondify

## Research Question

What server-side enforcement exists for the daily Emoji Check-In and Two Truths game rules, and what integration tests are needed to cover Risks #3 and #4 from the test plan (game-rule integrity phase)?

## Summary

Both games use **defence-in-depth**: service-layer checks fire first and throw typed error codes; DB UNIQUE constraints or CHECK constraints are the second line of defence; RLS policies are the third. The plan can target the service layer as the primary assertion subject (cheapest layer that still exercises real DB path), with DB constraint assertions as the secondary proof for the uniqueness rules.

**Key gaps**: Two fixture builders are missing — `submitEmojiCheckInAs()` and `castTwoTruthsGuessAs()` — and one helper for advancing phase state (`closeCollectionAs()` / `closeTwoTruthsVotingAs()`). These must be added before integration tests can be written.

**Already present** in `tests/helpers/fixtures.ts`:  
- `createEmojiSessionAs()` — creates a bare session row  
- `prepareTwoTruthsCollectionRound()` — opens a round in collecting phase  
- `prepareTwoTruthsVotingRound()` — advances through collection → voting with real entries  

---

## Detailed Findings

### Emoji Check-In (Risk #3)

#### Session creation and keying

- **Function**: `ensureTodayEmojiCheckInSession()` — `src/lib/services/bondify.ts:1371–1446`
- **Uniqueness key**: `(team_id, session_date)` — DB UNIQUE constraint at `supabase/migrations/20260609100000_emoji_check_in_daily_sessions.sql:10`
- **Date column type**: `date` (PostgreSQL), NOT `timestamptz` — no time component stored
- **Date computation**: `getEmojiCheckInSessionDateKey()` — `src/lib/emoji-check-in.ts:49–69`
  - Uses `Intl.DateTimeFormat` with timezone `"UTC"` (hardcoded constant at `emoji-check-in.ts:10`)
  - Entirely server-side: client cannot influence the keying date
- **Race condition handling**: If two concurrent callers both attempt to INSERT the session, the second gets a `23505` error and retries with a SELECT — `bondify.ts:1399–1410`

#### Duplicate submission prevention (three layers)

| Layer | Enforcement | Error | Location |
|---|---|---|---|
| DB UNIQUE | `(session_id, membership_id)` | `23505` | `20260609100000…sql:31` |
| Service | Catches `23505`, re-throws typed error | `DUPLICATE_DAILY_EMOJI_CHECK_IN` | `bondify.ts:2385–2391` |
| RLS | INSERT `with check`: session `status = 'open'`, active membership | deny | `20260609100000…sql:75–91` |

The RLS policy does **not** prevent duplicates on its own — the DB UNIQUE constraint is the actual guard. RLS validates prerequisites (session open, membership active).

#### Submission flow (full trace)

1. **API**: `src/pages/api/games/emoji-check-in/submit.ts:33` — POST entry point, Zod validation
2. **Service**: `submitTodayEmojiCheckIn()` — `bondify.ts:2358–2415`
   - `bondify.ts:2359` — `validateEmojiCheckInEmojis()` (whitelist, distinctness)
   - `bondify.ts:2362` — `ensureTodayEmojiCheckInSession()` (get-or-create UTC date session)
   - `bondify.ts:2367–2376` — check session not already revealed
   - `bondify.ts:2378–2383` — INSERT into `emoji_check_in_submissions`
   - `bondify.ts:2385–2413` — error mapping (`23505` → `DUPLICATE_DAILY_EMOJI_CHECK_IN`)
3. **DB**: `emoji_check_in_submissions` table — one row per `(session_id, membership_id)`

#### Data model

**`emoji_check_in_sessions`**
- `session_date date` — bare date, midnight UTC boundary
- UNIQUE: `(team_id, session_date)`

**`emoji_check_in_submissions`**
- `membership_id uuid` — team-scoped user identity (not raw `profile_id`)
- `emojis text[]` — 1–3 elements, no blanks (DB CHECK constraints at `sql:25–30`)
- UNIQUE: `(session_id, membership_id)` — one per member per session

**Implication**: The same Supabase user in two different teams can submit once in each team's session on the same day. Duplicate prevention is membership-scoped, not profile-scoped.

#### Key test insights for Risk #3

1. **Duplicate submission path** → easiest to test: submit twice for the same `(user, session)`, assert second call throws `DUPLICATE_DAILY_EMOJI_CHECK_IN`. This exercises DB UNIQUE + service error mapping.
2. **One session per team per day** → test DB-level race: the DB UNIQUE on `(team_id, session_date)` is the real guard; can assert it by attempting two direct INSERTs via admin client.
3. **Date boundary** → the test plan flags this explicitly: "boundary-time submissions land on the correct day." UTC midnight is the boundary. Testable by injecting a known date into `ensureTodayEmojiCheckInSession` or by overriding `new Date()`. *Anti-pattern to avoid*: asserting whatever date the code computes — use a known fixed date and assert `session_date` equals it.
4. **Session idempotency** → calling `ensureTodayEmojiCheckInSession` concurrently returns the same session; testable via two sequential service calls (true concurrent is hard in a single-process test, but sequential proves idempotency).

---

### Two Truths and a Lie (Risk #4)

#### Self-vote prevention (two layers)

| Layer | Check | Error | Location |
|---|---|---|---|
| Service | `targetEntry.author_membership_id === membership.id` | `TWO_TRUTHS_SELF_GUESS` | `bondify.ts:3163–3168` |
| RLS | `and target_entry.author_membership_id <> memberships.id` | deny | `20260610111000…sql:191` |

Both fire. Service fires first; RLS is a hard backstop even if service is bypassed.

#### Vote-after-close prevention (two layers)

| Layer | Check | Error | Location |
|---|---|---|---|
| Service | `roundRow.status !== "open"` | `ROUND_NOT_OPEN` | `bondify.ts:3139–3143` |
| Service | `structuredRound.phase !== "voting"` | `TWO_TRUTHS_ROUND_PHASE_MISMATCH` | `bondify.ts:3146–3152` |
| RLS | `and structured_round.phase = 'voting'` | deny | soft-memberships migration lines 158–185 |

The phase check is more specific than the round-status check: a round can be `status = 'open'` but `phase = 'revealed'` momentarily during transitions. The service validates both.

#### Lie designation data model

- **Column**: `two_truths_entries.lie_statement_index smallint NOT NULL`
- **Constraint**: CHECK `lie_statement_index in (1, 2, 3)` — `20260610111000…sql:32`
- **Type alias**: `TwoTruthsLieIndex = 1 | 2 | 3` — `src/types.ts:7`
- **Immutability**: Column is **write-once** — no service function updates it; no UPDATE policy targets it specifically. The `two_truths_entries_update_policy` migration (`20260610112000`) grants UPDATE to team members generally, but no code path calls UPDATE on `lie_statement_index`.
- **Survival through reveal**: `buildTwoTruthsRevealSummary()` reads it directly at `bondify.ts:1703–1710` — no derivation or recalculation.

#### Voting flow (full trace)

1. **API**: `src/pages/api/games/two-truths-vote.ts` — POST, input: `targetEntryId`, `guessedLieIndex`
2. **Service**: `submitTwoTruthsGuess()` — `bondify.ts:3114–3205`
   - `3119` — validate `guessedLieIndex` in 1–3
   - `3122–3136` — load and verify round exists
   - `3139–3143` — check `round.status === "open"`
   - `3145` — `requireMembershipAccess()` (team gate)
   - `3146` — load `two_truths_rounds` state
   - `3147–3152` — **phase = 'voting'** check
   - `3154–3161` — load target entry; verify it exists and `included_in_voting = true`
   - `3163–3168` — **self-vote check**
   - `3171–3178` — INSERT into `two_truths_guesses`
   - `3180–3189` — `23505` → `DUPLICATE_TWO_TRUTHS_GUESS`
3. **DB**: `two_truths_guesses` — UNIQUE `(game_round_id, voter_membership_id, target_entry_id)`

**Note**: An entry must be explicitly marked `included_in_voting = true` before it can be voted on. This flag is set in bulk when collection closes (`bondify.ts:3052`). A guess against an entry where `included_in_voting = false` is rejected at step `3154–3161`.

#### Close-voting / reveal transition

- **Function**: `finalizeTwoTruthsVoting()` — `bondify.ts:1763–1804`
  - Sets `two_truths_rounds.phase = 'revealed'`, `voting_closed_at = now()`
  - Sets `game_rounds.status = 'revealed'`, `revealed_at = now()`
  - Both updates are conditional (only if currently in the expected state)
- **Auto-trigger**: `submitTwoTruthsGuess():3196–3200` — if all required guesses are submitted, reveals automatically
- **Scoring**: `buildTwoTruthsRevealSummary()` — `bondify.ts:1694–1728`
  - Correct guesses: voter guessed the right `lie_statement_index`
  - Fooled: voter picked wrong index on that entry

#### Statement submission flow

1. **API**: `src/pages/api/games/two-truths-entry.ts` — POST
2. **Service**: `submitTwoTruthsEntry()` — `bondify.ts:2892–2999`
   - `2899–2902` — validate statements (not blank, ≤200 chars), lie index (1–3)
   - `2905–2935` — load round, verify template is Two Truths, verify `status = 'open'`
   - `2940–2946` — **phase = 'collecting'** check (blocks mid-voting submissions)
   - `2948–2958` — INSERT into `two_truths_entries` (`included_in_voting` defaults false)
   - `2960–2971` — `23505` → `DUPLICATE_TWO_TRUTHS_ENTRY`

#### Key test insights for Risk #4

1. **Self-vote** → submit an entry as User A, then attempt to guess on User A's own entry as User A; assert `TWO_TRUTHS_SELF_GUESS`. Also verifiable via direct DB INSERT (RLS denies with no code).
2. **Vote after close** → reveal the round, then attempt another guess; assert `TWO_TRUTHS_ROUND_PHASE_MISMATCH` or `ROUND_NOT_OPEN`. *The phase check is the more specific of the two.*
3. **Lie designation survives** → submit entry with `lieStatementIndex = 2`, reveal the round, load reveal summary, assert `lieStatementIndex === 2` on the returned entry. *Anti-pattern*: do not re-derive the expected value from the service code; use a literal fixed value.
4. **Partial-voting summary** → with two members in the voting round, have one vote correctly and one incorrectly; reveal; assert scores are `{ correct: 1, fooled: 1 }` for the entry. *Anti-pattern*: do not copy the `buildTwoTruthsRevealSummary` scoring formula into the test assertion — compute expected values by hand from the test inputs.

---

### Test Infrastructure

#### Available helpers (no new additions needed for scaffolding)

| Helper | File | Purpose |
|---|---|---|
| `adminClient()` | `tests/helpers/clients.ts:36` | Service-role client for fixture mint + verification |
| `userClient(credentials)` | `tests/helpers/clients.ts:40` | Real auth client (exercises RLS) |
| `mintUser(label, cleanup)` | `tests/helpers/fixtures.ts` | Creates auth user + waits for profile mirror |
| `createTeamAs(user, name, cleanup)` | `tests/helpers/fixtures.ts` | Creates team + owner membership |
| `inviteToTeamAs(owner, teamId, email)` | `tests/helpers/fixtures.ts` | Creates invite |
| `acceptInviteAs(user, inviteId)` | `tests/helpers/fixtures.ts` | Accepts invite, creates membership |
| `openRoundAs(user, teamId, slug)` | `tests/helpers/fixtures.ts` | Opens a game round by template slug |
| `createEmojiSessionAs(user, teamId, sessionDate?)` | `tests/helpers/fixtures.ts` | Creates bare emoji check-in session |
| `prepareTwoTruthsCollectionRound(...)` | `tests/helpers/fixtures.ts` | Opens Two Truths round in collecting phase |
| `prepareTwoTruthsVotingRound(...)` | `tests/helpers/fixtures.ts` | Advances through collection → voting |
| `setupTwoTeamScenario(cleanup)` | `tests/helpers/scenario.ts:23` | Owner + accepted member + outsider across two teams |
| `createCleanupRegistry()` | `tests/helpers/cleanup.ts:10` | Registry-based afterAll teardown |
| `withRetry(label, op)` | `tests/helpers/resilient.ts:20` | Retry on transient errors, stop on coded errors |

#### Missing fixture builders (must add in Phase 2)

| Builder to add | Purpose | Tables written |
|---|---|---|
| `submitEmojiCheckInAs(user, sessionId, emojis)` | Submit emoji check-in as a signed-in member | `emoji_check_in_submissions` |
| `castTwoTruthsGuessAs(voter, roundId, targetEntryId, guessedLieIndex)` | Cast a Two Truths guess | `two_truths_guesses` |

May also need:
- A helper to **close the Two Truths collection phase** (advance `two_truths_rounds.phase` to `'voting'` + mark entries `included_in_voting = true`) — today `prepareTwoTruthsVotingRound` wraps this, but a standalone `closeCollectionAs()` may be cleaner for partial scenarios.

#### Existing integration test files

| File | Tests |
|---|---|
| `tests/rls/smoke.test.ts` | Game template catalog (4 required slugs) |
| `tests/rls/harness.test.ts` | `setupTwoTeamScenario` fixture validation |
| `tests/rls/access-grants.test.ts` | Member access to rounds, game data |
| `tests/rls/cross-team-denial.test.ts` | Cross-team RLS denials incl. emoji_check_in_submissions + two_truths_guesses |

The game-rule integrity tests belong in a new file or files (e.g., `tests/rls/game-rules.test.ts` or split by game), not in the existing Phase 1 files.

---

## Code References

- `src/lib/services/bondify.ts:1371–1446` — `ensureTodayEmojiCheckInSession`
- `src/lib/services/bondify.ts:2358–2415` — `submitTodayEmojiCheckIn`
- `src/lib/services/bondify.ts:2892–2999` — `submitTwoTruthsEntry`
- `src/lib/services/bondify.ts:3114–3205` — `submitTwoTruthsGuess`
- `src/lib/services/bondify.ts:1763–1804` — `finalizeTwoTruthsVoting`
- `src/lib/services/bondify.ts:1694–1728` — `buildTwoTruthsRevealSummary`
- `src/lib/emoji-check-in.ts:49–69` — `getEmojiCheckInSessionDateKey` (UTC date computation)
- `src/lib/emoji-check-in.ts:10` — `EMOJI_CHECK_IN_DEFAULT_TIME_ZONE = "UTC"`
- `src/pages/api/games/emoji-check-in/submit.ts:33` — POST entry point
- `src/pages/api/games/two-truths-vote.ts` — POST entry point
- `src/pages/api/games/two-truths-entry.ts` — POST entry point
- `src/types.ts:7` — `TwoTruthsLieIndex = 1 | 2 | 3`
- `supabase/migrations/20260609100000_emoji_check_in_daily_sessions.sql:10` — UNIQUE `(team_id, session_date)`
- `supabase/migrations/20260609100000_emoji_check_in_daily_sessions.sql:31` — UNIQUE `(session_id, membership_id)`
- `supabase/migrations/20260609100000_emoji_check_in_daily_sessions.sql:75–91` — emoji submissions INSERT RLS
- `supabase/migrations/20260610111000_two_truths_structured_round.sql:1–15` — `two_truths_rounds` schema
- `supabase/migrations/20260610111000_two_truths_structured_round.sql:17–40` — `two_truths_entries` schema
- `supabase/migrations/20260610111000_two_truths_structured_round.sql:42–56` — `two_truths_guesses` schema
- `supabase/migrations/20260610111000_two_truths_structured_round.sql:169–194` — guesses INSERT RLS (self-vote + phase)
- `supabase/migrations/20260611100000_team_management_soft_memberships.sql:158–185` — updated guesses RLS with `removed_at` check
- `tests/helpers/fixtures.ts` — all fixture builders
- `tests/helpers/scenario.ts:23` — `setupTwoTeamScenario`
- `tests/rls/cross-team-denial.test.ts` — reference for denial assertion pattern

## Architecture Insights

**Defence-in-depth is consistent across both games.** Every rule has at least service-layer + RLS enforcement. The DB UNIQUE constraints provide a hard third layer that survives any service bypass. Tests should assert at the service layer (via real clients) to exercise all three layers simultaneously.

**Phase state machine is the central control.** Both games use a phase/status column to gate operations: emoji sessions use `status = 'open'/'revealed'`; Two Truths uses `phase = 'collecting'/'voting'/'revealed'`. Any test that needs to exercise "after close" must advance the state first.

**Membership scoping vs. profile scoping.** Duplicate prevention for both games uses `membership_id` (per-team user identity), not global `profile_id`. This is intentional: the same user can participate once per team. Tests that reuse a single user across two teams must use distinct membership IDs and will produce two separate valid submissions.

**The `included_in_voting` flag is a non-obvious gate.** A Two Truths entry created during collection cannot be voted on until `prepareTwoTruthsVotingRound()` (or a manual bulk UPDATE) sets `included_in_voting = true`. Tests that try to vote before this step will fail with "entry not found" rather than a phase error.

## Historical Context (from prior changes)

- `context/changes/testing-foundation-access-control/` — Phase 1 integration harness; established the `withRetry`, `createCleanupRegistry`, `setupTwoTeamScenario`, and real-client patterns that Phase 2 inherits
- `context/changes/testing-regression-guardrails/` — membership schema compatibility tests; established the service-mock pattern for unit tests (separate from integration tests)
- `context/changes/S-07-daily-emoji-check-in-loop/` — original feature implementation; change notes would carry the intent behind the UTC-only timezone decision
- `context/changes/S-09-two-truths-structured-round/` — original Two Truths implementation; source of the phase state machine design

## Open Questions

1. **Date boundary test feasibility**: The test plan flags boundary-time submissions as a risk. In practice, testing UTC midnight requires either mocking `new Date()` (not currently done in integration tests), or relying on `createEmojiSessionAs(user, teamId, sessionDate)` with a known past/future date to assert the `session_date` column value directly. The latter is cleaner and avoids time-dependency.

2. **Auto-reveal behaviour**: `submitTwoTruthsGuess` auto-triggers `finalizeTwoTruthsVoting` when all required guesses are submitted (`bondify.ts:3196–3200`). The "all required guesses" threshold is not immediately obvious from the research — needs clarification during planning: is it every member voting on every entry, or a fixed subset?

3. **Concurrent session creation**: The retry path (`bondify.ts:1399–1410`) handles the race condition, but integration tests typically run sequentially. This risk is more a correctness argument than a test scenario unless the suite is run with concurrency. May be acceptable to document rather than test.

4. **`closeCollectionAs()` helper scope**: `prepareTwoTruthsVotingRound` already wraps collection-close + entry creation. Whether Phase 2 needs finer-grained control (e.g., close collection without creating entries, to test the `included_in_voting = false` gate) depends on exact test scenarios — to be resolved in planning.
