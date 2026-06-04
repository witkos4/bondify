<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Selected Game History

- **Plan**: `context/changes/S-04-selected-game-history/plan.md`
- **Scope**: Phases 1-3
- **Date**: 2026-06-04
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | WARNING |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Summary

The S-04 implementation follows the planned shape: history retention is marked after the first accepted response for history-enabled templates, participant-safe history reads are membership-checked and reveal-gated, the history page renders grouped anonymous results, and owner clear actions are exposed through a form-backed API route. The dashboard now links to the selected team's history page, and clear operations soft-hide history without changing the latest revealed game result path.

The main design risk is in the database policy. The app service only updates `history_cleared_at`, but the owner RLS policy grants a broader `UPDATE` path for owners on `game_rounds`. Automated slice checks passed, but full repo lint still fails because of CRLF Prettier errors outside the slice.

## Verification

- `npx supabase migration up --local` passed; local database was up to date.
- `npx eslint src\types.ts src\lib\services\bondify.ts src\lib\history-flash.ts src\pages\api\teams\clear-history.ts "src\pages\teams\[teamId]\history.astro" src\pages\dashboard.astro` passed.
- `npm run build` passed.
- `git diff --check` passed.
- `npm run lint` failed with 1377 Prettier CRLF errors across existing repo files.

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
- **Decision**: PENDING

### F3 — Manual history acceptance remains pending

- **Severity**: OBSERVATION
- **Impact**: LOW
- **Dimension**: Success Criteria
- **Location**: `context/changes/S-04-selected-game-history/plan.md:385`
- **Detail**: Phase 2 and phase 3 manual checks remain unchecked, including grouped history visibility, live-only exclusion, non-owner clear-control omission, clear-one, clear-all, dashboard link, and regression checks for team/invite/submission/reveal flows.
- **Fix**: Run the listed manual flows and update progress checkboxes only after verification.
- **Decision**: PENDING
