# Daily Emoji Check-In Loop Implementation Plan

## Overview

Implement roadmap slice `S-07` by adding a true daily Emoji Check-In ritual to the selected-team dashboard. The new flow creates one shared Emoji Check-In session per team per day, accepts one emoji-only submission per member, supports a manual shared reveal, and shows a 30-day rolling mood timeline directly in the member overview.

This slice intentionally breaks from the current generic game-round contract for Emoji Check-In. The existing free-text round flow remains available for the other games, while Emoji Check-In moves to its own daily session model that is completed inline on `/dashboard`.

## Current State Analysis

The codebase already has the authenticated shell and selected-team overview needed for this slice, but the actual game flow is still the earlier generic MVP loop rather than the PRD's daily ritual model.

- `/dashboard` already acts as the selected-team member shell and game overview, with the shell context and game catalog loaded server-side in [dashboard.astro](/D:/REPOS/bondify/src/pages/dashboard.astro:17) and the current games overview rendered as card links in [dashboard.astro](/D:/REPOS/bondify/src/pages/dashboard.astro:218).
- The current team game page is fully generic: it loads `getTeamGameState()`, renders a textarea response form, and reveals shared results from the same route in [gameSlug.astro](/D:/REPOS/bondify/src/pages/teams/[teamId]/games/[gameSlug].astro:21), [gameSlug.astro](/D:/REPOS/bondify/src/pages/teams/[teamId]/games/[gameSlug].astro:169), and [gameSlug.astro](/D:/REPOS/bondify/src/pages/teams/[teamId]/games/[gameSlug].astro:191).
- The submit API and service still accept freeform `responseText`, so the current contract is incompatible with emoji-only multi-select input in [submit.ts](/D:/REPOS/bondify/src/pages/api/games/submit.ts:8), [submit.ts](/D:/REPOS/bondify/src/pages/api/games/submit.ts:55), and [bondify.ts](/D:/REPOS/bondify/src/lib/services/bondify.ts:1465).
- The service layer already supports shell context, generic game state, manual reveal, and grouped history, but all of it is based on `game_rounds` and `game_responses` in [bondify.ts](/D:/REPOS/bondify/src/lib/services/bondify.ts:857), [bondify.ts](/D:/REPOS/bondify/src/lib/services/bondify.ts:1223), [bondify.ts](/D:/REPOS/bondify/src/lib/services/bondify.ts:1266), and [bondify.ts](/D:/REPOS/bondify/src/lib/services/bondify.ts:1602).
- The current seed catalog has no Emoji Check-In template. It still exposes `rose-thorn-bud`, `two-truths-and-a-wish`, and `how-i-work` in [seed.sql](/D:/REPOS/bondify/supabase/seed.sql:1).
- The PRD and roadmap are explicit that S-07 changes the business rule itself: one shared daily session per team, emoji-only submission, shared reveal, and a 30-day comparable timeline in [prd-v2.md](/D:/REPOS/bondify/context/foundation/prd-v2.md:90), [prd-v2.md](/D:/REPOS/bondify/context/foundation/prd-v2.md:98), and [roadmap.md](/D:/REPOS/bondify/context/foundation/roadmap.md:26).

## Goals

- Create one shared Emoji Check-In session per team per calendar day.
- Use one application-defined team day boundary rather than viewer-local dates.
- Allow exactly one submission per member per day.
- Accept emoji-only input with 1 to 3 emojis per submission.
- Keep the reveal manual and anonymous until reveal time.
- Show the ritual inline on `/dashboard` for the selected team.
- Preserve equal access to the other games as separate linked experiences.
- Show a 30-day rolling dashboard timeline using per-day aggregate emoji counts.
- Start the new Emoji Check-In timeline fresh instead of migrating old generic round data into it.

## Non-Goals

- No dedicated Emoji Check-In page for primary use.
- No edits or resubmissions after a daily submission is saved.
- No auto-reveal on first submission or all-members-submitted logic.
- No migration of legacy generic round/history rows into the new Emoji Check-In timeline.
- No new team-timezone settings UI in this slice.
- No redesign of the existing history page for other games beyond compatibility adjustments.
- No changes to team management, invite flow, or owner/member permissions.
- No changes to Two Truths and a Lie structure or rules; `S-09` still owns that redesign.

## Confirmed Planning Decisions

