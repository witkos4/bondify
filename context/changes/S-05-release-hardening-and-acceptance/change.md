---
id: S-05-release-hardening-and-acceptance
roadmap_id: S-05
title: Release hardening and acceptance
status: implemented
created: 2026-06-04
updated: 2026-06-04
---

## Summary

Close the S-03 and S-04 implementation-review findings before treating the shared reveal plus selected-game history loop as shippable. This slice tightened owner-only history clear enforcement, resolved the full-repo CRLF lint blocker with explicit LF guardrails plus a mechanical formatting pass, and completed manual acceptance for the reveal/history MVP path.

## Roadmap Link

- `S-05` in `context/foundation/roadmap.md`
- Prerequisites: `S-03 shared-reveal-results`, `S-04 selected-game-history`

## Planning Notes

- Keep this as hardening and acceptance, not new product functionality.
- The S-04 RLS warning should be handled at the database boundary, not only in UI/service code.
- Owner history clear will be enforced through narrow `SECURITY DEFINER` Supabase RPCs added in a follow-up migration.
- Full repo lint cleanup belongs in this slice as an isolated phase, even though it will create a noisy formatting diff.
- Manual acceptance should be browser-assisted and cover the complete S-03/S-04 flow with one owner and one non-owner member.
