# Authenticated Member Shell And Team Context Implementation Plan

## Overview

Implement roadmap slice `S-06` by turning the current authenticated entry into a true member-first shell. Signed-in users should land in `/dashboard`, see a persistent authenticated top bar with team context, switch teams in one action, and reach game choices immediately, while existing invite, roster, and team-creation flows remain available but visually secondary until `S-08`.

## Current State Analysis

The repo already has the core data and auth capabilities needed for this slice, but the routing and page hierarchy still reflect the earlier MVP shape rather than the revised member-first experience.

- Successful sign-in still redirects to `/`, so authenticated users fall back into the public landing experience instead of the member shell in `src/pages/api/auth/signin.ts:19`.
- The public landing route always renders `Welcome.astro`, even when a valid session already exists, in `src/pages/index.astro:2` and `src/pages/index.astro:7`.
- The auth entry pages currently remain reachable even when a user is already signed in, while the confirmation screen is a separate static route in `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`, and `src/pages/auth/confirm-email.astro`.
- Protected routes are currently limited to `/dashboard` and `/teams`, which is enough for the revised shell to stay on `/dashboard` without introducing a new protected route in `src/middleware.ts:4` and `src/middleware.ts:18`.
- The current top bar only distinguishes signed-in versus signed-out state; it does not expose selected-team context, one-action switching, or management navigation in `src/components/Topbar.astro:2`, `src/components/Topbar.astro:11`, and `src/components/Topbar.astro:13`.
- The dashboard already resolves selected-team state from `?team=` and falls back to the first membership, but the switcher still requires an extra confirmation click in `src/pages/dashboard.astro:24`, `src/pages/dashboard.astro:28`, `src/pages/dashboard.astro:120`, and `src/pages/dashboard.astro:141`.
- The service layer already exposes the data this slice needs: current team summaries, pending invites, and available game templates in `src/lib/services/bondify.ts:834`, `src/lib/services/bondify.ts:1056`, and `src/lib/services/bondify.ts:1182`.
- `Topbar.astro` is used by both the public welcome surface and the authenticated pages, so any shell redesign must remain backward-compatible for the signed-out caller in `src/components/Welcome.astro:28`, `src/pages/dashboard.astro:85`, `src/pages/teams/[teamId]/games/[gameSlug].astro:47`, and `src/pages/teams/[teamId]/history.astro:84`.

## Desired End State

Signed-in users who visit `/`, `/auth/signin`, or `/auth/signup`, or who complete the sign-in flow, are routed directly into `/dashboard`, which now acts as the authenticated games overview shell. The shell shows the member’s email, selected team context, a one-action team switcher, a stable games entry point, and a stable management entry point.

On `/dashboard`, the primary content is the selected team’s game overview and available game entry points. Invite, roster, and create-team affordances still work, but they are grouped as secondary management content rather than competing with the main member journey.

The same top-bar contract is available on the current authenticated team pages so the revised shell feels coherent across the existing product surface.

`/auth/confirm-email` remains reachable even when a user already has a session, because Supabase can use email confirmation flows for both account verification and authenticated email-change confirmation.

### Key Discoveries:

- The selected-team query-param fallback logic already exists in `src/pages/dashboard.astro:24-35`; this slice should reuse that contract instead of inventing client-side team state.
- `TeamSummary` and `BondifyGameTemplate` already provide the data shape needed for the shell in `src/types.ts:67` and `src/types.ts:109`.
- Sign-out already returns to the public landing in `src/pages/api/auth/signout.ts:9`, so this slice only needs to change the authenticated-entry behavior, not the logged-out exit path.
- Supabase email confirmation flows can also be used for authenticated email-change verification, so `/auth/confirm-email` should be treated as an intentional exception to the signed-in redirect rule.

## What We're NOT Doing

- Implementing the daily Emoji Check-In session model, reveal changes, or “today’s ritual” data logic; that belongs to `S-07`.
- Delivering the separate team-management page; that belongs to `S-08`.
- Changing team membership, invite acceptance, or create-team business rules.
- Adding database migrations, schema changes, or Supabase policy changes.
- Preserving the current game or history route when switching teams; the team switcher will always refresh into `/dashboard?team=<id>`.
- Adding a client-side router or state-management layer for the shell.

