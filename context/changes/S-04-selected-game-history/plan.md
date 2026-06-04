# Selected Game History Implementation Plan

## Overview

Implement roadmap slice `S-04` by adding a team-scoped history view for selected games. History entries are derived from revealed rounds for history-enabled templates, retained for 30 days from first participation, grouped by game, and soft-clearable by the team owner.

## Current State Analysis

- `S-03` is functionally working: a member can reveal an open round and see participant-safe response text on the team/game page.
- The foundation schema already supports the history contract:
  - `game_templates.is_history_enabled` marks selected games.
  - `game_rounds.history_visible_until` stores the retention cutoff.
  - `game_rounds.history_cleared_at` stores soft-clear state.
  - `game_rounds.status` already distinguishes `open` and `revealed`.
- `src/lib/services/bondify.ts` already exposes `getParticipantSafeHistory(teamId)`, but it currently needs to be tightened so it returns only revealed, history-enabled, unexpired, uncleared rounds.
- The foundation implementation review warned that participant-safe response reads must be reveal-gated before S-04 uses them.
- `src/pages/dashboard.astro` already has the selected-team context and is the right place to link to a separate history page.
- The existing `game_rounds_update_for_team_members` RLS policy is broad enough that owner-only clear should not be implemented as UI-only hiding; the database policy needs a small refinement.

## Goals

- Start the 30-day retention clock for selected games when the first response is accepted.
- Keep response content gated until a round is revealed.
- Add a team history page at `/teams/<teamId>/history`.
- Group visible history entries by game template.
- Let any active team member view participant-safe history.
- Let the team owner clear all visible history or one visible history entry.
- Make clear a soft-hide operation by setting `history_cleared_at`.
- Preserve S-01 team setup, S-02 submission, and S-03 reveal behavior.

## Non-Goals

- No history for templates where `is_history_enabled = false`.
- No deletion of responses when history is cleared.
- No permanent archive beyond 30 days.
- No scheduled cleanup, cron job, or background worker.
- No realtime refresh, polling, or notifications.
- No per-entry detail routes.
- No member names, emails, profile IDs, membership IDs, or submitted-by lists in history.
- No analytics, scoring, moderation, or admin settings surface.

## Confirmed Planning Decisions

| Decision              | Choice                                                          |
| --------------------- | --------------------------------------------------------------- |
| History eligibility   | Selected games only: `game_templates.is_history_enabled = true` |
| History start         | First accepted response starts the 30-day history clock         |
| Response-content gate | History only renders revealed rounds                            |
| History location      | Separate route: `/teams/<teamId>/history`                       |
| Clear scope           | Owner can clear all visible history or one entry                |
| Clear meaning         | Set `history_cleared_at`; do not delete responses               |
| Viewer access         | All active team members can view participant-safe history       |
| Layout                | Group history entries by game template                          |

## Desired End State

- A selected-team dashboard includes a clear entry point to that team's history.
- Visiting `/teams/<teamId>/history` loads through the Bondify service layer and verifies the current user is an active team member.
- The page shows history-enabled game sections, each with recent revealed rounds and anonymous response cards.
- A non-history-enabled game can still be played and revealed, but it never appears in team history.
- If the current user created the team, the history page shows clear-all and clear-entry actions.
- If the current user is a non-owner member, the history page remains viewable but clear actions are absent and API calls are denied.
- Clearing history hides entries from the history page only; the existing game reveal screen can still show its latest revealed result.

## Scope

**In scope**

- Service-layer retention marker on response submission
- Data-only backfill or migration support for existing eligible rounds with responses
- RLS policy refinement for owner-only history clear
- Participant-safe history query hardening
- Owner clear service contracts
- Team history page
- Clear-all and clear-entry API route
- History flash messages
- Dashboard link to team history
- Manual checks with at least one history-enabled game and one live-only game

**Out of scope**

- New history tables
- Hard-delete privacy workflow
- Automated expiry cleanup
- Pagination or search
- History detail subpages
- Per-member visibility controls
- Admin role model beyond existing team creator ownership

## Architecture Decisions

### Selected games only

`game_templates.is_history_enabled` remains the source of truth for whether a game participates in history. Seeded examples already match this: `rose-thorn-bud` and `how-i-work` are history-enabled, while `two-truths-and-a-wish` is live-only.

### First-response marker, reveal-gated content

The retention marker should be written when the first response is accepted for a history-enabled round. The history read path must still exclude unrevealed rounds. This preserves the user's chosen "played game" retention clock without leaking response text before the shared reveal.

### Derived history, not duplicated history

