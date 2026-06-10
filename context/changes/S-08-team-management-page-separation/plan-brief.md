# Team Management Page Separation — Plan Brief

> Full plan: `context/changes/S-08-team-management-page-separation/plan.md`

## What & Why

This slice separates team-management work from the member-first dashboard by introducing a dedicated management page at `/teams/[teamId]/manage`. It also fills the still-missing owner admin actions for removing members and deleting teams, because the product direction for this change is not just “move the UI” but “finish the management surface.”

## Starting Point

Bondify already has a working shared shell, dashboard, team invite flow, history page, and game pages. The problem is that [`src/pages/dashboard.astro`](D:\REPOS\bondify\src\pages\dashboard.astro) still mixes games, incoming invites, roster, pending invites, batch invite UI, and create-team UI in the same member-facing surface, while remove-member and delete-team behavior do not exist yet.

## Desired End State

When this plan is done, the dashboard stays focused on daily participation and linked games, while management actions live on their own team-scoped page. Team owners can manage members and delete teams safely, and regular members can still reach invites and roster information without management clutter taking over the main experience.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Route shape | `/teams/[teamId]/manage` | Keeps management explicitly team-scoped and consistent with existing `/teams/[teamId]/...` pages. |
| Scope | Include existing flows plus missing admin actions | Your `1B` choice makes `S-08` the full management slice rather than a cosmetic move. |
| Team switching | Stay on management when switching from management | Preserves user intent while they are actively doing admin work. |
| Incoming invites | Move them to management | Consolidates all invite handling into the dedicated management surface. |
| No-team behavior | Redirect management-route visits to `/dashboard` | Keeps the create-first empty state singular and aligned with `S-06`. |
| Dashboard aftermath | Replace management blocks with a small CTA card | Protects the member-first dashboard while keeping management discoverable. |
| Post-action redirects | Return management-sourced form posts to management | Makes the new page feel complete instead of bouncing users back to dashboard. |
| Member removal model | Soft-deactivate memberships instead of hard delete | Hard-deleting memberships would cascade into old game and emoji history. |
| Team deletion UX | Owner-only destructive form with exact team-name confirmation | Team deletion is intentionally destructive and needs an explicit safety rail. |

## Scope

**In scope:**

- add `/teams/[teamId]/manage`
- move incoming invites, roster, pending invites, batch invite UI, and create-another-team UI there
- update shell navigation and team switching for the new route
- slim the dashboard to a management CTA
- add owner-only remove-member behavior
- add owner-only delete-team behavior
- update redirects and flash flows for management-sourced SSR forms
- preserve history/game data when a member is removed

**Out of scope:**

- permission-model redesign or multiple owners
- invite revocation workflow
- auth-flow redesign
- dashboard/game/history redesign beyond navigation and entry-point changes
- team archive/restore workflow

## Architecture / Approach

The plan keeps the existing Astro SSR + service-layer pattern. A dedicated management-state loader and a route-aware `Topbar` establish the new shell contract, the current dashboard management sections get extracted into the new page, and owner-only destructive actions follow the existing Supabase RPC pattern already used for history clear. The main data-model change is soft membership deactivation so member removal does not mutate old reveal/history records.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Management Route And Shell Contract | New route, route-aware top bar, shared flash/state contract | Leaving shell navigation half-dashboard, half-management |
| 2. Move Existing Management Flows Out Of The Dashboard | Dedicated management page plus slimmed dashboard | Breaking SSR redirects or flash flows during extraction |
| 3. Owner-Only Member Removal And Team Deletion | Safe destructive actions with DB-backed enforcement | Accidentally deleting historical participation through membership cascades |

**Prerequisites:** `S-06` shell work remains the baseline; local Supabase migrations must be runnable for Phase 3  
**Estimated effort:** ~3 implementation sessions across 3 phases

## Open Risks & Assumptions

- The current schema makes hard membership deletes unsafe for history, so Phase 3 assumes a soft-deactivation migration is acceptable in this slice.
- Management-sourced redirects likely require broadening the current dashboard-only flash helper into a shell-level helper.
- Team deletion needs a redirect target that survives after the current team route disappears; the service layer must compute that target explicitly.

## Success Criteria (Summary)

- The dashboard becomes clearly member-first and no longer carries the large management surface.
- `/teams/[teamId]/manage` becomes the coherent place for invites, roster, and team setup work.
- Team owners can remove members and delete teams safely, while old reveal/history data remains intact for remaining members.
