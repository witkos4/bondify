---
date: 2026-06-13T01:19:22+02:00
researcher: Claude (Fable 5)
git_commit: b2cf63526cc3e7d9bae961a1cabc7aa70c7c0de7
branch: main
repository: bondify
topic: "Ground test rollout Phase 1: team access lockout (Risk #1) and cross-team IDOR (Risk #2) — failure paths, guards, and harness architecture"
tags: [research, codebase, testing, rls, supabase, access-control, vitest, test-harness]
status: complete
last_updated: 2026-06-13
last_updated_by: Claude (Fable 5)
---

# Research: Ground test rollout Phase 1 — access-control risks and harness architecture

**Date**: 2026-06-13T01:19:22+02:00
**Researcher**: Claude (Fable 5)
**Git Commit**: b2cf63526cc3e7d9bae961a1cabc7aa70c7c0de7
**Branch**: main
**Repository**: bondify

## Research Question

Ground rollout Phase 1 of `context/foundation/test-plan.md` ("Test foundation + access-control critical path"). Verify Risk #1 (team access lockout) and Risk #2 (cross-team IDOR) in code: real failure paths, current policy definitions, existing tests, cheapest useful test layer — honoring the frame's three sharpenings (full migration replay, positive-presence assertions, harness-built fixtures).

## Summary

