# Game Round and Anonymous Submission

## Summary

Implement `S-02` by turning Bondify's dormant game foundation into the first playable team flow. A member chooses a micro-game from the selected team dashboard, opens a dedicated team-scoped game page, explicitly starts the current backing round for that team and game, and submits exactly one anonymous text response.

This plan deliberately stops before `S-03`: no response reveal, no results screen, no automatic ending, and no daily auto-started sessions. The output of this slice is participation, not payoff.

## Current State Analysis

- `S-01` is implemented: `/dashboard` loads authenticated team context, supports active-team switching, team creation, batch invites, and invite acceptance.
- The game data foundation already exists in `supabase/migrations/20260530090000_team_and_game_foundation.sql`:
  - `game_templates` stores reusable prompts.
  - `game_rounds` stores team/game play instances with `status`.
  - `game_responses` stores responses and enforces `unique (round_id, membership_id)`.
  - RLS restricts rounds and responses to active team members.
- `supabase/seed.sql` seeds three templates: `rose-thorn-bud`, `two-truths-and-a-wish`, and `how-i-work`.
- `src/lib/services/bondify.ts` already exposes foundational game methods:
  - `listGameTemplates()`
  - `createRound({ teamId, gameTemplateId })`
  - `submitResponse({ roundId, membershipId, responseText })`
  - `getParticipantSafeRoundReveal(roundId)`
- There are no game routes or API routes yet. Existing API patterns live under `src/pages/api/teams/*.ts` and use zod, service-layer calls, flash cookies, and redirects.
- The current service submission contract requires a caller-supplied `membershipId`; S-02 should derive the current user's membership server-side for the target round/team to avoid trusting a hidden form field for membership identity.

## Goals

- Add a template picker to the selected-team dashboard.
- Add a dedicated team-scoped game page for each team/game template.
- Support exactly one active open round per team and game for the MVP.
- Let any active team member explicitly start the current round if none is open.
- Let each active team member submit one required text response up to 500 characters.
- Show a submitted/waiting state after submission.
- Show an anonymous submitted-response count without revealing response content or identities.
- Keep all route writes behind service-layer contracts and existing RLS.

## Non-Goals

- No shared reveal/results screen.
- No response content preview after submission.
- No member-level submitted/pending list.
- No automatic round creation on page visit.
- No daily auto-started games.
- No time expiry or automatic close/reveal logic.
- No structured response fields per game template.
- No realtime subscriptions, polling, or live counter updates.
- No history UI or owner clear behavior.

## Confirmed Planning Decisions

- **Session scope:** one active round per team and game.
- **Future model:** multiple games will exist; daily game sessions are parked for later.
- **Game selection:** use a template picker.
- **User-facing route:** each game has a dedicated team-scoped page; rounds stay as backing state.
- **Round start:** starting is explicit, not automatic on visit.
- **Response shape:** one required text response, max 500 characters.
- **Post-submit UX:** show saved/waiting state only.
- **Progress visibility:** show anonymous submitted count, not identities.

## Desired End State

- A team member on `/dashboard?team=<teamId>` sees available micro-games for the selected team.
- Choosing a game opens a stable team-scoped game page, such as `/teams/<teamId>/games/<gameSlug>`.
- If no open round exists for that team/game, the page shows the prompt and a start action.
- Once started, all active team members opening the same game page connect to the same active backing round.
- A member who has not submitted sees a response form.
- A member who has submitted sees confirmation and waits for results in a later slice.
- A member cannot submit twice for the same active round.

## Scope

**In scope**

- Service-layer additions for game page state, active round lookup, explicit round start, and current-member response submission
- A narrow data invariant for one open round per team/game
- Shared types for game page state and submission results
- Dashboard template picker/navigation for the selected team
- Team-scoped game page route
- API route for explicit start
- API route for response submission
- Dashboard/game flash handling for user-facing success and failure messages
- Manual verification with two accounts

**Out of scope**

- S-03 reveal behavior
- S-04 history behavior
- Daily session automation
- Game authoring/admin
- Template-specific structured forms
- Email notifications or external sharing

## Architecture Decisions

### Game page as the stable surface

The product concept visible to users should be "open the team game", not "open round ID 123". Routes should be scoped by team and game template slug. The page resolves the active backing round internally.

Recommended route contract:

- `GET /teams/[teamId]/games/[gameSlug]`

The exact Astro filename can follow repo conventions, but the URL should remain team-scoped and game-scoped.

### One active round per team/game

The MVP needs one current session per team/game. Because the existing schema allows multiple open rounds for the same team/game, implementation should add a focused database invariant or an equivalently safe service guard.

Preferred database contract:

- Partial unique index on `game_rounds(team_id, game_template_id)` where `status = 'open'`.

This keeps concurrency behavior honest if two members click start at nearly the same time.

### Explicit round start

Opening a game page must not create a round. The page should show a start action when no active round exists. This keeps browsing safe and leaves daily auto-start behavior for a future slice.

### Current-member submission

The public form should submit `roundId` and `responseText`, not `membershipId`. The service layer should derive the current profile and membership for the round's team, then insert the response with that membership. This keeps the route contract simple and avoids trusting client-supplied membership identity.