| Decision | Choice |
| --- | --- |
| Session model | Dedicated daily Emoji Check-In session model |
| Day boundary | Team-local day using one app-level timezone rule |
| Reveal trigger | Manual reveal from the dashboard |
| Resubmission | One submission only; no edits after save |
| Primary surface | Inline on the selected-team dashboard |
| Timeline shape | Per-day aggregate emoji counts |
| Dashboard positioning | Emoji Check-In is inline on the dashboard, while other games remain equally accessible as links |
| Scale assumption | Small teams, low traffic |
| Legacy data policy | Clean break for Emoji Check-In timeline data |
| Emoji count rule | 1 to 3 emojis per member per day |
| Pre-reveal visibility | Anonymous submitted count only |

## Desired End State

When a signed-in member opens `/dashboard?team=<id>`, the selected team's member overview includes a daily Emoji Check-In module instead of treating all games as identical link cards. If today's session does not exist yet, the module transparently initializes it through a race-safe, idempotent server contract. The member can select 1 to 3 emojis, submit once, and then wait for the team's shared reveal.

Before reveal, the dashboard shows only anonymous participation progress for today's session. When a member triggers reveal, the dashboard plays a lightweight emoji burst or comparable celebratory transition, then settles into a readable results state for that day. Beneath today's state, the dashboard shows a 30-day timeline of past team days using per-day aggregate emoji counts that make mood trends visually comparable. Unrevealed or zero-submission days do not appear in the timeline, even if a session row was created earlier in the day.

The other games stay accessible from the same dashboard as ordinary linked entries. Their current generic round pages continue to exist, while Emoji Check-In uses its new daily ritual model and does not depend on the generic `/teams/[teamId]/games/[gameSlug]` page for completion.

## Scope

**In scope**

- New Emoji Check-In data model and migration
- Seed/catalog update for an `emoji-check-in` game template
- New service methods for loading today's session, submitting emojis, revealing, and reading the 30-day timeline
- Emoji-only validation and normalization
- Dashboard inline ritual module and reveal state
- Curated interactive emoji picker and reveal animation
- Compatibility changes so the old generic route does not remain the primary Emoji Check-In path
- Local Supabase/browser verification for the selected-team dashboard flow

**Out of scope**

- Generic game-round rewrite for all games
- Team-specific timezone configuration UI
- Realtime multiplayer sync, sockets, or polling
- Emoji analytics beyond the 30-day aggregate timeline
- Migrating or preserving old generic round data inside the new Emoji Check-In timeline
- New end-to-end test harness setup

## Implementation Approach

Treat Emoji Check-In as a specialized ritual beside the generic games, not as another thin wrapper around `game_rounds`. Add a dedicated session table keyed by `(team_id, session_date)` and a dedicated submission table keyed by `(session_id, membership_id)` so the daily uniqueness rule is explicit and queryable. Keep the rest of the catalog on the existing generic round/history path.

On the server side, add service methods that:

- resolve "today" using one app-level timezone rule
- fetch or create the selected team's current daily session
- validate and store one normalized emoji set per member
- reveal the current session manually
- aggregate the last 30 days into a timeline-friendly shape

On the UI side, keep the dashboard as the primary selected-team overview. Replace one generic game card with an inline Emoji Check-In module that mounts a small React island for the picker and reveal transition, but keep all authoritative submit/reveal actions server-backed through SSR-friendly forms and API routes.

## Critical Implementation Details

The "today" rule must live in one shared server utility, not be recomputed ad hoc in Astro pages, API routes, and service methods. S-07 introduces a date-based business rule, so inconsistent day-key logic would create duplicate sessions or cross-day submission bugs.

The fetch-or-create loader must be race-safe and idempotent. Multiple teammates can open the dashboard at the same time, so the implementation must rely on the unique `(team_id, session_date)` constraint plus an upsert-or-retry pattern rather than assuming only one request initializes the daily row.

Emoji Check-In should be a clean data break, not a silent reinterpretation of generic `game_rounds`. Old generic rows were not created with the daily session rule, so they should not be transformed into the new timeline or mixed into timeline queries.

The dashboard requirement and the "equal access" clarification must both hold. The implementation should complete Emoji Check-In inline on `/dashboard`, but the rest of the games should remain visible and usable as ordinary game links rather than disappearing behind the ritual module.

## Phase 1: Daily Session Foundation

### Overview

Add the dedicated storage and typed contracts that make one-team-one-day Emoji Check-In explicit and enforceable.

### Changes Required:

#### 1. Add Emoji Check-In domain types and errors

**File**: `src/types.ts`

**Intent**: Give the service layer, API routes, and dashboard a dedicated vocabulary for daily Emoji Check-In instead of overloading generic round types.

