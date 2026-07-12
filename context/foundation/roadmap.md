---
project: Bondify
version: 2
status: draft
created: 2026-06-05
updated: 2026-06-12
prd_version: 2
main_goal: speed
top_blocker: decisions
---

# Roadmap: Bondify

> Derived from `context/foundation/prd-v2.md` (v2) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

Bondify already works as a team micro-game app, but the current member journey is still too fragmented for repeat daily use. This roadmap focuses on the shortest revision path that makes a signed-in member land in the right team context immediately, see the right game choices, and complete the daily ritual without team-management clutter taking over the main experience.

The main product bet in this revision is that a cleaner member-first shell plus a stronger Emoji Check-In ritual will make Bondify feel ready for real team habits, while the existing auth, invite, and multi-team backbone stays intact.

## North star

**S-07: Team member can complete today's Emoji Check-In from the selected team overview** - This is the north star here, meaning the smallest end-to-end slice whose success proves the revised product is genuinely usable as a daily team ritual, and it is placed as early as S-06 allows.

## At a glance

| ID | Change ID | Outcome (user can ...) | Prerequisites | PRD refs | Status |
|---|---|---|---|---|---|
| S-06 | member-games-overview-shell | User can land directly in the selected team games overview, see the signed-in shell, and switch teams in one action. | - | US-01 | implemented |
| S-07 | daily-emoji-check-in-loop | User can enter today's Emoji Check-In, submit emoji-only reactions once, see the reveal, and compare the last 30 days. | S-06 | US-02 | implemented |
| S-08 | team-management-page-separation | User can leave the member-first games overview and reach team-management actions on their own dedicated page. | S-06 | US-01 | implemented |
| S-09 | two-truths-structured-round | User can join a structured Two Truths and a Lie round with teammate voting and no self-guessing. | S-06 | US-03 | implemented |
| S-10 | team-name-editing | Team owner can rename a team from team management, while non-owners are denied. | S-08 | US-01 | proposed |

## Streams

Navigation aid - groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme | Chain | Note |
|---|---|---|---|
| A | Member entry and daily ritual | `S-06` -> `S-07` | This is the must-have path for the speed-biased roadmap because it proves the revised member flow in daily use. |
| B | Team management separation | `S-08` | Depends on `S-06`, but stays separate so the member-first shell can land before owner-facing cleanup expands. |
| C | Second game redesign | `S-09` | Depends on `S-06` and stays blocked until the open game-rule decisions are answered. |
| D | Team management completeness | `S-08` -> `S-10` | Closes the missing Update operation in the team-management CRUD surface without changing the role model. |

## Baseline

What's already in place in the codebase as of `2026-06-05` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present - server-rendered routes and shared shell already exist in `src/pages/dashboard.astro`, `src/pages/teams/[teamId]/games/[gameSlug].astro`, and `src/components/Topbar.astro`.
- **Backend / API:** present - auth, team, and game handlers already exist under `src/pages/api/auth/`, `src/pages/api/teams/`, and `src/pages/api/games/`.
- **Data:** present - Supabase schema, RLS, seed data, and service-layer logic already exist in `supabase/migrations/20260530090000_team_and_game_foundation.sql`, `supabase/seed.sql`, and `src/lib/services/bondify.ts`.
- **Auth:** present - SSR Supabase session handling and route protection already exist in `src/lib/supabase.ts` and `src/middleware.ts`.
- **Deploy / infra:** present - Cloudflare worker deployment and CI scaffolding already exist in `wrangler.jsonc` and `.github/workflows/ci.yml`.
- **Observability:** partial - Wrangler observability is enabled in `wrangler.jsonc`, but no richer app-level monitoring path is yet evident.

## Foundations

No dedicated foundations are required for this roadmap. The brownfield baseline already covers auth, API, data, and deploy scaffolding well enough that the revision can stay vertical from the first slice instead of pausing for cross-cutting setup.

## Slices

### S-06: Authenticated member shell and team context

- **Outcome:** User can land directly in the selected team games overview, see the signed-in shell, and switch teams in one action.
- **Change ID:** member-games-overview-shell
- **PRD refs:** US-01
- **Prerequisites:** -
- **Parallel with:** -
- **Blockers:** -
- **Unknowns:** -
- **Risk:** This comes first because every later revision assumes the product already lands the member in the right team context; delaying it would force deeper game work onto the wrong shell.
- **Status:** implemented
- **2026-06-12 verification note:** The member shell, direct authenticated landing, and one-action team switching were manually rechecked during the wider slice sweep and remain stable.

### S-07: Daily Emoji Check-In ritual

- **Outcome:** User can enter today's Emoji Check-In, submit emoji-only reactions once, see the reveal, and compare the last 30 days.
- **Change ID:** daily-emoji-check-in-loop
- **PRD refs:** US-02
- **Prerequisites:** S-06
- **Parallel with:** S-08
- **Blockers:** -
- **Unknowns:** -
- **Risk:** This is the first full proof that the revised product creates a repeatable team ritual instead of only cleaning up navigation, so it should follow the shell immediately.
- **Status:** implemented
- **2026-06-12 verification note:** The dashboard Emoji Check-In flow, preview/history split, picker expansion, and whitespace/polish fixes were manually exercised and refined with live user feedback.