## Implementation Approach

Keep `/dashboard` as the authenticated member overview and make the routing contract converge there from both post-login and returning-session entry. Introduce a reusable authenticated top-bar contract that is driven by existing team summary data, then refocus `/dashboard` so games are the first-class content and management actions remain available but visually secondary. Finally, propagate the top-bar contract to the current team-scoped pages so selected-team context and shell navigation stay consistent across the authenticated experience.

Use one shared server-side shell-context loader rather than duplicating ad hoc team-summary fetch logic inside each page. The dashboard, game page, and history page should all consume the same authenticated-shell data contract, while the public welcome page continues using the same top-bar component in signed-out mode.

## Critical Implementation Details

The authenticated-entry rule should be enforced server-side at the route boundary, not just by the sign-in handler. That keeps direct visits to `/` and returning sessions aligned with the same UX contract as fresh logins.

The top-bar team switcher should always navigate to `/dashboard?team=<id>` on change. Preserving the current nested page during switching would create extra route-specific branching now and would not match the product requirement that switching reload the selected-team dashboard in one action.

`/auth/confirm-email` is the one auth-page exception to the signed-in redirect rule. It must remain reachable because it can serve signup confirmation and authenticated email-change confirmation flows.

## Phase 1: Authenticated Entry And Shell Contract

### Overview

Establish the routing and shared-shell contract so authenticated users consistently land in the member overview and the top bar can become the durable navigation surface for later slices.

### Changes Required:

#### 1. Route authenticated sessions into the member shell

**File**: `src/pages/index.astro`

**Intent**: Stop signed-in users from seeing the public marketing landing when they visit `/`. Keep the public welcome experience unchanged for signed-out visitors.

**Contract**: When `Astro.locals.user` is present, the page redirects server-side to `/dashboard`. When no user exists, the route continues rendering `Welcome.astro`.

#### 2. Align post-login navigation with the same shell destination

**File**: `src/pages/api/auth/signin.ts`

**Intent**: Make successful sign-in land on the same authenticated overview used for returning sessions.

**Contract**: A successful password sign-in redirects to `/dashboard` instead of `/`. Error redirects stay on `/auth/signin`.

#### 3. Redirect signed-in users away from auth entry pages

**File**: `src/pages/auth/signin.astro`

**Intent**: Prevent already-authenticated users from lingering on the sign-in page once a valid session exists.

**Contract**: If `Astro.locals.user` is present, the page redirects server-side to `/dashboard`. Signed-out users still see the existing sign-in form.

#### 4. Redirect signed-in users away from signup while preserving confirmation flows

**File**: `src/pages/auth/signup.astro`

**Intent**: Keep the authenticated-entry contract consistent across auth entry routes without breaking Supabase confirmation behavior.

**Contract**: If `Astro.locals.user` is present, the page redirects server-side to `/dashboard`. `src/pages/auth/confirm-email.astro` remains accessible and is not redirected by this slice, even when a session exists.

#### 5. Introduce a shared authenticated shell loader

**File**: `src/lib/services/bondify.ts`

**Intent**: Centralize the team-summary and selected-team data needed by the authenticated top bar so dashboard, game, and history pages do not each invent their own shell-loading logic.

**Contract**: Expose one server-side helper or service method that loads the current profile’s team summaries, derives the active team from an explicit team id when provided, and returns the authenticated top-bar context in a shape reusable by multiple pages. The helper remains optional for signed-out callers.

#### 6. Redefine the top bar as an authenticated shell component

**File**: `src/components/Topbar.astro`

**Intent**: Turn the top bar from a generic signed-in/signed-out banner into a reusable authenticated shell that can show identity, team context, switching, and navigation.

**Contract**: The component accepts enough server-rendered context to render two modes:
- public mode for signed-out pages
- authenticated shell mode for signed-in pages with email, games link, management link, sign out action, and optional team switcher data

The component remains backward-compatible for `Welcome.astro` while authenticated pages consume the shared shell-context loader. The team switcher submits in one action and targets `/dashboard?team=<id>`.

### Success Criteria:

#### Automated Verification:

- Authenticated entry routes build cleanly: `npm run build`
- Updated shell component passes lint: `npm run lint`

#### Manual Verification:

