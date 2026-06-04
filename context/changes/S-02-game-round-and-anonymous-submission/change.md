---
id: S-02-game-round-and-anonymous-submission
roadmap_id: S-02
title: Game round and anonymous submission
status: impl_reviewed
created: 2026-06-01
updated: 2026-06-02
---

## Summary

Allow any active team member to choose a micro-game, open a team-scoped game page, explicitly start the current team/game round, and submit one anonymous text response while waiting for the later shared reveal slice.

## Roadmap Link

- `S-02` in `context/foundation/roadmap.md`
- Prerequisite: `S-01 auth-and-team-setup`

## Planning Notes

- The game page is the stable user-facing surface.
- The active round is the backing session for one team plus one game.
- For the MVP, starting a round is explicit.
- Daily auto-created game sessions are intentionally deferred.
