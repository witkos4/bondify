# Certification Gap-Closure — Plan Brief

> Full plan: `context/changes/cert-progression-review/plan.md`
> Frame brief: `context/changes/cert-progression-review/frame.md`

## What & Why

Close every remaining 10xDevs certification gap so the project clears **Level 3 + the 10xChampion badge** by 2026-07-05. The frame found the project's features and most artifacts are done, but its **entire CI story is dead at the root**: CI has run 0 times because it triggers on `master` while the repo lives on `main`. Every CI-dependent gate is blocked beneath the already-written test plan until the trigger is repointed.

## Starting Point

CI is registered but has never executed (0 runs, 0 secrets, no branch protection). The test suite (6 Vitest integration files + 2 new Playwright specs) passes locally but isn't in CI. The Champion review pipeline doesn't exist — though the `10x-impl-review-ci` skill ships a ready-made workflow template in-repo. `lessons.md` has 2 lessons; `AGENTS.md` lacks a "must NOT do" section; README has no screenshot and points to `master`.

## Desired End State

CI fires on `main`, runs lint→build→Vitest→Playwright green. A label-gated `AI Code Review` pipeline runs OpenRouter `z-ai/glm-5.2` on PRs, posts an LLM review comment + verdict label/status, with badge screenshots captured from a demo PR. promptfoo regression-gates the same review prompt. Docs are complete: ≥3 lessons, a "must NOT do" section, and a shared-reveal screenshot.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Target scope | Level 3 + Champion, in parallel | User's certification goal | Frame |
| Branch intent | `main` is default; repoint stale `master` | Repo has only `main`; CI never fired | Frame |
| Phase 0 aggressiveness | Repoint + drive first run green (set secrets, fix build) | CI has 0 runs — first green is a real deliverable | Plan |
| Supabase in CI | `npx supabase start` (devDependency) | One fewer action to pin; version already locked | Plan |
| CI job shape | Single job, append test steps | Simplest; matches existing workflow | Plan |
| Playwright in CI | Yes, alongside Vitest | Stronger 2.D evidence (overrides test-plan §4 deferral) | Plan |
| Review-agent model | OpenRouter `z-ai/glm-5.2` | User-provisioned provider/model; bounded custom review script keeps promptfoo and CI on the same prompt | Implementation update |
| Pipeline implementation | Custom review script (`npm run review`) | One prompt promptfoo can regression-gate, vs. action+skill where the gate tested a parallel prompt | Plan-review F1 (Fix B) |
| promptfoo | Include now, wired to the live prompt | Full Playbook D coverage that guards the prompt that actually ships | Plan |
| Merge gate | Advisory until after submission | Avoid self-blocking pre-deadline merges | Plan |
| Badge evidence | Dedicated demo PR | Deterministic, repeatable screenshots | Plan |

## Scope

**In scope:** CI trigger fix + first green run; Vitest + Playwright in CI; Champion review pipeline (`review.yml`, OpenRouter `z-ai/glm-5.2`, SHA-pinned, label-gated); promptfoo gate; demo PR evidence; 3rd lesson; AGENTS.md "must NOT do"; README screenshot.

**Out of scope:** branch-protection/required checks (deferred post-submission); a `master` branch; test-plan rollout Phases 2–3; test-code changes; Docker image caching.

## Architecture / Approach

Phase 0 (prerequisite) repoints the trigger and gets CI green. Phases 1 (`ci.yml`) and 2 (`review.yml` + `prompts/review.txt` + `scripts/review.mjs` + promptfoo) touch disjoint files and can run in parallel after Phase 0. Phase 3 is independent doc work. All third-party actions SHA-pinned; manual prerequisites (secrets, Cloudflare branch, screenshots) flagged per phase.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 0. Repoint + first green run | CI actually runs and is green on `main` | First-ever run surfaces latent build/secret failures |
| 1. Tests in CI | Vitest + Playwright green in CI | Playwright needs `dev:local` wired to local Supabase + browsers |
| 2. Champion pipeline | Custom review script + workflow + promptfoo + badge screenshots | Larger build; OpenRouter key required; label gate and bounded call guard cost |
| 3. Doc fixes | 3rd lesson, AGENTS.md bottom, README shot | Trivial; screenshot needs a manual capture |

**Prerequisites:** GitHub Actions `OPENROUTER_API_KEY` for the AI review/promptfoo workflows; Cloudflare dashboard access to verify the deploy branch and confirm production `SUPABASE_URL`/`SUPABASE_KEY` live in Cloudflare. GitHub Supabase secrets are optional for this CI design.
**Estimated effort:** ~2–3 sessions across the four phases; Phase 2 is the largest.

## Open Risks & Assumptions

- The first real CI run may be red for reasons we can't see until it runs (missing secrets, latent build break) — Phase 0 owns fixing it.
- Playwright-in-CI assumes the `dev:local` server can read the injected local Supabase creds; if it only reads `.dev.vars`, the step writes one.
- Cloudflare's deploy branch is a dashboard setting outside the repo — must be verified manually.
- promptfoo and the demo PR depend on API keys the user must provision.

## Success Criteria (Summary)

- `CI` green on `main` with Vitest + Playwright (Level 1.5/1.6/2.D).
- A demo PR shows the Champion pipeline posting a review comment + verdict, with screenshots saved (Level 3.B + badge).
- `lessons.md` ≥3, `AGENTS.md` ends with "must NOT do", README shows the shared-reveal shot (Level 3.C/3.D/3.E).
