# Structured Two Truths And A Lie Round Implementation Plan

## Overview

Implement roadmap slice `S-09` by replacing the loose `Two Truths and a Wish` flow with a structured `Two Truths and a Lie` multiplayer round. The new round collects one authored truth-truth-lie set per participant, freezes the participant set before guessing begins, records one guess per teammate entry, reveals only after voting closes, and exposes a summary-only history view for past rounds.

## Current State Analysis

- [`supabase/seed.sql`](D:\REPOS\bondify\supabase\seed.sql) still seeds the legacy template as `two-truths-and-a-wish`, with a free-text prompt and `is_history_enabled = false`, so the current product contract is not just unstructured, it is also the wrong game shape.
- [`src/lib/services/bondify.ts`](D:\REPOS\bondify\src\lib\services\bondify.ts) models games generically as one open `game_round` plus one free-text `game_response` per membership, then an anonymous reveal. That contract cannot preserve three separate statements, the lie index, or per-opponent guesses.
- [`src/pages/teams/[teamId]/games/[gameSlug].astro`](D:\REPOS\bondify\src\pages\teams\[teamId]\games\[gameSlug].astro) currently supports only three states for linked games: start, textarea submission, and anonymous final reveal. It has no concept of collection vs voting and explicitly frames reveal as anonymous.
- [`src/pages/api/games/submit.ts`](D:\REPOS\bondify\src\pages\api\games\submit.ts) and [`src/pages/api/games/reveal.ts`](D:\REPOS\bondify\src\pages\api\games\reveal.ts) are built around the generic text-response lifecycle, so extending them in place without a template-specific contract would couple other games to Two-Truths-specific rules.
- [`src/types.ts`](D:\REPOS\bondify\src\types.ts) still treats linked-game participation as generic response text plus participant-safe reveal DTOs. There is no typed model yet for authored statements, guess coverage, round-phase progress, or score summaries.
- [`context/foundation/prd-v2.md`](D:\REPOS\bondify\context\foundation\prd-v2.md) and [`context/foundation/roadmap.md`](D:\REPOS\bondify\context\foundation\roadmap.md) explicitly position `S-09` as a structured multiplayer guessing redesign, not as an enhancement to the old wish-based flow.
- [`src/pages/teams/[teamId]/history.astro`](D:\REPOS\bondify\src\pages\teams\[teamId]\history.astro) and the `S-04` history contract expect anonymous response-card history. That is a poor fit for this slice because the user wants authored entries visible during the round and summary-only history after reveal.

## Confirmed Planning Decisions

| Decision | Choice |
| --- | --- |
| Round cadence | On-demand round |
| Reveal timing | Reveal only after round close |
| Guess visibility | Hidden during voting, visible only at final reveal |
| Author visibility | Visible from the start |
| Scoring | Lightweight per-round scoring |
| Entry count | Exactly one set per participant |
| Vote scope | Each participant votes once on every other participant set |
| Close behavior | Voting auto-closes when all required votes are in, with manual close fallback |
| Partial participation | Manual close may exclude missing votes from scoring |
| Edit policy | No edits after submit |
| History | Round summary only |
| Rollout policy | Clean-break structured template; legacy wish-based data may be removed if needed |

## Desired End State

- Bondify exposes a dedicated `Two Truths and a Lie` template rather than the old wish-based variant.
- Starting the game opens a collection phase where any active team member may submit one three-statement set and choose which statement is the lie.
- Once collection is closed, only submitted entries participate in the round and the game moves into voting.
- During voting, authored entries are visible, self-guessing is disallowed, and each participant can cast exactly one guess on every other included entry.
- Votes remain hidden until the final reveal.
- When all required votes are in, the round closes automatically; a manual close path can reveal partial-vote rounds without counting missing guesses.
- Final reveal shows each authored set, which statement was the lie, how teammates guessed, and lightweight per-round scoring.
- History stores only a useful per-round summary for this template instead of replaying the entire live voting surface.

## What We're Not Doing

- No realtime subscriptions or live-updating vote counts.
- No editing submitted statements after save.
- No anonymous author mode for this template.
- No cumulative leaderboard, streaks, or season-level score retention.
- No attempt to preserve backward-compatible behavior for the old `two-truths-and-a-wish` experience.
- No deletion or redesign of the generic `game_rounds` / `game_responses` foundation used by the other linked games.