**Contract**: Add typed shapes for:

- the daily Emoji Check-In session record
- a member submission containing a normalized 1-to-3 emoji array
- today's dashboard state
- a revealed daily result summary
- a 30-day timeline entry with per-day aggregate emoji counts

Extend `BondifyDomainErrorCode` with dedicated cases for invalid emoji selection, duplicate daily submission, session-not-found/revealed conditions, and any day-boundary-specific failure the routes need to distinguish.

#### 2. Add a dedicated daily-session migration

**File**: `supabase/migrations/<timestamp>_emoji_check_in_daily_sessions.sql`

**Intent**: Make the daily uniqueness rule and emoji-only payload shape explicit in the database.

**Contract**: Create dedicated tables for the Emoji Check-In ritual, such as:

- a session table keyed by `team_id` and calendar `session_date`
- a submission table keyed by `session_id` and `membership_id`

The schema should encode:

- one session per team per day
- one submission per membership per session
- session lifecycle with unrevealed/revealed state and `revealed_at`
- emoji payload storage as a validated 1-to-3 element collection

Enable RLS and keep access aligned with the existing "active team members can participate" model.

#### 3. Add an app-level day-boundary helper

**Files**: `src/lib/services/bondify.ts`, optional shared helper under `src/lib/`

**Intent**: Keep "today" consistent everywhere the new ritual uses it.

**Contract**: Centralize conversion from the current server time to the active Emoji Check-In day key using one application-level timezone rule. The helper must be reusable by the dashboard loader, submit route, reveal route, and timeline query path. The timezone value should come from one explicit app-level configuration point rather than viewer locale.

#### 4. Seed the Emoji Check-In template and stop treating legacy generic data as its source

**File**: `supabase/seed.sql`

**Intent**: Add the new ritual to the game catalog without implying that older generic rows belong to the new timeline.

**Contract**: Add an `emoji-check-in` template entry with history/timeline participation enabled. Do not add any migration that backfills old generic rounds into the new daily session tables. The new timeline begins with post-migration daily sessions only.

### Success Criteria:

#### Automated Verification:

- The new Supabase migration applies cleanly on the local project.
- Shared types and service scaffolding build cleanly: `npm run build`
- Type-checked lint passes for the foundational files: `npm run lint`

#### Manual Verification:

- The local database contains at most one Emoji Check-In session per team per day.
- The local database rejects a second submission from the same membership for the same daily session.
- The project seed exposes an `emoji-check-in` catalog entry without mixing old generic rows into the new timeline source.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Service and Route Contracts

### Overview

Add the server-side contracts for today's session, emoji submission, manual reveal, and the 30-day dashboard timeline.

### Changes Required:

#### 1. Add Emoji Check-In service methods

**File**: `src/lib/services/bondify.ts`

**Intent**: Keep the daily ritual logic inside the service layer rather than scattering it across Astro pages and API routes.

**Contract**: Add dedicated service methods such as:

- `getTodayEmojiCheckInState({ teamId })`
- `submitTodayEmojiCheckIn({ teamId, emojis })`
- `revealTodayEmojiCheckIn({ teamId, sessionId })`
- `getEmojiCheckInTimeline({ teamId, days: 30 })`

The loader path should fetch or create today's session for an active team member using a race-safe, idempotent upsert-or-retry flow around the daily uniqueness constraint. Submit should normalize/validate emojis, enforce the one-save rule, and return the updated participant-safe state. Reveal should remain manual, require membership, reject empty-session reveals, and return a participant-safe revealed payload. Timeline reads should aggregate the last 30 team days into per-day emoji counts and exclude any unrevealed or zero-submission day, even if a session row exists.

#### 2. Add emoji validation and normalization

**File**: `src/lib/services/bondify.ts` or a focused helper under `src/lib/`

**Intent**: Enforce the 1-to-3 emoji-only rule at the server boundary.

**Contract**: Accept only normalized emoji values chosen from the picker surface. Reject blank strings, text comments, duplicate empty values, or payloads with fewer than 1 or more than 3 emojis. The validation boundary should be shared by the route handlers and the service methods so API misuse cannot bypass the UI constraint.

#### 3. Add dedicated API routes for submit and reveal

**Files**: `src/pages/api/games/emoji-check-in/submit.ts`, `src/pages/api/games/emoji-check-in/reveal.ts`

**Intent**: Keep the interactive dashboard flow SSR-friendly and form-backed like the rest of Bondify.