- Visiting `/` with no session still shows the public landing page.
- Visiting `/` with a valid session redirects directly to `/dashboard`.
- Successful sign-in lands on `/dashboard` instead of the public welcome page.
- Visiting `/auth/signin` or `/auth/signup` with a valid session redirects directly to `/dashboard`.
- Visiting `/auth/confirm-email` remains possible even when a valid session exists.
- The authenticated top bar shows the user email, stable shell navigation, and sign out.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Member-First Dashboard Overview

### Overview

Refocus `/dashboard` so the selected team’s games overview becomes the primary experience while existing management flows remain present but secondary.

### Changes Required:

#### 1. Keep `/dashboard` as the selected-team overview route

**File**: `src/pages/dashboard.astro`

**Intent**: Preserve the existing protected route while changing its information architecture to match the revised member-first product flow.

**Contract**: `/dashboard` remains the authenticated landing page. It consumes the shared shell-context loader, resolves `selectedTeam` from `?team=` through that contract, and falls back to the first available team when the query param is absent or invalid.

#### 2. Make games the primary content and keep shell-aware empty states

**File**: `src/pages/dashboard.astro`

**Intent**: Ensure members see the selected team’s available games first, while signed-in users with no teams still stay inside an authenticated create-first experience.

**Contract**: 
- with memberships: games overview is the top-priority content block
- without memberships: the page remains authenticated and shows a create-first empty state instead of redirecting elsewhere
- wording stays honest about currently available games and does not claim the final daily-session model before `S-07`

#### 3. Demote team management without breaking it

**File**: `src/pages/dashboard.astro`

**Intent**: Keep roster, invites, and create-team capabilities working while making them visually secondary to the member game-entry path.

**Contract**: Invite, roster, pending-invite, and create-team sections remain available on `/dashboard`, but they are grouped as management content and have a stable anchor destination for the top-bar management link.

#### 4. Replace the current two-step switcher behavior

**File**: `src/pages/dashboard.astro`

**Intent**: Match the roadmap requirement that switching active team be a single action with a full-page refresh.

**Contract**: Selecting a different team submits immediately and reloads `/dashboard?team=<selected-id>` with no extra confirmation button.

### Success Criteria:

#### Automated Verification:

- Dashboard shell changes build cleanly: `npm run build`
- Dashboard overview changes pass lint: `npm run lint`

#### Manual Verification:

- A signed-in user with multiple teams can switch teams in one action and see the selected team reload.
- A signed-in user with one team sees the member-first overview without a redundant switch action.
- A signed-in user with no teams stays in an authenticated create-first state on `/dashboard`.
- Game entry appears as the primary content, while invites, roster, and team creation remain accessible but visually secondary.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Shared Shell Across Authenticated Team Pages

### Overview

Apply the same shell contract to the current team-scoped pages so navigation, selected-team context, and one-action switching remain consistent beyond the dashboard.

### Changes Required:

#### 1. Reuse the authenticated top bar on the current game page

**File**: `src/pages/teams/[teamId]/games/[gameSlug].astro`

**Intent**: Make the team game page participate in the same authenticated shell as the dashboard.

**Contract**: The page consumes the shared shell-context loader, passes the currently viewed team as the active team context, and still sends team switching to `/dashboard?team=<id>`.

#### 2. Reuse the authenticated top bar on the history page

**File**: `src/pages/teams/[teamId]/history.astro`

**Intent**: Keep the existing history route aligned with the new shell contract until later slices revisit history behavior.

**Contract**: The page consumes the shared shell-context loader, uses the current team as the active team context, and exposes the same shell navigation links as the dashboard.

#### 3. Keep shell links and selected-team continuity consistent

**File**: `src/components/Topbar.astro`

**Intent**: Ensure the shared shell does not drift into route-specific behavior or conflicting team-selection semantics.

**Contract**: The top-bar games link always points to `/dashboard` or `/dashboard?team=<active-id>` when team context exists. The management link points to the dashboard’s management anchor until `S-08` introduces a dedicated page.

### Success Criteria:

#### Automated Verification:

- Authenticated team pages compile cleanly with the shared shell: `npm run build`
- Shared shell usage across pages passes lint: `npm run lint`

#### Manual Verification:

- The game page and history page both show the authenticated top bar with the active team context.
- Switching teams from either authenticated team page returns to the selected-team dashboard in one action.
- The management link from authenticated pages lands in the dashboard’s management section until `S-08` replaces it.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- No dedicated unit-test runner exists yet, so this slice relies on lint/build verification and targeted manual checks.
- If the implementation extracts pure team-selection helpers during the slice, add focused tests only if the project gains a test runner before implementation starts.

### Integration Tests:

- Verify authenticated entry flow from `/auth/signin` to `/dashboard`.
- Verify returning-session redirect from `/` to `/dashboard`.
- Verify one-action team switching on dashboard, game, and history pages.

### Manual Testing Steps:

1. Sign in with a user who belongs to multiple teams and confirm the app lands on `/dashboard`.
2. Change the selected team from the top bar and confirm the dashboard refreshes immediately into the chosen team context.
3. Visit `/` while signed in and confirm it redirects to `/dashboard`.
4. Visit `/auth/signin` and `/auth/signup` while signed in and confirm both redirect to `/dashboard`.
5. Visit `/auth/confirm-email` while signed in and confirm the confirmation page still renders.
6. Visit `/` while signed out and confirm the public landing still renders.
7. Open a team game page and a team history page and confirm the authenticated shell matches the dashboard contract.
8. Confirm roster, invite, and create-team actions are still reachable from the dashboard management area.

## Performance Considerations

This slice should stay server-rendered and form-driven. Avoid introducing client-side state management for team selection or shell navigation. A shared shell-context loader may add one compact team-summary fetch to authenticated pages that did not previously need it; that is acceptable for the current product scale because team counts are small and the existing service layer already returns compact team summary records.

## Migration Notes

No database migration is required. The main compatibility change is behavioral: authenticated visits to `/` now redirect to `/dashboard`, and team switching always returns to `/dashboard?team=<id>` instead of trying to preserve the current nested route.

## References

- Active roadmap: `context/foundation/roadmap.md`
- Product requirements: `context/foundation/prd-v2.md`
- Lessons learned: `context/foundation/lessons.md`
- Existing shell component: `src/components/Topbar.astro:2`
- Existing dashboard selection logic: `src/pages/dashboard.astro:24`
- Existing auth redirect behavior: `src/pages/api/auth/signin.ts:19`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Authenticated Entry And Shell Contract

#### Automated

- [x] 1.1 Authenticated entry routes build cleanly — c380243
- [x] 1.2 Updated shell component passes lint — c380243

#### Manual

- [x] 1.3 Visiting `/` with no session still shows the public landing page — c380243
- [x] 1.4 Visiting `/` with a valid session redirects directly to `/dashboard` — c380243
- [x] 1.5 Successful sign-in lands on `/dashboard` instead of the public welcome page — c380243
- [x] 1.6 Visiting `/auth/signin` or `/auth/signup` with a valid session redirects directly to `/dashboard` — c380243
- [x] 1.7 Visiting `/auth/confirm-email` remains possible even when a valid session exists — c380243
- [x] 1.8 The authenticated top bar shows the user email, stable shell navigation, and sign out — c380243

### Phase 2: Member-First Dashboard Overview

#### Automated

- [x] 2.1 Dashboard shell changes build cleanly — 35c19e4
- [x] 2.2 Dashboard overview changes pass lint — 35c19e4

#### Manual

- [x] 2.3 A signed-in user with multiple teams can switch teams in one action and see the selected team reload — 35c19e4
- [x] 2.4 A signed-in user with one team sees the member-first overview without a redundant switch action — 35c19e4
- [x] 2.5 A signed-in user with no teams stays in an authenticated create-first state on `/dashboard` — 35c19e4
- [x] 2.6 Game entry appears as the primary content, while invites, roster, and team creation remain accessible but visually secondary — 35c19e4

### Phase 3: Shared Shell Across Authenticated Team Pages

#### Automated

- [x] 3.1 Authenticated team pages compile cleanly with the shared shell
- [x] 3.2 Shared shell usage across pages passes lint

#### Manual

- [x] 3.3 The game page and history page both show the authenticated top bar with the active team context
- [x] 3.4 Switching teams from either authenticated team page returns to the selected-team dashboard in one action
- [x] 3.5 The management link from authenticated pages lands in the dashboard management section until `S-08` replaces it