History remains derived from `game_rounds` plus `game_responses`; do not add a separate history table. `history_visible_until` and `history_cleared_at` are enough to express visible, expired, and cleared states.

### Owner clear needs database and service enforcement

The team owner is `teams.created_by`. The service layer should check that owner before clearing history, and the Supabase policy for `game_rounds` updates should be refined so normal members can still support lifecycle updates while history clear requires team creator ownership.

### Clear is a soft-hide

Clear actions set `history_cleared_at` on matching rounds. They do not modify response rows and do not change the round's `status`, `revealed_at`, or game page reveal result. This keeps clear safe and reversible at the data level even if the UI treats it as hidden.

## Phase 1: Retention and Service Contracts

### Overview

Make history eligibility and retention correct at the service and database boundary before adding UI.

### Changes Required

1. **Add history/owner domain types and errors**
   **File**: `src/types.ts`

   **Intent:** Give history route, API, and service methods typed contracts for page state and clear results.

   **Contract:** Add a team history state shape such as `TeamHistoryState` with `team`, `entries`, and `canClearHistory`. Add clear result shape(s) for bulk and single-entry clear. Extend `BondifyDomainErrorCode` with owner/history clear errors such as `TEAM_OWNER_REQUIRED` and `HISTORY_ENTRY_NOT_FOUND` if needed.

2. **Refine `game_rounds` update policies**
   **File**: `supabase/migrations/<timestamp>_history_visibility_and_clear.sql`

   **Intent:** Ensure owner-only history clear is enforced below the UI layer.

   **Contract:** Add a migration that preserves member lifecycle updates where `history_cleared_at` remains null, and adds a creator/owner path for updates that set or preserve `history_cleared_at`. If replacing the existing broad update policy, do it explicitly and keep reveal/submission-driven lifecycle updates working.

3. **Backfill existing eligible played rounds**
   **File**: `supabase/migrations/<timestamp>_history_visibility_and_clear.sql`

   **Intent:** Keep local or pre-S-04 revealed selected games from disappearing only because they were created before the marker existed.

   **Contract:** In the same migration or a separate data-only migration, set `history_visible_until` for existing history-enabled rounds with responses and a null marker. Use the first response timestamp plus 30 days where possible.

4. **Mark history visibility on first response**
   **File**: `src/lib/services/bondify.ts`

   **Intent:** Start the 30-day retention clock as soon as an eligible selected game is played.

   **Contract:** After `submitCurrentMemberResponse()` successfully inserts a response, update the backing round only when its template is history-enabled and `history_visible_until` is null. Set `history_visible_until` to the accepted response timestamp plus 30 days, or to the server-side timestamp used for that first response plus 30 days.

5. **Harden participant-safe history reads**
   **File**: `src/lib/services/bondify.ts`

   **Intent:** Prevent unrevealed response text from appearing through the history path.

   **Contract:** Update `getParticipantSafeHistory(teamId)` so it verifies membership and returns only rows that are all of:
   - `status = 'revealed'`
   - `game_template.is_history_enabled = true`
   - `history_visible_until` is not null and not expired
   - `history_cleared_at` is null

   Continue mapping through participant-safe response DTOs only.

6. **Add owner clear service contracts**
   **File**: `src/lib/services/bondify.ts`

   **Intent:** Keep history clear rules reusable and out of route files.

   **Contract:** Add service methods such as `getTeamHistoryState(teamId)`, `clearTeamHistory(teamId)`, and `clearTeamHistoryEntry({ teamId, roundId })`. Viewing requires membership. Clearing requires `teams.created_by` to match the current profile. Clear methods set `history_cleared_at` and return a count or cleared round summary.

### Success Criteria

#### Automated Verification

- Supabase migration applies cleanly against the local schema.
- Targeted ESLint passes for `src/types.ts` and `src/lib/services/bondify.ts`.
- `npm run build` passes with the service/type changes.

#### Manual Verification

- Submitting the first response to a history-enabled selected game sets `history_visible_until`.
- Submitting to a live-only game leaves `history_visible_until` null.
- An unrevealed eligible round with responses does not return response text through the history service.
- A non-owner member cannot clear team history through the service/API contract.

---

## Phase 2: History Page and Clear API

### Overview

Expose the team history route and owner clear actions through the same SSR/form-backed style used by the rest of Bondify.

### Changes Required

1. **Add history flash helper**
   **File**: `src/lib/history-flash.ts`

   **Intent:** Show clear success and failure messages on the history page without adding client-side state.

   **Contract:** Follow the existing dashboard/game flash pattern with variants for clear-all success, clear-entry success, and clear errors. Store enough context to match the flash to `teamId`.

