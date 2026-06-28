---
change_id: cert-progression-review
title: Certification progression review and gap closure plan
status: implementing
created: 2026-06-27
updated: 2026-06-28
archived_at: null
---

## Notes

- Framing exercise: map current project state against the checkup.md certification gate matrix.
- Target: Level 3 + 10xChampion badge. Submission deadline 2026-07-05.
- See frame.md for the complete gap analysis and prioritized action list.
- Phase 0 runtime credential finding: ongoing deploys are documented as Cloudflare Workers Builds / Git integration, not a GitHub deploy job. `SUPABASE_URL` and `SUPABASE_KEY` therefore belong in Cloudflare Workers runtime/build environment settings; the GitHub Actions `ci.yml` build env only references optional build-time secrets and is not the production runtime source.
- Phase 2 CI review prerequisites: set `ANTHROPIC_API_KEY` as a GitHub Actions secret before running the `AI Code Review` workflow on a labeled PR. For promptfoo regression checks, provide `OPENROUTER_API_KEY` locally/CI before `npx promptfoo eval`; leave `PROMPTFOO_PASS_RATE_THRESHOLD` unset for the default all-tests-must-pass gate unless a noisy eval set is intentionally being triaged.

## Resume checkpoint — 2026-06-27

- Stop reason: local Docker Desktop is not available and likely needs a PC restart. `npx supabase start` failed with the missing `dockerDesktopLinuxEngine` pipe, and a `docker desktop start` helper was still waiting silently (`docker.exe desktop start`, observed PID `16180` during the session).
- Committed and pushed:
  - `efcabc0` Phase 0: repointed CI to `main`; CI run `28291559024` green with lint/build.
  - `ab7ab4b` Phase 1 initial CI test wiring; CI run `28291709909` failed because `supabase status -o env` values kept wrapping quotes.
  - `7488a88` Phase 1 quote-normalization fix; CI run `28291807498` green with 6 Vitest files / 20 tests and 5 Playwright tests.
  - `1a6d034` Phase 2 review pipeline; `AI Code Review` workflow registered (`review.yml`, workflow id `303220392`) and normal CI run `28292116378` green.
- Still pending because API keys / human evidence are required: Phase 0 manual Cloudflare checks; Phase 1 manual log review rows; Phase 2 real `ANTHROPIC_API_KEY` review run, `OPENROUTER_API_KEY` promptfoo eval, demo PR screenshots and quality review.
- Local uncommitted Phase 3 work started:
  - `context/foundation/lessons.md` has the third lesson, "CI Configured Is Not CI Running".
  - `AGENTS.md` should contain the bottom "What AI agents must NOT do" section; verify before staging because `git status` did not show it as dirty in this pause snapshot.
  - `README.md` references `docs/shared-reveal.png`, but that image is not captured yet.
  - `context/changes/cert-progression-review/plan.md` has local progress row updates after the pushed commits.
  - `tests/browser/readme-shared-reveal.spec.ts` is a temporary screenshot-capture spec. After restart, use it to create `docs/shared-reveal.png`, then delete the spec before the final docs commit unless you intentionally want to keep it.
- Suggested post-restart screenshot flow:
  1. Start Docker Desktop and confirm `docker desktop status` is running.
  2. Run `npx supabase start`.
  3. Export local Supabase env values from `npx supabase status -o env` into both `BONDIFY_TEST_*` and `SUPABASE_URL` / `SUPABASE_KEY`, mirroring `.github/workflows/ci.yml`.
  4. Run `npx playwright test tests/browser/readme-shared-reveal.spec.ts --project=chromium`.
  5. Confirm `docs/shared-reveal.png` exists and visibly shows the Two Truths shared reveal screen.
  6. Delete `tests/browser/readme-shared-reveal.spec.ts`, then finish Phase 3 verification/commit.

## Resume update — 2026-06-27

- Docker Desktop started successfully after settings were reapplied; `npx supabase start` reported the local stack running.
- `npx playwright test tests/browser/readme-shared-reveal.spec.ts --project=chromium` passed and generated `docs/shared-reveal.png`.
- The temporary screenshot spec was removed after capture; it is not part of the permanent test suite.
- Phase 3 automated checks passed for lesson count, AGENTS.md "must NOT" placement, and README image path resolution. Manual acceptance of screenshot quality and third-lesson quality is still pending.

## Self-check update — 2026-06-28

- Verified the latest `CI` run on `main` with `gh`: run `28292116378` succeeded, including `npm run lint`, `npm run build`, 6 Vitest files / 20 tests, and 5 chromium Playwright tests.
- Verified `https://bondify.witkos4.workers.dev` returns HTTP `200 OK` after the main-branch pushes.
- Verified `context/foundation/test-plan.md` marks Phase 4 complete and includes a usable §6.5 CI recipe.
- Verified `context/changes/cert-ci-test-gate/change.md` is `status: superseded`.
- Visually inspected `docs/shared-reveal.png`; it clearly shows the Two Truths shared reveal state with 2/2 votes, scoring, and both final reveal cards.
- Reviewed the third lesson and accepted it as a reusable rule.
- `gh secret list` returned no repository secrets, and `gh workflow view "AI Code Review"` showed 0 runs. Real Anthropic review, promptfoo, and demo-PR evidence remain blocked on API keys.
- `npx wrangler deployments list` could not run non-interactively without `CLOUDFLARE_API_TOKEN`; Cloudflare dashboard/runtime-secret checks remain manual. See `manual-checks.md`.
