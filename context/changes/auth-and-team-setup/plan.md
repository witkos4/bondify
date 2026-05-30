# Auth and team setup

## Summary

Turn the current authenticated placeholder experience into Bondify's first real post-login product surface. This slice takes a signed-in user from an empty authenticated state to a working team home where they can create teams, switch the active team from a dropdown, invite teammates by email in batches, see members and pending invites in one roster, and accept invites addressed to their own email.

The plan assumes `F-01: team-and-game-data-foundation` lands first and becomes the source of truth for profiles, teams, memberships, invites, and the service contracts that sit on top of them. `S-01` should build on those contracts rather than re-opening the schema or inventing parallel access patterns.

## Current State Analysis

- Auth, sessions, and protected-route handling already work through `src/lib/supabase.ts`, `src/middleware.ts`, and the existing auth pages/components.
- The current authenticated destination, `src/pages/dashboard.astro`, is still a static placeholder that only greets the signed-in user and offers sign-out.
- The public app shell already has a visual language and reusable auth form patterns (`src/pages/auth/*.astro`, `src/components/auth/*.tsx`) that `S-01` should reuse instead of introducing a second design system.
- There is no team UI, no team-selection UX, and no invite acceptance UI in the app yet.
- Product drift must be treated as intentional: roadmap and README still mention username-based teammate adding, but the accepted foundation plan changed the MVP invite identifier to email. `S-01` must implement the email-based flow.

## Goals

- Replace the placeholder dashboard with the first real authenticated team home.
- Let a signed-in user create teams from the UI and switch the active team from a dropdown in the same surface.
- Show a combined roster containing active members and pending invites for the selected team.
- Allow any active team member to add several teammate emails at once.
- Surface matching pending invites to the signed-in user and let them explicitly accept them.
- Preserve partial-success behavior for batch invites so invalid rows do not block valid ones.

## Non-Goals

- No gameplay, reveal, or history behavior in this slice.
- No role system beyond the chosen MVP rule that any active team member can invite others.
- No username-based invite path.
- No silent auto-join on sign-in.
- No custom onboarding route separate from `/dashboard`.

## Confirmed Planning Decisions

- **Post-sign-in destination:** keep `/dashboard` and make it the first setup surface.
- **Team UI scope:** expose multi-team creation and active-team switching in the UI, using a dropdown menu for switching.
- **Invite identifier:** use email-based invites, not usernames.
- **Invite entry UX:** support batch invite entry in one screen rather than one-at-a-time submission.
- **Roster UX:** show active members and pending invites together in one team roster.
- **Invite permissions:** any active team member can add teammates.
- **Invite acceptance:** matching invites appear in the dashboard and the user explicitly accepts them.
- **Batch invite failure handling:** use partial success with row-level errors.
- **Manual milestone verification:** require a two-account happy path.

## Desired End State

- A newly signed-in user who has no teams lands on `/dashboard` and sees a clear empty-state path to create their first team.
- A user who belongs to one or more teams sees a team home that includes active-team context, a team switcher, the member/invite roster, and invite actions.
- A team member can submit multiple invite emails at once and receive precise row-level feedback when some rows fail.
- A signed-in user whose email matches one or more pending invites sees those invites and can explicitly join the corresponding teams.
- Team setup is complete enough that the next slice can assume working team membership and active-team context without reworking navigation or invite behavior.

## Scope

**In scope**

- `/dashboard` redesign into the authenticated team home
- empty state for users with no active team
- active-team switcher for users with multiple memberships
- team creation flow
- batch email invite flow
- combined roster for active members and pending invites
- invite acceptance UI for matching pending invites
- route/API/service integration needed to support the above

**Out of scope**

- gameplay launch controls
- shared reveal UI
- history UI
- long-term team settings/admin screens
- richer permissions beyond active-member invite rights

## Architecture Decisions

### Dashboard as the stable authenticated shell

- Keep `/dashboard` as the protected destination in middleware and evolve it into the long-term authenticated hub.
- Use one page with conditional states rather than introducing a separate setup route: empty state when the user has no teams, team home when they do, and pending-invite acceptance surfaced in the same overall shell.

### Active-team context

- The UI must expose multi-team membership directly because the user chose visible multi-team support in `S-01`.
- Use a dropdown team switcher as the explicit active-team selector.
- The selected team should drive the roster and invite actions for the current view; later slices can reuse the same active-team context for gameplay and history.

### Invite model at the UI boundary

- The invite form should accept multiple email rows in one submission and return per-row outcomes.
- Server responses must distinguish created invites from row-level failures such as invalid email, duplicate pending invite, already-member, or self-invite, so the UI can keep valid progress and annotate invalid rows.
- Do not fallback to all-or-nothing submission semantics, because that would contradict the accepted plan decision.

