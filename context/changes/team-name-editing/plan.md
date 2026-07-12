# Owner-Only Team Name Editing

## Current State Analysis

Bondify already has a dedicated team-management route at `src/pages/teams/[teamId]/manage.astro`, owner authorization through `requireTeamOwnerAccess()` in `src/lib/services/bondify.ts`, and server-rendered form/flash patterns for create, member removal, and deletion. Team creation already establishes the desired name normalization and validation contract: trim whitespace, require a non-empty value, and cap the name at 80 characters.

The missing capability is the Update leg of team CRUD. The team owner needs to edit the selected team's name from management; a regular active member must be unable to perform the operation even by posting directly to the API. No database migration is required because `teams.name` already exists and the existing RLS/owner checks can protect the update.

## Desired End State

An owner sees an inline “Edit team name” form on the selected team's management page. Submitting a valid name trims it, updates the selected team, redirects back to the same management route, and shows a success flash. Blank, overlong, or malformed requests return to management with a field-preserving error. Members may view management but do not see the form, and direct API requests from a member fail with the existing owner-only domain error.

## Scope

**In scope:**

- Add an owner-guarded service method to update `teams.name`.
- Add `POST /api/teams/update` with Zod validation for `teamId`, `teamName`, and the allowlisted management surface.
- Add inline owner-only form and success/error flash rendering to the management page.
- Add service/API authorization coverage and one Playwright owner happy path.

**Out of scope:**

- Role or permission-model redesign.
- Team slug, URL, invite, or historical-data changes.
- Editing team names from the dashboard or adding a client-side mutation layer.
- General CRUD completion for rounds, invites, or memberships.

## Complexity Assessment

**LOW**: the change touches service, one API route, one Astro page, shared flash types, and focused tests. It reuses existing owner authorization, SSR redirects, and name-validation conventions; it introduces no schema migration or new persistence model.

## Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Name validation | Trimmed, 1–80 characters | Matches the existing create-team contract and prevents whitespace-only or inconsistent names. |
| Editing UX | Inline form on management | Keeps the owner in the selected-team context and follows the existing SSR form pattern. |
| Post-submit behavior | Redirect to the same management route with flash | Re-renders the shell and management state from the database without adding client state. |
| Test scope | Service/API authorization plus one browser happy path | Covers the security boundary and real user flow while keeping this small slice focused. |

## Phase 1: Service Contract And Owner-Guarded API

### Overview

Add the update operation behind the existing service authorization boundary and expose it through a validated management-scoped POST route.

### Changes Required:

#### 1. Add the team update service method

**File**: `src/lib/services/bondify.ts`

**Intent**: Provide one canonical domain operation for renaming a team and ensure authorization is enforced before persistence.

