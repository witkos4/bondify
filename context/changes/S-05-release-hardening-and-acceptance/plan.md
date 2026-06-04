# Release Hardening and Acceptance Implementation Plan

## Overview

Implement roadmap slice `S-05` by closing the remaining S-03 and S-04 implementation-review findings before the shared reveal plus selected-game history loop is treated as shippable. This is a hardening and acceptance slice: no new product behavior, no new UX surface, and no new game/history semantics.

## Current State Analysis

S-03 and S-04 are implemented in the working tree:

- S-03 adds shared reveal through `src/pages/api/games/reveal.ts`, `src/lib/game-flash.ts`, `src/lib/services/bondify.ts`, `src/types.ts`, and `src/pages/teams/[teamId]/games/[gameSlug].astro`.
- S-04 adds selected-game history through `supabase/migrations/20260604030000_history_visibility_and_clear.sql`, `src/lib/history-flash.ts`, `src/pages/api/teams/clear-history.ts`, `src/pages/teams/[teamId]/history.astro`, `src/pages/dashboard.astro`, `src/lib/services/bondify.ts`, and `src/types.ts`.
- Targeted ESLint, migration application, `npm run build`, and `git diff --check` passed during review.
- Full `npm run lint` fails with 1377 Prettier CRLF errors across existing repo files.
- S-04 implementation review flagged that `game_rounds_update_for_team_owner_history_clear` grants a broad team-owner `UPDATE` path on `public.game_rounds`, even though clear should only set `history_cleared_at`.
- S-03 and S-04 manual acceptance checks remain open in their plans.

## Desired End State

- Owner history clear is database-enforced through narrow `SECURITY DEFINER` RPCs that only update `game_rounds.history_cleared_at`.
- The broad owner update policy on `public.game_rounds` is removed by a follow-up migration.
- `clearTeamHistory()` and `clearTeamHistoryEntry()` call the RPCs instead of directly updating `game_rounds`.
- Full repo `npm run lint` passes, not only targeted lint.
- Browser-assisted manual acceptance has verified the S-03 reveal flow and S-04 history/clear flow with owner and non-owner users.
- S-03 and S-04 plan progress plus saved implementation-review decisions are updated to match verified reality.

## Confirmed Planning Decisions

| Decision | Choice |
| --- | --- |
| Migration strategy | Add a follow-up migration rather than amending the already-applied S-04 migration |
| Clear enforcement | RPC-only clear through `SECURITY DEFINER` functions |
| Lint cleanup | Include repo-wide CRLF/Prettier cleanup in S-05 as an isolated phase |
| Acceptance method | Browser-assisted manual pass, not Playwright/E2E in this slice |

## Goals

- Close S-04 review finding F1 by removing the broad owner update policy.
- Close S-03 review finding F1 and S-04 review finding F2 by making full repo lint pass.
- Close S-03 review finding F2 and S-04 review finding F3 by completing manual acceptance.
- Preserve S-01 team setup, S-02 submission, S-03 reveal, and S-04 history behavior.
- Keep hardening changes small enough to review despite the expected formatting diff.

## Non-Goals

- No new product screens, states, game templates, or history views.
- No changes to the 30-day retention rule.
- No changes to selected-game eligibility.
- No response deletion or hard-delete privacy workflow.
- No Playwright, browser automation harness, or test framework introduction.
- No rewrite of S-03 or S-04 UI beyond what acceptance uncovers as a blocking bug.
- No reset or rewrite of already-applied migration history.

## Architecture Decisions

### Follow-up migration over migration rewrite

The S-04 migration has already been applied locally. A follow-up migration avoids reset/repair work and creates an auditable sequence: S-04 introduced history clear, S-05 narrows the database boundary after implementation review.

### RPC as the hard database boundary

Postgres RLS policies are not a good fit for column-level "owners may update only `history_cleared_at`" semantics. The safer boundary is a pair of `SECURITY DEFINER` functions that perform one specific update each and expose only those functions to authenticated callers. The existing service owner checks stay for friendly domain errors, but the database must remain safe if called directly.

### Formatting as an isolated phase

The CRLF cleanup will likely touch many files. It belongs in S-05 because the slice is the release gate, but it must be sequenced after the logic hardening so reviewers can inspect the SQL/service diff first and treat the formatting diff as mechanical.

### Manual acceptance before artifact closure

S-03/S-04 plan checkboxes and review decisions should change only after behavior is observed. Browser-assisted acceptance gives enough evidence for this MVP without spending this slice on E2E infrastructure.

## Phase 1: RPC Clear Hardening

### Overview