2. **Add clear history API route**
   **File**: `src/pages/api/teams/clear-history.ts`

   **Intent:** Provide one form-backed route for owner clear actions.

   **Contract:** Add `export const prerender = false` and `POST`. Validate `teamId` and optional `roundId` with zod. If `roundId` is present, clear that single entry; otherwise clear all visible history for the selected team. Set history flash and redirect to `/teams/<teamId>/history`.

3. **Add team history page**
   **File**: `src/pages/teams/[teamId]/history.astro`

   **Intent:** Give the selected team a dedicated history surface.

   **Contract:** Load `getTeamHistoryState(teamId)` through `callBondifyService()`. Render an unavailable/error state for denied or missing teams. Render empty state when no visible history exists. Group entries by template slug/name and sort groups and entries with newest revealed/created rounds first.

4. **Render anonymous grouped history**
   **File**: `src/pages/teams/[teamId]/history.astro`

   **Intent:** Make history useful without weakening anonymity.

   **Contract:** Each group should show the game name, prompt context, and recent revealed rounds. Each round should show date, response count, and anonymous response cards. Do not show member names, emails, profile IDs, membership IDs, or submitted/pending identity lists.

5. **Render owner clear controls**
   **File**: `src/pages/teams/[teamId]/history.astro`

   **Intent:** Let the team owner clear history at both scopes requested.

   **Contract:** If `canClearHistory` is true, render a clear-all form for the page and a clear-entry form for each round. If false, omit those controls entirely. All clear forms post to the clear API route and include hidden `teamId` plus optional `roundId`.

### Success Criteria

#### Automated Verification

- Targeted ESLint passes for the history page, history flash helper, clear API route, service, and shared types.
- `npm run build` passes with the new dynamic history route and API route.
- Invalid clear form payloads redirect without unhandled exceptions.

#### Manual Verification

- A team member can open `/teams/<teamId>/history` and see grouped selected-game history.
- A non-history-enabled game does not appear after being played and revealed.
- A non-owner member sees history but does not see clear controls.
- The owner can clear one entry and that entry disappears from history.
- The owner can clear all visible history and the history page becomes empty or updates accordingly.

---

## Phase 3: Dashboard Entry and End-to-End Verification

### Overview

Connect the new page to the selected-team dashboard and verify the full S-01 through S-04 loop.

### Changes Required

1. **Add dashboard history entry point**
   **File**: `src/pages/dashboard.astro`

   **Intent:** Make team history discoverable without crowding the game cards.

   **Contract:** For the selected team, add a link to `/teams/<activeTeamId>/history`. The link should preserve existing team switching, invite, roster, game picker, and sign-out behavior.

2. **Keep reveal result behavior independent from history clear**
   **File**: `src/lib/services/bondify.ts`

   **Intent:** Match the chosen clear meaning: hide from history only.

   **Contract:** Do not make `getLatestRevealedGameRound()` depend on `history_cleared_at`. The game page can continue showing the latest revealed result even if the round was cleared from history.

3. **Verify selected and live-only game paths**
   **Files**: `src/pages/dashboard.astro`, `src/pages/teams/[teamId]/games/[gameSlug].astro`, `src/pages/teams/[teamId]/history.astro`

   **Intent:** Prove the selected-game rule through the UI.

   **Contract:** Manual verification should cover at least one history-enabled template and one live-only template from `supabase/seed.sql`.

4. **Update plan progress as verification lands**
   **File**: `context/changes/S-04-selected-game-history/plan.md`

   **Intent:** Keep the 10x change artifact accurate for handoff.

   **Contract:** Mark automated checks complete only after commands pass. Mark manual checks complete only after the user or implementer verifies the behavior.

### Success Criteria

#### Automated Verification

- Targeted ESLint passes for all S-04 touched files.
- `npm run build` passes after dashboard integration.
- `git diff --check` reports no whitespace errors in S-04 touched files.

#### Manual Verification

- Dashboard shows a working history link for the selected team.
- A history-enabled game can be started, submitted, revealed, and then seen in grouped history.
- A live-only game can be started, submitted, and revealed but remains absent from history.
- Clearing a history entry hides it from history without deleting its game reveal result.
- Existing team creation, invite, submission, and reveal flows still work.

## Testing Strategy

### Unit Tests

- No dedicated unit-test harness exists for the Bondify service yet. If one is introduced, prioritize pure/date-bound helper tests for:
  - first-response plus 30-day timestamp calculation
  - grouping by template slug/name
  - owner flag derivation from `teams.created_by`