**Contract**: Add `POST` routes with `export const prerender = false`. Validate `teamId`, session identity, and the submitted emoji payload shape with zod. Submit sets success/error flash state and redirects back to `/dashboard?team=<id>`. Reveal does the same for manual reveal. Both routes must remain safe for refresh/retry behavior and avoid client-only mutation assumptions.

#### 4. Add Emoji Check-In flash handling

**File**: `src/lib/game-flash.ts` or a dedicated sibling helper if separation is cleaner

**Intent**: Surface submit and reveal outcomes on the dashboard without adding client-side auth/state drift.

**Contract**: Add flash variants for Emoji Check-In submit success, submit failure, reveal success, and reveal failure. The flash context must match `teamId` and be consumable from `/dashboard` without interfering with the existing generic game flash semantics.

#### 5. Keep the generic game path compatible without making it primary

**Files**: `src/lib/services/bondify.ts`, `src/pages/teams/[teamId]/games/[gameSlug].astro`, optional route guard helper

**Intent**: Avoid two competing primary flows for the same ritual.

**Contract**: The generic team game page should no longer be the main completion path for `emoji-check-in`. If the emoji template still resolves through the generic game route, it should redirect back to the dashboard's inline ritual module or render a simple shell-preserving handoff that points users back to `/dashboard?team=<id>`.

### Success Criteria:

#### Automated Verification:

- The new API routes, flash handling, and service contracts pass lint: `npm run lint`
- The project builds with the new daily-session service path: `npm run build`
- Invalid Emoji Check-In form payloads redirect without unhandled exceptions.

#### Manual Verification:

- Opening `/dashboard?team=<id>` for a valid member loads or creates today's Emoji Check-In session successfully.
- A member can submit 1 to 3 emojis once and gets a friendly duplicate-submission error on a second attempt.
- Revealing a session with zero submissions is blocked with a friendly error.
- Navigating to the old generic route for `emoji-check-in` does not leave the user in a second competing completion flow.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Dashboard Ritual UI

### Overview

Embed the new daily ritual directly into the selected-team dashboard while preserving equal access to the rest of the game catalog.

### Changes Required:

#### 1. Add an inline Emoji Check-In module to the dashboard

**File**: `src/pages/dashboard.astro`

**Intent**: Fulfill the roadmap's north star literally: members can complete today's ritual from the selected-team overview.

**Contract**: Load the selected team's today's-session state and 30-day timeline into `/dashboard`. Render an inline Emoji Check-In section inside the games overview area rather than sending members to a separate page. The section must support these states:

- no submission yet
- submitted / waiting for reveal
- revealed today
- unavailable/error fallback

#### 2. Preserve equal access to the other games

**File**: `src/pages/dashboard.astro`

**Intent**: Match the user's clarification that Emoji Check-In should not erase the rest of the game catalog.

**Contract**: Keep the other games visible and reachable as linked game entries. The games overview should continue to present the rest of the catalog as ordinary entry points, while Emoji Check-In is the inline interactive module within that same overview rather than a hidden or exclusive path.

#### 3. Add a small React island for a curated emoji picker

**Files**: new interactive component under `src/components/`, plus any supporting data/helper files

**Intent**: Deliver the required multi-emoji picker without converting the whole dashboard to a client-heavy page or introducing unnecessary dependency scope.

**Contract**: Mount a focused React island that exposes a curated in-repo emoji set, lets the member pick 1 to 3 emojis, shows current selections clearly, and submits through the server-backed route contract. Use existing UI primitives and styling conventions where they help. Do not assume a third-party emoji-picker dependency, full emoji search, or category-authoring UX in this slice. The island should not become the source of truth for auth, session lifecycle, or reveal state.

#### 4. Add the reveal moment and post-reveal result state

**Files**: dashboard UI plus the same Emoji Check-In island or a focused display component

**Intent**: Preserve the shared reveal payoff described in the PRD without weakening anonymity pre-reveal.

**Contract**: Before reveal, the dashboard shows only anonymous submitted count. After reveal, it plays an emoji burst or comparable lightweight animation and then renders the day's aggregated emoji result in a readable settled state. No member identities or per-person bundles should appear in this primary result view.

#### 5. Add the 30-day dashboard timeline

**File**: `src/pages/dashboard.astro`

**Intent**: Make mood patterns visually comparable across days without requiring a separate history trip for the main ritual.

**Contract**: Render a 30-day timeline directly on the dashboard using per-day aggregate emoji counts. The visualization can be simple and SSR-friendly, but each day should clearly communicate that day's emoji mix at a glance. The timeline should be derived only from the new daily Emoji Check-In sessions, not from legacy generic round history.