## Implementation Approach

Keep the generic team/game shell and `game_rounds` container used across Bondify, but add a dedicated Two-Truths-specific model for structured entries and guesses. The collection and voting stages should live in Two-Truths-specific state rather than being forced into the generic `game_responses` contract.

This slice should be treated as a clean-break template rollout, not a migration preserving old wish-based semantics. The old template row and its historical rows may be removed if that proves simpler than carrying compatibility code, but shared linked-game infrastructure must remain intact because other games still depend on it.

## Critical Implementation Details

### Participant freeze

Because the round is on-demand, there is no reliable "everyone who intended to play" list at round start. The implementation should therefore define round participants as the members who have submitted by the moment collection is closed. After that, the participant set is frozen for voting and scoring.

### Round phases

The generic game status alone is too coarse for this slice. The implementation should model at least these Two-Truths-specific phases:

- `collecting`: structured entries can still be submitted
- `voting`: included entries are fixed and guesses are being collected
- `revealed`: final results are visible

`game_rounds.status` can stay aligned to the broader linked-game contract, but the Two-Truths layer needs its own phase-aware logic so the page can distinguish collection from voting without breaking other games.

### Lightweight scoring rule

Unless implementation reveals a blocker, use the simplest meaningful per-round score model:

- `+1` to a voter for each correct guess
- `+1` to an author for each teammate they fooled with a wrong guess

Missing votes excluded through manual close should neither add nor subtract points.

### History shape

This template should not reuse the anonymous response-card history UI from `S-04` unchanged. The history view for this template should render round summaries only, such as author, statements, lie marker, and score totals, without turning history into a full replay of every live action.

### Clean-break rollout boundary

The user approved deleting old data and tables if needed, but that permission applies only to the legacy wish-based template data and any new Two-Truths-specific compatibility layer. Shared tables like `game_rounds` and `game_responses` must stay because the other selected games still rely on them.

## Phase 1: Structured Round Data Model And Service Contracts

### Overview

Introduce the new template, dedicated structured tables, and phase-aware service contracts before touching the page UI.

### Changes Required:

#### 1. Add the clean-break structured template rollout

**Files**: `supabase/seed.sql`, `supabase/migrations/<timestamp>_two_truths_structured_template.sql`

**Intent**: Replace the old wish-based game contract with the new structured multiplayer one.

**Contract**: Add a structured `two-truths-and-a-lie` template with the final prompt, and stop exposing `two-truths-and-a-wish` as an active selectable game. If the simplest safe path is to purge legacy wish-based rounds/responses and remove or replace that template row, do so inside the migration rather than carrying compatibility logic forward. The new template should be history-enabled so summary history can work.

#### 2. Add dedicated Two-Truths tables for entries, guesses, and phase metadata

**Files**: `supabase/migrations/<timestamp>_two_truths_structured_round.sql`

**Intent**: Store structured truths/lies and guesses without distorting the generic free-text response table.

**Contract**: Add a dedicated per-round metadata table keyed to `game_round_id`, a structured entries table keyed to round plus author membership, and a guesses table keyed to round plus voter plus target entry. Persist the three statement fields, the lie index, round phase, timestamps for collection/voting/reveal transitions, and uniqueness constraints that prevent duplicate entries or duplicate guesses.

#### 3. Add typed DTOs and domain errors for structured rounds

**Files**: `src/types.ts`

**Intent**: Give the page, APIs, and service layer explicit contracts instead of leaking ad hoc shapes.

**Contract**: Add typed state for collection, voting, and reveal views, plus entry, guess-progress, and reveal-summary DTOs. Add domain errors for invalid lie index, duplicate submission, duplicate vote, self-guessing, insufficient entries to start voting, round phase mismatch, and legacy-template-not-supported.

#### 4. Add phase-aware service loaders and mutation methods

**Files**: `src/lib/services/bondify.ts`

**Intent**: Keep the structured round rules out of Astro page files and out of generic routes used by other games.

**Contract**: Extend or specialize the game-state loader so `two-truths-and-a-lie` returns structured phase-aware state while other games keep their current generic contract. Add service methods for:

