# CI Test Gate Implementation Plan

## Overview

Add `supabase start` and `npm test` to the existing GitHub Actions `ci` job so the
integration test suite runs and passes on every push. The tests already pass locally;
this change closes the gap between "tests exist" and "tests pass in CI" required for
Level 1.5 and 2.D certification.

## Current State Analysis

- `.github/workflows/ci.yml` runs: `npm ci → npx astro sync → npm run lint → npm run build`.
  No `npm test` step exists.
- Six test files under `tests/` pass locally against a running local Supabase stack.
- `tests/helpers/supabase-env.ts:44-47` short-circuits early if `BONDIFY_TEST_SUPABASE_URL`,
  `BONDIFY_TEST_ANON_KEY`, and `BONDIFY_TEST_SERVICE_ROLE_KEY` are already in the environment —
  no code change needed in the test helpers.
- The Supabase CLI is not a declared npm dependency; it must be installed in CI via the
  `supabase/setup-cli` GitHub Action before `supabase start` can run.
- 15 migrations under `supabase/migrations/` and `supabase/seed.sql` — `supabase start`
  applies both automatically on first run.
- `ubuntu-latest` runners have Docker pre-installed; `supabase start` works out of the box.

## Desired End State

`.github/workflows/ci.yml` runs `npm test` after `supabase start` on every push and PR.
The CI job is green on the main branch. The smoke test, harness, access-grant, cross-team
denial, service compatibility, and emoji-picker contract tests all pass in CI.

Verify: open the Actions tab → `CI` workflow → confirm the `Run tests` step is green.

### Key Discoveries

- `ensureLocalSupabaseTestEnv()` (`tests/helpers/supabase-env.ts:43-47`) returns
  immediately if all three `BONDIFY_TEST_*` vars are set — CI only needs to inject them
  before `npm test`; the `npx supabase status` shell call is bypassed.
- `supabase status -o env` emits `KEY=VALUE` lines; the three we need are `API_URL`,
  `ANON_KEY`, `SERVICE_ROLE_KEY`. `cut -d= -f2-` correctly handles JWT values that
  contain embedded `=` characters.
- SHA pins resolved (2026-06-27):
  - `actions/checkout@v4.3.1` → `34e114876b0b11c390a56381ad16ebd13914f8d5`
  - `actions/setup-node@v4.4.0` → `49933ea5288caeca8642d1e84afbd3f7d6820020`
  - `supabase/setup-cli@v2.1.1` → `3c2f5e2ae34c34e428e8e206e2c4d21fa2d20fbf`

## What We're NOT Doing

- Not moving tests to a separate parallel job — tests are appended to the existing `ci` job.
- Not adding a health-check poll after `supabase start` — the CLI blocks until all services
  are healthy; no extra polling needed.
- Not adding Phases 2–3 of the test rollout (game-rule and owner-action tests) — those are
  separate changes.
- Not changing branch trigger names in ci.yml.
- Not adding Playwright E2E tests — deferred per test-plan §4.

## Implementation Approach

Pin existing action refs to SHAs, then append four steps to the existing `ci` job after
the build: install the Supabase CLI, start the local stack, extract and rename the three
credential env vars, and run `npm test`.

## Phase 1: Update `.github/workflows/ci.yml`

### Overview

Extend the existing `ci` job with Supabase startup, credential injection, and test execution.

### Changes Required

#### 1. Pin existing action refs to SHAs

**File**: `.github/workflows/ci.yml`

**Intent**: Replace floating `@v4` tags on `actions/checkout` and `actions/setup-node`
with their current SHA equivalents so every step is pinned.

**Contract**:
- `actions/checkout@v4` → `actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5  # v4.3.1`
- `actions/setup-node@v4` → `actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020  # v4.4.0`

#### 2. Add Supabase CLI install step

**File**: `.github/workflows/ci.yml`

**Intent**: Install the Supabase CLI so `supabase start` and `supabase status` commands
are available in subsequent steps.

**Contract**: Add after the `npm run build` step:
```yaml
      - uses: supabase/setup-cli@3c2f5e2ae34c34e428e8e206e2c4d21fa2d20fbf  # v2.1.1
        with:
          version: latest
```

#### 3. Add `supabase start` step

**File**: `.github/workflows/ci.yml`

**Intent**: Spin up the full local Supabase stack (Auth, PostgREST, DB) and apply all
migrations + seed data so the test suite can exercise real RLS policies.

**Contract**: Add immediately after the CLI install:
```yaml
      - name: Start local Supabase stack
        run: supabase start
```

`supabase start` blocks until all services are healthy. No poll needed.

#### 4. Add credential injection step

**File**: `.github/workflows/ci.yml`

