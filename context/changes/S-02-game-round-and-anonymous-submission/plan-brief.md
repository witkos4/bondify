# Game Round and Anonymous Submission - Plan Brief

> Full plan: `context/changes/S-02-game-round-and-anonymous-submission/plan.md`

## What & Why

Build the first playable Bondify game step: a team member can choose a micro-game, open a team-scoped game page, start the active backing round, and submit one anonymous response. This proves the core participation loop without pulling in the shared reveal screen from `S-03`.

## Starting Point

The database and service foundation already include game templates, game rounds, game responses, RLS, and a unique one-response-per-round/member constraint. The dashboard already has active team context, but no game navigation, game API routes, or submission UI exists yet.

## Desired End State

Each selected team can show available game templates from the seeded catalog. A member can navigate to a dedicated team-scoped game page, explicitly start the current game round, submit a required text response up to 500 characters, and then see a saved/waiting state with an anonymous submitted-response count.

## Key Decisions Made

| Decision             | Choice                                       | Why                                                                                     |
| -------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------- |
| Active session scope | One active round per team and game           | Future multiple games are expected, but each game should have one current team session. |
| Game selection       | Template picker                              | Uses the existing `game_templates` foundation and avoids hard-coding one game.          |
| User-facing surface  | Dedicated team-scoped game page              | The game is the visible concept; the round stays in the background as backing state.    |
| Round creation       | Explicit start action                        | Avoids accidental sessions from simple navigation.                                      |
| URL shape            | Team-scoped game URL                         | Keeps multi-team users unambiguous and shareable within the app.                        |
| Response shape       | Single required text response, 500 chars max | Matches the current `response_text` storage contract and keeps S-02 small.              |
| Post-submit state    | Saved/waiting state                          | Confirms success while leaving reveal behavior to `S-03`.                               |
| Progress visibility  | Anonymous submitted count                    | Gives useful waiting feedback without exposing response content or identities.          |

## Scope

**In scope:**

- Dashboard template picker for the selected team
- Team-scoped game page route
- Explicit start-round API route
- Submit-response API route
- Service-layer support for active team/game round lookup and current-member response submission
- Friendly duplicate, invalid, and access-denied handling
- Anonymous submitted-response count

**Out of scope:**

- Shared reveal/results screen
- Time expiry or automatic reveal
- Daily auto-started games
- Structured per-template fields
- History visibility and owner clear behavior
- Realtime updates or polling

## Architecture / Approach

The dashboard lists templates from the service layer and links to team-scoped game pages. The game page verifies team membership, resolves the game template, finds the current open round for that team/game if one exists, and renders either a start action, a submit form, or a submitted/waiting state. API routes call service methods instead of querying Supabase directly.

## Phases at a Glance

| Phase                                     | What it delivers                                                          | Key risk                                       |
| ----------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------- |
| 1. Active game contracts                  | Service and type contracts for current team/game rounds                   | Avoiding duplicate or ambiguous open rounds    |
| 2. Game routes and APIs                   | Team-scoped game page plus start and submit endpoints                     | Keeping round identity hidden but still robust |
| 3. Dashboard integration and verification | Template picker, navigation, waiting state, and manual two-account checks | Not leaking reveal behavior into S-02          |

**Prerequisites:** `S-01` is implemented and remote/local Supabase migrations are applied in schema `public`.
**Estimated effort:** About 2-3 focused sessions across 3 phases.

## Open Risks & Assumptions

- The current schema does not enforce one open round per team/game; this plan should add a narrow migration or a transaction-safe service guard.
- The first version can rely on normal page reloads rather than realtime progress updates.
- Tiny teams may infer progress from anonymous counts, but response content and identity remain hidden.
- Daily game sessions are a later product decision and should not shape this implementation beyond preserving a clean team/game round model.

## Success Criteria (Summary)

- A team member can choose a game, start it for the selected team, and submit exactly one response.
- A second submission by the same member is blocked with a friendly already-submitted state.
- Teammates can open the same team/game page and see the active prompt plus anonymous submitted count without seeing response content.
