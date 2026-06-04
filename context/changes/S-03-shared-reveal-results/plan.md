# Shared Reveal Results Implementation Plan

## Overview

Implement roadmap slice `S-03` by turning an active team/game round into a shared reveal state. Participants use the existing team-scoped game page to reveal submitted responses and see them together without exposing responder identity.

## Current State Analysis

`S-02` is implemented: `/teams/[teamId]/games/[gameSlug]` loads team/game state, lets a member start a round, submit exactly one response, and then wait with an anonymous submitted count. `src/lib/services/bondify.ts` already has `getParticipantSafeRoundReveal(roundId)`, but it does not verify team membership explicitly before returning reveal data and nothing transitions a round to `revealed`.

## Desired End State

An active team member can reveal an open round from the game page after at least one response is submitted. The round status changes to `revealed`, further submissions are rejected by the existing `ROUND_NOT_OPEN` path, and the same page renders every submitted response text as a shared result without names, emails, profile IDs, or membership IDs.

### Key Discoveries:

- The game route already resolves team/game state in `src/pages/teams/[teamId]/games/[gameSlug].astro`.
- `src/lib/services/bondify.ts` already maps participant-safe responses through `toParticipantSafeResponses()`.
- `game_rounds.status` already supports `open`, `revealed`, and `closed`.
- `src/pages/api/games/start.ts` and `src/pages/api/games/submit.ts` provide the zod plus flash plus redirect API pattern to follow.
- `src/lib/game-flash.ts` is the right place to add reveal success/error flash types.

## What We're NOT Doing

- No automatic reveal on timer, quorum, or all-members-submitted condition.
- No realtime updates or polling.
- No history UI or manual history clearing.
- No responder identity, member names, or emails in the results payload.
- No analytics, scoring, moderation, or team admin controls.

## Implementation Approach

Keep the flow server-rendered and incremental. Add a service method that verifies membership, checks the current open round, requires at least one submitted response, updates the round to `revealed`, and returns participant-safe reveal data. Add a form-backed API route that calls that method and redirects to the existing game page. Extend the game page to render a results state whenever the round has been revealed.

## Phase 1: Reveal Service and API Route

### Overview

Add the server-side reveal contract and a route that triggers it from the game page.

### Changes Required:

#### 1. Shared Types

**File**: `src/types.ts`

**Intent**: Let the game page know when a round has revealed participant-safe results.

**Contract**: Extend `TeamGameState` with a nullable participant-safe reveal field or equivalent view-model property that contains round/template/responses without responder identity.

#### 2. Service Layer

**File**: `src/lib/services/bondify.ts`

**Intent**: Keep reveal transition and access checks out of route files.

**Contract**: Add a method such as `revealTeamGameRound({ teamId, gameSlug, roundId })` that:

- requires the current user profile
- verifies team membership for `teamId`
- resolves the template for `gameSlug`
- verifies `roundId` belongs to that team/template
- requires `status = 'open'`
- requires at least one response
- updates the round to `revealed` with `revealed_at`
- returns participant-safe reveal data

Also update team/game state loading so revealed rounds can render results instead of disappearing when no open round exists.

#### 3. Reveal API Route

**File**: `src/pages/api/games/reveal.ts`

**Intent**: Follow the existing form-backed API pattern for game actions.

**Contract**: Add `export const prerender = false` and `POST`. Validate `teamId`, `gameSlug`, and `roundId` with zod, call the service reveal method, set a reveal success/error flash, and redirect back to `/teams/<teamId>/games/<gameSlug>`.

#### 4. Game Flash Types

**File**: `src/lib/game-flash.ts`

**Intent**: Display reveal success and reveal failure without client-side state.

**Contract**: Add `game-revealed` and `game-reveal-error` variants with `teamId`, `gameSlug`, and `message`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes with the reveal service and API route.
- `npm run build` passes with the new route.
- Invalid reveal form payloads redirect without unhandled exceptions.

#### Manual Verification:

- A non-member cannot reveal a team game.
- Revealing with zero submitted responses shows a friendly error.
- Revealing an already revealed or closed round shows a friendly error.

---

## Phase 2: Shared Results UI

### Overview

Render the revealed state on the existing team/game page and preserve the anonymity boundary.

### Changes Required:

#### 1. Game Page State

**File**: `src/pages/teams/[teamId]/games/[gameSlug].astro`

**Intent**: Make the revealed round visible as the game payoff.

**Contract**: Load revealed results from `TeamGameState` and branch before the start/submit/waiting UI. When results are present, render the shared results screen with template context, response count, and response text cards.

#### 2. Reveal Action UI

**File**: `src/pages/teams/[teamId]/games/[gameSlug].astro`

**Intent**: Let participants reveal the current open round manually.

**Contract**: In the submitted/waiting state, add a `POST /api/games/reveal` form with hidden `teamId`, `gameSlug`, and `roundId`. Disable or omit the action when submitted count is zero.

#### 3. Anonymity Boundary

**File**: `src/pages/teams/[teamId]/games/[gameSlug].astro`

**Intent**: Match the PRD's anonymous-by-default requirement.

**Contract**: Results may show response text and creation time, but must not show membership IDs, profile IDs, emails, names, or submitted/pending identity lists.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes with the updated game page.
- `npm run build` passes with the revealed results UI.

#### Manual Verification:

- User A starts a game and submits a response.
- User A reveals the round and sees all submitted responses on one results screen.
- User B opens the same team/game page and sees the same shared results.
- Response identity remains hidden in the results UI.
- Attempting to submit after reveal no longer shows an active submit form.

## Testing Strategy

### Unit Tests:

- No test harness exists for service methods yet; keep service logic small and verify through lint/build plus manual flow.

### Integration Tests:

- Use the server-rendered routes against Supabase during manual verification:
  - start round
  - submit response
  - reveal round
  - reload as another member

### Manual Testing Steps:

1. Sign in as User A, open a selected team's game page, start a game, and submit a response.
2. Reveal the round from the waiting state.
3. Confirm the page renders the shared results screen with submitted response text.
4. Sign in as User B, open the same team/game page, and confirm the same results are visible.
5. Confirm the page does not show responder names, emails, profile IDs, or membership IDs.
6. Confirm the submit form is no longer shown after reveal.

## Performance Considerations

MVP team sizes are small, so loading responses with the revealed round is acceptable. The query should continue using indexed round and response paths already established by the foundation migration.

## Migration Notes

No database migration is expected. The existing `game_rounds.status`, `revealed_at`, and `game_responses` tables already support this slice.

## References

- Roadmap item: `context/foundation/roadmap.md`
- Product requirements: `context/foundation/prd.md`
- Prior slice plan: `context/changes/S-02-game-round-and-anonymous-submission/plan.md`
- Game page: `src/pages/teams/[teamId]/games/[gameSlug].astro`
- Service layer: `src/lib/services/bondify.ts`
- Shared types: `src/types.ts`
- Game flash helper: `src/lib/game-flash.ts`
- Existing game routes: `src/pages/api/games/start.ts`, `src/pages/api/games/submit.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Reveal Service and API Route

#### Automated

- [x] 1.1 Lint passes with the reveal service and API route
- [x] 1.2 Build passes with the new route
- [x] 1.3 Invalid reveal form payloads redirect without unhandled exceptions

#### Manual

- [x] 1.4 Non-member reveal is denied
- [x] 1.5 Zero-response reveal shows a friendly error
- [x] 1.6 Already revealed or closed round shows a friendly error

### Phase 2: Shared Results UI

#### Automated

- [x] 2.1 Lint passes with the updated game page
- [x] 2.2 Build passes with the revealed results UI

#### Manual

- [x] 2.3 User A can reveal a submitted round
- [x] 2.4 User B sees the same shared results
- [x] 2.5 Response identity remains hidden
- [x] 2.6 Submit form is hidden after reveal
