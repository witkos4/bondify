# Team Management Page Separation Implementation Plan

## Overview

Implement roadmap slice `S-08` by moving team-management work out of the member-first dashboard and into a dedicated team-scoped management page, while also filling the still-missing owner-only admin actions for removing members and deleting a team.

## Current State Analysis

- [`src/pages/dashboard.astro`](D:\REPOS\bondify\src\pages\dashboard.astro) currently owns both the member-first games overview and the management surface. It renders personal incoming invites, roster, pending invites, batch invite submission, and create-team UI in the same page that now centers Emoji Check-In and linked games.
- [`src/components/Topbar.astro`](D:\REPOS\bondify\src\components\Topbar.astro) already provides a shared authenticated shell across dashboard, game, and history pages, but its management link still targets `#management` on the dashboard and its team switcher always submits back to `/dashboard`.
- [`src/pages/api/teams/create.ts`](D:\REPOS\bondify\src\pages\api\teams\create.ts), [`src/pages/api/teams/invite.ts`](D:\REPOS\bondify\src\pages\api\teams\invite.ts), and [`src/pages/api/teams/accept-invite.ts`](D:\REPOS\bondify\src\pages\api\teams\accept-invite.ts) all assume the dashboard is both the source and destination for management flows.
- [`src/lib/dashboard-flash.ts`](D:\REPOS\bondify\src\lib\dashboard-flash.ts) contains shell-level flash states for create-team, invite, invite acceptance, and dashboard-only Emoji Check-In feedback, so the current naming and routing assumptions no longer match the desired information architecture.
- Ownership already exists in the model through `teams.created_by`, and the service layer already uses owner-only enforcement for history clear via [`src/lib/services/bondify.ts`](D:\REPOS\bondify\src\lib\services\bondify.ts) and [`supabase/migrations/20260604130000_history_clear_rpc_hardening.sql`](D:\REPOS\bondify\supabase\migrations\20260604130000_history_clear_rpc_hardening.sql).
- The missing remove-member action is not just a UI gap. [`supabase/migrations/20260530090000_team_and_game_foundation.sql:88-93`](D:\REPOS\bondify\supabase\migrations\20260530090000_team_and_game_foundation.sql) defines `team_memberships` with `unique (team_id, profile_id)`, while `game_responses.membership_id` and emoji check-in submissions reference memberships with `on delete cascade`. A naive hard delete would erase historical participation.
- Membership checks and multiple RLS policies rely on `public.is_team_member(...)` from [`supabase/migrations/20260531002000_fix_team_rls_recursion.sql:1-24`](D:\REPOS\bondify\supabase\migrations\20260531002000_fix_team_rls_recursion.sql), so any member-removal design must update the database contract, not only the Astro pages.

## Desired End State

- Team members land on a cleaner member-first dashboard that focuses on Emoji Check-In and linked games, with only a lightweight path into management instead of the full management UI.
- A dedicated route at `/teams/<teamId>/manage` becomes the single authenticated surface for personal incoming invites, team roster visibility, pending invites, batch teammate invites, and creating another team.
- Team switching from the management page keeps the user on the management page for the newly selected team. Team switching elsewhere keeps the existing games-first behavior.
- Team owners gain owner-only destructive actions on the management page: they can remove non-owner members without erasing prior history, and they can delete an entire team through an explicit destructive confirmation flow.
- Existing invite, membership, multi-team, dashboard, game, history, and Emoji Check-In flows continue working without permission regressions.

### Key Discoveries:

- The dashboard itself announces the future split: the current management section says it stays there until `S-08` moves it into its own page, so the code already identifies the right extraction boundary. Reference: [`src/pages/dashboard.astro`](D:\REPOS\bondify\src\pages\dashboard.astro).
- The shared shell is already centralized, so the cleanest route split is to evolve `Topbar` rather than invent a second navigation pattern. Reference: [`src/components/Topbar.astro`](D:\REPOS\bondify\src\components\Topbar.astro).
- Owner-only admin actions should follow the same database-enforced RPC pattern as history clear, not UI-only checks. References: [`src/lib/services/bondify.ts`](D:\REPOS\bondify\src\lib\services\bondify.ts), [`supabase/migrations/20260604130000_history_clear_rpc_hardening.sql`](D:\REPOS\bondify\supabase\migrations\20260604130000_history_clear_rpc_hardening.sql).
- Hard-deleting a membership would cascade into game and emoji records, so member removal must be modeled as soft deactivation instead of row deletion. References: [`supabase/migrations/20260530090000_team_and_game_foundation.sql`](D:\REPOS\bondify\supabase\migrations\20260530090000_team_and_game_foundation.sql), [`supabase/migrations/20260609100000_emoji_check_in_daily_sessions.sql`](D:\REPOS\bondify\supabase\migrations\20260609100000_emoji_check_in_daily_sessions.sql).

