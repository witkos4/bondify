# Frame Brief: Certification Progression Review

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.
>
> **Re-verified 2026-06-27** against current repo state (post two-truths tests,
> regression guardrails, and new Playwright specs). The original verdicts mostly
> hold, but one was wrong — see the 1.6 row — and that correction changes the plan.

## Reported Observation

All MVP slices (S-06 through S-09) are implemented. Context artifacts (PRD,
roadmap, plans, reviews, test-plan, AGENTS.md) exist. Integration tests are
written locally; Playwright E2E specs now also exist locally. The user wants to
confirm the project is progressing properly toward certification, then plan and
implement the gaps — reviewing what's done vs. what's ahead against `checkup.md`.

## Initial Framing (preserved)

- **User's stated cause or approach**: Review the checkup runbook against the
  actual project state to confirm progress.
- **User's proposed direction**: Identify what's missing, plan it, start
  implementing.
- **Pre-dispatch narrowing**: Target is **Level 3 + Champion badge, built in
  parallel** (confirmed 2026-06-27). Branch intent: **`main` is the default;
  the `master` references are stale starter config and must be repointed.**

## Dimension Map

| Cert group | What the certification checks |
|---|---|
| Level 1.1–1.4 | Artifacts (PRD, AGENTS.md, stack, plans, test-plan) + feature substance (auth, CRUD, business logic) |
| Level 1.5–1.6 | Integration/E2E test **passing in CI** + CI pipeline **green on the default branch** |
| Level 2.A–2.E | git workflow, code review artifacts, context discipline, test depth, live URL + auto-deploy |
| Level 3.A–3.E | Roadmap, multi-agent/headless/pipeline, ≥3 lessons, U-shaped AGENTS.md, demo-day readiness |
| Champion | CI code-review agent running; pipeline + job + LLM review comment screenshots |

## Hypothesis Investigation (re-verified 2026-06-27)

| Dimension | Evidence | Verdict |
|---|---|---|
| Level 1.1–1.4 met | `prd.md`, `AGENTS.md`, `tech-stack.md`, `stack-assessment.md`, `health-check.md`, multiple `plan.md`, `test-plan.md`, Supabase auth+RLS, CRUD, business rules, live URL in README | **STRONG — met** |
| **Level 1.6 (CI green on default branch)** | `gh api .../actions/runs` → **`total_count: 0`**. Workflow `CI` is registered+active but triggers on `branches: [master]`; the repo's only branch is `main` (`origin/HEAD → main`, no `master` anywhere). **CI has never run.** | **🔴 NONE — root blocker, missed by the prior pass** |
| Level 1.5 (test green in CI) | No `npm test` in `ci.yml`. `cert-ci-test-gate/plan.md` written but `change.md` status `planned` — unexecuted. The plan adds `npm test` but **does not fix the branch trigger**, so as written it would still never run. | **🔴 NONE — blocked (and the plan is incomplete)** |
| Level 2.A–2.C, 2.E (artifacts/URL) | Phase commits, `impl-review.md` for S-01–S-04, clean `context/`, live URL `bondify.witkos4.workers.dev` in README | **STRONG — met** |
| Level 2.E (ongoing auto-deploy) | README documents Cloudflare deploy **from `master`** (lines 24, 38). Same branch mismatch → pushes to `main` likely don't auto-deploy. Cloudflare dashboard branch is a **manual-verify** item. | **⚠️ AT RISK — verify Cloudflare branch** |
| Level 2.D (tests beyond minimum) | Rich local suite: 6 Vitest files + **new** Playwright specs (`tests/browser/emoji-check-in-picker.spec.ts`, `two-truths-round.spec.ts`). None run in CI. | **🔴 NONE — same CI gap** |
| Level 3.A roadmap | `roadmap.md` present, MVP slice marked, status per slice | **STRONG — met** |
| Level 3.B + Champion pipeline | No `.github/workflows/review.yml`; no headless/worktree evidence in git log. Module 5 entirely unstarted. | **🔴 NONE — not started (largest block)** |
| Level 3.C ≥3 lessons | `lessons.md` still has exactly **2** lessons | **⚠️ WEAK — 1 short** |
| Level 3.D U-shaped AGENTS.md | Bottom (lines 64–94) is the CLI-injected E2E block; no "must NOT do" section | **⚠️ WEAK — add bottom section** |
| Level 3.E demo readiness | README has live URL + description; **no screenshot/GIF** | **⚠️ WEAK — add screenshot** |