Replace broad owner table-update access with narrow clear RPCs and update the service layer to use those RPCs.

### Changes Required

1. **Add follow-up Supabase migration**
   **File**: `supabase/migrations/20260604130000_history_clear_rpc_hardening.sql`

   **Intent:** Close S-04 review finding F1 without rewriting the already-applied S-04 migration.

   **Contract:** The migration should:

   - drop policy `game_rounds_update_for_team_owner_history_clear` on `public.game_rounds`
   - keep `game_rounds_update_for_member_lifecycle` intact so reveal and first-response history marking still work for uncleared rounds
   - create `public.clear_team_history(team_uuid uuid)` as `security definer set search_path = public`
   - create `public.clear_team_history_entry(team_uuid uuid, round_uuid uuid)` as `security definer set search_path = public`
   - grant execute on both functions to `authenticated`
   - ensure neither function can update any `game_rounds` column except `history_cleared_at`

2. **Define clear-all RPC behavior**
   **File**: `supabase/migrations/20260604130000_history_clear_rpc_hardening.sql`

   **Intent:** Let the database clear all visible history rows for a team with one narrow operation.

   **Contract:** `public.clear_team_history(team_uuid uuid)` should:

   - check the current profile is the team creator and an active team member
   - update only rows where:
     - `game_rounds.team_id = team_uuid`
     - `game_rounds.status = 'revealed'`
     - `game_rounds.history_visible_until is not null`
     - `game_rounds.history_visible_until >= now()`
     - `game_rounds.history_cleared_at is null`
     - joined `game_templates.is_history_enabled = true`
   - set `history_cleared_at` to a single timestamp value
   - return a result with `cleared_count` and `cleared_at`

3. **Define clear-one RPC behavior**
   **File**: `supabase/migrations/20260604130000_history_clear_rpc_hardening.sql`

   **Intent:** Let the database clear one visible history entry while preserving the same visibility constraints as clear-all.

   **Contract:** `public.clear_team_history_entry(team_uuid uuid, round_uuid uuid)` should:

   - check the current profile is the team creator and an active team member
   - update only the matching visible history row using the same filters as clear-all
   - set `history_cleared_at` to a single timestamp value
   - return a result with `cleared_count` and `cleared_at`
   - let the service map `cleared_count = 0` to `HISTORY_ENTRY_NOT_FOUND`

4. **Refactor clear service methods to RPC**
   **File**: `src/lib/services/bondify.ts`

   **Intent:** Remove direct table-update clear calls from the app service while preserving existing TypeScript result shapes and friendly domain errors.

   **Contract:** Update:

   - `clearTeamHistory(teamId)` to keep `requireTeamOwnerAccess()` for friendly errors, call `supabase.rpc("clear_team_history", { team_uuid: teamId })`, and return `TeamHistoryClearResult`
   - `clearTeamHistoryEntry({ teamId, roundId })` to keep `requireTeamOwnerAccess()`, call `supabase.rpc("clear_team_history_entry", { team_uuid: teamId, round_uuid: roundId })`, return `TeamHistoryEntryClearResult`, and throw `HISTORY_ENTRY_NOT_FOUND` when the RPC clears zero rows
   - avoid direct `.from("game_rounds").update({ history_cleared_at: ... })` in service clear methods

5. **Update S-04 review decision**
   **File**: `context/changes/S-04-selected-game-history/reviews/impl-review.md`

   **Intent:** Keep review triage durable.

   **Contract:** After implementation and verification pass, change S-04 F1 `Decision: PENDING` to a fixed decision that names the RPC hardening migration.

### Success Criteria

#### Automated Verification

- `npx supabase migration up --local` applies the follow-up migration cleanly.
- Targeted ESLint passes for `src/lib/services/bondify.ts`.
- `npm run build` passes after the service RPC refactor.
- A code search shows no broad `game_rounds_update_for_team_owner_history_clear` policy remains in active migrations after the follow-up migration.
- A code search shows service clear methods no longer directly update `game_rounds.history_cleared_at`.

#### Manual Verification

- Owner can clear one visible history entry through the app after the RPC refactor.
- Owner can clear all visible history through the app after the RPC refactor.
- Non-owner clear still fails through the API route.

---

## Phase 2: Repo Lint and Line-Ending Cleanup

### Overview

Normalize repo formatting so full `npm run lint` passes and the CRLF issue does not keep reappearing on Windows.

### Changes Required

1. **Make line-ending expectations explicit**
   **Files**: `.prettierrc.json`, `.gitattributes`

   **Intent:** Reduce future drift between Windows checkouts and Prettier's LF expectations.

   **Contract:** Add explicit LF guardrails, for example:

   - `.prettierrc.json`: set `"endOfLine": "lf"`
   - `.gitattributes`: prefer `* text=auto eol=lf` unless repo constraints require a narrower rule