- **RLS is the sole authorization boundary** (verified end-to-end). The app uses only the publishable key + user cookie session (`src/lib/supabase.ts:6-7`); no service-role client exists in app code; middleware does authentication only (`src/middleware.ts:23-27`). Owner actions run through `security definer` RPCs with `revoke ... from service_role`.
- **Risk #1 is real and recurrent**: the regression class is migration-evolution drift (helper `can_insert_team_membership` orphaned by the soft-memberships migration, fixed next day; a second same-class fix landed 2026-06-13 for RPC ambiguity). Lockouts on SELECT paths are **silent** — `data: [], error: null` — so tests must assert positive presence.
- **Risk #2 is partially mitigated by design but unverified**: all 14 team-scoped mutation endpoints reach a loud guard (`requireMembershipAccess` throw or RPC `raise exception`). One information-disclosure gap found: `acceptInvite` selects an invite by `inviteId` with no team filter (`bondify.ts:2043`). No silent-success IDOR found on mutations — but nothing currently proves any of this stays true.
- **No tests exist anywhere** (0 test files, no runner, no `test` script).
- **Cheapest layer verdict (corrects the test plan's hypothesis slightly)**: pure RLS-level integration tests with raw `@supabase/supabase-js` clients (installed, v2.105.3) — *not* service-layer tests. `bondify.ts` is hard-coupled to `astro:env/server` via `createClient(requestHeaders, cookies)` (`bondify.ts:614-615`) with no injection seam, so importing it under Vitest stacks several unverified Astro/Vitest unknowns. Raw per-role PostgREST clients exercise the exact same RLS mechanics production uses.

## Detailed Findings

### 1. Authorization architecture (both risks)

- Client creation: `src/lib/supabase.ts:16-38` — `createServerClient` (from `@supabase/ssr`) with publishable key; secrets read via `getSecret` from `astro:env/server` (`supabase.ts:3`), names: `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`/`SUPABASE_KEY` (declared in `astro.config.mjs:17-24`; the node-local `astro.local.config.mjs:16-21` declares only `SUPABASE_URL`/`SUPABASE_KEY`).
- Service entry: `createBondifyServices({requestHeaders, cookies})` → `requireSupabase` → `createClient` (`bondify.ts:1665`, `614-622`). **No client-injection seam.**
- Membership guard: `requireMembershipAccess(supabase, teamId, profileId)` (`bondify.ts:676-698`) — an RLS-backed read of `team_memberships` that throws `BondifyServiceError("TEAM_ACCESS_DENIED")` when no row returns.
- Middleware (`src/middleware.ts:23-27`): authentication only; no team scoping.

### 2. Risk #1 — member access read/grant paths and their policies

Final policy/helper definitions (later migrations replace earlier ones):

| Helper / policy | Final definition |
|---|---|
| `current_profile_id()` | `20260530090000_team_and_game_foundation.sql:176` |
| `current_profile_normalized_email()` | `20260530090000:184` |
| `is_team_member()` (filters `removed_at is null`) | `20260611100000_team_management_soft_memberships.sql:21-35` |
| `shares_team_with_profile()` | `20260611100000:37-53` |
| `can_insert_team_membership()` | `20260612090000_fix_team_membership_insert_helper.sql:1-37` |
| `team_memberships` INSERT policy | `20260612090000:39-48` (`profile_id = current_profile_id() AND removed_at IS NULL AND can_insert_team_membership(...)`) |
| `team_memberships` SELECT policy | `20260531002000_fix_team_rls_recursion.sql:53-58` via `is_team_member` |
| `teams` SELECT (`teams_select_for_active_members`) | refactored `20260531002000` via `is_team_member` |
| `profiles` SELECT (`profiles_select_teammates`) | `20260531002000:37-43` (self or `shares_team_with_profile`) |
| `profiles` UPDATE (`profiles_update_self`) | `20260530090000:208-213` |
| `game_rounds` SELECT | `20260531002000:104-109` via `is_team_member` |
| `game_responses` INSERT (`..._for_active_member_once`) | `20260531002000:143-161`, `removed_at` added `20260611100000` |
| emoji check-in tables | `20260609100000_emoji_check_in_daily_sessions.sql` via `is_team_member` |
| two-truths tables | `20260610111000_two_truths_structured_round.sql` (+ `20260610112000` update policy) via `is_team_member` |

Read paths a Risk-#1 suite must exercise with **positive assertions**:

1. **Dashboard team list** — `getCurrentTeamSummaries` → `listTeamSummaryRows` (`bondify.ts:881-929`): selects `teams` with embedded `team_memberships` and `team_invites`. **Silent-lockout path**: RLS filtering returns `[]` with `error: null`; `dashboard.astro:33,69` then renders the "no team" state. Assertion: member's client sees exactly their teams with expected roster entries.
2. **Games overview** — `getTeamGameState` → `loadTeamGameState` (membership check at `bondify.ts:1616`; reads `game_templates`, `game_rounds`, `game_responses`). Sub-query RLS filtering is silent (round appears "not started").
3. **History** — `getTeamHistoryState` (`bondify.ts:3107`, membership check throws loudly).
4. **Manage** — `getTeamManagementState` (`bondify.ts:1707-1728`, throws at `:1716` if team absent from member's RLS-visible list).
5. **Invite grant end-to-end** — `createPendingInvites` (`bondify.ts:1891`, membership check `:1893`; `team_invites` INSERT policy `20260530090000:291-306`) → `acceptInvite` (`bondify.ts:2039-2127`: invite SELECT `:2043`, email match `:2067`, invite UPDATE `:2074` via `team_invites_update_for_accepting_invitee` `20260530090000:308`, membership INSERT `:2095` gated by `can_insert_team_membership` invitee branch) → new member must then see the team via path 1.
6. **Create-team (the June-12 regression flow)** — `createTeam` (`bondify.ts:1821-1846`): inserts `teams` row then `team_memberships` row (`:1838-1841`) gated by `can_insert_team_membership` **creator branch**. The regression: `20260611100000` updated `is_team_member` for `removed_at` but orphaned this helper; fixed in `20260612090000`. A test creating a *second* team for the same user reproduces the historical failure exactly.
7. **Profile bootstrap** — `ensureProfileRow` (`bondify.ts:636+`): profile select/insert under `profiles_select_self`/`profiles_select_teammates` policies.

### 3. Risk #2 — cross-team IDOR surface (14 mutation endpoints)

All endpoints validate IDs as `z.uuid` and delegate to the service layer; the guard then is either (a) `requireMembershipAccess` throw, or (b) RPC internal `raise exception`:

| Endpoint | Foreign-controllable IDs | Guard (file:line) | Denial mode |
|---|---|---|---|
| POST /api/teams/invite | teamId | membership check `bondify.ts:1893` | loud |
| POST /api/teams/accept-invite | inviteId | email match `bondify.ts:2067` + membership INSERT policy | loud — **but invite SELECT `:2043` has no team filter (info-disclosure: invite row readable by guessing inviteId, subject to `team_invites` SELECT policy)** |
| POST /api/teams/remove-member | teamId, membershipId | RPC owner check `20260613093000:32-34`; membership lookup team-filtered `:40-46` | loud (owner check); silent no-op if membership not found `:48-50` |
| POST /api/teams/delete-team | teamId | RPC owner check `20260611101000:92-94`; DELETE where-clause bounded `:102-104` | loud |
| POST /api/teams/clear-history | teamId, roundId? | `requireTeamOwnerAccess` `bondify.ts:2133` + RPC `20260604130000` | loud |
| POST /api/games/start | teamId, gameSlug | membership check via `loadTeamGameState` `bondify.ts:2616` | loud |
| POST /api/games/submit | teamId, roundId | round SELECT by id (`:2598-2604`, **no team filter**) then membership check on `roundRow.team_id` `:2642` | loud |
| POST /api/games/reveal | teamId, roundId | membership `:2388` + round SELECT team-filtered `:2422-2423` | loud |
| POST /api/games/two-truths-entry | teamId, roundId | membership `:2732` + INSERT policy `20260611100000:134-156` | loud |
| POST /api/games/two-truths-close-collection | teamId, roundId | membership `:2824` | loud |
| POST /api/games/two-truths-vote | teamId, roundId, targetEntryId | membership `:2940` + entry lookup `:2949-2956` | loud |
| POST /api/games/two-truths-close-voting | teamId, roundId | membership `:3027` | loud |
| POST /api/games/emoji-check-in/submit | teamId, sessionId | membership `bondify.ts:2154` | loud |
| POST /api/games/emoji-check-in/reveal | teamId, sessionId | membership `:2219` + session SELECT team-filtered `:2123-2124` | loud |

Page-level GETs (`/teams/[teamId]/games|history|manage`) throw `TEAM_ACCESS_DENIED` for non-members and render an error box; the **dashboard** is the silent surface (finding 2.1).

Highest-value IDOR cases: foreign-team `remove-member` and `delete-team` (owner RPCs), foreign `roundId` on `submit` (relies on post-lookup membership check), foreign `sessionId` on emoji submit, foreign-team vote, and the **soft-removed member** variant (removed member retries each write — exercises `removed_at is null` in `is_team_member`). Every denial must also assert **zero rows changed** in the foreign team's tables, not just an error response.

### 4. Existing tests and harness feasibility

- **No tests exist**: no runner config, no `test` script (`package.json:8-17`), zero `*.test.*`/`*.spec.*` files.
- **astro:env coupling is confined** to `src/lib/supabase.ts:3` and `src/lib/config-status.ts:1`; `bondify.ts` itself never imports it but reaches it transitively (`bondify.ts:614-615`).
- **Verified locally**: astro 6.3.7 exports `getViteConfig` (`node_modules/astro/dist/config/index.d.ts:13`); vite 7.3.3 installed via override (`package.json:61-63`); `@supabase/supabase-js` 2.105.3 exposes `auth.admin.createUser` (`GoTrueAdminApi.d.ts:335`, supports `email_confirm: true`) and `auth.signInWithPassword` (`GoTrueClient.d.ts:514`).
- **Local stack** (`supabase/config.toml`): API 54321, DB 54322, Postgres 17; `enable_confirmations = false` (`:209`) so minted users can sign in immediately; `db.migrations.enabled` + `db.seed.enabled` true (`:55,60-65`) so `npx supabase db reset` replays all 16 migrations + `seed.sql`; supabase CLI 2.101.0 runs via npx (verified); Docker required. Keys are obtained at runtime via `supabase status -o env` (`SERVICE_ROLE_KEY`, `ANON_KEY`, `API_URL`) — nothing stored in repo.
- **Fixtures must be harness-built** (confirms frame): `supabase/seed.sql` seeds only `game_templates` (4 rows — emoji-check-in, rose-thorn-bud, two-truths-and-a-lie, how-i-work); no users/teams/memberships. Minimum fixture set: 3 users (owner-A, member-A2 via invite, outsider-B with own team), 2 teams, plus per-suite game rounds as needed. service_role admin client mints users; per-role authenticated clients then build teams/invites through the same RLS paths being tested (fixture creation doubles as grant-path coverage).
- **Needs confirmation at implementation time**: vitest@^4 pairs with vite 7 (peer `^6.0.0 || ^7.0.0`) — install and check `npm ls vite` dedupes; Astro 6 + vitest 4 `getViteConfig` pairing is young and only needed for option B (not chosen).
- **Lint/TS**: `tsconfig.json:3` includes `**/*` so test files anywhere are type-checked with `@/*` paths; eslint `strictTypeChecked` + `projectService: true` (`eslint.config.js:14-21`) will apply to tests — plan a small `files: ["**/*.test.ts"]` override (e.g. `unbound-method` is noisy with `expect`).
- **CI** (`.github/workflows/ci.yml`): single job, checkout → node 26.2.0 → `npm ci` → `astro sync` → lint → build. **Bug found: workflow triggers on `master` (lines 4-7) but the repo branch is `main` — CI may currently never fire.** Test job slots between lint and build: supabase CLI → `supabase start -x studio,inbucket,...` → keys from `supabase status -o env` → `vitest run`; no GitHub secrets needed (local demo keys).

### 5. Cheapest-layer verdict (verifies/corrects test-plan §2 guidance)

Test-plan §2 hypothesized "integration (local Supabase, seeded users, RLS-level)" — **verified, with a sharpening**: the cheapest real-signal layer is **raw supabase-js per-role clients against the replayed local DB**, *not* tests that import `bondify.ts`:

- **(A) Raw RLS-level clients** — zero Astro involvement, zero unverified pairings, exercises the exact PostgREST+JWT mechanics production uses (`@supabase/ssr`'s `createServerClient` is cookie plumbing over the same engine). **Chosen.**
- **(B) Service-layer under `getViteConfig`** — stacks 4 unknowns (vitest4/vite7, astro6/vitest4, Cloudflare adapter exclusion via `astro.local.config.mjs`, `AstroCookies` stub). Defer.
- **(C) `vi.mock`/alias of `astro:env/server`** — middle ground if service-layer coverage is wanted later; needs a `resolve.alias` stub since the virtual module doesn't exist outside Astro. Do C before B if ever needed.

Limitation to carry into the plan: option A does not execute `bondify.ts` business logic (e.g. the `TEAM_ACCESS_DENIED` translation, `acceptInvite` email-match). Phase 1 covers the policy layer (where both shipped regressions lived); service-layer behavior is exercisable later via C.

## Code References

- `src/lib/supabase.ts:3-38` — sole client factory; `astro:env/server` coupling
- `src/middleware.ts:23-27` — auth-only route protection
- `src/lib/services/bondify.ts:614-622` — `requireSupabase`, no injection seam
- `src/lib/services/bondify.ts:676-698` — `requireMembershipAccess` (loud guard)
- `src/lib/services/bondify.ts:881-929` — `listTeamSummaryRows` (silent lockout surface)
- `src/lib/services/bondify.ts:1821-1846` — `createTeam` + creator membership insert (regression flow)
- `src/lib/services/bondify.ts:2039-2127` — `acceptInvite` (invite SELECT `:2043` unfiltered by team)
- `supabase/migrations/20260611100000_team_management_soft_memberships.sql:21-53` — `is_team_member`/`shares_team_with_profile` final
- `supabase/migrations/20260612090000_fix_team_membership_insert_helper.sql` — `can_insert_team_membership` final + INSERT policy
- `supabase/migrations/20260611101000_team_management_owner_actions.sql` / `20260613093000` — owner RPCs (`raise exception` guards, service_role revoked)
- `supabase/config.toml:55-65,169-209` — replay/seed/auth settings
- `.github/workflows/ci.yml:4-7` — branch-name bug (`master` vs `main`)

## Architecture Insights

1. **Single-boundary authorization**: every team-scoped decision resolves in Postgres (RLS policy or security-definer RPC). Tests at the raw-client layer therefore test the *whole* authorization story, not a slice.
2. **Silent vs loud denial split**: SELECT filtering is silent (empty data), INSERT policy violations and RPC checks are loud (errors). This is why Risk-#1 tests assert positive presence and Risk-#2 tests assert both denial *and* zero-row side effects.
3. **Migration-evolution drift is the active failure class**: two same-class fixes within 48 hours (`20260612090000`, `20260613093000`). Tests must run against the fully replayed migration set so any future helper/policy desync fails the suite.
4. **Fixture creation is test coverage**: because fixtures (users → teams → invites → memberships) can only be built through the same RLS-gated paths, the harness setup itself exercises the grant paths — design the suite to treat setup failures as first-class assertions.

## Historical Context (from prior changes)

- `context/changes/testing-foundation-access-control/frame.md` — dimension map, hypothesis table, and the three sharpenings this research confirms.
- `context/foundation/test-plan.md` §2-§3 — Risk #1/#2 definitions and Phase 1 scope.
- `context/foundation/roadmap.md` (S-08 note, Done section) — the 2026-06-12 create-another-team RLS regression discovered in manual testing.
- `context/foundation/lessons.md` — "Treat Supabase Seed Data Separately From Schema Migrations" (drives the fixture-bootstrap requirement); "Default To Local Verification" (Docker/stack health checks belong in harness setup errors).
- `context/changes/S-08-team-management-page-separation/` — the slice that introduced soft memberships and the regression.

## Related Research

- `context/changes/testing-foundation-access-control/frame.md` — the framing investigation preceding this document (three read-only sub-agent reports summarized there).

## Open Questions

1. **vitest@4 + vite 7.3.3 dedupe** — expected to work via the `overrides` pin; confirm with `npm ls vite` at install time.
2. **Invite info-disclosure** (`bondify.ts:2043` team-unfiltered invite SELECT) — confirm what the `team_invites` SELECT policy (`20260530090000:277`) actually exposes to a non-member holding a guessed `inviteId`; include a probe test either way.
3. **Per-test isolation strategy** — one `db reset` per run + per-test cleanup via service_role is the hypothesis; measure reset cost (~tens of seconds) before deciding suite granularity.
4. **CI branch trigger** — fixing `master` → `main` in `ci.yml` is out of Phase 1 scope (test-plan Phase 4 owns CI) but should be flagged in the plan so the gate actually fires.
