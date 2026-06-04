<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Selected Game History

- **Plan**: `context/changes/S-04-selected-game-history/plan.md`
- **Scope**: Phases 1-3
- **Date**: 2026-06-04
- **Verdict**: PASS
- **Findings**: 0 open, 2 resolved warnings, 1 resolved observation

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | PASS    |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

## Summary

The S-04 implementation follows the planned shape: history retention is marked after the first accepted response for history-enabled templates, participant-safe history reads are membership-checked and reveal-gated, the history page renders grouped anonymous results, and owner clear actions are exposed through a form-backed API route. The dashboard links to the selected team's history page, and clear operations soft-hide history without changing the latest revealed game result path.

The earlier database-boundary risk was resolved in S-05 by replacing the broad owner update policy with narrow `SECURITY DEFINER` clear RPCs. The earlier repo-wide CRLF lint failure was also resolved in S-05 by adding explicit LF guardrails and running a mechanical formatting pass. Manual acceptance is complete against the real local app flow.

## Verification

- `npx supabase migration up --local` passed; local database was up to date.
- `npx eslint src\types.ts src\lib\services\bondify.ts src\lib\history-flash.ts src\pages\api\teams\clear-history.ts "src\pages\teams\[teamId]\history.astro" src\pages\dashboard.astro` passed.
- `npm run lint` passed after explicit LF guardrails and a repo-wide formatting pass in S-05.
- `npm run build` passed.
- `git diff --check` passed.

## Findings

### F1 — Owner RLS policy grants broader update power than clear-history needs

- **Severity**: WARNING
- **Impact**: MEDIUM
- **Dimension**: Safety & Quality / Architecture
- **Location**: `supabase/migrations/20260604030000_history_visibility_and_clear.sql:18`
- **Detail**: The service clear methods only set `history_cleared_at`, but the owner policy grants team owners general `UPDATE` access to matching `game_rounds`. A direct authenticated Supabase caller could update lifecycle fields, not just clear history.
- **Fix**: Replace the broad owner update policy with a narrow `SECURITY DEFINER` RPC for clear-one and clear-all that only sets `history_cleared_at`; have the service call that RPC.
- **Decision**: FIXED in `context/changes/S-05-release-hardening-and-acceptance/` by adding `supabase/migrations/20260604130000_history_clear_rpc_hardening.sql`, dropping `game_rounds_update_for_team_owner_history_clear`, and moving clear-one/clear-all service writes to narrow `SECURITY DEFINER` RPCs.

### F2 — Full repo lint remains a CI risk

- **Severity**: WARNING
- **Impact**: MEDIUM
- **Dimension**: Success Criteria
- **Location**: `AGENTS.md`
- **Detail**: The S-04 targeted automated criteria passed, but repo rules and CI use `npm run lint`. Review-run `npm run lint` failed with repo-wide CRLF Prettier errors, so the branch may still fail CI even though the slice-local lint passed.
- **Fix**: Normalize line endings repo-wide with the formatter or a dedicated LF cleanup, then rerun `npm run lint`.
- **Decision**: FIXED on 2026-06-04 in `context/changes/S-05-release-hardening-and-acceptance/` by adding explicit LF guardrails in `.prettierrc.json` and `.gitattributes`, running `npm run format`, and rerunning full-repo `npm run lint`.

### F3 — Manual history acceptance remains pending

- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Success Criteria
- **Location**: `context/changes/S-04-selected-game-history/plan.md:385`
- **Detail**: Local verification covered grouped history visibility for a history-enabled game, live-only exclusion, non-owner absence of clear controls, owner clear-one and clear-all, dashboard history link visibility, reveal-result preservation after clear, and regression checks for create/invite/submission/reveal flows.
- **Fix**: Update the plan progress checkboxes to match the verified local behavior.
- **Decision**: FIXED on 2026-06-04 via `npm run dev:local -- --host 127.0.0.1 --port 4321` using owner and non-owner member sessions against the real app flow.
