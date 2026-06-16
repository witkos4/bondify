# Test Foundation + Access-Control Critical Path — Implementation Plan

## Overview

Bootstrap Bondify's first test infrastructure (Vitest 4 + raw `@supabase/supabase-js` per-role clients against the local Supabase stack) and ship two integration suites: Risk #1 positive-presence access tests (member sees their data; invitee gains access; the June-12 create-second-team regression reproduced as a permanent test) and Risk #2 cross-team IDOR denial tests (foreign-ID reads return zero rows, foreign-ID writes fail loudly AND change zero rows). This is rollout Phase 1 of `context/foundation/test-plan.md`.

## Current State Analysis

- **Zero test infrastructure**: no runner, no `test` script (`package.json:8-17`), zero test files.
- **RLS is the sole authorization boundary** (frame, HIGH confidence): publishable-key client only (`src/lib/supabase.ts:6-7`), auth-only middleware (`src/middleware.ts:23-27`), owner actions via `security definer` RPCs with service_role revoked (`supabase/migrations/20260611101000`, `20260613093000`).
- **Active failure class — migration-evolution drift**: `can_insert_team_membership` orphaned by `20260611100000`, fixed in `20260612090000`; second same-class fix `20260613093000`. Lockouts on SELECT paths are silent (`bondify.ts:881-929` returns `[]`, `dashboard.astro:33` renders "no team").
- **No injection seam in the service layer**: `createBondifyServices` → `requireSupabase` → `createClient` hard-coupled to `astro:env/server` (`bondify.ts:614-622`, `supabase.ts:3`). Raw-client testing avoids this entirely.
- **Local stack verified**: supabase CLI 2.101.0, API 54321/DB 54322, `enable_confirmations = false` (`supabase/config.toml:209`), keys obtainable via `npx supabase status -o env`. `seed.sql` provides only the 4 `game_templates` rows — no users/teams.

## Desired End State

`npm test` runs a Vitest suite against the developer's running local Supabase stack (additive — never destroys manual-testing data), failing fast with an actionable diagnostic when the stack is down. The suite proves: (a) every member grant/read path from research grants real, positively-asserted visibility; (b) every cross-team mutation is denied with zero row side effects; (c) the two historical regression shapes (helper drift on second-team creation; soft-removed membership semantics) fail the suite if they ever recur. `context/foundation/test-plan.md` §6.1/§6.2 document the patterns for future contributors.

### Key Discoveries:

- Cheapest layer is raw supabase-js clients — production's `createServerClient` (from `@supabase/ssr`) is cookie plumbing over the same PostgREST+JWT mechanics (research §5).
- Fixture creation IS test coverage: users/teams/invites can only be built through the same RLS-gated paths under test — harness setup failures are first-class assertions (research, Architecture Insight 4).
- `admin.createUser({ email_confirm: true })` + `signInWithPassword` verified in installed `@supabase/supabase-js` 2.105.3 (`GoTrueAdminApi.d.ts:335`, `GoTrueClient.d.ts:514`).
- Denial modes split: INSERT policy violations error loudly (PostgREST `42501`); SELECT filtering and UPDATE/DELETE on invisible rows are silent (empty data / zero rows). Tests must match assertion style to mode.
- eslint `strictTypeChecked` + `projectService: true` applies to all files (`tsconfig.json:3` includes `**/*`) — test files need a small rules override (`unbound-method` is noisy with `expect`).

## What We're NOT Doing

- No service-layer tests (importing `bondify.ts`) — deferred; if ever wanted, do the `astro:env` alias-stub route (research option C) before `getViteConfig` (option B).
- No e2e/browser tests, no UI snapshots, no animation tests (test-plan §7 negative space).
- No CI wiring — that is rollout Phase 4. (The `ci.yml` `master`-vs-`main` trigger bug is flagged there, not fixed here.)
- No fixing of the invite info-disclosure gap (`bondify.ts:2043`) — Phase 4 of this plan *probes and documents* actual exposure; any fix is a separate change.
- No `supabase db reset` in local test runs (destructive to manual-testing data); full-replay verification is the rollout-Phase-4 CI gate.
- No game-rule tests (duplicate check-in, self-vote, etc.) — rollout Phase 2.

## Implementation Approach