### Integration Tests

- Migration-level verification for the RLS policy refinement and backfill behavior.
- Service-level verification, if a service test harness exists or is added, for:
  - first response on history-enabled template sets retention
  - response on live-only template does not set retention
  - unrevealed eligible round is omitted from participant-safe history
  - revealed eligible round appears until expiry or clear
  - non-owner clear is denied
  - owner clear-one and clear-all set `history_cleared_at`

### Manual Testing Steps

1. Sign in as the owner, select a team on `/dashboard`, and confirm the history link appears.
2. Play and reveal `rose-thorn-bud` or `how-i-work`; confirm it appears on `/teams/<teamId>/history`.
3. Play and reveal `two-truths-and-a-wish`; confirm it does not appear in history.
4. Sign in as a non-owner team member; confirm the same history is visible and clear controls are absent.
5. As owner, clear one history entry; confirm it disappears from history.
6. Navigate back to the relevant game page; confirm the latest revealed result still renders.
7. As owner, clear all visible history; confirm the history page shows an empty state.

## Performance Considerations

The MVP history window is bounded to 30 days and team sizes are expected to stay small, so a simple SSR query plus in-page grouping is acceptable. The service should filter expired and cleared rows before rendering. No pagination, caching, or realtime sync is needed in this slice.

## Migration Notes

- Use the established Supabase migration naming format `YYYYMMDDHHmmss_short_description.sql`.
- No new table is expected.
- The migration may refine existing RLS policies and backfill `history_visible_until` for eligible rounds that already have responses.
- If local test data has old revealed selected-game rounds, the backfill should make them visible only when still inside the 30-day window.
- The first-response retention decision means an eligible round that is revealed much later may have less than 30 days left after reveal.

## References

- Roadmap item: `context/foundation/roadmap.md`
- Product requirements: `context/foundation/prd.md`
- Foundation handoff: `context/changes/F-01-team-and-game-data-foundation/handoff.md`
- Foundation implementation review: `context/changes/F-01-team-and-game-data-foundation/reviews/impl-review.md`
- Prior slice plan: `context/changes/S-03-shared-reveal-results/plan.md`
- Current dashboard: `src/pages/dashboard.astro`
- Current game page: `src/pages/teams/[teamId]/games/[gameSlug].astro`
- Service layer: `src/lib/services/bondify.ts`
- Shared types: `src/types.ts`
- Game flash pattern: `src/lib/game-flash.ts`
- Seed templates: `supabase/seed.sql`
- Foundation migration: `supabase/migrations/20260530090000_team_and_game_foundation.sql`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` - <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Retention and Service Contracts

#### Automated

- [x] 1.1 Supabase migration applies cleanly against the local schema
- [x] 1.2 Targeted ESLint passes for `src/types.ts` and `src/lib/services/bondify.ts`
- [x] 1.3 `npm run build` passes with the service/type changes

#### Manual

- [x] 1.4 First response to a history-enabled selected game sets `history_visible_until`
- [x] 1.5 Response to a live-only game leaves `history_visible_until` null
- [x] 1.6 Unrevealed eligible round does not return response text through history
- [x] 1.7 Non-owner member cannot clear team history

### Phase 2: History Page and Clear API

#### Automated

- [x] 2.1 Targeted ESLint passes for the history page, flash helper, clear API route, service, and shared types
- [x] 2.2 `npm run build` passes with the new history route and API route
- [x] 2.3 Invalid clear form payloads redirect without unhandled exceptions

#### Manual

- [x] 2.4 Team member can open `/teams/<teamId>/history` and see grouped selected-game history
- [x] 2.5 Non-history-enabled game does not appear after play and reveal
- [x] 2.6 Non-owner member sees history without clear controls
- [x] 2.7 Owner can clear one history entry
- [x] 2.8 Owner can clear all visible history

### Phase 3: Dashboard Entry and End-to-End Verification

#### Automated

- [x] 3.1 Targeted ESLint passes for all S-04 touched files
- [x] 3.2 `npm run build` passes after dashboard integration
- [x] 3.3 `git diff --check` reports no whitespace errors in S-04 touched files

#### Manual

- [x] 3.4 Dashboard shows a working history link for the selected team
- [x] 3.5 History-enabled game appears in grouped history after start, submit, and reveal
- [x] 3.6 Live-only game remains absent from history after start, submit, and reveal
- [x] 3.7 Clearing a history entry does not delete its game reveal result
- [x] 3.8 Existing team creation, invite, submission, and reveal flows still work
