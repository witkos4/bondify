# Release Hardening and Acceptance - Plan Brief

> Full plan: `context/changes/S-05-release-hardening-and-acceptance/plan.md`
> Roadmap item: `S-05` in `context/foundation/roadmap.md`

## What & Why

Close the review findings that keep S-03 shared reveal and S-04 selected-game history from being treated as shippable. This slice does not add product scope; it tightens the database boundary for owner history clear, restores full lint/CI confidence, and completes browser-assisted manual acceptance for the MVP reveal/history loop.

## Starting Point

S-03 and S-04 are implemented and targeted automated checks pass. The implementation reviews still show `NEEDS ATTENTION` because full `npm run lint` fails on repo-wide CRLF Prettier errors, S-04 grants team owners a broader `game_rounds` update policy than clear-history needs, and several manual S-03/S-04 acceptance checks remain open.

## Desired End State

History clear is enforced by narrow Supabase RPCs that only set `history_cleared_at`; the service no longer performs direct `game_rounds` update calls for clear actions. Full repo lint and build pass. The S-03 and S-04 manual flows have been browser-checked with owner and non-owner users, and the related plans and implementation-review decisions reflect the accepted state.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Migration strategy | Follow-up migration | Keeps already-applied local migration history stable while superseding the broad policy. |
| Clear enforcement | RPC-only clear | Makes the database enforce that clear is a soft-hide operation only. |
| Lint cleanup | Include in S-05 | S-05 is the release gate, so it should end with `npm run lint` green. |
| Acceptance method | Browser-assisted manual pass | Gives realistic MVP evidence without adding a Playwright harness now. |

## Scope

**In scope:**

- Follow-up Supabase migration that drops the broad owner update policy
- `SECURITY DEFINER` RPCs for clear-all and clear-one history actions
- Service updates to call the clear RPCs instead of direct `game_rounds` updates
- Repo-wide CRLF/Prettier cleanup and line-ending guardrails
- Full `npm run lint`, `npm run build`, migration, and diff checks
- Browser-assisted S-03/S-04 acceptance with owner and non-owner users
- Updating S-03/S-04 progress and implementation-review decisions after verification

**Out of scope:**

- New user-facing product features
- Rewriting the reveal or history UI beyond what hardening requires
- Adding a Playwright/E2E test harness in this slice
- Resetting or rewriting already-applied migrations
- Changing retention rules, history eligibility, anonymity rules, or clear semantics

## Architecture / Approach

Add a follow-up migration that drops `game_rounds_update_for_team_owner_history_clear` and replaces owner clear with two RPCs: one for all visible history in a team and one for a single visible history entry. Both functions check the current profile against team ownership, filter to revealed, history-enabled, unexpired, uncleared rounds, and only set `history_cleared_at`. The TypeScript service keeps the existing friendly owner checks, then calls `supabase.rpc(...)` so the database remains the final enforcement boundary.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. RPC hardening | Follow-up migration plus service refactor for clear-all and clear-one | Breaking owner clear or leaving a direct broad update path |
| 2. Lint cleanup | LF/Prettier normalization and full lint/build passing | Noisy diff obscures real logic changes |
| 3. Browser acceptance and artifact closure | Manual S-03/S-04 verification plus plan/review status updates | Marking acceptance before behavior is actually proven |

**Prerequisites:** S-03 and S-04 current implementations remain in the working tree; local Supabase and app dev server can run.
**Estimated effort:** One focused hardening session plus one browser acceptance pass.

## Open Risks & Assumptions

- The RPCs need to use the repo's existing `security definer` and `set search_path = public` pattern.
- `npm run format` may touch many files; this is expected and should stay isolated from the RPC phase in review notes.
- Browser-assisted acceptance depends on available owner and non-owner test accounts or a quick invite/sign-up setup path.

## Success Criteria (Summary)

- Team owners can clear one or all visible history entries through the app.
- Non-owner members cannot clear history through the app or direct clear RPC calls.
- No broad owner `UPDATE` policy remains on `public.game_rounds`.
- `npm run lint`, `npm run build`, migration checks, and `git diff --check` pass.
- S-03/S-04 progress and review decisions accurately reflect completed manual acceptance.