## What We're NOT Doing

- No redesign of the auth model or member-versus-owner permission boundary.
- No redesign of game or history routes beyond updating shared shell navigation targets.
- No invite-link system, username invite flow, or invite revocation workflow.
- No transfer-of-ownership feature or multi-owner role model.
- No soft-delete/restore workflow for whole teams; deleting a team remains intentionally destructive.
- No changes to Emoji Check-In, linked-game rules, or history retention behavior outside membership access preservation.

## Implementation Approach

Create a team-scoped management route and make the authenticated shell route-aware instead of dashboard-anchored. Extract the existing non-destructive management UI out of the dashboard, move personal incoming invites into the management page per the selected product direction, and leave the dashboard with a small CTA back into management.

For missing destructive actions, reuse the existing Bondify pattern of owner-only service methods backed by authenticated Supabase RPCs. Team deletion can stay intentionally destructive because the team itself is being removed, but member removal must become soft deactivation at the membership layer so historical responses, reveal data, and emoji timeline entries survive after a member loses access.

## Critical Implementation Details

### State sequencing

Delete-team flow cannot redirect back to `/teams/<deletedTeamId>/manage`. The service layer needs to resolve the next surviving team context after deletion and return a redirect target that falls back to `/dashboard` when no team remains.

### Debug & observability

Member-removal verification must explicitly check that prior revealed rounds and emoji timeline entries remain visible after a member is removed. Because the risky failure mode is silent history mutation through cascade deletes, manual verification needs to compare before/after history states, not only roster access.

## Phase 1: Management Route And Shell Contract

### Overview

Establish the new route, route-aware shell navigation, and flash/state contracts so the later extraction work can move without inventing page-specific hacks.

### Changes Required:

#### 1. Add management-specific state and flash contracts

**Files**: `src/types.ts`, `src/lib/dashboard-flash.ts` or a replacement helper such as `src/lib/team-shell-flash.ts`

**Intent**: Give the new management page typed data contracts and make shell-level form feedback usable outside the dashboard.

**Contract**: Add management-facing types such as `TeamManagementState`, owner-capability flags, and destructive-action result DTOs. Add any new domain errors needed for owner-only management flows, such as membership-not-found, owner-membership immutable, and delete-confirmation mismatch. Replace or broaden the existing dashboard flash helper so create-team, invite, invite acceptance, member removal, and team deletion feedback can be consumed on both dashboard and management surfaces without raw open redirects.

#### 2. Add a management-state service loader

**File**: `src/lib/services/bondify.ts`

**Intent**: Centralize the management page's server-side state instead of re-deriving ownership, selected team, incoming invites, and route edge cases directly inside Astro page code.

**Contract**: Add a service method such as `getTeamManagementState({ teamId })` that verifies the current user is an active member of the target team, returns the selected team's summary data, returns personal pending invites addressed to the signed-in profile, and exposes whether the current user is the team owner for that selected team. The method must treat removed memberships as inactive once Phase 3 lands.

#### 3. Make the top bar route-aware

**File**: `src/components/Topbar.astro`

**Intent**: Preserve the shared shell while letting different authenticated surfaces choose sensible management and switcher targets.

**Contract**: Extend `Topbar` props so each page can provide the current navigation mode or explicit switch target builder. On dashboard, switcher submits to `/dashboard?team=<id>`. On management, it submits to `/teams/<id>/manage`. The management link must point to `/teams/<activeTeamId>/manage` when an active team exists and should be omitted or disabled when no active team exists.

#### 4. Add the management route shell

**File**: `src/pages/teams/[teamId]/manage.astro`

**Intent**: Create the dedicated authenticated surface that the rest of the plan can fill in.

