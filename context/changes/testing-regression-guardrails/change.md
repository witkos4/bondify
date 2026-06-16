---
change_id: testing-regression-guardrails
title: Regression guardrails for Emoji Check-In UI and legacy membership schema
status: preparing
created: 2026-06-16
updated: 2026-06-16
archived_at: null
---

## Notes

- Focused research change opened to define durable tests for two recent regressions:
  1. Emoji Check-In picker looked clickable but could not actually be used.
  2. Remote environments without `team_memberships.removed_at` still crashed on live code paths.
