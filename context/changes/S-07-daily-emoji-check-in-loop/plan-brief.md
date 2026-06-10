# Daily Emoji Check-In Loop — Plan Brief

> Full plan: `context/changes/S-07-daily-emoji-check-in-loop/plan.md`
> Product requirements: `context/foundation/prd-v2.md`
> Roadmap: `context/foundation/roadmap.md`

## What & Why

This plan adds Bondify's first true daily ritual: one shared Emoji Check-In session per team per day, completed from the selected-team dashboard. The goal is to replace the current generic free-text game behavior for this ritual with an emoji-only, once-per-day flow that produces a shared reveal and a 30-day mood timeline people can actually compare over time.

## Starting Point

Bondify already has the right shell for this work: `/dashboard` is now the selected-team member overview, and the app already supports generic game start, submit, reveal, and grouped history. But today's implementation is still generic and free-text, and the seed catalog does not yet contain an Emoji Check-In template.

## Desired End State

Members open `/dashboard?team=<id>`, see today's Emoji Check-In inline, pick 1 to 3 emojis, submit once, and wait for a manual shared reveal. After reveal, the dashboard shows the day's result with a lightweight transition plus a 30-day timeline of aggregated team emoji counts. The other games remain equally accessible as linked entries from the same overview.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Session model | Dedicated daily session tables | The daily uniqueness rule is explicit and queryable instead of being inferred from generic rounds. | Plan |
| Day boundary | App-level team day rule | Preserves one shared team day without viewer-local drift. | Plan |
| Reveal | Manual reveal | Keeps the shared moment and reuses the current product mental model. | Plan |
| Submission policy | One save, no edits | Matches the existing integrity bias and keeps the state model small. | Plan |
| Primary surface | Inline on `/dashboard` | Matches the roadmap's "complete from the selected team overview" north star. | Plan |
| Game positioning | Other games stay equally accessible | Preserves the user's desired catalog model instead of turning Emoji Check-In into the only main path. | Plan |
| Timeline shape | Per-day aggregate emoji counts | Makes 30-day mood patterns easier to compare at a glance. | Plan |
| Legacy data | Clean break | Old generic rounds were not true daily sessions, so they should not pollute the new timeline. | Plan |
| Scale target | Small teams, low traffic | Supports an SSR-first implementation without premature complexity. | Plan |

## Scope

**In scope:**

- dedicated Emoji Check-In session/submission schema
- `emoji-check-in` seed/catalog entry
- service and API contracts for load, submit, reveal, and timeline
- inline dashboard ritual module
- rich emoji picker and reveal transition
- 30-day dashboard timeline

**Out of scope:**

- dedicated Emoji Check-In page for primary use
- migration of old generic round data into the new timeline
- timezone settings UI
- changes to other game rules beyond compatibility
- realtime or polling behavior

## Architecture / Approach

Emoji Check-In becomes a specialized ritual beside the generic games. The backend adds dedicated daily-session tables plus service methods for today's state, submission, reveal, and 30-day aggregation. The frontend keeps `/dashboard` as the primary selected-team overview, mounts a small React island for emoji picking and reveal animation, and keeps the rest of the game catalog as ordinary linked entries.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Daily Session Foundation | Schema, types, seed, and day-key contract | Getting the day boundary or uniqueness rule wrong creates duplicate sessions |
| 2. Service and Route Contracts | Server-backed load, submit, reveal, and timeline APIs | Letting dashboard, API, and service logic drift on what "today" means |
| 3. Dashboard Ritual UI | Inline picker, reveal state, and 30-day timeline | Overcomplicating the dashboard or creating a second competing emoji flow |
| 4. Compatibility, Cleanup, and Verification | Catalog alignment and end-to-end local proof | Accidentally regressing the existing non-emoji games |

**Prerequisites:** S-06 shell work already landed; local Supabase seed data must be verified separately from schema health.
**Estimated effort:** ~3-4 implementation sessions across 4 phases.

## Open Risks & Assumptions

- The plan assumes one app-level timezone rule is acceptable for now and that team-level timezone configuration can wait.
- The plan assumes the clean break applies to Emoji Check-In timeline lineage only, not to unrelated generic game data.
- The dashboard must hold two truths at once: inline Emoji Check-In completion and equal accessibility of the other games.

## Success Criteria (Summary)

- A member can complete today's Emoji Check-In from the selected-team dashboard with 1 to 3 emojis and only one submission.
- The team sees anonymous progress before reveal and a visible shared reveal state afterward.
- The selected-team dashboard shows a 30-day Emoji Check-In timeline built only from the new daily-session model.