### Success Criteria:

#### Automated Verification:

- Dashboard and new interactive components pass lint: `npm run lint`
- The project builds with the inline Emoji Check-In module and timeline: `npm run build`

#### Manual Verification:

- A member can complete today's Emoji Check-In from `/dashboard?team=<id>` without navigating to a dedicated page.
- Before reveal, the dashboard shows anonymous submitted count only.
- After reveal, the dashboard shows a visible reveal transition and then a stable aggregated result state.
- The dashboard still shows the rest of the game catalog as accessible linked entries.
- The dashboard shows a readable 30-day timeline for the selected team.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Compatibility, Cleanup, and Verification

### Overview

Finish the slice by aligning the catalog/history surfaces and verifying the full member flow with local Supabase data and browser-visible behavior.

### Changes Required:

#### 1. Align catalog wording and navigation with the new ritual split

**Files**: `src/pages/dashboard.astro`, optional supporting copy/helpers

**Intent**: Keep the member overview honest now that one game is inline and the others remain page-linked.

**Contract**: Update dashboard copy so it no longer describes all games as the same "open game" flow. Emoji Check-In should read as today's inline ritual; the other games should read as linked participation paths.

#### 2. Keep other history behavior intact

**Files**: `src/pages/teams/[teamId]/history.astro`, `src/lib/services/bondify.ts`, optional dashboard link adjustments

**Intent**: Avoid accidental regression to the S-04 history path for the non-emoji games.

**Contract**: Preserve the existing grouped history route for the other games unless a small compatibility tweak is required for catalog wording or template filtering. The new Emoji Check-In 30-day dashboard timeline should not depend on the old generic history route to work.

#### 3. Verify seed and cleanup semantics locally

**Files**: `supabase/seed.sql`, local verification notes inside this plan

**Intent**: Make the clean-break rule explicit and testable.

**Contract**: Local verification should prove that:

- new daily Emoji Check-In sessions populate the dashboard timeline
- old generic rounds do not appear inside that timeline
- unrelated generic games still function through their existing start/submit/reveal/history flow

#### 4. Update plan progress as verification lands

**File**: `context/changes/S-07-daily-emoji-check-in-loop/plan.md`

**Intent**: Keep the change artifact accurate for implementation handoff.

**Contract**: Mark automated items complete only after the commands pass. Mark manual items complete only after the browser-visible checks succeed.

### Success Criteria:

#### Automated Verification:

- Final touched files pass lint: `npm run lint`
- Final touched files build cleanly: `npm run build`
- `git diff --check` reports no whitespace errors in S-07 touched files.

#### Manual Verification:

- The selected-team dashboard shows today's Emoji Check-In inline and still exposes the other games as links.
- A member can submit 1 to 3 emojis once, see anonymous progress, reveal manually, and then see the result transition.
- The 30-day timeline uses only post-migration daily Emoji Check-In sessions.
- The old generic round flow continues working for the non-emoji games.
- If local Supabase initially looks empty, the verification explicitly checks seed data separately from schema state.

## Testing Strategy

### Unit Tests:

- No dedicated unit-test harness exists yet, so the slice should rely on lint/build plus focused local verification.
- If the implementation extracts pure helpers, prioritize tests for:
  - day-key calculation in the configured app timezone
  - emoji normalization and max-count enforcement
  - timeline aggregation from submission arrays into per-day counts

### Integration Tests:

- Migration-level verification that the daily session uniqueness constraints hold.
- Service-level verification, if a harness is added, for:
  - fetch-or-create today's session
  - one submission per membership per day
  - manual reveal requiring at least one submission
  - timeline aggregation using only new daily-session data
  - legacy generic rounds remaining excluded from the new timeline

### Manual Testing Steps:

1. Start local Supabase and the app, then open `/dashboard` as a signed-in member with at least one team.
2. Verify the dashboard shows an inline Emoji Check-In module plus separate linked entries for the other games.
3. Submit 1 emoji, then repeat with 2 and 3 emojis across separate team members; confirm all are accepted.
4. Attempt a fourth emoji or a second submission from the same member; confirm it is rejected cleanly.
5. Before reveal, confirm the dashboard shows only anonymous submitted count.
6. Reveal the session manually and confirm the reveal transition runs before the settled results render.
7. Confirm the same dashboard shows a 30-day timeline entry for the revealed day.
8. Confirm existing non-emoji games still open through their linked pages and still use the generic start/submit/reveal flow.
9. If dashboard data looks missing, verify `supabase/seed.sql` data separately from migration health before treating the slice as broken.