### Invite acceptance behavior

- Matching pending invites should be visible to the signed-in user in the dashboard before team acceptance.
- Accepting an invite should be an explicit user action that promotes the pending invite into active membership through the foundation's contract.
- Silent enrollment is out of scope.

### Permissions

- Any active team member can invite additional teammates.
- This slice should not invent a new owner-only restriction in the app layer, even if future settings pages grow stricter management rules.
- The plan assumes `F-01`'s contracts can differentiate active members from non-members cleanly.

## Phase 1: Team home shell and active-team context

### Goal

Replace the placeholder dashboard with a real authenticated team home that can represent empty, single-team, and multi-team states.

### Changes Required

1. **Convert the dashboard into the team home**
   **Intent:** Turn the current placeholder authenticated page into the permanent post-login home for setup and later team activity.
   **Contract:** `src/pages/dashboard.astro` should render a team-home shell instead of a simple welcome card, while preserving protected-route behavior and sign-out access.

2. **Add team-context loading for the signed-in user**
   **Intent:** Give the dashboard enough server-side data to know which teams, memberships, and pending incoming invites belong to the current user.
   **Contract:** The page should load the current user's team/membership context from the foundation service layer rather than reading raw tables directly. If `F-01` introduces a shared team-home query contract, this slice should reuse it instead of adding a second path.

3. **Implement empty and populated dashboard states**
   **Intent:** Make the first-run experience clear for users with no teams while still serving as the steady-state home for users who already belong to one or more teams.
   **Contract:** The dashboard must have:
   - an empty state with first-team creation affordance
   - a populated state with selected-team context
   - a visible path to accept matching pending invites

4. **Add active-team switching**
   **Intent:** Surface multi-team membership in the UI without expanding into a separate settings/navigation system.
   **Contract:** The dashboard must expose a dropdown menu for selecting the active team. The selected team controls which roster and invite-management data the page shows.

### Success Criteria

#### Automated Verification

- `npm run lint` passes with the new dashboard shell and supporting components.
- `npm run build` passes with the new authenticated team-home route behavior.

#### Manual Verification

- A signed-in user with no memberships sees a team-creation-first empty state instead of the placeholder dashboard.
- A signed-in user with memberships can switch the active team from a dropdown and see the page update to the selected team context.
- Sign-out still works from the authenticated shell after the dashboard redesign.

---

## Phase 2: Team creation and roster management

### Goal

Let a signed-in user create teams, view the selected team roster, and batch-invite teammates by email with partial-success feedback.

### Changes Required

1. **Add team-creation flow**
   **Intent:** Make the first authenticated milestone real by letting the user create a team from the dashboard.
   **Contract:** Add the server interaction and UI contract needed to create a team and immediately surface it in the active-team context. Team creation should use the foundation service layer rather than duplicating domain logic in the page.

2. **Render a combined roster**
   **Intent:** Give users one understandable view of who is already in the team and who is still pending.
   **Contract:** The selected team roster must show both active members and pending invites in one list with clear status treatment so invite progress is visible without navigating away.

3. **Implement batch invite submission**
   **Intent:** Support realistic team kickoff behavior by allowing several teammate emails to be invited in one action.
   **Contract:** The invite form must support multiple email rows and submit them together against the foundation invite contract.

4. **Handle partial-success invite results**
   **Intent:** Prevent one bad email row from blocking successful invites.
   **Contract:** The server/client contract must return row-level outcomes so the UI can:
   - preserve created invites
   - annotate invalid or failed rows inline
   - distinguish duplicate pending invite, already-member, invalid email, and self-invite style failures if the foundation exposes them separately

5. **Honor active-member invite permissions**
   **Intent:** Match the chosen MVP rule that any active team member can invite teammates.
   **Contract:** Invite entry must be available to active members of the selected team and unavailable to non-members. This slice should not add a creator-only restriction in the UI or route layer.

### Success Criteria

#### Automated Verification

- `npm run lint` passes with the team-creation and invite-management UI.
- `npm run build` passes with the team creation and roster flows wired to the foundation contracts.

#### Manual Verification

- A signed-in user can create a team and see it become the active team.
- The selected team's roster shows active members and pending invites in one place.
- Batch invite submission can create valid invites while showing inline row-level errors for invalid rows in the same submission.

---

## Phase 3: Invite acceptance and end-to-end milestone verification

### Goal

Complete the team setup milestone by allowing invited users to explicitly accept matching invites and join the team from the dashboard.

### Changes Required

1. **Surface matching pending invites to the signed-in user**
   **Intent:** Make it clear when the current user's email has already been invited to one or more teams.
   **Contract:** The dashboard must display pending incoming invites that match the signed-in user's email, regardless of whether the user currently has another active team.

