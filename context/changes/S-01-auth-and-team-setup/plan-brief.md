# Auth and team setup — Plan Brief

> Full plan: `context/changes/S-01-auth-and-team-setup/plan.md`

## What & Why

We are turning Bondify's authenticated placeholder into the first real team setup experience. This matters because `S-01` is the roadmap's first user-visible milestone after the data foundation and is the point where the product stops being “auth works” and starts being “a team can begin using Bondify.”

## Starting Point

Auth, sessions, and protected-route behavior already work, and `/dashboard` already exists as the authenticated destination. What is missing is everything team-specific: no team home, no team switcher, no team roster, no teammate invite flow, and no invite acceptance flow.

## Desired End State

When this plan is done, a signed-in user lands on `/dashboard` and can create a team, switch active teams from a dropdown, invite teammates by email in batches, and see both members and pending invites in one roster. An invited user can sign in, explicitly accept the invite, and appear as an active member in the same team home.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Authenticated home | Keep `/dashboard` as the team home | It reuses the existing protected route and gives later slices one stable post-login shell. | Plan |
| Team UI scope | Show multi-team creation and switching in the UI | The user wants visible multi-team support now, with active-team switching via dropdown. | Plan |
| Invite identifier | Email-based invites | This follows the accepted foundation decision even though older docs still mention usernames. | Plan |
| Invite entry UX | Batch email invites | It fits real team kickoff behavior better than one-at-a-time invite submission. | Plan |
| Roster UX | Members and pending invites in one list | It makes invite progress understandable without extra screens. | Plan |
| Invite permissions | Any active member can invite | This matches the chosen MVP collaboration rule and avoids early role complexity. | Plan |
| Invite acceptance | Explicit acceptance in dashboard | It is clearer and safer than silent auto-join while still keeping setup simple. | Plan |
| Batch failure behavior | Partial success with row-level errors | One bad invite row should not block valid teammates from being added. | Plan |
| Manual milestone | Two-account happy path | This is the smallest verification that proves real team setup works end to end. | Plan |

## Scope

**In scope:** dashboard redesign, team creation, active-team switching, combined member/pending-invite roster, batch email invites, invite acceptance, and the route/service integration needed for those flows.

**Out of scope:** gameplay, reveal/history UI, advanced admin/settings screens, username invites, silent auto-join, and a separate onboarding route.

## Architecture / Approach

Use `/dashboard` as the single authenticated team home with conditional states for empty, populated, and invited-user scenarios. Build the page on top of the `F-01` team/invite service contracts, keep the active team as explicit page context selected from a dropdown, and treat batch invite results as row-level outcomes that the UI renders inline.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Team home shell and active-team context | Real dashboard shell, empty state, active-team switching | Choosing the wrong team-home contract now would force later slices to rework navigation |
| 2. Team creation and roster management | Team creation, combined roster, batch invites with partial success | Weak batch-result handling would make invite UX brittle and confusing |
| 3. Invite acceptance and end-to-end milestone verification | Explicit invite acceptance and full two-account setup flow | If invite acceptance is incomplete, `S-01` looks done but does not actually prove team setup works |

**Prerequisites:** `F-01` must land first so profiles, teams, invites, and shared service contracts exist.
**Estimated effort:** ~2-3 implementation sessions across 3 phases.

## Open Risks & Assumptions

- The plan assumes `F-01` provides stable service contracts for teams, memberships, invites, and matching pending invites.
- Existing username wording in roadmap/README is stale for implementation purposes; this slice follows the accepted email-based invite path.
- `src/types.ts` does not exist yet, so this slice should reuse whatever shared type/service layer the foundation introduces rather than inventing its own parallel contract.

## Success Criteria (Summary)

- A signed-in user can create a team and use `/dashboard` as the real team home instead of the placeholder page.
- Team members can batch-invite teammates by email and see members plus pending invites in one roster with row-level error feedback.
- A second user can sign in with an invited email, explicitly accept the invite, and appear as an active member in the roster.