## Performance Considerations

The slice can stay SSR-first because the target is small teams and low daily traffic. A focused React island for the picker/reveal UI is acceptable, but the server should remain the source of truth for session state, duplicate-submission checks, reveal status, and timeline aggregation. Timeline queries can stay simple and bounded to the last 30 days; no pagination, caching, polling, or realtime fan-out is needed in this slice.

## Migration Notes

- Use the standard Supabase migration naming format `YYYYMMDDHHmmss_short_description.sql`.
- Introduce new dedicated Emoji Check-In tables rather than retrofitting `game_rounds` for the daily uniqueness rule.
- Add the `emoji-check-in` template to seed data.
- Do not backfill or transform old generic `game_rounds` / `game_responses` into the new timeline.
- Preserve unrelated generic game data and history for the other templates.
- If the implementation needs one app-level timezone setting, place it behind one explicit configuration point so later team-level timezone support can replace it without rewriting the service contract.

## References

- Roadmap slice: `context/foundation/roadmap.md`
- Product requirements: `context/foundation/prd-v2.md`
- Lessons learned: `context/foundation/lessons.md`
- Existing member overview: `src/pages/dashboard.astro`
- Existing generic game page: `src/pages/teams/[teamId]/games/[gameSlug].astro`
- Existing submit API: `src/pages/api/games/submit.ts`
- Existing service layer: `src/lib/services/bondify.ts`
- Existing history plan: `context/changes/S-04-selected-game-history/plan.md`
- Existing shell plan: `context/changes/S-06-member-games-overview-shell/plan.md`
- Current seed catalog: `supabase/seed.sql`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Daily Session Foundation

#### Automated

- [x] 1.1 The new Supabase migration applies cleanly on the local project
- [x] 1.2 Shared types and service scaffolding build cleanly
- [x] 1.3 Type-checked lint passes for the foundational files

#### Manual

- [ ] 1.4 The local database contains at most one Emoji Check-In session per team per day
- [ ] 1.5 The local database rejects a second submission from the same membership for the same daily session
- [ ] 1.6 The seed exposes an `emoji-check-in` catalog entry without mixing old generic rows into the new timeline source

### Phase 2: Service and Route Contracts

#### Automated

- [x] 2.1 The new API routes, flash handling, and service contracts pass lint
- [x] 2.2 The project builds with the new daily-session service path
- [x] 2.3 Invalid Emoji Check-In form payloads redirect without unhandled exceptions

#### Manual

- [ ] 2.4 Opening `/dashboard?team=<id>` for a valid member loads or creates today's Emoji Check-In session successfully
- [ ] 2.5 A member can submit 1 to 3 emojis once and gets a friendly duplicate-submission error on a second attempt
- [ ] 2.6 Revealing a session with zero submissions is blocked with a friendly error
- [ ] 2.7 Navigating to the old generic route for `emoji-check-in` does not leave the user in a second competing completion flow

### Phase 3: Dashboard Ritual UI

#### Automated

- [x] 3.1 Dashboard and new interactive components pass lint
- [x] 3.2 The project builds with the inline Emoji Check-In module and timeline

#### Manual

- [ ] 3.3 A member can complete today's Emoji Check-In from `/dashboard?team=<id>` without navigating to a dedicated page
- [ ] 3.4 Before reveal, the dashboard shows anonymous submitted count only
- [ ] 3.5 After reveal, the dashboard shows a visible reveal transition and then a stable aggregated result state
- [ ] 3.6 The dashboard still shows the rest of the game catalog as accessible linked entries
- [ ] 3.7 The dashboard shows a readable 30-day timeline for the selected team

### Phase 4: Compatibility, Cleanup, and Verification

#### Automated

- [x] 4.1 Final touched files pass lint
- [x] 4.2 Final touched files build cleanly
- [x] 4.3 `git diff --check` reports no whitespace errors in S-07 touched files

#### Manual

- [ ] 4.4 The selected-team dashboard shows today's Emoji Check-In inline and still exposes the other games as links
- [ ] 4.5 A member can submit 1 to 3 emojis once, see anonymous progress, reveal manually, and then see the result transition
- [ ] 4.6 The 30-day timeline uses only post-migration daily Emoji Check-In sessions
- [ ] 4.7 The old generic round flow continues working for the non-emoji games
- [ ] 4.8 Seed data is verified separately from schema state if the dashboard initially looks empty