**Intent**: Extract the three required keys from `supabase status -o env` output and
write them into `$GITHUB_ENV` under the names the test suite expects. The
`ensureLocalSupabaseTestEnv()` early-exit then short-circuits the
`npx supabase status` shell call inside the test process.

**Contract**: Add after `supabase start`:
```yaml
      - name: Set Supabase test credentials
        run: |
          STATUS=$(supabase status -o env 2>/dev/null)
          echo "BONDIFY_TEST_SUPABASE_URL=$(echo "$STATUS" | grep '^API_URL=' | cut -d= -f2-)" >> "$GITHUB_ENV"
          echo "BONDIFY_TEST_ANON_KEY=$(echo "$STATUS" | grep '^ANON_KEY=' | cut -d= -f2-)" >> "$GITHUB_ENV"
          echo "BONDIFY_TEST_SERVICE_ROLE_KEY=$(echo "$STATUS" | grep '^SERVICE_ROLE_KEY=' | cut -d= -f2-)" >> "$GITHUB_ENV"
```

`cut -d= -f2-` takes field 2 onwards, correctly preserving embedded `=` signs in JWT values.

#### 5. Add test execution step

**File**: `.github/workflows/ci.yml`

**Intent**: Run the full Vitest integration suite.

**Contract**: Add last in the job:
```yaml
      - name: Run tests
        run: npm test
```

### Success Criteria

#### Automated Verification

- CI job completes green on a push to the main branch (check GitHub Actions tab)
- The `Run tests` step shows all 6 test files passing in the job log
- Existing steps (`lint`, `build`) still pass — no regressions

#### Manual Verification

- Open GitHub Actions → most recent CI run → expand `Run tests` → confirm
  `smoke.test.ts`, `harness.test.ts`, `access-grants.test.ts`,
  `cross-team-denial.test.ts`, `bondify-compatibility.test.ts`,
  `emoji-check-in-picker.contract.test.ts` all show green

---

## Phase 2: Update test-plan.md and change records

### Overview

Mark Phase 4 of the test rollout complete and update the change record.

### Changes Required

#### 1. Advance test-plan Phase 4 status

**File**: `context/foundation/test-plan.md`

**Intent**: Update `§3 Phased Rollout` table — Phase 4 row status from `not started`
to `complete`. Fill `§6.5 Wiring a new gate into CI` with the pattern used.

**Contract**: Phase 4 row: `Status` column → `complete`, `Change folder` column →
`context/changes/cert-ci-test-gate/`. §6.5 body: name the `supabase/setup-cli` action,
the `supabase start` + credential-injection pattern, and the early-exit that makes it
work without modifying test helpers.

#### 2. Close change record

**File**: `context/changes/cert-ci-test-gate/change.md`

**Intent**: Status → `implemented`, `updated` → today.

**Contract**: Frontmatter only.

### Success Criteria

#### Automated Verification

- `npm run lint` passes (markdown not linted, but repo state is clean)

#### Manual Verification

- §6.5 reads as a usable recipe for a future contributor who wasn't in this session
- Phase 4 row in test-plan.md shows `complete`

---

## Testing Strategy

### Integration Tests

The entire test suite serves as the integration verification for this change:
`smoke.test.ts` (stack + seed), `harness.test.ts` (fixture harness), `access-grants.test.ts`
(Risk #1), `cross-team-denial.test.ts` (Risk #2), `bondify-compatibility.test.ts`
(service layer), `emoji-check-in-picker.contract.test.ts` (UI contract).

### Manual Testing Steps

1. Push a commit to the main branch.
2. Open GitHub Actions → CI → confirm both the existing steps and `Run tests` show green.
3. Verify the job log shows test counts, not just exit 0.

## References

- Test infrastructure plan: `context/changes/testing-foundation-access-control/plan.md`
- Supabase env helper: `tests/helpers/supabase-env.ts:43-73`
- Test plan Phase 4: `context/foundation/test-plan.md` §3 row 4
- CI workflow: `.github/workflows/ci.yml`
- Frame brief: `context/changes/cert-progression-review/frame.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Update `.github/workflows/ci.yml`

#### Automated

- [ ] 1.1 CI job green on push to main branch (Actions tab)
- [ ] 1.2 `Run tests` step shows all 6 test files passing
- [ ] 1.3 Existing lint and build steps still pass

#### Manual

- [ ] 1.4 Expand `Run tests` in job log — all 6 test files named and green

### Phase 2: Update test-plan.md and change records

#### Automated

- [ ] 2.1 `npm run lint` passes

#### Manual

- [ ] 2.2 §6.5 cookbook entry usable by a future contributor
- [ ] 2.3 Phase 4 row in test-plan.md shows `complete`