- submitting one structured entry
- closing collection and freezing the participant set
- casting one guess for another participant's entry
- checking whether all required votes are complete
- manually closing voting with partial guesses allowed
- revealing the final summary and score breakdown

The service must enforce no edits after submit, no self-guessing, and no duplicate votes.

#### 5. Define history summary projection for the structured template

**Files**: `src/lib/services/bondify.ts`, `src/types.ts`

**Intent**: Make `S-04` history compatible with the new template without turning history into the live voting screen.

**Contract**: Add a participant-safe summary DTO for revealed Two-Truths rounds that includes author identity, structured statements, the lie marker, and lightweight score totals, but not a full per-click replay surface. Ensure the history read path can return a template-specific summary variant for this game while keeping the current generic history behavior for the other templates.

### Success Criteria:

#### Automated Verification:

- The new Supabase migrations apply cleanly against local schema.
- `npm run lint` passes for the new types and service contracts.
- `npm run build` passes with the structured template and service changes.
- Duplicate entries, duplicate guesses, self-guesses, and invalid lie indexes are rejected through the service layer.

#### Manual Verification:

- The old wish-based template is no longer presented as if it were still the supported game.
- Starting the new template creates a collection-phase round instead of the old free-text flow.
- Submitting a structured entry persists the three statements and lie position correctly.
- A participant cannot submit a second entry or edit the first one after submission.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets. The corresponding `- [ ]` checkboxes live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Structured Submission And Voting Experience

### Overview

Replace the generic textarea flow on the game page with collection and voting experiences tailored to the structured round rules.

### Changes Required:

#### 1. Add the structured collection UI

**File**: `src/pages/teams/[teamId]/games/[gameSlug].astro`

**Intent**: Let participants submit a real truth-truth-lie set instead of a loose paragraph.

**Contract**: For the new template slug, render three statement fields plus a lie selector during the collection phase. Once the current member has submitted, swap the form for a waiting state that shows collection progress and clearly states that edits are locked.

#### 2. Add a controlled transition from collection to voting

**Files**: `src/pages/teams/[teamId]/games/[gameSlug].astro`, `src/pages/api/games/two-truths-close-collection.ts`, `src/lib/game-flash.ts`

**Intent**: Freeze the participant set intentionally before guesses begin.

**Contract**: Render a close-collection action once there are enough submitted entries to make the game valid. Closing collection snapshots the current submitters as the round participants, opens voting, and excludes members who did not submit from that round. Flash states should explain why the round could or could not move forward.

#### 3. Add the structured voting UI and vote API

**Files**: `src/pages/teams/[teamId]/games/[gameSlug].astro`, `src/pages/api/games/two-truths-vote.ts`, `src/lib/game-flash.ts`

**Intent**: Capture one hidden guess per participant per teammate entry.

**Contract**: During voting, render each authored entry except the viewer's own, with one selectable lie guess for that entry. Show author names from the start, but do not show current guess totals, correctness, or other members' choices. The page should show outstanding-vote progress for the current user and whether the round is waiting on others.

#### 4. Add manual close fallback for incomplete voting

**Files**: `src/pages/teams/[teamId]/games/[gameSlug].astro`, `src/pages/api/games/two-truths-close-voting.ts`, `src/lib/services/bondify.ts`

**Intent**: Keep the round finishable when some participants stop short of full vote coverage.

**Contract**: If not all required guesses are in, an active member can manually close voting. The resulting reveal excludes missing guesses from scoring rather than inventing defaults. If all required guesses are present, the round should auto-close into final reveal without waiting for this manual action.

#### 5. Keep non-Two-Truths templates on the existing generic path

**Files**: `src/pages/teams/[teamId]/games/[gameSlug].astro`, existing generic game API routes as needed

**Intent**: Avoid a regression where Rose/Thorn/Bud or How I Work accidentally inherit Two-Truths-specific rules.

**Contract**: The page and route changes must branch cleanly on the structured template slug. Existing selected games should still use the current generic start, submit, reveal, and history behavior unless explicitly changed by their own slice.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes for the specialized page UI, flash changes, and Two-Truths routes.
- `npm run build` passes with the new collection, voting, and close flows.
- Invalid form payloads, duplicate guesses, and self-guess attempts fail safely with controlled flash messages.