**Contract**: Add a protected SSR route at `/teams/[teamId]/manage` that loads shell context plus management state and renders an initial page scaffold. If a signed-in user has no active team memberships and manually opens this route, redirect them to `/dashboard` so the create-first empty state remains singular and consistent with `S-06`.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes for the new management route, shell props, and flash/type changes.
- `npm run build` passes with the new authenticated route and updated `Topbar` contract.
- Invalid or unsupported return-surface values are rejected by server-side validation rather than producing arbitrary redirects.

#### Manual Verification:

- Visiting `/teams/<teamId>/manage` as an active member loads the authenticated shell and selected-team context successfully.
- Switching teams from the management page keeps the user on the management page for the newly selected team.
- A signed-in user with no active team memberships who opens the management route is redirected to `/dashboard`.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Move Existing Management Flows Out Of The Dashboard

### Overview

Extract the existing non-destructive management features and the personal incoming-invite surface into the dedicated management page, then slim the dashboard back down to a member-first overview.

### Changes Required:

#### 1. Build the management page UI from the current dashboard surface

**File**: `src/pages/teams/[teamId]/manage.astro`

**Intent**: Move management work into its own page without changing the established create/invite/accept behavior underneath.

**Contract**: Render the selected team header, personal incoming invites, active roster, pending invites, batch invite form, and create-another-team form on the management page. Personal incoming invites move here by product decision even though they are account-level rather than selected-team data. The page should reserve a clearly separated owner-only area for the destructive controls added in Phase 3.

#### 2. Strip the bulky management blocks out of the dashboard

**File**: `src/pages/dashboard.astro`

**Intent**: Finish the information-architecture split so the dashboard stays member-first.

**Contract**: Remove the large incoming-invites panel and the full management grid from the authenticated team dashboard. Replace them with a compact management CTA card or section that links to `/teams/<activeTeamId>/manage`. Keep the no-team create-first dashboard state intact; it remains the only authenticated no-team landing page.

#### 3. Make existing team form routes management-aware

**Files**: `src/pages/api/teams/create.ts`, `src/pages/api/teams/invite.ts`, `src/pages/api/teams/accept-invite.ts`, shared shell flash helper

**Intent**: Keep SSR form flows coherent once the source page is no longer always `/dashboard`.

**Contract**: Validate a small allowlist return mode such as `dashboard` or `management`; do not accept arbitrary redirect URLs. Management-sourced create-team and invite actions redirect back to the relevant management page on both success and failure. Accept-invite from management redirects to the newly joined team's management page so the accepted team becomes the active context immediately. Dashboard-sourced no-team create remains on the dashboard path.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes for the management page, dashboard extraction, and updated API-route redirects.
- `npm run build` passes with the dashboard content move and form-route contract changes.
- Invalid management form payloads and invalid return modes fail safely without open redirects or unhandled exceptions.

#### Manual Verification:

- The authenticated team dashboard no longer renders the large management forms or invite panels and instead shows a lightweight management entry point.
- The management page shows personal incoming invites, team roster, pending invites, batch invite UI, and create-another-team UI.
- Submitting invite, create-team, and accept-invite flows from the management page returns the user to management with the correct flash state and selected-team context.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Owner-Only Member Removal And Team Deletion

### Overview

Add the missing destructive management actions safely by soft-deactivating memberships and using owner-only RPC-backed deletion flows.

### Changes Required:

#### 1. Introduce soft membership deactivation in the database model

**Files**: `supabase/migrations/<timestamp>_team_management_soft_memberships.sql`, `src/lib/services/bondify.ts`, `src/types.ts`

**Intent**: Support member removal without erasing historical participation data.

**Contract**: Add `removed_at timestamptz null` to `team_memberships`. Replace the current unconditional `unique (team_id, profile_id)` rule with an active-membership uniqueness rule that allows a removed member to be re-invited later. Update service-layer roster and active-membership queries to treat only `removed_at is null` memberships as active while preserving historical rows for prior responses and emoji submissions.

#### 2. Update shared membership helpers and RLS predicates

**Files**: `supabase/migrations/<timestamp>_team_management_soft_memberships.sql`, especially the `public.is_team_member(...)` and `public.shares_team_with_profile(...)` helpers

**Intent**: Make access control consistent with the new soft-removal semantics instead of relying on stale active-membership assumptions.

**Contract**: Update the membership helper functions and any dependent RLS policies so removed members immediately lose access to teams, invites, games, history, emoji sessions, and management routes, while remaining active members continue to function unchanged. Preserve participant-safe history reads for existing members after a teammate has been removed.