2. **Run repo-wide formatting**
   **Files**: many

   **Intent:** Convert CRLF-formatted files and any incidental Prettier drift into the repo's expected format.

   **Contract:** Run `npm run format` once after the LF guardrails are in place. Treat the resulting diff as mechanical formatting unless a file shows an unexpected semantic change.

3. **Re-run full validation**
   **Files**: N/A

   **Intent:** Close S-03 F1 and S-04 F2 review findings with command evidence.

   **Contract:** Run:

   - `npm run lint`
   - `npm run build`
   - `git diff --check`

4. **Update S-03/S-04 review decisions**
   **Files**:

   - `context/changes/S-03-shared-reveal-results/reviews/impl-review.md`
   - `context/changes/S-04-selected-game-history/reviews/impl-review.md`

   **Intent:** Mark the lint-related findings fixed only after full lint passes.

   **Contract:** Change:

   - S-03 F1 `Decision: PENDING` to fixed with the lint cleanup
   - S-04 F2 `Decision: PENDING` to fixed with the lint cleanup

### Success Criteria

#### Automated Verification

- `npm run format` completes.
- `npm run lint` passes.
- `npm run build` passes.
- `git diff --check` passes.

#### Manual Verification

- Formatting diff is reviewed as mechanical and contains no accidental product behavior changes.

---

## Phase 3: Browser-Assisted Acceptance and Artifact Closure

### Overview

Verify the S-03/S-04 user flows through the running app, then update progress and review artifacts to match the verified state.

### Changes Required

1. **Run the local app with Supabase configured**
   **Files**: N/A

   **Intent:** Test the same SSR form-backed flows users exercise.

   **Contract:** Start the app using the repo's normal local path (`npm run dev` or `npm run dev:local` depending on the active Supabase configuration). Use the browser to open `/dashboard`.

2. **Verify S-03 reveal acceptance**
   **Files**:

   - `context/changes/S-03-shared-reveal-results/plan.md`
   - `context/changes/S-03-shared-reveal-results/reviews/impl-review.md`

   **Intent:** Close pending shared reveal acceptance.

   **Contract:** Verify:

   - invalid reveal payload redirects without an unhandled exception
   - non-member reveal is denied
   - zero-response reveal shows a friendly error
   - already revealed or closed round shows a friendly error
   - User A can reveal a submitted round
   - User B sees the same shared results
   - response identity remains hidden
   - submit form is hidden after reveal

   After verification, mark the matching S-03 progress checkboxes and update S-03 F2 `Decision`.

3. **Verify S-04 history acceptance**
   **Files**:

   - `context/changes/S-04-selected-game-history/plan.md`
   - `context/changes/S-04-selected-game-history/reviews/impl-review.md`

   **Intent:** Close pending selected-game history acceptance.

   **Contract:** Verify:

   - dashboard shows a working history link for the selected team
   - history-enabled game appears in grouped history after start, submit, and reveal
   - live-only game remains absent from history after start, submit, and reveal
   - non-owner member sees history without clear controls
   - owner can clear one visible history entry
   - owner can clear all visible history
   - clearing a history entry does not delete its game reveal result
   - existing team creation, invite, submission, and reveal flows still work

   After verification, mark the matching S-04 progress checkboxes and update S-04 F3 `Decision`.

4. **Update S-05 progress and change state**
   **Files**:

   - `context/changes/S-05-release-hardening-and-acceptance/plan.md`
   - `context/changes/S-05-release-hardening-and-acceptance/change.md`

   **Intent:** Leave a durable handoff for implementation review.

   **Contract:** Mark automated and manual S-05 progress only after checks pass. When all S-05 progress is complete, update `change.md` from `planned` to `implemented`.

### Success Criteria

#### Automated Verification

- `npm run lint` passes after acceptance changes.
- `npm run build` passes after acceptance changes.
- `git diff --check` passes after artifact updates.

#### Manual Verification

- S-03 pending manual acceptance checkboxes are complete.
- S-04 pending manual acceptance checkboxes are complete.
- S-03 and S-04 implementation-review pending decisions are resolved.
- S-05 manual acceptance notes identify the accounts/team/game templates used, without committing secrets.

## Testing Strategy

### Unit Tests

No unit-test harness exists for the Bondify service. Do not introduce one in S-05. Keep verification focused on migration, lint/build, service type checks, and browser acceptance.

### Integration / Migration Checks

