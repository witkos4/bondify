# Team and game data foundation — Plan Brief

> Full plan: `context/changes/F-01-team-and-game-data-foundation/plan.md`

## What & Why

We are building the first Bondify domain data layer: teams, memberships, pending invites, reusable game templates, live rounds, responses, and history-retention metadata. The motivation is simple: every roadmap slice after auth depends on these contracts, so getting them right once is faster than letting team setup, gameplay, and history each invent their own storage rules.

## Starting Point

The app already has working auth sessions, protected routes, and sign-in/sign-up flows through Supabase. What is missing is the entire product domain: there are no Bondify tables, no access rules for team data, and no typed service contracts that future slices can reuse.

## Desired End State

When this plan is done, the app will have a stable schema and server-side contracts for team relationships and the team ritual loop. Later slices will be able to implement team setup, round creation, response submission, shared reveal, and 30-day history without reopening the foundational data model.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Teammate identity | Email-based invites | It removes username setup work and keeps the MVP path faster, even though it changes the PRD wording. | Plan |
| Invite timing | Allow invites before sign-up | Pending invites are only useful if teams can add people before those people register. | Plan |
| Membership model | Many-to-many user/team membership | It matches “create or join a team” and avoids a boxed-in single-team schema. | Plan |
| Invite lifecycle | Separate pending invite records | It keeps unresolved invites distinct from active membership and simplifies later claim flows. | Plan |
| Anonymity model | App-level anonymity only | The MVP stores responder identity for integrity and hides it through service/query contracts. | Plan |
| Retention handling | Metadata now, automation later | It keeps the schema aligned with the 30-day rule without pulling in background-job scope. | Plan |
| Game structure | Template -> round -> response | This supports selected games and history without duplicating data in a separate history table. | Plan |

## Scope

**In scope:** schema migration, RLS policies, profile/team/invite/game contracts, selected-game initialization, shared types, service modules, and doc alignment for email-based invites.

**Out of scope:** team UI, invite delivery UX, reveal/history screens, scheduled deletion jobs, auth-provider migration, analytics, and observability expansion.

## Architecture / Approach

Use Supabase Auth only for authentication, then add an app-owned domain layer around it. The schema centers on profiles, teams, memberships, invites, game templates, rounds, and responses; server-only service modules under `src/lib/services/` become the contract boundary that later UI and API work will call.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Domain schema and access rules | Core tables, constraints, retention fields, and RLS | Early RLS mistakes can force every later slice into workarounds |
| 2. App-facing types and service contracts | Reusable TypeScript and server-side domain contracts | Weak contracts would leak raw-table assumptions into later features |
| 3. Reference data, verification path, and doc alignment | Selected games, verified assumptions, and aligned product docs | Product-doc drift could send `S-01` down the wrong invite model |

**Prerequisites:** local Supabase workflow available, current auth flows remain the session source, and this change stays focused on foundation-only work.
**Estimated effort:** ~2-3 implementation sessions across 3 phases.

## Open Risks & Assumptions

- The plan assumes MVP scale stays near the shaped target of dozens to roughly a hundred users.
- Email-based invites are now the working product contract, so the PRD and roadmap must be updated to match.
- App-level anonymity is weaker than a hard-anonymized model; this is accepted for MVP speed.

## Success Criteria (Summary)

- The local Supabase environment can apply the new migration cleanly and the app still passes lint/build.
- The foundation supports multi-team membership, pending pre-sign-up invites, one response per participant, and 30-day history metadata.
- The next roadmap slice can start team setup without reopening the schema or invite model.