2. **Implement explicit invite acceptance**
   **Intent:** Give users a clear confirmation moment before they join a team.
   **Contract:** Accepting an invite must call the foundation's invite-resolution path and convert the pending invite into active membership without silent auto-join.

3. **Refresh team context after acceptance**
   **Intent:** Make invite acceptance feel complete immediately and prepare the selected-team model for later gameplay slices.
   **Contract:** After acceptance, the dashboard should refresh the user's available teams, update the roster, and make the newly joined team selectable in the active-team dropdown.

4. **Verify the two-account happy path**
   **Intent:** Ensure `S-01` proves the real team setup flow rather than just individual screens.
   **Contract:** Manual verification must cover User A creating a team and inviting User B, then User B signing in, accepting the invite, and both users appearing correctly in the team roster.

### Success Criteria

#### Automated Verification

- `npm run lint` passes with invite-acceptance UI and route integration.
- `npm run build` passes with final team-setup behavior in place.

#### Manual Verification

- A signed-in user with a matching pending invite sees it in the dashboard and can explicitly accept it.
- Accepting an invite promotes the user into active team membership and updates the available-team context.
- The two-account happy path completes end to end: User A creates a team and invites User B, User B signs in and accepts, and both appear correctly in the roster.

## Testing Strategy

### Unit Tests

- Validate any client-side helpers that normalize invite rows, detect blank/duplicate local entries, or map row-level server outcomes into inline UI errors.
- Validate any server-side mapping code that transforms the foundation's invite/team contracts into dashboard-facing view models.

### Integration Tests

- Dashboard data-loading path for:
  - no teams
  - one team
  - multiple teams
  - matching incoming pending invites
- Team-creation flow from authenticated dashboard state
- Batch invite submission with mixed valid and invalid rows
- Invite acceptance flow that converts a pending invite into active membership

### Manual Testing Steps

1. Sign in as User A, land on `/dashboard`, create a team, and confirm the new team becomes active.
2. While still signed in as User A, submit a multi-email invite batch where at least one row is valid and one row is invalid or duplicate, and confirm partial success with row-level feedback.
3. Sign in as User B using an invited email, confirm the pending invite is visible on `/dashboard`, accept it, and verify the team appears in the active-team selector.
4. Return to User A and confirm the roster now shows User B as an active member rather than a pending invite.

## Performance Considerations

- Optimize dashboard loading around the shaped MVP scale rather than large-team directory behavior.
- Avoid introducing extra route hops for simple state refreshes if the selected-team shell can be kept responsive through a single dashboard context fetch per render/update cycle.
- Keep invite result payloads compact and row-oriented; there is no need for heavy client state machinery in this slice.

## Migration Notes

- This slice depends on `F-01` being landed first. If the foundation contracts are incomplete or renamed, the plan should be updated before implementation begins.
- The plan assumes the team-wide shared types/service contracts may be introduced by `F-01`; `S-01` should consume that layer instead of inventing a parallel contract, especially because `src/types.ts` does not exist yet in the current app.
- Existing README/roadmap wording about username-based invites must not override the accepted email-based invite decision during implementation.

## References

- Change record: `context/changes/auth-and-team-setup/change.md`
- Roadmap item: `context/foundation/roadmap.md`
- Existing auth guard: `src/middleware.ts`
- Existing auth client: `src/lib/supabase.ts`
- Current authenticated placeholder: `src/pages/dashboard.astro`
- Existing auth pages: `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`
- Existing auth forms: `src/components/auth/SignInForm.tsx`, `src/components/auth/SignUpForm.tsx`
- Public landing shell: `src/components/Welcome.astro`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Team home shell and active-team context

#### Automated

- [x] 1.1 Lint passes with the new dashboard shell
- [x] 1.2 Build passes with the authenticated team-home route behavior

#### Manual

- [x] 1.3 Empty team-home state verified for a signed-in user with no memberships
- [x] 1.4 Active-team dropdown switching verified for a multi-team user
- [x] 1.5 Sign-out still works from the redesigned dashboard

### Phase 2: Team creation and roster management

#### Automated

- [ ] 2.1 Lint passes with team creation and invite-management UI
- [ ] 2.2 Build passes with team creation and roster flows

#### Manual

- [ ] 2.3 Team creation verified from dashboard
- [ ] 2.4 Combined roster verified for members and pending invites
- [ ] 2.5 Partial-success batch invite handling verified with row-level errors

### Phase 3: Invite acceptance and end-to-end milestone verification

#### Automated

- [ ] 3.1 Lint passes with invite-acceptance flow
- [ ] 3.2 Build passes with final team-setup behavior

#### Manual

- [ ] 3.3 Matching pending invite visibility verified for invited user
- [ ] 3.4 Explicit invite acceptance verified
- [ ] 3.5 Two-account happy path verified end to end