#### Manual Verification:

- A participant can submit one structured entry during collection and then sees a locked waiting state.
- Closing collection moves the round into voting using only submitted entries.
- During voting, authored entries are visible but guess results remain hidden.
- A participant cannot vote on their own entry and cannot vote twice on the same teammate entry.
- When every required guess is submitted, the round auto-closes into final reveal.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets. The corresponding `- [ ]` checkboxes live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Final Reveal, Summary History, And Clean-Break Rollout

### Overview

Finish the user-visible experience with a clear reveal, summary-only history integration, and removal of leftover legacy template exposure.

### Changes Required:

#### 1. Render the final reveal summary with lightweight scoring

**File**: `src/pages/teams/[teamId]/games/[gameSlug].astro`

**Intent**: Make the end of the round feel conclusive and understandable.

**Contract**: Final reveal should show each participant's three statements, clearly mark which statement was the lie, show how teammates guessed, and surface the agreed lightweight score summary. Guess visibility starts here and only here.

#### 2. Integrate summary-only history for the structured template

**Files**: `src/lib/services/bondify.ts`, `src/types.ts`, `src/pages/teams/[teamId]/history.astro`

**Intent**: Preserve the usefulness of selected-game history without replaying the live round in full.

**Contract**: Revealed Two-Truths rounds should appear in team history as summary entries grouped with the rest of selected-game history, but rendered with this template's structured summary variant rather than the old anonymous response-card layout. History should not expose an editable or re-votable surface.

#### 3. Remove leftover legacy template entry points

**Files**: `supabase/seed.sql`, `src/lib/services/bondify.ts`, game selection surfaces as needed

**Intent**: Avoid shipping a half-converted product where both the old and new game contracts appear active.

**Contract**: Ensure only the structured template is discoverable and startable. If old wish-based rows or selection artifacts remain after the migration, remove them now rather than keeping dead compatibility branches around.

#### 4. Verify end-to-end round and history behavior

**Files**: plan progress only, plus touched runtime files as needed

**Intent**: Confirm that the slice works as a complete game loop, not just as isolated forms.

**Contract**: Manual verification must cover collection, close-collection, voting, auto-close, manual-close fallback, final reveal, and summary history visibility using real team memberships.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes for all `S-09` touched files.
- `npm run build` passes after history integration and legacy-template cleanup.
- `git diff --check` reports no whitespace errors in `S-09` touched files.

#### Manual Verification:

- Final reveal shows truths, lies, guesses, and lightweight scores clearly.
- Guess outcomes remain hidden until reveal and do not leak during voting.
- Manually closing an incomplete voting round reveals only recorded guesses and excludes missing votes from scoring.
- A revealed structured round appears in team history as a summary entry.
- The old wish-based template is no longer reachable through normal game selection.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before marking the slice done. Phase blocks use plain bullets. The corresponding `- [ ]` checkboxes live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit / Service-Level Focus

- Structured-entry validation, especially lie-index bounds and duplicate-submission prevention.
- Guess validation, especially self-guess rejection and duplicate-vote rejection.
- Score calculation for correct guesses, fooled authors, and partial-vote manual close.
- Phase transition guards between collection, voting, and reveal.

### Integration Focus

- Migration behavior for new template rollout and legacy wish-data cleanup.
- Structured round service loading alongside unchanged generic game services.
- History projection for structured reveal summaries versus the generic history contract.
- Auto-close detection when all required guesses are in.

### Manual Testing Steps

1. Start the structured Two Truths and a Lie game from a real team.
2. Submit structured entries from at least two different members and confirm edits are locked afterward.
3. Close collection and confirm only submitters become round participants.
4. Vote from each participant account and confirm self-guessing is disallowed.
5. Verify that when all required guesses are submitted, the round closes into reveal automatically.
6. Start a second round, leave some votes missing, manually close voting, and confirm missing guesses are excluded from scoring.
7. Open `/teams/<teamId>/history` and confirm the revealed structured round appears as a summary entry.
8. Confirm the old wish-based template no longer appears in normal selection flow.

## Performance Considerations