#### 3. Add owner-only RPCs and service methods for destructive actions

**Files**: `supabase/migrations/<timestamp>_team_management_owner_actions.sql`, `src/lib/services/bondify.ts`, `src/types.ts`

**Intent**: Reuse the Bondify pattern of database-enforced owner-only RPCs for destructive flows.

**Contract**: Add a `remove_team_member(team_uuid uuid, membership_uuid uuid)` RPC that soft-deactivates a non-owner membership and rejects attempts to remove the owner membership. Add a `delete_owned_team(team_uuid uuid)` RPC that hard-deletes the team and relies on cascade semantics intentionally. Grant execute only to `authenticated`. Add service methods that wrap these RPCs, translate failures into domain errors, and compute the correct post-delete redirect target for the shell.

#### 4. Add owner-only management UI and API routes

**Files**: `src/pages/teams/[teamId]/manage.astro`, `src/pages/api/teams/remove-member.ts`, `src/pages/api/teams/delete-team.ts`, shared shell flash helper

**Intent**: Expose the missing admin actions through the established SSR form pattern.

**Contract**: Render remove-member controls only for team owners and only on non-owner active roster rows. Render a destructive delete-team form only for the team owner and require exact team-name confirmation before submission. Successful member removal stays on the same team's management page. Successful team deletion redirects to another remaining team’s management page when one exists, otherwise to `/dashboard`.

#### 5. Preserve history and access semantics after removal

**Files**: `src/lib/services/bondify.ts`, `src/pages/teams/[teamId]/history.astro`, `src/pages/teams/[teamId]/games/[gameSlug].astro`, management page and dashboard loaders as needed

**Intent**: Prevent member removal from silently rewriting the product's historical record.

**Contract**: Removed members must disappear from active-team shell options, roster, and invite eligibility checks and must lose access to team-scoped pages immediately. Previously revealed rounds, selected-game history, and Emoji Check-In timeline data for remaining members must remain intact because historical membership rows are preserved rather than deleted.

### Success Criteria:

#### Automated Verification:

- The new Supabase migrations apply cleanly and leave existing team, history, and Emoji Check-In tables readable to current code.
- `npm run lint` passes for the new migrations, service methods, owner-only routes, and management page updates.
- `npm run build` passes with soft-membership semantics and destructive-action flows wired in.
- Invalid membership IDs, owner-self-removal attempts, and bad delete confirmations return controlled domain errors instead of partial deletes.

#### Manual Verification:

- Non-owner members can view the management page but do not see remove-member or delete-team controls and cannot force those actions through direct POST requests.
- Removing a non-owner member removes that person from the active roster and team access immediately without deleting prior revealed/history content for remaining members.
- Deleting a team removes it from the switcher and redirects the owner to another surviving team’s management page or `/dashboard` when no teams remain.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- Flash serialization/deserialization for management-surface success and error states.
- Redirect-target resolution for dashboard versus management form submissions.
- Domain-error mapping for owner-only destructive actions and delete-team confirmation failures.

### Integration Tests:

- Team management route loads the correct selected team and shell context.
- Create-team, invite, and accept-invite flows preserve the intended management return target.
- Soft-removed memberships fail active-membership checks across dashboard, manage, game, history, and emoji flows.
- Owner-only RPC wrappers reject non-owner access and preserve historical content after member removal.

### Manual Testing Steps:

1. Sign in as a member with at least one team and confirm the dashboard now shows a compact management CTA instead of the large management blocks.
2. Open `/teams/<teamId>/manage` and verify incoming invites, roster, pending invites, invite form, and create-another-team form all render correctly.
3. Switch teams from the management page and confirm the route stays `/teams/<newTeamId>/manage`.
4. Accept an incoming invite from the management page and confirm the newly joined team becomes the active management context.
5. As a non-owner member, verify destructive controls are absent and direct POST requests to destructive routes are rejected.
6. As a team owner, remove a non-owner member, then verify that member loses access while prior reveal/history/emoji data remains visible to the remaining team.
7. As a team owner, submit an incorrect delete-team confirmation and verify the action is blocked.
8. As a team owner, delete a team and verify switcher cleanup plus redirect to another team’s management page or the dashboard.

## Performance Considerations

