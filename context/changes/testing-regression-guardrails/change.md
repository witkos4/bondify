---
change_id: testing-regression-guardrails
title: Regression guardrails for Emoji Check-In UI and legacy membership schema
status: implemented
created: 2026-06-16
updated: 2026-06-30
archived_at: null
---

## Notes

- Focused research change opened to define durable tests for two recent regressions:
  1. Emoji Check-In picker looked clickable but could not actually be used.
  2. Remote environments without `team_memberships.removed_at` still crashed on live code paths.

## Plan scoping — 2026-06-30

- `plan.md` written. The research recommended three tests; reconciling against the
  current tree showed two are **already shipped**:
  - Research #1 (picker browser test) → `tests/browser/emoji-check-in-picker.spec.ts`
    (2 tests: count badge, max-3 lockout, no-descriptions contract, submit, reveal).
  - Research #2 (compatibility family) → `tests/services/bondify-compatibility.test.ts`
    (4 tests: summary fallback, createTeam, acceptInvite, duplicate-invite check).
- The plan therefore scopes to the **residual gap** only:
  - Phase 1: cover the plain read-gate fallback (`requireMembershipAccess` →
    `findActiveMembershipByTeamAndProfile`) via `getTeamHistoryState` — the one
    membership-sensitive path the existing compatibility tests miss.
  - Phase 2: build research #3 (the never-implemented structural "don't bypass the
    compatibility seam" guard).
