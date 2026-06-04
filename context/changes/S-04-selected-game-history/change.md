---
id: S-04-selected-game-history
roadmap_id: S-04
title: Selected game history
status: implemented
created: 2026-06-04
updated: 2026-06-04
---

## Summary

Add a simple team history surface for selected, history-enabled games. Team members can view grouped anonymous results for recently played eligible games, while the team owner can soft-clear all visible history or individual history entries.

## Roadmap Link

- `S-04` in `context/foundation/roadmap.md`
- Prerequisite: `S-03 shared-reveal-results`

## Planning Notes

- History applies only to selected templates where `game_templates.is_history_enabled = true`.
- The 30-day retention clock starts when the first response is submitted for an eligible round.
- Response content remains reveal-gated; history only renders revealed rounds.
- History lives on a separate team-scoped page.
- Clearing history sets `game_rounds.history_cleared_at`; it does not delete responses or remove the live reveal page result.
