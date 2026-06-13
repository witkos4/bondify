# Test Foundation + Access-Control Critical Path — Plan Brief

> Full plan: `context/changes/testing-foundation-access-control/plan.md`
> Frame brief: `context/changes/testing-foundation-access-control/frame.md`
> Research: `context/changes/testing-foundation-access-control/research.md`

## What & Why

Bondify ships with zero test infrastructure, and its DB-level authorization (RLS policies + security-definer helpers/RPCs) drifts out of sync as migrations evolve — the resulting lockouts and exposures ship undetected because nothing exercises the policies with real per-role user sessions, and RLS denials render as silent empty states so even page-level checks pass. This plan bootstraps the first test runner and ships integration suites for the two highest-rated risks: member access lockout (Risk #1) and cross-team IDOR (Risk #2).

## Starting Point

RLS is the app's sole authorization boundary (no service-role client, no TypeScript guards, auth-only middleware). Two same-class regressions shipped within 48 hours (helper drift on 2026-06-11, RPC ambiguity fixed 2026-06-13), both caught only by manual testing. `seed.sql` provides only game templates — no users or teams to test with.

## Desired End State

`npm test` runs a Vitest suite against the developer's running local Supabase stack without touching their manual-testing data, failing fast with a "start Docker → `npx supabase start`" diagnostic when the stack is down. The suite positively proves members see their data, invitees gain access, the June-12 regression shape can never silently return, and foreign-team writes are denied with zero row side effects. The test plan's cookbook (§6) documents the patterns for every future test.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Test layer | Raw supabase-js per-role clients, no Astro imports | `bondify.ts` has no injection seam (`astro:env` coupling); raw clients exercise the exact PostgREST+JWT mechanics production uses | Research |
| Assertion discipline | Positive presence + zero-row-delta, never "no error" | RLS lockouts are silent (`data: [], error: null`) — absence-of-error assertions pass during a lockout | Frame |
| Local DB handling | Additive (unique fixtures + cleanup); no `db reset` locally | Preserves manual-testing data (BUBBA team); full-replay verification becomes the CI gate in rollout Phase 4 | Plan |
| Stack-down behavior | Fail fast with environment-first diagnostic | lessons.md rule: check Docker/stack before suspecting code; no surprise multi-minute auto-starts | Plan |
| Fixtures | Harness-built via the real RLS-gated paths | seed.sql has no users/teams; building fixtures through production sequences makes setup itself grant-path coverage | Frame + Research |
| IDOR scope | Core denials + soft-removed-member variant + invite disclosure probe | Both variants are cheap once fixtures exist and cover the two gaps research flagged | Plan |
| Layout | Root `tests/` (`tests/rls/`, `tests/helpers/`, `tests/setup/`) | These tests target DB policies, not src modules; becomes the durable §6 convention | Plan |

## Scope

**In scope:** Vitest 4 bootstrap; stack preflight + key acquisition (`supabase status -o env`); fixture harness (user minting, team/invite builders mirroring `bondify.ts` sequences); Risk #1 positive-presence suite incl. second-team regression repro; Risk #2 denial suite incl. soft-removed variant and invite-disclosure probe; test-plan §6 cookbook update.

**Out of scope:** Service-layer tests (astro:env stubbing deferred); e2e/snapshots/animations; CI wiring and the `ci.yml` master/main bug (rollout Phase 4); fixing the invite disclosure if found (separate change); game-rule tests (rollout Phase 2).

## Architecture / Approach

A service-role admin client mints users and verifies side effects; per-user authenticated clients (anon key + `signInWithPassword`) drive RLS as production JWTs do. One composed `setupTwoTeamScenario()` (owner-A, invited member-A2, outsider-B with own team) feeds both suites. Helpers mirror the exact production insert sequences with file references, so policy coverage matches real flows and drift is detectable.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Runner bootstrap | vitest@^4 + config + preflight + smoke test | vitest 4 / vite 7.3.3 dedupe (verify at install) |
| 2. Fixture harness | Clients, builders, cleanup, two-team scenario | profiles-row bootstrap mechanics (trigger vs insert) |
| 3. Risk #1 suite | Positive-presence grant tests + regression repro | assertions too shape-coupled to service selects |
| 4. Risk #2 suite | Denial + zero-delta tests, removed-member, disclosure probe | silent-mode assertions need admin-side verification |
| 5. Closeout | §6 cookbook + status reconciliation | — |

**Prerequisites:** Docker Desktop + `npx supabase start` running locally.
**Estimated effort:** ~2-3 implementation sessions across 5 phases.

## Open Risks & Assumptions

- vitest@^4 pairs with the pinned vite 7.3.3 (override expected to hold — checked at Phase 1 install).
- Profiles-row creation path for fresh auth users (trigger vs client insert) must be confirmed in Phase 2; the plan flags both routes.
- The invite-disclosure probe may surface a real exposure — decision on a follow-up change is deliberately deferred to the user (Progress item 4.4).

## Success Criteria (Summary)

- `npm test` green twice consecutively on a running stack, with manual-testing data intact afterwards.
- Breaking `can_insert_team_membership` in Studio makes the regression-repro test fail (the suite has teeth).
- A contributor can add the next RLS test from §6.2 alone, without reading this change folder.
