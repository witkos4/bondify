# Structured Two Truths And A Lie Round — Plan Brief

> Full plan: `context/changes/S-09-two-truths-structured-round/plan.md`

## What & Why

This slice replaces the current loose `Two Truths and a Wish` text box with a structured `Two Truths and a Lie` multiplayer round. Each participant submits one authored three-statement set, the team votes on which statement is the lie in every other participant's set, and the round reveals only after voting closes.

## Starting Point

Bondify already supports team-scoped game rounds, one free-text response per member, shared reveal, and selected-game history. The problem is that the current implementation stores only anonymous free text in `game_responses`, so it cannot preserve which statement is the lie, cannot support per-opponent guesses, and cannot show a meaningful round summary in history.

## Desired End State

When this plan is done, Bondify treats this game as a structured round:

- participants submit three separate statements and mark which one is the lie
- authored entries are visible during guessing
- members cannot guess their own entry
- guesses stay hidden until the round is finally revealed
- lightweight scoring is shown in the reveal
- history shows a round summary rather than the old anonymous response cards

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Cadence | On-demand round | Fits the existing team game model and avoids forcing a daily ritual into the generic game shell. |
| Submission model | Exactly one structured set per participant | Keeps the round understandable and makes vote totals deterministic. |
| Author visibility | Visible from the start | The social point of the game is guessing which lie belongs to which teammate, not preserving author anonymity. |
| Guess visibility | Hidden until final reveal | Prevents mid-round social proof and preserves the shared reveal moment. |
| Vote scope | Each participant votes once on every other participant set | Matches the multiplayer guessing outcome in the PRD and prevents self-guessing. |
| Close behavior | Voting auto-closes when all required votes are in, with manual fallback | Removes unnecessary waiting while still handling partial participation. |
| Partial participation | Manual close may exclude missing votes from scoring | Lets the round finish without blocking on every teammate forever. |
| Edit window | No edits after submit | Keeps the vote target stable once an entry is visible to others. |
| History | Round summary only | Avoids replaying the full vote ledger while still making past rounds useful. |
| Rollout | Clean-break structured template | The old wish-based template is a different game contract, so preserving it would add migration complexity without product value. |

## Scope

**In scope:**

- add a dedicated structured `Two Truths and a Lie` template
- add structured storage for entries, lie positions, and guesses
- add collection, voting, and final reveal phases
- update the game page to render structured submission, guessing, and reveal states
- add round-closing actions and lightweight scoring
- add summary-only history support for this template
- retire the old `two-truths-and-a-wish` behavior and purge its legacy rows if needed

**Out of scope:**

- real-time updates or live vote streaming
- editing submitted entries
- anonymous authors during guessing
- cumulative leaderboard or season scoring
- preserving old wish-based rounds for backward compatibility

## Architecture / Approach

The plan keeps the generic `game_rounds` container used by other games, but adds a Two-Truths-specific data model for structured entries and guesses. The existing free-text `game_responses` table stays in place for the other games; only the legacy wish-based template and its data are eligible for clean-break removal. The game page remains at `/teams/[teamId]/games/[gameSlug]`, but branches into a specialized SSR flow for the new template.

## Phases At A Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Structured Round Data Model And Service Contracts | New template, dedicated structured tables, phase-aware service methods | Modeling round transitions incorrectly and ending up with ambiguous participant/vote expectations |
| 2. Structured Submission And Voting Experience | Specialized game page states plus submit, vote, and close actions | Letting invalid self-guesses, duplicate votes, or late edits slip through |
| 3. Reveal, Summary History, And Clean-Break Rollout | Final scoring reveal, history summary rendering, legacy template retirement | Half-migrating the old template and leaving dashboard/history behavior inconsistent |

## Open Risks & Assumptions

- The current generic game contract has no reliable concept of "all intended participants," so the plan assumes the participant set is frozen when the round moves from collection to voting.
- To keep the round unblocked, the plan assumes any active team member can close submissions or manually close voting, matching the current collaborative reveal model unless implementation shows a stronger permission boundary is needed.
- Lightweight scoring is planned as `+1` for each correct guess and `+1` to an author for each teammate they fooled; if you want a different scoring formula, that should be changed before `/10x-implement`.

## Success Criteria (Summary)

- Starting the structured game produces a real collection phase instead of a loose free-text form.
- Voting is teammate-against-teammate, never self-guessing, and remains hidden until the final reveal.
- The reveal clearly shows truths, lies, guesses, and lightweight round scoring.
- History shows a useful round summary for the structured template.
- The old wish-based template is no longer exposed as if it were the same game.
