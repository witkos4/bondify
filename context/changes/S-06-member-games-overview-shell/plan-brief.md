# Authenticated Member Shell And Team Context - Plan Brief

> Full plan: `context/changes/S-06-member-games-overview-shell/plan.md`

## What & Why

We are turning the current authenticated entry flow into a real member-first shell. A signed-in user should stop landing on the public welcome page and instead arrive directly in the selected team’s games overview, with a persistent authenticated top bar and one-action team switching.

## Starting Point

Bondify already has working auth, team summaries, invite flow, and game template loading, but the routing and shell still reflect the earlier MVP. Sign-in currently redirects to `/`, the landing page still renders the public welcome component for signed-in users, and `/dashboard` still mixes gameplay and management concerns.

## Desired End State

When this plan is complete, `/dashboard` is the authenticated member overview. Signed-in users who log in, revisit `/`, or manually open `/auth/signin` or `/auth/signup` are routed there automatically, the shell shows their email and selected team context, and switching teams happens in one action with a full refresh.

The dashboard emphasizes game entry first, while invites, roster, and create-team actions remain available as secondary management content. The same authenticated shell contract also appears on the current team game and history pages, while `/auth/confirm-email` remains available for signup and email-change confirmation flows.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Authenticated overview route | Keep `/dashboard` | Reuses the existing protected route with the lowest migration risk. |
| No-team behavior | Keep a create-first empty state on `/dashboard` | Preserves one authenticated landing surface without adding a setup route before `S-08`. |
| Top-bar scope | Make the top bar shell-aware now | Establishes the reusable navigation contract early so later slices do not invent competing shells. |
| Team switching | Submit immediately on selection change | Matches the PRD requirement for one-action switching with simple SSR behavior. |
| Games overview copy | Show available games now, not final “today” ritual wording | Keeps `S-06` honest until `S-07` introduces the real daily session model. |
| Management placement | Keep management actions visible but secondary on `/dashboard` | Protects existing flows while shifting emphasis toward member gameplay. |
| Entry rule | Redirect signed-in users from `/` to `/dashboard` server-side | Covers both fresh login and returning-session entry with one consistent rule. |
| Auth-page redirects | Redirect signed-in users away from `/auth/signin` and `/auth/signup`, but not `/auth/confirm-email` | Preserves the authenticated landing rule without breaking Supabase confirmation and email-change flows. |
| Shared shell data | Extract a shared server-side shell loader | Prevents dashboard, game, and history pages from drifting into separate top-bar data-loading patterns. |

## Scope

**In scope:**

- redirect signed-in visits to `/` into `/dashboard`
- redirect successful sign-in into `/dashboard`
- redesign the top bar as an authenticated shell
- make `/dashboard` the member-first games overview
- keep no-team users in an authenticated create-first state
- switch teams in one action
- reuse the authenticated shell on current game and history pages

**Out of scope:**

- daily Emoji Check-In logic from `S-07`
- dedicated team-management page from `S-08`
- schema or migration changes
- changes to invite, membership, or create-team business rules
- preserving the current nested route during team switching

## Architecture / Approach

The plan stays server-rendered and builds on the existing service layer. Routing converges on `/dashboard`, a shared server-side shell loader provides selected-team context, `Topbar.astro` becomes the reusable authenticated shell contract, and the current dashboard keeps using existing team summary and game template data while changing hierarchy rather than data ownership. Team-scoped pages adopt the same shell so the selected-team experience stays coherent across the product.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Authenticated Entry And Shell Contract | Correct authenticated routing and reusable top-bar contract | Fixing entry behavior in one place but missing returning-session behavior elsewhere |
| 2. Member-First Dashboard Overview | Games-first dashboard with one-action switching and authenticated no-team state | Refocusing the page without breaking working management flows |
| 3. Shared Shell Across Authenticated Team Pages | Consistent shell on game and history pages | Letting shell links or switching semantics drift between routes |

**Prerequisites:** current auth, team summary, invite, and game template flows remain stable  
**Estimated effort:** ~2-3 implementation sessions across 3 phases

## Open Risks & Assumptions

- Adding authenticated shell context to team pages may require one extra SSR fetch for team summaries on those pages.
- The temporary management link will point into `/dashboard` until `S-08` introduces a dedicated team-management page.
- This plan assumes team switching should always return to `/dashboard?team=<id>` rather than preserving the current nested route.
- This plan assumes `/auth/confirm-email` must remain exempt from the signed-in redirect rule because Supabase can use it for authenticated email-change confirmation.

## Success Criteria (Summary)

- Signed-in users land on `/dashboard` from both login and direct visits to `/`.
- The authenticated shell shows user identity, selected-team context, and one-action team switching.
- The dashboard clearly prioritizes game entry while keeping management actions working and secondary.