Raw per-role supabase-js clients (decided in research, confirmed in planning): a service-role admin client mints users and verifies side effects; per-user authenticated clients (anon key + `signInWithPassword`) exercise RLS exactly as production JWTs do. Tests live in root `tests/` (`tests/rls/*.test.ts`, `tests/helpers/`, `tests/setup/`). Local runs are additive — every run mints unique users/teams (UUID-suffixed emails/names) and best-effort cleans up via the admin client. The stack-health preflight fails fast with the lessons.md environment-first diagnostic.

## Critical Implementation Details

- **Key acquisition**: global setup shells out to `npx supabase status -o env` and parses `API_URL`, `ANON_KEY`, `SERVICE_ROLE_KEY` into `process.env` for tests. Never hardcode the demo JWTs — they're stack-version-dependent. On any failure (Docker down, stack stopped), print: which check failed, then "Start Docker Desktop, then run: npx supabase start" and abort the run.
- **Helpers mirror production sequences**: team creation = `teams` insert then `team_memberships` insert (mirrors `bondify.ts:1828-1845`); invite acceptance = `team_invites` update (status/accepted_profile_id) then `team_memberships` insert (mirrors `bondify.ts:2074-2098`). Each helper carries a comment with the bondify.ts line range it mirrors; if the service flow changes, helpers must follow (recorded in §6.2 cookbook in Phase 5).
- **Assertion style by denial mode**: foreign SELECT → expect `data: []`/`null` AND no error; foreign INSERT → expect error code `42501` (or RPC `raise exception` message); foreign UPDATE/DELETE → expect success-with-zero-rows, then verify via service-role read that the victim rows are unchanged. Never assert "no error" alone — that's the silent-lockout trap (frame sharpening #1).
- **Profile rows are trigger-created (verified)**: a DB trigger (`after insert or update of email on auth.users`, `20260530090000:44-61`) inserts the `profiles` row when `admin.createUser` runs. No `profiles` INSERT policy exists — `mintUser` must rely on the trigger and *assert* the row exists; a client-side insert would be denied.

## Phase 1: Runner Bootstrap & Environment Plumbing

### Overview

Installable, runnable test infrastructure with one smoke test proving stack connectivity and catalog seed presence.

### Changes Required:

#### 1. Dependencies & scripts

**File**: `package.json`

**Intent**: Add `vitest@^4` to devDependencies; add `"test": "vitest run"` and `"test:watch": "vitest"` scripts.