- Soft membership removal should preserve index-backed active-membership checks. Add or update indexes so `removed_at is null` lookups stay fast for shell, roster, invite, game, and history reads.
- Avoid re-querying the same team summary data multiple times on the management page. Prefer one server-side management-state load plus shell context over duplicative page-local filtering wherever possible.
- The new owner-only RPCs should perform constant-scope validation work: verify owner, verify membership or team existence, then update/delete the target row set without broad scans.

## Migration Notes

- Membership soft-deactivation is the critical migration dependency. Update helper functions and any dependent RLS policies before exposing the remove-member UI, or removed users may retain access unexpectedly.
- Converting `team_memberships` from hard uniqueness to active-membership uniqueness must preserve existing rows and allow future re-invite of previously removed members.
- Team deletion remains intentionally destructive because the whole team is being removed; it should reuse existing cascade relationships rather than inventing archival storage in this slice.
- No backfill is required for current memberships beyond `removed_at = null` defaults, but local verification should explicitly exercise existing history and Emoji Check-In data after the migration lands.

## References

- Member-first dashboard shell: `src/pages/dashboard.astro`
- Shared authenticated top bar: `src/components/Topbar.astro`
- Team history page pattern: `src/pages/teams/[teamId]/history.astro`
- Team game page pattern: `src/pages/teams/[teamId]/games/[gameSlug].astro`
- Existing team APIs: `src/pages/api/teams/create.ts`, `src/pages/api/teams/invite.ts`, `src/pages/api/teams/accept-invite.ts`
- Existing shell flash helper: `src/lib/dashboard-flash.ts`
- Service layer: `src/lib/services/bondify.ts`
- Team and membership foundation schema: `supabase/migrations/20260530090000_team_and_game_foundation.sql`
- Membership helper and RLS baseline: `supabase/migrations/20260531002000_fix_team_rls_recursion.sql`
- Owner-only RPC precedent: `supabase/migrations/20260604130000_history_clear_rpc_hardening.sql`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Management Route And Shell Contract

#### Automated

- [x] 1.1 `npm run lint` passes for the new management route, shell props, and flash/type changes
- [x] 1.2 `npm run build` passes with the new authenticated route and updated `Topbar` contract
- [x] 1.3 Invalid or unsupported return-surface values are rejected by server-side validation rather than producing arbitrary redirects

#### Manual

- [ ] 1.4 Visiting `/teams/<teamId>/manage` as an active member loads the authenticated shell and selected-team context successfully
- [ ] 1.5 Switching teams from the management page keeps the user on the management page for the newly selected team
- [ ] 1.6 A signed-in user with no active team memberships who opens the management route is redirected to `/dashboard`

### Phase 2: Move Existing Management Flows Out Of The Dashboard

#### Automated

- [ ] 2.1 `npm run lint` passes for the management page, dashboard extraction, and updated API-route redirects
- [ ] 2.2 `npm run build` passes with the dashboard content move and form-route contract changes
- [ ] 2.3 Invalid management form payloads and invalid return modes fail safely without open redirects or unhandled exceptions

#### Manual

- [ ] 2.4 The authenticated team dashboard no longer renders the large management forms or invite panels and instead shows a lightweight management entry point
- [ ] 2.5 The management page shows personal incoming invites, team roster, pending invites, batch invite UI, and create-another-team UI
- [ ] 2.6 Submitting invite, create-team, and accept-invite flows from the management page returns the user to management with the correct flash state and selected-team context

### Phase 3: Owner-Only Member Removal And Team Deletion

#### Automated

- [ ] 3.1 The new Supabase migrations apply cleanly and leave existing team, history, and Emoji Check-In tables readable to current code
- [ ] 3.2 `npm run lint` passes for the new migrations, service methods, owner-only routes, and management page updates
- [ ] 3.3 `npm run build` passes with soft-membership semantics and destructive-action flows wired in
- [ ] 3.4 Invalid membership IDs, owner-self-removal attempts, and bad delete confirmations return controlled domain errors instead of partial deletes

#### Manual

- [ ] 3.5 Non-owner members can view the management page but do not see remove-member or delete-team controls and cannot force those actions through direct POST requests
- [ ] 3.6 Removing a non-owner member removes that person from the active roster and team access immediately without deleting prior revealed/history content for remaining members
- [ ] 3.7 Deleting a team removes it from the switcher and redirects the owner to another surviving team’s management page or `/dashboard` when no teams remain