### Anonymity boundary

S-02 may count responses but must not show response content or responder identity. Counts are anonymous aggregate progress. `S-03` will decide how and when response content becomes visible.

## Phase 1: Active game contracts and data invariant

### Goal

Add the server-side contracts needed to resolve, start, and submit to the current team/game round safely.

### Changes Required

1. **Add one-open-round invariant**
   **Intent:** Prevent ambiguous active sessions when two members try to start the same team/game at the same time.
   **Contract:** Add a Supabase migration in `supabase/migrations/` that enforces one open `game_rounds` row per `(team_id, game_template_id)`.

2. **Extend game domain types**
   **Intent:** Give pages and API routes a typed shape for active game state without exposing internal response identity.
   **Contract:** Extend `src/types.ts` with view-model types for team-scoped game state, active round summary, current-user submission status, and anonymous submitted count.

3. **Add active game lookup service**
   **Intent:** Let the game page load all needed state through one service contract.
   **Contract:** Add a service method in `src/lib/services/bondify.ts` that accepts `teamId` and `gameSlug`, verifies membership, resolves the template, finds the current open round if present, counts submitted responses, and reports whether the current member has already submitted.

4. **Add explicit start service**
   **Intent:** Keep start behavior reusable and protected by membership checks.
   **Contract:** Add a service method that accepts `teamId` and `gameSlug`, verifies membership, resolves the template, creates the open round only if one does not already exist, and returns the active game state.

5. **Add current-member response service**
   **Intent:** Avoid trusting client-provided membership IDs while preserving the existing response table shape.
   **Contract:** Add a service method that accepts `roundId` and `responseText`, validates a non-empty max-500-character response, verifies the round is open, derives the current user's membership for that round's team, inserts the response, and maps duplicate inserts to a friendly already-submitted domain error.

### Success Criteria

#### Automated Verification

- Supabase migration applies cleanly in local and remote-compatible schema `public`.
- `npm run lint` passes with the new service and type contracts.
- `npm run build` passes with no server/client boundary violations.

#### Manual Verification

- Starting the same game twice for the same team returns or preserves one active open round.
- A non-member cannot load or start a team game.
- A second response by the same member maps to a friendly duplicate-submission outcome.

---

## Phase 2: Team-scoped game page and API routes

### Goal

Expose the manual start and anonymous submission flow through dedicated team/game pages and form-backed API routes.

### Changes Required

1. **Add team-scoped game page**
   **Intent:** Give each team/game pair a stable page that hides round mechanics behind the game experience.
   **Contract:** Add an Astro page for a URL shaped like `/teams/<teamId>/games/<gameSlug>`. It should load active game state from the service layer, render the template prompt, and conditionally show start, submit, or submitted/waiting states.

2. **Add start-round API route**
   **Intent:** Let members explicitly start the current team/game round from a form submit.
   **Contract:** Add an API route under `src/pages/api/` that validates `teamId` and `gameSlug` with zod, calls the explicit start service, sets any needed flash state, and redirects back to the team-scoped game page.

3. **Add submit-response API route**
   **Intent:** Let members submit one anonymous response to the active round using the established server-rendered form pattern.
   **Contract:** Add an API route under `src/pages/api/` that validates `roundId` and a required max-500-character `responseText`, calls the current-member response service, maps duplicate/closed/access errors into friendly flash state, and redirects back to the game page.

4. **Add game flash support**
   **Intent:** Show route-level success and failure states without converting the flow to a client-heavy island.
   **Contract:** Extend or add a small flash helper so start/submit routes can display validation errors and submitted confirmations on the game page.

5. **Protect reveal boundaries**
   **Intent:** Keep S-02 from accidentally becoming a reveal slice.
   **Contract:** The game page may show prompt, current user status, and anonymous response count. It must not render `responseText` values or responder identity.

### Success Criteria

#### Automated Verification

- `npm run lint` passes with the new game page and API routes.
- `npm run build` passes with the new dynamic route.
- Invalid form payloads are handled without unhandled exceptions.

#### Manual Verification

- A member opens a team/game page with no active round and sees an explicit start action.
- Starting the game redirects back to the same game page with the active round ready for submissions.
- A member can submit a valid response and lands in the submitted/waiting state.
- A blank or too-long response returns a visible error and preserves the game context.

---

## Phase 3: Dashboard picker and end-to-end verification

### Goal

Wire the playable game flow into the existing dashboard and verify it with real team memberships.

### Changes Required

1. **Load templates on the dashboard**
   **Intent:** Make selected micro-games visible from the selected team shell.
   **Contract:** Update `src/pages/dashboard.astro` to load `listGameTemplates()` alongside existing team and invite context. Fail softly if templates cannot load.

2. **Render a selected-team template picker**
   **Intent:** Let members choose which micro-game to open without inventing a separate session dashboard.
   **Contract:** Add a compact game picker section for the selected team. Each template links to the team-scoped game page for `activeTeamId` and the template slug.

3. **Preserve existing dashboard flows**
   **Intent:** Avoid regressing the verified S-01 setup flow while adding gameplay entry points.
   **Contract:** Team creation, active-team switching, roster, invite submission, invite acceptance, and sign-out behavior must continue to work.

