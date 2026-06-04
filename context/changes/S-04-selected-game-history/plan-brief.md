# Selected Game History - Plan Brief

> Full plan: `context/changes/S-04-selected-game-history/plan.md`
> Roadmap item: `S-04` in `context/foundation/roadmap.md`

## What & Why

Build the final MVP slice: selected games leave a simple 30-day team history that team members can revisit and the team owner can clear. This turns the shared reveal moment into a lightweight record of team rituals without creating permanent archives or exposing responder identity.

## Starting Point

The foundation already has `game_templates.is_history_enabled`, `game_rounds.history_visible_until`, `game_rounds.history_cleared_at`, and a participant-safe history DTO. S-03 adds shared reveal, but it does not mark rounds as history-visible or provide a history page or owner clear flow.

## Desired End State

A member can open `/teams/<teamId>/history` and see recently revealed results for the selected games that participate in history. Entries are grouped by game, show anonymous response cards, and omit names, emails, profile IDs, and membership IDs. The team owner can clear all visible history or one round at a time, and clear only hides entries from history.

## Key Decisions Made

| Decision        | Choice                     | Why                                                                                                |
| --------------- | -------------------------- | -------------------------------------------------------------------------------------------------- |
| Eligible games  | Selected templates only    | The PRD and roadmap say selected games, so `is_history_enabled` remains the source of truth.       |
| Retention start | First accepted response    | A game counts as played once someone participates; reveal still gates response-content visibility. |
| History surface | Separate team history page | Keeps dashboard density down and gives grouped history enough room.                                |
| Layout          | Group by game template     | Supports comparing repeated rituals without adding detail routes.                                  |
| View access     | All active team members    | History is a shared team ritual record, matching reveal access and current membership model.       |
| Clear access    | Team owner only            | The PRD specifically grants manual clear to the owner.                                             |
| Clear behavior  | Soft-hide from history     | Uses existing schema, avoids data deletion, and leaves the game reveal intact.                     |

## Scope

**In scope:**

- First-response history visibility for history-enabled templates
- Reveal-gated participant-safe history reads
- Team-scoped history page at `/teams/<teamId>/history`
- Grouped-by-game history UI
- Dashboard entry point to the history page
- Owner-only clear-all and clear-one actions
- RLS/service updates so owner-only clear is not just a hidden button
- Automated lint/build checks and manual multi-user verification

**Out of scope:**

- History for templates where `is_history_enabled = false`
- Permanent archives beyond 30 days
- Scheduled deletion or background cleanup
- Response deletion on clear
- Realtime updates, polling, analytics, scoring, moderation, or admin settings
- Per-entry detail routes

## Architecture / Approach

The response submission service marks eligible rounds with `history_visible_until` the first time a response is accepted. The history read path then includes only revealed, unexpired, uncleared, history-enabled rounds and maps them through the existing participant-safe response shape. A team history route renders grouped entries, while a form-backed owner clear API soft-clears rounds by setting `history_cleared_at`.

## Phases at a Glance

| Phase                               | What it delivers                                                                                     | Key risk                                                                 |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1. Retention and service contracts  | First-response history markers, safer history reads, owner clear service methods, and RLS refinement | Exposing unrevealed response text or leaving owner-only clear as UI-only |
| 2. History page and clear API       | Team history route, grouped UI, flash handling, clear-all and clear-one forms                        | Accidentally showing identity or confusing clear semantics               |
| 3. Dashboard entry and verification | Dashboard link plus end-to-end selected/non-selected game checks                                     | Regressing S-01 to S-03 flows while adding the final slice               |

**Prerequisites:** S-03 reveal flow works locally; Supabase is configured for the current environment.
**Estimated effort:** Around 2 focused implementation sessions across 3 phases.

## Open Risks & Assumptions

- Existing local rounds created before S-04 may need a data-only backfill to get `history_visible_until`.
- The broad existing `game_rounds` update policy must be refined carefully so reveal still works for members while history clear becomes owner-only.
- The first-response clock means a round revealed much later has less than 30 days remaining in history.

## Success Criteria (Summary)

- Revealed rounds for history-enabled templates appear on the team history page for 30 days from first response.
- Non-history-enabled templates never appear in history.
- All members can view anonymous history, but only the team owner can clear entries.
- Owner clear hides entries from history without deleting responses or removing the game reveal result.
