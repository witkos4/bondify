# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-06-13

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "the team
   is worried about X, and the failure would surface somewhere in this
   area" carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents *what
   could fail* and *why we believe it's likely* — drawn from documents,
   interview, and codebase *signal* (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src/`, `supabase/`
(excluding `node_modules/`, `dist/`, `context/`); 19 commits in the last
30 days.

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the *evidence that surfaced
this risk* — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|---|---|---|---|
| 1 | Team access lockout — a legitimate member is denied their team's overview/games/history, or an accepted invite fails to grant access, after an RLS/migration change | High | High | interview Q1; roadmap S-08 verification note (create-team RLS regression, 2026-06-12); hot-spot dir `supabase/migrations/` (14 commits/30d) |
| 2 | Cross-team data exposure (IDOR) — an authenticated user reads or writes another team's check-ins, votes, or member list by substituting a foreign teamId/sessionId | High | Medium | abuse lens (authorization/ownership); PRD guardrail "team-based scoping and multi-team support must remain intact"; hot-spot dir `src/pages/api/` (27 commits/30d) |
| 3 | Daily ritual rule break — duplicate Emoji Check-In for the same user/day, two sessions created for one team/day, or a submission attributed to the wrong day at date boundaries | Medium | High | PRD US-02 acceptance criteria; roadmap S-07; interview Q3 (whole server data path low-confidence) |
| 4 | Two Truths rule enforcement fails — a self-vote is accepted server-side, a vote lands after voting closes, or the lie designation is lost between submission and reveal | Medium | High | PRD US-03; roadmap S-09 residual-risk note (partial voting, legacy templates, summary history); interview Q3 |
| 5 | Owner-action blast radius / privilege gap — a non-owner can invoke remove-member or delete-team, or those actions delete more than intended | High | Medium | abuse lens; PRD "preserve the current member-versus-owner permission split"; hot-spot dir `src/pages/api/teams/` (new owner-action endpoints in working tree) |
| 6 | Local/hosted environment drift — migrations + seed replay cleanly locally but the running app misbehaves because required catalog/reference rows are missing or policies apply differently | Medium | Medium | interview Q2 (burned before); AGENTS.md lesson "a current schema does not guarantee required catalog rows exist" |

Hosted-runtime-only drift (Cloudflare/hosted-Supabase behavior that cannot
be reproduced locally) belongs to observability/alerting, not this test
rollout — Risk #6 covers only the locally provable part.

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|------|-----------------------------|----------------|--------------------------------------|-----------------------|-----------------------|
| #1 | A seeded member of team T can read overview/games/history data, and a freshly accepted invite grants access — and this still holds after a full migration replay | "Policy passes for the row creator implies it passes for all legitimate members"; "works locally once implies survives migration replay" | Which queries back the team pages; membership/invite tables and their policies; session/JWT shape used by RLS | integration (local Supabase, seeded users, RLS-level) | Asserting policy SQL text or mocking the DB — the policy must be exercised, not described |
| #2 | An authenticated user belonging only to team T1 who requests T2 pages or API mutations gets a denial and zero leaked rows | "Logged-in check implies ownership check" | How each endpoint resolves teamId into an authorization decision (service layer vs RLS-only) | integration (two seeded users hitting API routes) | Happy-path-only; testing the UI guard instead of the server boundary |
| #3 | A second same-day submission is rejected server-side; concurrent first submissions create exactly one session per team per day; boundary-time submissions land on the correct day | "The UI disables the button so double-submit cannot happen"; "server date equals the team's expected day" | How the daily session is keyed (date column, timezone, uniqueness constraint); the idempotency rule for session creation | integration (service layer + DB constraints) | Oracle from implementation — asserting whatever date the code computes |
| #4 | Self-votes and post-close votes are rejected at the API; the lie designation survives from three-field submission to reveal; the partial-voting summary is correct | "The client hides your own card so self-vote is impossible"; "closing voting implies all votes were counted" | Vote and close-voting endpoint validation; statement/lie data model; the close transition semantics | integration (API/service layer) | Copying scoring/summary assertions from production code |
| #5 | Non-owner calls to remove-member/delete-team are denied; delete-team removes only that team's rows; remove-member does not orphan or over-delete data | "Owner check in the UI implies owner check in the API" | Soft-membership semantics; cascade/cleanup behavior of the owner actions | integration (owner + non-owner seeded users) | Testing only the happy owner path |
| #6 | A fresh local reset (full migration + seed replay) yields a stack where the critical-flow suite passes, including required catalog/reference rows | "Migrations applied implies the app works" — seed/catalog data is a separate failure surface | Which reference/catalog rows the app depends on at runtime | CI gate (migration replay + smoke integration run) | Schema-dump snapshot with no behavioral assertion |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|---|---|---|---|---|---|
| 1 | Test foundation + access-control critical path | Bootstrap the test runner and local-Supabase integration harness; prove membership grants access and team scoping holds | #1, #2 | integration + unit | planned | context/changes/testing-foundation-access-control/ |
| 2 | Game-rule integrity | Prove the daily check-in and Two Truths rules are enforced server-side, not just in the UI | #3, #4 | integration + unit | not started | — |
| 3 | Owner actions and destructive paths | Prove owner-only authorization and a bounded blast radius for remove-member/delete-team | #5 | integration | not started | — |
| 4 | Quality gates and environment parity | Wire the suite into CI behind a full migration + seed replay; add a minimal landing-flow smoke probe | #6 | gates + migration-replay smoke | not started | — |

**Status vocabulary** (fixed — parser literals): `not started` →
`change opened` → `researched` → `planned` → `implementing` → `complete`.

## 4. Stack

The classic test base for this project. Recommendations are grounded in
local manifests/configs plus the tools actually exposed in the current
session.

| Layer | Tool | Version | Notes |
|---|---|---|---|
| unit + integration | none yet — see §3 Phase 1 | — | Vitest is the natural fit (Vite 7 already pinned via overrides); Phase 1 research must verify against Astro 6 SSR + Cloudflare adapter |
| DB / RLS harness | none yet — see §3 Phase 1 | — | Local Supabase (`npx supabase start`, supabase CLI ^2.101.0 in devDependencies) with seeded users per role |
| API mocking | none yet — see §3 Phase 1 | — | Mocking policy to be set by Phase 1: prefer real local Supabase over mocks for RLS-bearing paths |
| e2e | none planned | — | Deliberately deferred: §2 risks are server-enforcement risks, cheapest at integration level; revisit only if a routing/session risk proves untestable below browser level |
| CI gates | GitHub Actions (lint + build wired) | — | Test job added by §3 Phase 4 with migration + seed replay |

**Stack grounding tools (current session):**
- Docs: none — no docs MCP (Context7 not exposed); relied on local manifests and configs; checked: 2026-06-13
- Search: WebSearch available — not used for this write; Phase 1 research should verify current Vitest + Astro 6 + Cloudflare guidance against official docs; checked: 2026-06-13
- Runtime/browser: wmux browser panel available — possible manual-verification layer; not selected as a test layer under cost × signal; checked: 2026-06-13
- Provider/platform: Supabase CLI + wrangler available locally — relevant to the Phase 4 migration-replay gate; checked: 2026-06-13

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.
"Required after §3 Phase N" means the gate is enforced once that rollout
phase lands; before that, the gate is planned.

| Gate | Where | Required? | Catches |
|---|---|---|---|
| lint + typecheck | local (husky/lint-staged) + CI | required (already wired) | syntactic / type drift |
| build | CI | required (already wired) | SSR/adapter breakage |
| unit + integration | local + CI | required after §3 Phase 1 | logic and RLS regressions |
| migration + seed replay before test run | CI | required after §3 Phase 4 | environment drift, missing catalog rows |
| landing-flow smoke probe | CI | required after §3 Phase 4 | broken auth landing / team-switch path |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, the sub-section reads
"TBD — see §3 Phase N."

### 6.1 Adding a unit test

- TBD — see §3 Phase 1 (runner bootstrap; first pattern lands with the
  access-control coverage).

### 6.2 Adding an integration test against local Supabase (RLS-level)

- TBD — see §3 Phase 1 for the membership-access and cross-team-denial
  pattern (seeded users per role, real policies, no DB mocks).

### 6.3 Adding a test for a game-rule (server-enforced constraint)

- TBD — see §3 Phase 2 for the duplicate-submission rejection and
  self-vote rejection patterns.

### 6.4 Adding a test for a new API endpoint

- TBD — see §3 Phase 2/3 for the authorization-denial and
  destructive-action blast-radius patterns.

### 6.5 Wiring a new gate into CI

- TBD — see §3 Phase 4 for the migration-replay + suite gate.

### 6.6 Per-rollout-phase notes

(After each phase lands, /10x-implement appends a 2–3 line note here
capturing anything surprising the rollout phase taught.)

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5). Future
contributors should respect these unless the underlying assumption changes.

- **Reveal animations and emoji-burst visuals** — cosmetic, verified by
  eye, low blast radius. Re-evaluate if a reveal bug ever hides or corrupts
  result data rather than just its presentation. (Source: interview Q5.)
- **UI markup snapshots** — the dashboard and game surfaces churn under
  active polish; snapshots would break constantly and catch nothing.
  Re-evaluate if the UI stabilizes and rendering regressions start
  recurring. (Source: interview Q5.)
- **Third-party internals** — Supabase auth internals and shadcn/ui
  component behavior are the vendor's contract, not ours. Test our usage
  boundaries, not their implementation. (Source: interview Q5 examples,
  confirmed by negative-space selection.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-06-13
- Stack versions last verified: 2026-06-13
- AI-native tool references last verified: 2026-06-13

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
