---
change_id: testing-foundation-access-control
title: Test foundation and access-control critical path (test rollout Phase 1)
status: impl_reviewed
created: 2026-06-13
updated: 2026-06-29
archived_at: null
---

## Notes

**Cross-change dependency**: `tests/helpers/supabase-env.ts` (env-acquisition logic, Docker fail-fast diagnostic) was extracted as a shared helper during implementation. It is committed alongside the `testing-regression-guardrails` change but is load-bearing for `tests/setup/global.ts` in this change. If `testing-regression-guardrails` is restructured, verify `supabase-env.ts` remains in place.

Open a change folder for rollout Phase 1 of context/foundation/test-plan.md: "Test foundation + access-control critical path". Risks covered: Risk #1 (team access lockout — a legitimate member denied their team's overview/games/history, or an accepted invite failing to grant access, after an RLS/migration change), Risk #2 (cross-team data exposure / IDOR — an authenticated user reading or writing another team's check-ins, votes, or member list via a foreign teamId/sessionId). Test types planned: integration (local Supabase, seeded users per role, RLS-level) + unit; this phase also bootstraps the test runner (no test infrastructure exists yet). Risk response intent: Risk #1 — prove a seeded member of team T can read overview/games/history data and a freshly accepted invite grants access, and that this survives a full migration replay. Risk #2 — prove a user belonging only to team T1 who requests T2 pages or API mutations gets a denial and zero leaked rows.
