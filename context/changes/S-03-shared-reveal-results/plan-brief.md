# Shared Reveal Results - Plan Brief

> Full plan: `context/changes/S-03-shared-reveal-results/plan.md`
> Roadmap item: `S-03` in `context/foundation/roadmap.md`

## What & Why

Build the payoff for the current game loop: after teammates submit anonymous responses, participants can reveal the round and see all responses together on one shared results screen. This completes the PRD's primary outcome for the live micro-game experience without adding history or long-term archive behavior.

## Starting Point

`S-02` already gives members a team-scoped game page, explicit round start, one anonymous response per member, and an anonymous submitted count. The service layer already has a participant-safe reveal read, but no action marks a round revealed and the page still tells users the reveal comes later.

## Desired End State

A member can reveal an open round from the game page once at least one response exists. The round becomes `revealed`, the page switches to a results state, and every team member with access sees all submitted response text without membership IDs, profile IDs, names, or emails.

## Key Decisions Made

| Decision         | Choice                          | Why                                                                                                                    |
| ---------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Reveal trigger   | Manual reveal action            | The MVP has no timer or realtime quorum model yet, so a simple explicit action keeps scope tight.                      |
| Reveal surface   | Existing team/game page         | The user already has a stable page for the round; a separate results route would add navigation without product value. |
| Round transition | `open` to `revealed`            | Uses the existing `GameRoundStatus` and prevents further response submission after reveal.                             |
| Results payload  | Participant-safe responses only | The PRD requires shared responses, but anonymity means identity stays hidden.                                          |
| History scope    | Deferred                        | `S-04` owns 30-day history and owner clear behavior.                                                                   |

## Scope

**In scope:**

- Service method to reveal a current team/game round
- Participant-safe reveal state in the game page model
- API route for reveal form submission
- Game flash success and error handling for reveal
- Results UI that lists all submitted responses without responder identity
- Automated lint and production build verification

**Out of scope:**

- Time expiry or automatic reveal
- Realtime updates, polling, or live reveal notifications
- Member-by-member submitted/pending identity lists
- History view, retention cleanup, or owner clear behavior
- Moderation, scoring, analytics, or admin controls

## Architecture / Approach

The service layer owns the reveal transition and membership checks. The game page continues loading one `TeamGameState`, but that state can now include a participant-safe revealed result when the active round has already moved to `revealed`. Form-backed API routes keep the flow server-rendered and redirect back to the same game page after reveal.

## Phases at a Glance

| Phase                     | What it delivers                                        | Key risk                                                                           |
| ------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1. Reveal service and API | Round reveal transition plus route-level flash handling | Allowing reveal without team access or without responses                           |
| 2. Results page state     | Shared results UI on the existing game page             | Accidentally exposing responder identity or leaving submit UI visible after reveal |

## Success Criteria (Summary)

- A team member can reveal an open round with submitted responses.
- Revealed rounds stop accepting new responses through the existing submission service.
- Participants see all response text together with no responder identity.
- `npm run lint` and `npm run build` pass.
