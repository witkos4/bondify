# Frame Brief: Test foundation + access-control critical path (rollout Phase 1)

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

Bondify has zero test infrastructure (no runner, no test script, 0 test
files), and a real RLS regression (create-another-team, fixed by
`supabase/migrations/20260612090000_fix_team_membership_insert_helper.sql`)
shipped and was caught only by manual testing. Team-scoped access control —
member lockout (test-plan Risk #1) and cross-team IDOR exposure (Risk #2) —
is the highest-rated risk surface, with churn concentrated in
`supabase/migrations/` and `src/pages/api/`.

## Initial Framing (preserved)

- **User's stated cause or approach**: the right first protection is
  test-plan §3 Phase 1 as written — bootstrap a test runner (Vitest
  hypothesized) plus a local-Supabase integration harness with seeded
  users, proving membership-grants-access and cross-team-denial at the
  RLS/integration layer.
- **User's proposed direction**: research → plan → implement that phase
  (integration + unit tests for Risks #1 and #2, runner bootstrap included).
- **Pre-dispatch narrowing**: "Not sure / haven't separated" — the user had
  not yet distinguished whether the leading concern is the RLS-regression
  class, the missing test infrastructure, or both.

## Dimension Map

The observation could originate at any of these dimensions:

1. **Policy SQL layer (RLS in migrations)** — policies/helpers deny
   legitimate members or admit outsiders; nothing exercises them with real
   user JWTs. ← initial framing
2. **Service/endpoint layer** — if authorization lived in TypeScript or a
   privileged client, an RLS-level harness would test the wrong boundary.
3. **Migration evolution/replay** — later migrations redefining earlier
   policies/helpers drift out of sync; the failure surface is the
   cumulative replayed state, not any single policy.
4. **Session/page visibility layer** — RLS denials surface as silent empty
   states rather than errors, so regressions hide from both users and
   naive assertions.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| D1/D2: RLS is the sole authorization boundary (no TS guards, no service-role) | `src/lib/supabase.ts:6-7` publishable key only; zero grep hits for service_role/secret clients; `src/lib/services/bondify.ts:676-698` membership "guard" is itself an RLS-backed read; `src/middleware.ts:23-27` authentication only; owner actions are `security definer` RPCs with `revoke ... from service_role` (`20260611101000_team_management_owner_actions.sql`) | STRONG |
| D3: regression class is migration-evolution drift | `20260611100000_team_management_soft_memberships.sql:21-53` updated `is_team_member()`/`shares_team_with_profile()` for `removed_at` but orphaned `can_insert_team_membership()` (defined `20260531010000`); fixed next day in `20260612090000`; second instance of the class fixed today: `20260613093000_fix_remove_team_member_rpc_ambiguity.sql` | STRONG |
| D4: lockouts are silent at the page layer | `bondify.ts:881-929` `listTeamSummaryRows` returns `[]` on silent RLS filtering (`error: null`); `dashboard.astro:33,69` renders "No active team selected" create-team state on lockout; only direct `requireMembershipAccess` throws (`bondify.ts:694`) — sub-query RLS filtering (e.g. game_responses) appears as "no data yet" | STRONG |
| D2 alternative: authorization in TS would make RLS harness mis-targeted | Disproven by D1/D2 evidence above — no TS-level authorization exists to test instead | NONE |

## Narrowing Signals

- The 2026-06-12 regression chain is fully reconstructed as helper/policy
  drift across migrations — not a one-off policy typo.
- A second same-class fix (`20260613093000`, RPC ambiguity in
  `remove_team_member`) landed within 24 hours — the class actively recurs.
- `supabase/seed.sql` creates only `game_templates` rows — no users, teams,
  or memberships. The "seeded users per role" the test plan assumes do not
  exist yet; the harness must create them (auth admin API or SQL fixtures).
- Local stack is standard (`supabase/config.toml`: API 54321, DB 54322,
  Postgres 17, seed enabled) — no obstacle to a real local-Supabase harness.

## Cross-System Convention

For Supabase apps where RLS is the sole boundary, the accepted convention is
integration tests against a locally replayed database with per-role JWTs —
exactly what the initial framing proposes. The pressure-test held: a
sub-agent reconstructing the regression without being told the hypothesis
landed on the same migration-drift chain, and the inverse prediction (more
instances of the class should exist) was confirmed by today's RPC fix.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: DB-level authorization logic
> (RLS policies + security-definer helpers/RPCs) drifts out of sync as
> migrations evolve, and the resulting lockouts/exposures ship undetected
> because (a) nothing replays the cumulative migration state and exercises
> it with real per-role user sessions, and (b) RLS denials render as silent
> empty states, so even page-level checks pass.

The initial framing was correct in scope and boundary — Phase 1 as written
targets the right layer. The investigation sharpens it in three ways that
the plan must honor: (1) tests must assert **positive presence** (a member
sees their team/rows; an invitee gains access) and **foreign-user absence**,
never just "no error", because lockouts are silent; (2) the harness must run
against the **fully replayed** migration set (`supabase db reset`
semantics), since the failure class lives in cumulative drift, not single
policies; (3) user/team fixtures must be **built by the harness** — seed.sql
provides none.

## Confidence

**HIGH** — strong file-level evidence on every dimension, independent
reconstruction converged, the inverse prediction confirmed, and the
confirmed framing matches the ecosystem convention.

## What Changes for /10x-plan

Plan Phase 1 as scoped in test-plan §3, with the three sharpenings above as
hard requirements; treat the silent-empty-state behavior (D4) as a reason
tests assert at the service/DB layer with positive assertions, and flag the
fixture-bootstrap work (users/teams per role) as its own sub-phase.

## References

- Source files: `src/lib/supabase.ts:6-23`, `src/middleware.ts:23-27`,
  `src/lib/services/bondify.ts:676-698`, `src/lib/services/bondify.ts:881-929`,
  `src/pages/dashboard.astro:33`
- Migrations: `20260531010000`, `20260611100000:21-91`, `20260612090000`,
  `20260613093000`, `supabase/seed.sql`, `supabase/config.toml`
- Related research: none yet — `/10x-research` for this change is the next
  step in the test-rollout process
- Investigation: three parallel read-only sub-agents (service-boundary,
  migration-evolution, visibility-layer)