**Contract**: Add `updateTeam(input: { teamId: string; name: string }): Promise<TeamSummary>` (or the repository's equivalent naming). Normalize the name with `trim()`, reject blank input and values over 80 characters using the existing `INVALID_TEAM_NAME` error, call `requireTeamOwnerAccess()`, update `teams.name` by `id`, and return the refreshed `TeamSummary` using the existing summary loader/shape.

#### 2. Add the management update endpoint

**File**: `src/pages/api/teams/update.ts`

**Intent**: Keep the mutation in the established Astro SSR form pattern and make malformed or unauthorized requests safe and repeatable.

**Contract**: Export `prerender = false` and an uppercase `POST` handler. Validate `teamId` as a UUID, `teamName` as a trimmed 1–80 character string, and `surface` through `parseTeamSurface`; accept only the management surface for this slice. On success, write a `team-updated` flash and redirect with `getTeamSurfaceHref({ surface: "management", teamId })`. On validation or service failure, preserve the submitted trimmed value in a `team-update-error` flash and redirect to the same management route with an edit-form hash.

#### 3. Extend shared DTO and flash contracts

**Files**: `src/types.ts`, `src/lib/dashboard-flash.ts`

**Intent**: Make success and failure states type-safe and renderable by the management page without duplicating cookie or redirect logic.

**Contract**: Add the minimal `TeamSummary` update result reuse or a dedicated update result only if the current type shape requires it. Extend the `DashboardFlash` union with `team-updated` carrying `teamId`, `teamName`, `message`, and `surface`, plus `team-update-error` carrying `teamId`, submitted `teamName`, `message`, and `surface`. Preserve the existing cookie serialization and allowlisted surface behavior.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes for the service, flash types, and new endpoint.
- `npm run build` passes with the new API route and updated flash union.
- Service/API tests prove the owner can update and a non-owner receives `TEAM_OWNER_REQUIRED` without changing the team name.
- Invalid UUID, blank, overlong, and invalid-surface payloads redirect safely and do not update the database.

#### Manual Verification:

- A direct POST as a non-owner cannot rename the selected team, even if the request is crafted outside the UI.

## Phase 2: Inline Management UI

### Overview

Expose the new operation only to owners and render its flash states in the existing management page.

### Changes Required:

#### 1. Add the owner-only edit form and feedback

**File**: `src/pages/teams/[teamId]/manage.astro`

**Intent**: Let the owner rename the currently selected team without leaving the management surface, while keeping member-facing management read-only for this action.

**Contract**: Consume `team-updated` and `team-update-error` flashes scoped to the selected team. Render an accessible inline form only when `managementState.canManageTeam` is true, with a labeled `teamName` textbox prefilled from the submitted value on error and the current team name otherwise, hidden `teamId` and `surface=management`, and a submit button. Keep the displayed page title, management header, roster heading, and other team references driven by the freshly loaded `managementState.team.name` after redirect.

#### 2. Preserve existing management flows

**Files**: `src/pages/teams/[teamId]/manage.astro`, `src/lib/dashboard-flash.ts`

**Intent**: Add the new state without changing invite, member-removal, create-team, or delete-team behavior.

**Contract**: Scope update flashes by `decodedTeamId`, use an edit-form anchor only for update errors, and leave all existing flash variants and redirects intact.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes for the Astro markup and flash handling.
- `npm run build` passes with owner/member conditional rendering.
- Browser test locators use accessible labels/roles and do not use CSS/XPath selectors or `page.waitForTimeout()`.

#### Manual Verification:

- Owner sees the inline form, renames the team, remains on `/teams/<teamId>/manage`, and sees the new name in the page header and management content.
- Member can view the management page but does not see the rename form.
- Invalid owner input returns to the same management page with the submitted value and an actionable error.

## Phase 3: Focused Verification

### Overview

Lock the security boundary and user-visible behavior with deterministic service/API coverage and one independent browser scenario.

### Changes Required:

#### 1. Add service/API authorization tests

**Files**: `tests/rls/access-grants.test.ts` or the repository's focused service/API test location; add a dedicated test file if that is the established pattern after inspection.

**Intent**: Verify both the positive owner path and the negative member path at the mutation boundary, not only through hidden UI controls.

**Contract**: Seed an owner/member team fixture, update the name as owner and assert the stored value, then attempt the same operation as the member and assert the owner-required error plus unchanged name. Include validation cases for blank and overlong names where the test harness supports service-level assertions.

#### 2. Add one browser happy path

**File**: `tests/browser/team-name-editing.spec.ts`

**Intent**: Prove the real SSR flow from management page through form submission and redirected state.

**Contract**: Create a unique owner-owned team fixture, sign the owner in, navigate to the management page, fill the accessible team-name field, submit the accessible update button, assert the management URL and updated heading/text, and clean up the fixture. Keep the test standalone and use state-based Playwright assertions.

### Success Criteria:

#### Automated Verification:

- Focused service/API tests pass.
- `npx playwright test tests/browser/team-name-editing.spec.ts` passes when local Supabase and the app server are available.
- `npm run lint` and `npm run build` pass after all phases.

#### Manual Verification:

- Owner flow works on desktop and mobile-width management layouts without clipping the inline form.
- The member view remains unchanged apart from not exposing the owner-only rename control.

## Testing Strategy

### Unit / Service Tests:

- Name normalization: surrounding whitespace is removed; blank and overlong names fail with `INVALID_TEAM_NAME`.
- Authorization: owner succeeds; active member and outsider cannot mutate the team.

### Integration / API Tests:

- Valid management POST redirects to the selected management route and persists the new name.
- Invalid payloads preserve the submitted value in flash state and do not mutate data.
- Invalid surface values fail closed to `/dashboard` through the existing allowlist behavior.

### Browser Testing:

- One independent owner happy path with unique fixture data and cleanup.
- Member denial remains covered at the API/service boundary rather than requiring a second browser scenario.

## Performance Considerations

The update is one indexed primary-key update followed by the existing team-summary reload on redirect. No new query, index, cache, or client-side state is needed.

## Migration Notes

No migration is required. The existing `teams.name` column, RLS policies, and owner identity are reused. Rollback is limited to removing the endpoint, service method, flash variants, form, and tests.

## References

- Roadmap slice: `context/foundation/roadmap.md` S-10
- Prior management implementation: `context/changes/S-08-team-management-page-separation/plan.md`
- Existing owner guard: `src/lib/services/bondify.ts:962`
- Existing team-name validation: `src/pages/api/teams/create.ts:8`
- Existing management route: `src/pages/teams/[teamId]/manage.astro:1`

## Progress

### Phase 1: Service Contract And Owner-Guarded API

#### Automated

- [x] 1.1 `npm run lint` passes for service, flash types, and endpoint. — 323abff
- [x] 1.2 `npm run build` passes with the update route. — 323abff
- [x] 1.3 Owner update and member denial tests pass. — 323abff
- [x] 1.4 Invalid payloads fail closed without updating the team. — 323abff

#### Manual

- [x] 1.5 Direct non-owner POST cannot rename the team. — 323abff

### Phase 2: Inline Management UI

#### Automated

- [x] 2.1 `npm run lint` passes for the management page. — 323abff
- [x] 2.2 `npm run build` passes with owner/member conditional rendering. — 323abff
- [x] 2.3 Browser locators use accessible roles/labels and state-based waits. — 323abff

#### Manual

- [x] 2.4 Owner can rename and sees the updated name after redirect. — 323abff
- [x] 2.5 Member does not see the rename form. — 323abff
- [x] 2.6 Invalid input preserves the value and shows an error. — 323abff

### Phase 3: Focused Verification

#### Automated

- [x] 3.1 Focused service/API tests pass. — 323abff
- [x] 3.2 `npx playwright test tests/browser/team-name-editing.spec.ts` passes with local services. — 323abff
- [x] 3.3 Final `npm run lint` and `npm run build` pass. — 323abff

#### Manual

- [x] 3.4 Owner flow is usable at desktop and mobile widths. — 323abff
- [x] 3.5 Member-facing management behavior has no unrelated regressions. — 323abff
