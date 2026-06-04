---
id: S-03-shared-reveal-results
roadmap_id: S-03
title: Shared reveal results
status: implemented
created: 2026-06-04
updated: 2026-06-04
---

## Summary

Let team participants reveal an open micro-game round and see every submitted response together on the existing team-scoped game page, while preserving the MVP anonymity boundary by omitting responder identity.

## Roadmap Link

- `S-03` in `context/foundation/roadmap.md`
- Prerequisite: `S-02 game-round-and-anonymous-submission`

## Planning Notes

- The game page remains the stable user-facing surface.
- Revealing changes the backing round from `open` to `revealed`.
- Participant-facing reveal payloads may include response text, but not responder identity.
- History behavior remains deferred to `S-04`.