**Contract**: After `npm install`, `npm ls vite` must show a single deduped vite 7.3.3 (the existing `overrides` pin must hold for vitest's transitive vite). If it doesn't dedupe, stop and resolve before proceeding.

#### 2. Vitest config

**File**: `vitest.config.ts` (new, root)

**Intent**: Configure test discovery and global setup; no Astro involvement.

**Contract**: `test.include: ["tests/**/*.test.ts"]`, `test.globalSetup: ["tests/setup/global.ts"]`, `testTimeout` generous enough for DB round-trips (≥15s). Plain `defineConfig` from `vitest/config` — NOT Astro's `getViteConfig`.

#### 3. Stack preflight + key acquisition

**File**: `tests/setup/global.ts` (new)

**Intent**: Acquire local stack URL/keys via `npx supabase status -o env`; fail the run with the environment-first diagnostic when the stack is unreachable (lessons.md rule).

**Contract**: Exports vitest globalSetup; populates `process.env.BONDIFY_TEST_SUPABASE_URL / _ANON_KEY / _SERVICE_ROLE_KEY`. Parse only lines matching `^[A-Z0-9_]+=` — the real output interleaves "Stopped services: [...]" and CLI-update notices with the KEY=VALUE pairs (verified live). Diagnostic message names Docker Desktop and `npx supabase start` explicitly.

#### 4. Smoke test

**File**: `tests/rls/smoke.test.ts` (new)

**Intent**: Prove the harness end-to-end: service-role client connects and the `game_templates` catalog has the 4 seeded slugs (seed-vs-schema lesson — schema current ≠ catalog present).

**Contract**: Asserts presence of `emoji-check-in`, `rose-thorn-bud`, `two-truths-and-a-lie`, `how-i-work` slugs.

#### 5. Lint accommodation

**File**: `eslint.config.js`

**Intent**: Add a `files: ["tests/**/*.ts"]` override relaxing rules that fight test idioms (`@typescript-eslint/unbound-method`, `no-console` for the preflight diagnostic). Keep strict rules otherwise.

**Contract**: `npm run lint` passes over the new tree with no blanket-disable.

### Success Criteria:

#### Automated Verification:

- `npm install` succeeds and `npm ls vite` shows one deduped vite 7.3.3
- `npm test` runs the smoke test green against a running local stack
- `npm run lint` passes
- `npx astro check` (or `tsc`-equivalent used by the repo) reports no new type errors

#### Manual Verification:

- With Docker/Supabase stopped, `npm test` fails fast (<10s) with the diagnostic naming Docker Desktop and `npx supabase start`

---

## Phase 2: Fixture Harness

### Overview

Reusable helpers that mint per-role users and build teams/invites through the real RLS-gated paths; setup failures surface as assertion-quality errors.

### Changes Required:

#### 1. Client factories

**File**: `tests/helpers/clients.ts` (new)

**Intent**: `adminClient()` (service-role; fixture minting + side-effect verification only — never the subject of an RLS assertion) and `userClient(credentials)` (anon key + `signInWithPassword` → authenticated client whose JWT drives RLS).

**Contract**: Both read the `BONDIFY_TEST_*` env populated by global setup. `userClient` returns a client with a live session or throws with the sign-in error.

#### 2. Fixture builders

**File**: `tests/helpers/fixtures.ts` (new)

**Intent**: `mintUser()` (admin.createUser with `email_confirm: true`, UUID-suffixed email, ensures `profiles` row exists — see Critical Implementation Details), `createTeamAs(user, name)` (mirrors `bondify.ts:1828-1845` insert sequence), `inviteToTeamAs(owner, teamId, email)` (mirrors `createPendingInvites`), `acceptInviteAs(user, inviteId)` (mirrors `bondify.ts:2074-2098`), `openRoundAs(user, teamId, slug)` for game-read fixtures — must set `opened_by_profile_id` to the acting user's id (INSERT policy `20260531002000:112-119` requires `opened_by_profile_id = current_profile_id()` AND membership).

**Contract**: Every builder throws rich errors on policy denial (these ARE grant-path coverage); UUID-suffixed names keep runs additive/idempotent.

#### 3. Cleanup

**File**: `tests/helpers/cleanup.ts` (new)

**Intent**: Best-effort teardown registry: collects created team IDs and user IDs during a suite, deletes them via the admin client in `afterAll` (teams first, then auth users).

**Contract**: Cleanup failure logs a warning but never fails the suite; local stack stays usable for manual testing either way.

#### 4. Standard fixture scenario

**File**: `tests/helpers/scenario.ts` (new)

**Intent**: One composed `setupTwoTeamScenario()` used by both suites: owner-A + team-A; member-A2 joined via real invite acceptance; outsider-B with own team-B. Returns typed handles (clients + IDs).

**Contract**: The scenario builder is itself the Risk-#1 grant-path exercise for create/invite/accept; Phase 3 asserts the read paths on top of it.

### Success Criteria:

#### Automated Verification:

- A harness self-test (`tests/rls/harness.test.ts`) runs `setupTwoTeamScenario()` green: 3 users minted, 2 teams created, invite accepted
- `npm run lint` passes
- Two consecutive `npm test` runs both pass (additive idempotence)

#### Manual Verification:

- After a test run, pre-existing manual-testing data (BUBBA team, seeded emoji history) is intact in Studio/dashboard

---

## Phase 3: Risk #1 Suite — Positive Presence

### Overview

Prove every member grant/read path from research grants real visibility, asserted positively (never "no error").

### Changes Required:

#### 1. Access-grant suite

**File**: `tests/rls/access-grants.test.ts` (new)

**Intent**: The grant-path tests, headlined by the historical regression reproduction.

**Contract**: Test cases (each maps to a research §2 path):
- **Second-team regression repro**: owner-A creates a second team → both `team_memberships` inserts succeed (creator branch of `can_insert_team_membership`, the exact June-12 failure; `20260612090000:39-48`).
- **Invite grant end-to-end**: after `acceptInviteAs`, member-A2's client SELECTs `teams` and positively sees team-A (the silent-lockout counter-assertion).
- **Team list shape**: member-A2 sees team-A with embedded `team_memberships` and `team_invites` mirroring the `listTeamSummaryRows` select shape (`bondify.ts:887-906`) — roster includes both members.
- **Game round visibility**: a round opened by owner-A is SELECTable by member-A2 (`game_rounds` policy `20260531002000:104-109`).
- **Profile visibility**: member-A2 sees own profile and owner-A's (`profiles_select_teammates` `20260531002000:37-43`).

#### 2. Baseline absence control

**File**: same suite

**Intent**: Positive control for the silent-filtering mechanism: outsider-B's client SELECTs `teams`/`team_memberships`/`game_rounds` for team-A and gets zero rows with no error — proving the assertions in this suite would catch a lockout (a locked-out member looks exactly like this).

**Contract**: Asserts `error === null` AND `data.length === 0` — documenting the silent mode explicitly.

### Success Criteria:

#### Automated Verification:

- `npm test` green: all grant-path cases pass including the second-team repro
- `npm run lint` passes

#### Manual Verification:

- Temporarily breaking a policy locally (e.g. re-applying the pre-fix `can_insert_team_membership` body in Studio SQL) makes the second-team repro fail, restoring it makes it pass (mutation-check of the suite's teeth; revert afterwards)

---

## Phase 4: Risk #2 Suite — Cross-Team Denial

### Overview

Prove foreign-ID access is denied AND side-effect-free, covering both denial modes and the two research-flagged variants.

### Changes Required:

#### 1. IDOR denial suite

**File**: `tests/rls/cross-team-denial.test.ts` (new)

**Intent**: Highest-value foreign-ID cases from research §3, each asserting denial + zero row delta (victim-team row counts via admin client before/after).

**Contract**: Test cases:
- Outsider-B INSERTs into team-A's surfaces: `game_responses` (round-scoped policy `20260531002000:143-161`), `emoji_check_in_submissions`, `two_truths_guesses` → expect `42501`-class error AND unchanged victim row counts.
- Outsider-B (and separately non-owner member-A2) calls `remove_team_member` / `delete_owned_team` RPCs against team-A → expect `raise exception` ("Only the team owner…", `20260613093000:32-34`, `20260611101000:92-94`) AND team/membership rows intact.
- Outsider-B UPDATEs team-A's `team_invites`/`game_rounds` → expect silent zero-row success; assert victim rows unchanged via admin read (the silent-mode discipline).

#### 2. Soft-removed member variant

**File**: same suite

**Intent**: Owner-A removes member-A2 via the real `remove_team_member` RPC; A2 then retries reads (zero rows — `is_team_member` `removed_at is null`, `20260611100000:21-35`) and writes (denied). This is the regression class most likely to recur.

**Contract**: Runs against a dedicated scenario instance so Phase-3 fixtures stay valid.

#### 3. Invite info-disclosure probe

**File**: same suite

**Intent**: Document actual exposure of the team-unfiltered invite SELECT (`bondify.ts:2043`): outsider-B holding team-A's `inviteId` SELECTs `team_invites` directly. Assert whatever the `team_invites` SELECT policy (`20260530090000:277-289`) actually yields and record the verdict in the test name/comment.

**Contract**: If rows ARE exposed, the test pins current behavior with a `// FINDING:` comment and the closeout phase surfaces it to the user as a candidate follow-up change — this plan does not fix it.

### Success Criteria:

#### Automated Verification:

- `npm test` green: all denial cases pass with zero-row-delta assertions
- `npm run lint` passes
- Full suite (Phases 1-4 tests) passes twice consecutively

#### Manual Verification:

- Disclosure-probe verdict reviewed: user decides whether the invite SELECT exposure (if any) warrants a follow-up change

---

## Phase 5: Closeout — Cookbook & Status

### Overview

Make the patterns durable and reconcile rollout state.

### Changes Required:

#### 1. Cookbook update

**File**: `context/foundation/test-plan.md`

**Intent**: Fill §6.1 (runner + how to run: `npm test`, stack prerequisite, where config lives) and §6.2 (RLS integration pattern: per-role clients, scenario builder, positive-presence + zero-delta assertion discipline, helpers-mirror-service-sequences rule with file refs, reference test `tests/rls/access-grants.test.ts`). Add a §6.6 note for anything surprising learned during implementation. Bump "Last updated".

**Contract**: §6 sub-sections lose their "TBD — see §3 Phase 1" placeholders; §3 Phase 1 row Status → `complete` once Progress is fully checked (orchestrator vocabulary).

#### 2. Change record

**File**: `context/changes/testing-foundation-access-control/change.md`

**Intent**: Status → `implemented` (or repo convention), `updated` bumped.

**Contract**: Frontmatter only.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes (markdown untouched by lint, but guard the repo state)
- `npm test` full suite green

#### Manual Verification:

- §6.1/§6.2 read as usable recipes for a contributor who wasn't in this session

---

## Testing Strategy

### Unit Tests:
- None in this phase — the smoke test and harness self-test are integration-shaped by design (the unit under test is the policy set).

### Integration Tests:
- Grant paths: create-team (×2, regression repro), invite E2E, team-list shape, round visibility, profile visibility.
- Denials: foreign INSERT (loud), owner RPCs (loud), foreign UPDATE (silent + zero-delta), soft-removed retries, disclosure probe.

### Manual Testing Steps:
1. Stop Docker → `npm test` → confirm fail-fast diagnostic.
2. Run suite twice → confirm both green and BUBBA data intact.
3. Studio mutation-check: break/restore `can_insert_team_membership` → suite fails/passes accordingly.

## Performance Considerations

- Suite budget: ~3 users + 2-3 teams per scenario instance, 2-3 scenario instances per full run — well under the public sign-up rate limit (`config.toml:190`, 30/5min) and admin API is not rate-limited the same way. Target full-suite runtime under ~60s.
- No `db reset` in the loop — runs are additive; reset cost (~tens of seconds) is deferred to the CI gate (rollout Phase 4).

## Migration Notes

None — no schema changes. The suite runs against whatever migration state is applied; full-replay verification is rollout Phase 4 (CI).

## References

- Related research: `context/changes/testing-foundation-access-control/research.md`
- Frame brief: `context/changes/testing-foundation-access-control/frame.md`
- Risk definitions: `context/foundation/test-plan.md` §2 (#1, #2), §3 Phase 1
- Production sequences mirrored: `src/lib/services/bondify.ts:1828-1845` (createTeam), `:2074-2098` (acceptInvite), `:881-929` (team list shape)
- Final policy definitions: `supabase/migrations/20260612090000`, `20260611100000:21-53`, `20260531002000`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Runner Bootstrap & Environment Plumbing

#### Automated

- [x] 1.1 `npm install` succeeds and `npm ls vite` shows one deduped vite 7.3.3
- [x] 1.2 `npm test` runs the smoke test green against a running local stack
- [x] 1.3 `npm run lint` passes
- [x] 1.4 `npx astro check` reports no new type errors

#### Manual

- [ ] 1.5 With Docker/Supabase stopped, `npm test` fails fast with the Docker/`supabase start` diagnostic

### Phase 2: Fixture Harness

#### Automated

- [x] 2.1 Harness self-test runs `setupTwoTeamScenario()` green (3 users, 2 teams, invite accepted)
- [x] 2.2 `npm run lint` passes
- [x] 2.3 Two consecutive `npm test` runs both pass (additive idempotence)

#### Manual

- [ ] 2.4 Pre-existing manual-testing data (BUBBA team, emoji history) intact after a run

### Phase 3: Risk #1 Suite — Positive Presence

#### Automated

- [x] 3.1 All grant-path cases pass including the second-team regression repro
- [x] 3.2 `npm run lint` passes

#### Manual

- [ ] 3.3 Studio mutation-check: breaking/restoring `can_insert_team_membership` flips the repro test

### Phase 4: Risk #2 Suite — Cross-Team Denial

#### Automated

- [x] 4.1 All denial cases pass with zero-row-delta assertions
- [x] 4.2 `npm run lint` passes
- [x] 4.3 Full suite passes twice consecutively

#### Manual

- [ ] 4.4 Disclosure-probe verdict reviewed; follow-up decision recorded

### Phase 5: Closeout — Cookbook & Status

#### Automated

- [x] 5.1 `npm run lint` passes
- [x] 5.2 `npm test` full suite green

#### Manual

- [ ] 5.3 §6.1/§6.2 cookbook entries usable by a contributor outside this session