## Narrowing Signals

- **CI is configured but has never executed.** The prior pass conflated "a
  workflow file exists" with "CI runs and is green." Zero runs means every
  CI-dependent gate (1.5, 1.6, 2.D, and the ongoing-deploy half of 2.E) is
  blocked at the *root* — the branch trigger — not at the test step.
- The existing `cert-ci-test-gate` plan fixes the *test step* but not the
  *trigger*; running it as written would still produce 0 runs on `main`.
- Module 5 / Champion is the single largest remaining block and has zero
  evidence — but the user has chosen to pursue it in parallel.
- Feature substance and most artifacts are genuinely done; "the project is on
  track for features" was correct.

## Cross-System Convention

CI-dependent gates in this repo all resolve the same way: a job in
`.github/workflows/` that actually fires on the default branch. The fix order
is therefore **trigger first, then steps**: repoint the trigger to `main`, then
the `npm test` + Supabase-start steps from `cert-ci-test-gate` become
meaningful. The Champion pipeline (`review.yml`) is the same shape and can be
built in parallel once the trigger convention is fixed.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: the project's features and most
> artifacts are done, but its entire CI story is dead at the root — CI has run
> **0 times** because it triggers on `master` while the repo lives on `main` —
> so the planned `cert-ci-test-gate` work would be inert until the branch
> trigger (and the Cloudflare deploy branch) are repointed to `main`. On top of
> that prerequisite, three streams remain: wire tests into the now-live CI
> (1.5/2.D), build the Champion CI/CD review pipeline from scratch (3.B +
> badge), and finish three minor polish items (3rd lesson, AGENTS.md "must NOT
> do", README screenshot).

The initial framing ("review, plan, implement the gaps") was sound, and the
morning's frame correctly found the test-in-CI and Champion gaps — but it
missed that CI never runs, which sits *underneath* its top blocker.

## Confidence

- **HIGH** — file-verified gaps + `gh` confirming `total_count: 0` runs. The
  only unverifiable item is the Cloudflare deploy branch (dashboard setting),
  flagged as a manual check.

## What Changes for /10x-plan

Target is **Level 3 + Champion, in parallel**. Plan in this order:

1. **Amend `cert-ci-test-gate`** (do not run it as-is): add a **Phase 0** that
   repoints `ci.yml` triggers `master → main` (push + pull_request) *before*
   the `npm test` + `supabase start` steps. Also update README's `master`
   deploy references to `main` and **manually verify the Cloudflare Workers
   Builds branch** is `main`. This unblocks 1.5, 1.6, 2.D, and 2.E together.
2. **`/10x-plan cert-champion-pipeline`** — build the CI/CD code-review agent
   per Playbook D: `review.yml`, Claude Code Action with `10x-impl-review-ci`,
   promptfoo eval, merge gate, SHA-pinned actions. Closes 3.B + Champion badge.
   Buildable in parallel with (1) since it touches different files.
3. **Quick fixes (no plan needed)**: 3rd lesson in `lessons.md`; "must NOT do"
   section at the bottom of `AGENTS.md`; screenshot/GIF in README.
4. **Optional**: decide whether the new Playwright `tests/browser/*` specs join
   the CI gate now or stay local (test-plan §4 deferred E2E) — a scope call for
   the `cert-ci-test-gate` plan.

## References

- Cert gate matrix: `context/foundation/checkup.md` (§ Certification gate matrix)
- CI workflow (0 runs, triggers `master`): `.github/workflows/ci.yml`
- Existing (incomplete) CI plan: `context/changes/cert-ci-test-gate/plan.md`
- Test plan phases: `context/foundation/test-plan.md` (§3 Phased Rollout)
- Roadmap: `context/foundation/roadmap.md`
- Lessons (2 of 3): `context/foundation/lessons.md`
- README deploy/branch refs: `README.md` (lines 24, 38)
- Local Playwright specs: `tests/browser/emoji-check-in-picker.spec.ts`, `tests/browser/two-truths-round.spec.ts`