- Apply the follow-up migration locally with Supabase.
- Use the app/service flow to prove owner and non-owner clear behavior.
- Optionally inspect local database rows to confirm `history_cleared_at` changes and response rows remain.

### Manual Browser Checks

Use one owner user and one non-owner member on the same team. Use at least one history-enabled template (`rose-thorn-bud` or `how-i-work`) and one live-only template (`two-truths-and-a-wish`) from `supabase/seed.sql`.

## Performance Considerations

The RPCs operate on visible 30-day history rows for one team. MVP team/history volume is small and already bounded by S-04. No pagination, background job, cache, or async processing is needed in this slice.

## Security Considerations

- The broad owner update policy must be dropped.
- The clear RPCs must use `security definer` with `set search_path = public`, matching existing helper-function style.
- The RPCs must check the current profile through existing auth/profile helper functions.
- The RPCs must not accept a caller-supplied `cleared_at` timestamp.
- The service should preserve friendly owner/history errors, but the database must remain safe if called directly.

## Migration Notes

- Use a new migration after `20260604030000_history_visibility_and_clear.sql`.
- Do not rewrite the existing S-04 migration.
- Keep migration idempotency reasonable with `drop policy if exists` and `create or replace function`.
- Grant execute to `authenticated`; avoid exposing clear functions to unauthenticated roles.

## References

- Roadmap item: `context/foundation/roadmap.md`
- S-03 plan: `context/changes/S-03-shared-reveal-results/plan.md`
- S-03 review: `context/changes/S-03-shared-reveal-results/reviews/impl-review.md`
- S-04 plan: `context/changes/S-04-selected-game-history/plan.md`
- S-04 review: `context/changes/S-04-selected-game-history/reviews/impl-review.md`
- Service layer: `src/lib/services/bondify.ts`
- Current S-04 migration: `supabase/migrations/20260604030000_history_visibility_and_clear.sql`
- Existing SQL helper-function style: `supabase/migrations/20260531002000_fix_team_rls_recursion.sql`
- Formatting config: `.prettierrc.json`, `.gitattributes`, `eslint.config.js`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` - <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: RPC Clear Hardening

#### Automated

- [ ] 1.1 Follow-up migration applies cleanly with `npx supabase migration up --local`
- [x] 1.2 Targeted ESLint passes for `src/lib/services/bondify.ts`
- [x] 1.3 `npm run build` passes after the service RPC refactor
- [x] 1.4 No broad `game_rounds_update_for_team_owner_history_clear` policy remains active after the follow-up migration
- [x] 1.5 Service clear methods no longer directly update `game_rounds.history_cleared_at`

Note: `npx supabase migration up --local` timed out connecting to `127.0.0.1:54322` despite a healthy local DB container. The same migration SQL was applied cleanly in one transaction via `docker exec supabase_db_bondify psql`, and live DB inspection confirmed the broad policy is absent and the RPCs are `SECURITY DEFINER` functions executable only by `authenticated` and `postgres`.

#### Manual

- [ ] 1.6 Owner can clear one visible history entry after the RPC refactor
- [ ] 1.7 Owner can clear all visible history after the RPC refactor
- [ ] 1.8 Non-owner clear still fails through the API route

### Phase 2: Repo Lint and Line-Ending Cleanup

#### Automated

- [ ] 2.1 LF guardrails are explicit in `.prettierrc.json` and `.gitattributes`
- [ ] 2.2 `npm run format` completes
- [ ] 2.3 `npm run lint` passes
- [ ] 2.4 `npm run build` passes
- [ ] 2.5 `git diff --check` passes

#### Manual

- [ ] 2.6 Formatting diff is reviewed as mechanical

### Phase 3: Browser-Assisted Acceptance and Artifact Closure

#### Automated

- [ ] 3.1 `npm run lint` passes after artifact updates
- [ ] 3.2 `npm run build` passes after artifact updates
- [ ] 3.3 `git diff --check` passes after artifact updates

#### Manual

- [ ] 3.4 S-03 invalid reveal and reveal edge cases are verified and marked complete
- [ ] 3.5 S-03 two-user shared reveal and anonymity checks are verified and marked complete
- [ ] 3.6 S-04 grouped history, live-only exclusion, and non-owner UI checks are verified and marked complete
- [ ] 3.7 S-04 clear-one, clear-all, and reveal-result preservation checks are verified and marked complete
- [ ] 3.8 Existing team creation, invite, submission, and reveal flows still work
- [ ] 3.9 S-03 and S-04 implementation-review pending decisions are resolved
- [ ] 3.10 S-05 `change.md` is updated to `implemented` after all checks pass