4. **Verify multi-account participation**
   **Intent:** Prove S-02 against real team membership, not a single-user shortcut.
   **Contract:** Manual verification should cover User A starting a game, User A submitting, User B opening the same team/game page, seeing the same active prompt and anonymous count, then submitting once.

### Success Criteria

#### Automated Verification

- `npm run lint` passes with dashboard integration.
- `npm run build` passes with final S-02 behavior.

#### Manual Verification

- The selected-team dashboard shows seeded game templates and links to team-scoped game pages.
- User A can start a game for a team and submit once.
- User B can open the same game for the same team and submit once.
- Submitted users see a waiting state and anonymous submitted count.
- No response content or responder identity is visible before S-03.
- Existing S-01 team creation, switching, invite, and invite-acceptance flows still work.

## Testing Strategy

### Unit Tests

- Test pure helper logic for response validation if extracted.
- Test domain error mapping for duplicate response and invalid round/template cases if the repo adds service-test infrastructure.

### Integration Tests

- Migration-level verification for the one-open-round-per-team/game invariant.
- Service-level verification for:
  - active game lookup with no open round
  - explicit start creating one open round
  - explicit start returning/preserving an existing open round
  - current-member response submission
  - duplicate current-member submission
  - non-member access rejection

### Manual Testing Steps

1. Sign in as User A, select a team on `/dashboard`, and confirm game templates appear.
2. Open one template for the team and confirm the game page shows a start action when no round is active.
3. Start the game and submit a valid response.
4. Confirm User A sees a submitted/waiting state and anonymous submitted count.
5. Sign in as User B, open the same team/game page, and confirm the prompt and count reflect the same active round.
6. Submit as User B and confirm a second submission attempt is blocked or shown as already submitted.
7. Confirm no page exposes response text or responder identity before the reveal slice.

## Performance Considerations

- The first live version can rely on SSR page loads and direct Supabase queries; no realtime channel is needed in S-02.
- Active game lookup should use indexed paths: team membership by user/team, template by slug, rounds by team/status/created time, responses by round.
- The anonymous count should be computed from response rows for the active round. At MVP team sizes this is simple and sufficient.
- The open-round uniqueness invariant prevents ambiguous reads and reduces defensive UI complexity.

## Migration Notes

- The remote Supabase project uses schema `public`; migrations must target `public` explicitly, consistent with existing migrations.
- Adding the partial unique index is low risk if no duplicate open team/game rounds exist yet. If local or remote manual testing created duplicates, implementation should close or remove duplicates before applying the invariant.
- No existing submitted responses should be transformed by this slice.

## References

- Roadmap item: `context/foundation/roadmap.md`
- Product requirements: `context/foundation/prd.md`
- Foundation plan: `context/changes/team-and-game-data-foundation/plan.md`
- S-01 plan: `context/changes/auth-and-team-setup/plan.md`
- Current dashboard: `src/pages/dashboard.astro`
- Service layer: `src/lib/services/bondify.ts`
- Shared types: `src/types.ts`
- Foundation migration: `supabase/migrations/20260530090000_team_and_game_foundation.sql`
- Seed templates: `supabase/seed.sql`
- Existing team API patterns: `src/pages/api/teams/create.ts`, `src/pages/api/teams/invite.ts`, `src/pages/api/teams/accept-invite.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Active game contracts and data invariant

#### Automated

- [x] 1.1 Supabase migration applies cleanly in local and remote-compatible schema `public` — aaa4b78
- [x] 1.2 Lint passes with the new service and type contracts — aaa4b78
- [x] 1.3 Build passes with no server/client boundary violations — aaa4b78

#### Manual

- [ ] 1.4 Starting the same game twice preserves one active open round
- [ ] 1.5 Non-member access to a team game is denied
- [ ] 1.6 Duplicate current-member submission maps to a friendly outcome

### Phase 2: Team-scoped game page and API routes

#### Automated

- [x] 2.1 Lint passes with the new game page and API routes — aaa4b78
- [x] 2.2 Build passes with the new dynamic route — aaa4b78
- [x] 2.3 Invalid form payloads are handled without unhandled exceptions — aaa4b78

#### Manual

- [x] 2.4 Member sees explicit start action before a round exists — aaa4b78
- [x] 2.5 Starting redirects back to the active game page — aaa4b78
- [x] 2.6 Valid response submission lands in submitted/waiting state — aaa4b78
- [x] 2.7 Blank or too-long response shows a visible error — aaa4b78

### Phase 3: Dashboard picker and end-to-end verification

#### Automated

- [x] 3.1 Lint passes with dashboard integration
- [x] 3.2 Build passes with final S-02 behavior

#### Manual

- [x] 3.3 Selected-team dashboard shows seeded game templates
- [x] 3.4 User A can start a game and submit once
- [x] 3.5 User B can open the same team/game and submit once
- [x] 3.6 Submitted users see waiting state and anonymous count
- [x] 3.7 No response content or responder identity is visible before S-03
- [x] 3.8 Existing S-01 setup flows still work