- Expected team sizes are still small, so per-round aggregation for votes and score summaries can remain server-side without caching.
- Add indexes or uniqueness constraints that keep round-entry lookups and vote-coverage checks cheap, especially by `game_round_id`, `author_membership_id`, and `voter_membership_id`.
- Avoid N+1 history rendering for structured rounds by loading entry and vote summaries in one service-layer read where possible.

## Migration Notes

- Use the standard Supabase migration naming format `YYYYMMDDHHmmss_short_description.sql`.
- The clean-break permission does not justify deleting shared linked-game tables. Only the legacy `two-truths-and-a-wish` template data and any slice-specific compatibility artifacts are eligible for removal.
- If implementation chooses to delete legacy wish-based rows, do it inside the migration so local and deployed environments converge cleanly.
- Ensure the new structured template is marked history-enabled if summary history is expected to work through the existing selected-game history route.

## References

- Roadmap slice: `context/foundation/roadmap.md`
- Product requirements: `context/foundation/prd-v2.md`
- Prior selected-game submission flow: `context/changes/S-02-game-round-and-anonymous-submission/plan.md`
- Prior reveal flow: `context/changes/S-03-shared-reveal-results/plan.md`
- Prior history flow: `context/changes/S-04-selected-game-history/plan.md`
- Shared lessons: `context/foundation/lessons.md`
- Shared types: `src/types.ts`
- Game service layer: `src/lib/services/bondify.ts`
- Game page: `src/pages/teams/[teamId]/games/[gameSlug].astro`
- Existing game APIs: `src/pages/api/games/start.ts`, `src/pages/api/games/submit.ts`, `src/pages/api/games/reveal.ts`
- Seed templates: `supabase/seed.sql`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` - <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Structured Round Data Model And Service Contracts

#### Automated

- [x] 1.1 Supabase migrations apply cleanly for the structured template and Two-Truths tables
- [x] 1.2 `npm run lint` passes for the new types and service contracts
- [x] 1.3 `npm run build` passes with the structured template and service changes
- [x] 1.4 Duplicate entries, duplicate guesses, self-guesses, and invalid lie indexes are rejected through the service layer

#### Manual

- [ ] 1.5 The old wish-based template is no longer presented as if it were still the supported game
- [ ] 1.6 Starting the new template creates a collection-phase round instead of the old free-text flow
- [ ] 1.7 Submitting a structured entry persists the three statements and lie position correctly
- [ ] 1.8 A participant cannot submit a second entry or edit the first one after submission

### Phase 2: Structured Submission And Voting Experience

#### Automated

- [x] 2.1 `npm run lint` passes for the specialized page UI, flash changes, and Two-Truths routes
- [x] 2.2 `npm run build` passes with the new collection, voting, and close flows
- [x] 2.3 Invalid form payloads, duplicate guesses, and self-guess attempts fail safely with controlled flash messages

#### Manual

- [ ] 2.4 A participant can submit one structured entry during collection and then sees a locked waiting state
- [ ] 2.5 Closing collection moves the round into voting using only submitted entries
- [ ] 2.6 During voting, authored entries are visible but guess results remain hidden
- [ ] 2.7 A participant cannot vote on their own entry and cannot vote twice on the same teammate entry
- [ ] 2.8 When every required guess is submitted, the round auto-closes into final reveal

### Phase 3: Final Reveal, Summary History, And Clean-Break Rollout

#### Automated

- [x] 3.1 `npm run lint` passes for all `S-09` touched files
- [x] 3.2 `npm run build` passes after history integration and legacy-template cleanup
- [x] 3.3 `git diff --check` reports no whitespace errors in `S-09` touched files

#### Manual

- [ ] 3.4 Final reveal shows truths, lies, guesses, and lightweight scores clearly
- [ ] 3.5 Guess outcomes remain hidden until reveal and do not leak during voting
- [ ] 3.6 Manually closing an incomplete voting round reveals only recorded guesses and excludes missing votes from scoring
- [ ] 3.7 A revealed structured round appears in team history as a summary entry
- [ ] 3.8 The old wish-based template is no longer reachable through normal game selection

### 2026-06-12 Verification Note

- The slice is implemented and was included in the manual cross-slice sweep after the structured rules were finalized.
- Core-path confidence is now good enough to treat the feature as landed, but the remaining high-value checks are still the edge cases listed above: incomplete-vote manual close, history-summary rendering, and legacy-template reachability.
