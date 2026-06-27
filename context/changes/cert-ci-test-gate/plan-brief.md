# CI Test Gate — Plan Brief

> Full plan: `context/changes/cert-ci-test-gate/plan.md`
> Frame brief: `context/changes/cert-progression-review/frame.md`

## What & Why

Wire the existing Vitest integration test suite into the GitHub Actions `ci` job so
`npm test` runs and passes on every push. The tests already pass locally; this change
closes the gap identified in the frame brief: "tests written locally" ≠ "tests passing
in CI", which is the explicit Level 1.5 certification gate.

## Starting Point

`.github/workflows/ci.yml` runs `npm ci → astro sync → lint → build` with no test step.
Six test files under `tests/` are complete and passing locally against the local Supabase
stack. The test helper `ensureLocalSupabaseTestEnv()` already contains an early-exit that
short-circuits when the three `BONDIFY_TEST_*` env vars are pre-set — making CI integration
clean without touching any test code.

## Desired End State

The CI job is green on main and the `Run tests` step in the job log shows all 6 test files
passing. Certification Level 1.5 and 2.D evidence is in the GitHub Actions run history.

## Key Decisions Made

| Decision | Choice | Why | Source |
|---|---|---|---|
| Job structure | Append to existing `ci` job | Simpler cert screenshot; one job in UI | Plan |
| Supabase in CI | `supabase/setup-cli` + `supabase start` | Full Auth+PostgREST needed; tests use `signInWithPassword` | Plan |
| Startup wait | Rely on `supabase start` blocking | CLI designed for CI; blocks until healthy | Plan |
| Action pins | SHA for all actions | Cert runbook explicit requirement | Frame |
| Credential injection | Extract from `supabase status -o env` via grep+cut | Matches existing `parseSupabaseEnv` logic; JWT-safe with `cut -f2-` | Plan |

## Scope

**In scope:** Update `ci.yml` — pin existing action SHAs, add Supabase CLI install, `supabase start`, credential injection, `npm test`. Update test-plan.md Phase 4 status and §6.5.

**Out of scope:** Phases 2–3 test rollout (game-rule, owner-action tests), Playwright E2E, branch trigger name changes, separate parallel test job.

## Architecture / Approach

Four steps appended to the existing `ci` job after the build:

```
install supabase/setup-cli → supabase start (blocks until healthy)
  → extract API_URL/ANON_KEY/SERVICE_ROLE_KEY from supabase status -o env
  → write BONDIFY_TEST_* to $GITHUB_ENV
  → npm test (ensureLocalSupabaseTestEnv early-exits; tests run against CI stack)
```

No test code changes required.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Update ci.yml | `npm test` green in CI with SHA-pinned actions | `supabase start` pull time adds ~90s to CI; acceptable |
| 2. Update docs | test-plan Phase 4 marked complete; §6.5 filled | None |

**Prerequisites:** Supabase project initialized (confirmed — `supabase/config.toml` + 15 migrations exist).
**Estimated effort:** ~1 session, 2 phases, ~15 lines of YAML.

## Open Risks & Assumptions

- `supabase start` on `ubuntu-latest` pulls Docker images on first run (~60-90s); caching is
  possible but not in scope — add only if CI times become unacceptable.
- The `supabase/setup-cli` action installs `version: latest` CLI; if a CLI breaking change
  ships, pin the CLI version in the `with:` block to lock it down.

## Success Criteria (Summary)

- CI `Run tests` step is green on the main branch after a push.
- All 6 test file names appear in the job log with a passing count.
- Existing lint + build steps continue to pass (no regression).
