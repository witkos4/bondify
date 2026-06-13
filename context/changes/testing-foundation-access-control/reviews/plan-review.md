<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Test Foundation + Access-Control Critical Path

- **Plan**: context/changes/testing-foundation-access-control/plan.md
- **Mode**: Deep
- **Date**: 2026-06-13
- **Verdict**: SOUND (was REVISE; all findings fixed in triage)
- **Findings**: 1 critical, 0 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS (2 observations, fixed) |
| Plan Completeness | FAIL → PASS after F1 fix |

## Grounding

5/5 paths ✓ (package.json, eslint.config.js, supabase/config.toml, src/lib/services/bondify.ts, supabase/seed.sql), 3/3 symbols ✓ (can_insert_team_membership final def, game_rounds_insert_for_team_members, profiles trigger), brief↔plan ✓. Live check: `npx supabase status -o env` exposes API_URL / ANON_KEY / SERVICE_ROLE_KEY (stack running, CLI 2.101.0). Seed slugs stable via `on conflict do update` upsert.

## Findings

### F1 — Progress 5.1 merges two Success Criteria bullets

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: ## Progress → Phase 5
- **Detail**: Phase 5 lists two Automated bullets but Progress collapsed them into one item; /10x-implement parses one checkbox per bullet.
- **Fix**: Split into 5.1 (lint) / 5.2 (suite green); renumber manual to 5.3.
- **Decision**: FIXED

### F2 — Profiles bootstrap ambiguity resolved: trigger-based

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Plan Completeness
- **Location**: Critical Implementation Details, bullet 4
- **Detail**: Verified during review: profiles rows are created by a DB trigger (`20260530090000:44-61`); no profiles INSERT policy exists. The plan's verify-at-implementation hedge could state the fact.
- **Fix**: Bullet rewritten — mintUser relies on the trigger and asserts the row; client insert would be denied.
- **Decision**: FIXED

### F3 — `supabase status -o env` output contains non-env noise

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Blind Spots
- **Location**: Phase 1, change 3 (tests/setup/global.ts)
- **Detail**: Live run interleaves "Stopped services" and CLI-update notices with KEY=VALUE lines; naive parser breaks.
- **Fix**: Contract now specifies parsing only `^[A-Z0-9_]+=` lines.
- **Decision**: FIXED

### F4 — openRoundAs must set opened_by_profile_id

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Plan Completeness
- **Location**: Phase 2, change 2 (tests/helpers/fixtures.ts)
- **Detail**: game_rounds INSERT policy (`20260531002000:112-119`) requires `opened_by_profile_id = current_profile_id()`; fixtures contract omitted the column.
- **Fix**: Requirement + policy reference added to the openRoundAs contract.
- **Decision**: FIXED