### S-08: Team-management page separation

- **Outcome:** User can leave the member-first games overview and reach team-management actions on their own dedicated page.
- **Change ID:** team-management-page-separation
- **PRD refs:** US-01
- **Prerequisites:** S-06
- **Parallel with:** S-07
- **Blockers:** -
- **Unknowns:** -
- **Risk:** This stays behind the member shell because separating owner actions is valuable, but it should not delay the core member entry and daily game path.
- **UX note from manual testing (2026-06-12):** The extra management entry point low on the dashboard feels redundant because team management is already reachable from the top bar. If the card starts feeling noisy, prefer trimming or removing the duplicate CTA instead of adding more management affordances to the games-first surface.
- **Status:** implemented
- **2026-06-12 verification note:** Core management navigation and non-destructive flows were manually exercised. The create-another-team RLS regression discovered during testing was fixed the same day.

### S-09: Structured Two Truths and a Lie round

- **Outcome:** User can join a structured Two Truths and a Lie round with teammate voting and no self-guessing.
- **Change ID:** two-truths-structured-round
- **PRD refs:** US-03
- **Prerequisites:** S-06
- **Parallel with:** S-07, S-08
- **Blockers:** -
- **Unknowns:** -
- **Risk:** The main residual risk is now edge-case QA around partial voting, legacy-template reachability, and summary history, rather than product-definition uncertainty.
- **Status:** implemented
- **2026-06-12 verification note:** The structured round is implemented and the core flow was included in the manual slice sweep after the planning decisions were locked.

### S-10: Team name editing

- **Outcome:** Team owner can rename a team from team management, while non-owners are denied.
- **Change ID:** team-name-editing
- **PRD refs:** US-01
- **Prerequisites:** S-08
- **Parallel with:** -
- **Blockers:** -
- **Unknowns:** -
- **Risk:** This is intentionally narrow: it completes the missing Update leg of team CRUD while preserving the existing owner/member access model and avoiding a wider team-management redesign.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID | Suggested issue title | Ready for `/10x-plan` | Notes |
|---|---|---|---|---|
| S-06 | member-games-overview-shell | Member-first landing, signed-in shell, and one-action team switching | yes | Run `/10x-plan S-06-member-games-overview-shell` |
| S-07 | daily-emoji-check-in-loop | Daily Emoji Check-In with emoji-only input, reveal, and 30-day timeline | no | Wait for `S-06`, then plan immediately as the north star slice. |
| S-08 | team-management-page-separation | Separate team-management page while keeping member overview focused | no | Wait for `S-06`; can run after or alongside `S-07`. |
| S-09 | two-truths-structured-round | Structured Two Truths and a Lie multiplayer round | no | Resolve the open game-rule decisions first. |
| S-10 | team-name-editing | Owner-only team rename from team management | yes | Small follow-up to complete team CRUD; verify owner access and member denial. |

## Open Roadmap Questions

1. **What is the expected ballpark QPS for the revised product flow?** - Owner: user. Block: none currently.
2. **What is the expected ballpark data volume for the revised product flow?** - Owner: user. Block: none currently.
3. **How should Two Truths and a Lie scoring work?** - Owner: user. Block: S-09.
4. **Are Two Truths and a Lie guesses anonymous or visible?** - Owner: user. Block: S-09.
5. **When should Two Truths and a Lie results be revealed: immediately or only after all votes?** - Owner: user. Block: S-09.
6. **Should Two Truths and a Lie run as a daily ritual, an on-demand game, or a session-based activity?** - Owner: user. Block: S-09.

## Parked

- **Auth model rewrite** - Why parked: the PRD explicitly preserves the current auth and session model, so this revision should not widen into identity redesign.
- **Owner/member role redesign** - Why parked: the PRD says the problem is navigation and gameplay flow, not a new permission model.
- **Strict preservation of old game URLs** - Why parked: the PRD explicitly allows route changes when they improve the revised experience.
- **Strict preservation of old revision-sensitive game data** - Why parked: the PRD explicitly allows discarding old game data if the redesigned flows are simpler or safer to land that way.
- **Forcing full dashboard replacement inside this revision** - Why parked: the PRD allows team-management actions to remain on the dashboard temporarily if the two-week window gets tight.
- **Finalizing all Two Truths and a Lie rules inside this roadmap pass** - Why parked: the PRD keeps scoring, anonymity, reveal timing, and cadence open for later clarification.

## Done

- **2026-06-12 - S-06 validated:** Authenticated shell routing, team context, and shared topbar flow remain working after the later slice changes.
- **2026-06-12 - S-07 validated and polished:** Emoji Check-In dashboard flow was manually exercised, whitespace issues were removed, the preview/history split was refined, the picker was expanded to 25 options, and seeded history was added for the `BUBBA` team.
- **2026-06-12 - S-08 validated and fixed:** Dedicated team management flow was manually exercised; the `create another team` RLS regression was found and fixed, and invite-field whitespace was removed.
- **2026-06-12 - S-09 validated at core-flow level:** Structured Two Truths and a Lie flow is implemented and included in the manual sweep, with a few edge-case QA checks still worth running before treating the slice as fully hardened.
