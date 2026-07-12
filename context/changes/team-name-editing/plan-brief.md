# Owner-Only Team Name Editing — Plan Brief

> Full plan: `context/changes/team-name-editing/plan.md`

## What & Why

Bondify is missing the Update operation in team CRUD. This slice lets a team owner rename the selected team directly from the management page while preserving the current owner/member access model.

## Starting Point

The management route, owner authorization helper, SSR form redirects, flash cookie, and team-name validation pattern already exist. The implementation only needs to connect those pieces to an update mutation.

## Desired End State

Owners see an inline rename form, submit a trimmed 1–80 character name, and return to the same management route with the updated name visible. Members can still view management but cannot see or invoke the rename action.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Validation | Trimmed, 1–80 characters | Matches create-team behavior. |
| UI | Inline management form | Keeps the owner in context with minimal new UI. |
| Redirect | Same management route with flash | Reuses the existing SSR flow and refreshed state. |
| Tests | Service/API authorization plus one browser happy path | Covers security and the real user journey without widening scope. |

## Scope

**In scope:** service method, owner-guarded POST endpoint, flash states, inline owner form, focused authorization tests, one browser happy path.

**Out of scope:** migrations, role redesign, dashboard editing, client-side mutation state, and unrelated CRUD surfaces.

## Architecture / Approach

The owner form posts to `/api/teams/update`. The endpoint validates the form and calls the service. The service calls the existing owner guard, updates `teams.name`, and returns the refreshed summary. The endpoint stores a typed flash and redirects to `/teams/<teamId>/manage`, where Astro reloads the management state from Supabase.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Service and API | Secure, validated rename mutation | Bypassing owner authorization on direct POST |
| 2. Inline UI | Owner-only form and feedback | Stale or incorrectly scoped flash state |
| 3. Verification | API/security tests and browser happy path | Test setup or redirect assertions drifting from SSR behavior |

**Prerequisites:** Existing S-08 management page and local Supabase test setup.

## Open Risks & Assumptions

- No database migration is needed because `teams.name` already exists.
- The existing `DashboardFlash` cookie remains the shared transport despite its historical name.
- Browser verification requires the local app and Supabase services to be running.

## Success Criteria (Summary)

- Owner can rename a team from management and sees the new name after redirect.
- Member cannot rename the team through the UI or direct API request.
- Invalid names fail safely without mutating persisted team data.
