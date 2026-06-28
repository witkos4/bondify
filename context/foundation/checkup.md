# 10xDevs Module Runbook — Agent Step-by-Step

- **Purpose:** A single, agent-executable runbook for the certification project. One module = one phase. Lists every feature to achieve per module, the exact agent actions, and the four explicit deep-dives: **CI/CD**, **testing**, **agent on a legacy codebase**, and **GitHub code-review agents**.
- **Last updated:** 2026-06-26
- **Deadlines:** first submission **2026-07-05** → feedback by 2026-07-19. Fallbacks: 2026-08-10 | 2026-09-14.
- **Stack targeted by the concrete commands:** Astro 6 + React 19 + TypeScript + Tailwind CSS 4 + Supabase + Cloudflare (Pages/Workers) + Playwright/Vitest + GitHub Actions.
- **Companion notes (do not duplicate — cross-link):** [[Learning/10xDevs/10xDevs Course Completion Plan]] (the Level 1/2/3 pass criteria) and [[Learning/10xDevs/Proces pracy z agentem w 10xDevs]] (the consolidated process map).

> **Core rule (from the completion plan):** the course grades the *process*, not just the app. Reviewers check artefacts (PRD, AGENTS.md, plans, tests, CI/CD) **before** they check features. This runbook is ordered so the artefacts fall out of the work.

---

## How an agent should use this runbook

1. **Work module by module, top to bottom.** Each module is a phase. Produce the named artifacts before moving on.
2. **Greenfield vs brownfield legend:** 🌱 = new project from scratch · 🏚️ = existing/legacy codebase. Where the two paths diverge, both branches are shown side by side. Steps with no icon apply to both.
3. **Commit per phase.** Use the vault `[AREA]` style for vault notes, but for the *project repo* use the course convention reviewers scan for:
   ```text
   feat: [S-01 phase 1] scaffold Supabase auth with RLS
   test: [S-01] add Playwright login flow test
   ```
4. **Verify against the module gate before advancing.** Each module ends with a **Do-not-miss checklist** and a **Certification relevance** pointer.
5. **When the session degrades** (agent repeats itself, invents paths, ignores accepted constraints), write state to a file and `/clear` — see [[Learning/10xDevs/Proces pracy z agentem w 10xDevs]] § context engineering.
6. **The workflow order never changes:**
   ```text
   shape → prd → tech-stack → bootstrap → roadmap → plan → plan-review → implement → impl-review → lesson
   ```

---

## Module 0 — Global setup (Prework essentials)

**Objective:** Get the agent, the CLI, the context folder, and the permission policy in place so every later module has a working harness.

**Lessons covered:** [[2.3 Claude Code — Podstawy operacyjne - 10xDevs 3.0 Prework]] · [[3.5 Rekomendowane modele i jak być na bieżąco - 10xDevs 3.0 Prework]] · [[4.1 Tech Stack Overview - 10xDevs 3.0 Prework]] · [[4.3 Checklista uczestnika i support (Circle) - 10xDevs 3.0 Prework]]

**Skills / commands:** `10x-cli-setup`, `10x-cli-guide`, `/10x-init`, `/10x-agents-md`, `/10x-rule-review`

**Steps:**

1. **Pick the agent + data tier.** Terminal agent (Claude Code / Codex) inside your IDE's terminal is the recommended default. Confirm your tier is private: API / business plans don't train on your code by default; consumer tiers do — turn training off. (See [[AI-Powered Bootstrap boilerplate i bezpieczna praca z Agentem]] Deep Dive.)
2. **Authenticate the course CLI and pull a lesson pack:**
   ```bash
   npx @przeprogramowani/10x-cli@latest auth
   npx @przeprogramowani/10x-cli@latest get m1l1
   ```
   (Use `get m1l2`, `get m4l2`, etc. per module. The `10x-cli-guide` skill knows these commands for you.)
3. **Initialize the context folder:**
   ```bash
   /10x-init
   ```
4. **Paste the starter permission policy** into `.claude/settings.json` after the first bootstrap (verbatim from the bootstrap lesson; rules evaluate **deny → ask → allow**, first match wins):
   ```json
   {
     "permissions": {
       "allow": [
         "Bash(npm *)",
         "Bash(npx *)",
         "Bash(node *)",
         "Bash(git add *)",
         "Bash(git commit *)",
         "Bash(git diff *)",
         "Bash(git log *)",
         "Bash(git status *)",
         "Bash(git branch *)",
         "Bash(git checkout *)",
         "Bash(git stash *)",
         "Read",
         "Edit",
         "Write"
       ],
       "ask": [
         "Bash(curl *)",
         "Bash(wget *)",
         "Bash(git push *)",
         "Bash(git push)"
       ],
       "deny": [
         "Bash(rm -rf *)"
       ]
     }
   }
   ```
   Filter for every new "don't ask again" rule: *what can this pattern break outside my repo?* "Nothing" → allow. "Anything `git push` puts on the remote" → keep as ask. "Potentially the whole disk" (`Bash(*)`) → never.

**Artifact map (where everything lives):**

| Folder | Holds |
|--------|-------|
| `context/foundation/` | `prd.md`, `tech-stack.md` (or `stack-assessment.md`), `infrastructure.md`, `roadmap.md`, `test-plan.md`, `lessons.md`, `health-check.md` |
| `context/changes/<id>/` | per-feature `requirements.md`, `research.md`, `plan.md`, `plan-brief.md`, `review.md` |
| `context/map/` | `artifact-1-territory.md`, `artifact-2-structure.md`, `artifact-3-contributors.md`, `repo-map.md` (legacy only) |
| `context/deployment/` | `deploy-plan.md` |
| `context/archive/` | completed changes |
| repo root | `AGENTS.md`, `.github/workflows/`, `.claude/settings.json` |

**Do-not-miss checklist:**
- [ ] Data-training turned off if on a consumer tier.
- [ ] `deny` rules present *before* you ever consider YOLO mode (`--dangerously-skip-permissions` only in a sandbox/dev container).
- [ ] `context/` exists and is committed (bootstrapper preserves it verbatim).

**Certification relevance:** Foundation for **all** Level 1 artefacts. Permission hygiene + context layout are what Level 2 "context managed correctly" is graded on.

---

## Prework — concept layer (read once, reference always)

**Objective:** Internalize the mental models the rest of the runbook assumes.

**Lessons covered:** [[1.1 Co potrafi AI w 2026 r. - 10xDevs 3.0 Prework]] · [[1.2 Chatbot vs Agent vs Harness — definicje - 10xDevs 3.0 Prework]] · [[1.3 Jak uczyć się i rozwijać z AI - 10xDevs 3.0 Prework]] · [[2.1 Agent w IDE, Terminalu czy w Chmurze - 10xDevs 3.0 Prework]] · [[3.2 Wzorce i antywzorce promptowania - 10xDevs 3.0 Prework]] · [[3.3 Cykl życia wątku i zarządzanie kontekstem - 10xDevs 3.0 Prework]]

**Skills / commands:** none (conceptual).

**Artifacts produced:** none — but these decisions feed `AGENTS.md` and your model choices.

**Steps (just enough to act on):**
1. Treat the agent as **Model + Harness + Local env + User policy**, not "the model".
2. Use **Generation-then-Comprehension**: after a useful session, answer one "why / trade-off" question without hints; capture Q/A flashcards.
3. Keep an eye on the **MECW**: 🟢 ≤40K tokens full attention, 🟡 40–80K weakening, 🔴 80–120K+ degradation. Reset before the red zone.
4. **Prompt reasoning models with constraints, not steps/examples** (exceptions: migrations, security, payments).

**Do-not-miss checklist:**
- [ ] Default model set for daily execution; best model reserved for plans, architecture, debugging, code review.
- [ ] You can state the project in one sentence before any code.

**Certification relevance:** Indirect — feeds the quality of every artefact and the U-shaped `AGENTS.md` graded at Level 3.

---

## Module 1 — Contract & rules (Sprint Zero)

**Objective:** Turn an idea into a product+technical contract, a scaffolded repo, an onboarded agent, and a **first production deploy**.

**Lessons covered:** [[Od pomysłu do PRD Metoda Sokratejska z Agentem]] · [[Od chatbota do Agenta tech stack, skille i metaprompting]] · [[AI-Powered Bootstrap boilerplate i bezpieczna praca z Agentem]] · [[Agent Onboarding Agents.md, AI Rules i feedback loops]] · [[Od localhosta na produkcję]] · (team registry: [[Shared AI Registry skille, komendy i reguły dla zespołu]])

**Skills / commands:** `/10x-shape` → `/10x-prd` → (🌱 `/10x-tech-stack-selector` · 🏚️ `/10x-stack-assess`) → (🌱 `/10x-bootstrapper` · 🏚️ `/10x-health-check`) → `/10x-agents-md` → `/10x-rule-review` → `/10x-infra-research` → Plan-Mode deploy. Lesson packs: `get m1l1` … `get m1l5`.

**Artifacts produced:** `context/foundation/prd.md`, `context/foundation/tech-stack.md` (🌱) or `context/foundation/stack-assessment.md` + `context/foundation/health-check.md` (🏚️), `AGENTS.md`, `context/foundation/infrastructure.md`, `context/deployment/deploy-plan.md`, `context/changes/bootstrap-verification/verification.md` (🌱).

**Steps:**

1. **Shape the idea (Socratic):** `/10x-shape` → writes `shape-notes.md`. If the problem itself is mis-framed, insert `/10x-frame` first.
2. **Write the contract:** `/10x-prd` turns `shape-notes.md` into `context/foundation/prd.md`. Gate: can you write *"The app [classifies/recommends/validates/scores/generates/routes] X based on Y"*? If not, fix the PRD.
3. **Choose / assess the stack:**
   - 🌱 `/10x-tech-stack-selector` → `tech-stack.md` (typed, convention-based, well-documented, agent-friendly = Astro/React/TS/Supabase/Cloudflare).
   - 🏚️ `/10x-stack-assess` → `stack-assessment.md` (rates the *existing* stack against the same gates).
4. **Get a working starting point:**
   - 🌱 `/10x-bootstrapper @tech-stack.md` — delegates to the authoritative CLI (e.g. `npm create astro@latest -- --template minimal`), runs three gates (pre-execution hand-off check → in-execution permissions → post-execution `npm audit`), and writes `verification.md`.
   - 🏚️ `/10x-health-check` — audits deps (`npm audit`/`pip-audit`/`cargo audit`), test runner, CI presence, missing config; verdict `healthy | needs-attention | critical-issues` → `health-check.md`. **Never run the bootstrapper on a brownfield repo.**
5. **Onboard the agent:** `/10x-agents-md` drafts `AGENTS.md`; then `/10x-rule-review AGENTS.md` scores it on length, redundancy, precision, pasted-code, rule order. Apply the **inclusion test** ("could the agent know this without the file?") and **U-shaped attention** (most critical rules at top and bottom).
6. **Research infrastructure & deploy:**
   - `/10x-infra-research` (input: `tech-stack.md`) → scored Pass/Partial/Fail platform table → run the three anti-bias tests (devil's advocate, pre-mortem, unknown unknowns) → write `context/foundation/infrastructure.md`.
   - Prepare accounts/CLIs: Cloudflare (`npx wrangler login`), Supabase project (URL + anon key), GitHub CLI (`gh auth login`).
   - Enter **Plan Mode** (`Shift+Tab` cycles default → auto-accept → plan): *"Wykonajmy pierwsze wdrożenie w oparciu o `@infrastructure.md`, zgodnie ze stackiem z `@tech-stack.md`."* Review the plan, approve, let the agent execute. Save it as `context/deployment/deploy-plan.md`. (Full CI/CD detail → **Playbook A**.)

**Do-not-miss checklist:**
- [ ] 🏚️ ran `health-check`, **not** bootstrapper (avoids `.scaffold` collisions).
- [ ] `AGENTS.md` < ~200 lines; no rule the agent could infer from docs/README.
- [ ] Secrets go in env / GitHub Secrets / Workers Secrets — **never** in `.mcp.json` committed to the repo.
- [ ] First deploy done via Plan Mode (read-only plan first), not "agent runs, I watch".
- [ ] `deploy-plan.md` saved — it's the input to Module 2's MVP planning.

**Certification relevance:** **Level 1.1** (prd.md, AGENTS.md, tech-stack.md), **Level 1.2** (access control begins with Supabase auth), **Level 2.C** (context managed), **Level 2.E** (public deployment starts here).

---

## Module 2 — Roadmap, single change & review

**Objective:** Sequence the MVP, implement one slice at a time with a reviewable git history, and run Solo Code Review.

**Lessons covered:** [[Od roadmapy do kodu plan, review, implementacja]] · [[Roadmapa MVP milestony, zależności i priorytety]] · [[Od localhosta na produkcję]] · [[Solo Code Review weryfikuj kod AI szybko i skutecznie]] · [[Code Review w erze AI standardy, DoD i Agent w pipeline]]

**Skills / commands:** `/10x-roadmap` → `/10x-new` → `/10x-plan` → `/10x-plan-review` → `/10x-implement` (one phase) → `/10x-impl-review` → `/10x-lesson`.

**Artifacts produced:** `context/foundation/roadmap.md`, `context/changes/<id>/plan.md` + `plan-brief.md`, `context/changes/<id>/review.md`, `context/foundation/lessons.md`.

**Steps:**

1. **Roadmap:** `/10x-roadmap` orders slices, foundations, and north-star; mark the MVP slice explicitly, scope out the rest.
2. **Open a change:** `/10x-new <id> "<intent>"` creates the change folder.
3. **Plan:** `/10x-plan <id>` → `plan.md` (+ `plan-brief.md`). If new unknowns affect a technical decision, drop back to `/10x-research`.
4. **Plan review:** `/10x-plan-review` stops a bad plan *before* the agent edits code en masse.
5. **Implement one phase at a time:** `/10x-implement` — commit each phase separately (`feat: [S-xx phase n] …`).
6. **Solo Code Review:** `/10x-impl-review` scores six dimensions — Plan Adherence, Scope Discipline, Safety & Quality, Architecture, Pattern Consistency, Success Criteria. Triage findings by **severity × impact**; react with Fix now / Fix differently / Skip (with reason) / Record as lesson. Keep output in `review.md` or PR comments.
7. **Capture lessons:** `/10x-lesson` appends a recurring finding as a rule → `lessons.md` (format: rule → **Why:** → **How to apply:**).

**Do-not-miss checklist:**
- [ ] One commit per plan phase — reviewers scan `git log` for the workflow, not a bulk dump.
- [ ] `plan-review` ran before implementation (don't skip the gate).
- [ ] Read the agent diff in order: scope → risk boundaries (auth, data writes, migrations, external APIs) → local patterns → tests.
- [ ] Deployment now runs automatically from CI after tests pass (→ **Playbook A**).

**Certification relevance:** **Level 2.A** (full workflow in git history), **Level 2.B** (Solo Code Review artefact), **Level 3.A** (roadmap with milestones).

---

## Module 3 — Quality & tests

**Objective:** Protect real risk with tests that verify *behavior*, get at least one E2E flow green in CI, and automate fast feedback with hooks.

**Lessons covered:** [[Plan testów z AI quality gates, test-plan i priorytety]] · [[Od planu do testów implementacja unitów z Agentem]] · [[Testy E2E Playwright, MCP i multimodalne scenariusze]] · [[Hooki i triggery Agent, który sam reaguje na błędy]] · [[Debugowanie z AI od stack trace]]

**Skills / commands:** `/10x-test-plan` → `/10x-tdd` / `/10x-e2e` → `/10x-implement`; `/10x-research` for debugging.

**Artifacts produced:** `context/foundation/test-plan.md`, unit tests (Vitest), one Playwright E2E spec, hook config (`.claude/settings.json` hooks + `.husky/` or equivalent).

**Steps:**

1. **Test plan:** `/10x-test-plan` — choose what to *protect* (risk), not coverage for its own sake → `test-plan.md`.
2. **Unit / TDD:** `/10x-tdd` writes the failing test first for the one-sentence business rule, then `/10x-implement` makes it pass. Give the agent a concrete input tied to risk; verify the assertion separately (the **oracle problem** — agents test what code *does*, not what it *should*).
3. **E2E:** `/10x-e2e` drives the main user flow with Playwright (happy path). This is the test that must exist for Level 1.
4. **Debug loop** (when a prod ticket lands): evidence (ticket/logs/Sentry/Playwright/network) → hypothesis via `/10x-research` → fix in `/10x-plan` → `/10x-implement` → verify symptom gone; if browser-only, use `/10x-e2e`; if recurring, `/10x-lesson`.
5. **Hooks:** wire post-edit (lint/format/typecheck), pre-commit (staged files), pre-push/CI (heavier). Hooks run *outside* the model and react faster than a long session. (Full detail → **Playbook B**.)

**Do-not-miss checklist:**
- [ ] The E2E/integration test **passes in CI** — a local-only test does not count for certification.
- [ ] Don't pile on random tests to make coverage green with a weak assertion — go back to `/10x-research` or `/10x-tdd`.
- [ ] Tests are deterministic.

**Certification relevance:** **Level 1.5** (≥1 E2E/integration test passing in CI), **Level 2.D** (test coverage beyond minimum).

---

## Module 4 — Legacy & large projects

**Objective:** Make an unfamiliar/large repo workable: scale context, build a project map, extract a domain, and refactor reversibly.

**Lessons covered:** [[Skalowanie kontekstu dla AI w dużych projektach]] · [[Agent w projekcie legacy - generowanie Mapy projektu]] · [[Refaktoryzacja z Agentem testy, zmiany, weryfikacja]] · [[Modernizacja legacy z DDD wydzielaj domeny, potem deleguj Agentowi]] · [[Analiza feature z AI co działa, co kuleje, co zmodernizować]]

**Skills / commands:** `/10x-init`; ad-hoc git/CLI prompts → `context/map/*`; `/10x-feature-analysis` → `research.md`; `/10x-new refactor-opportunities` → `/10x-research` → `/10x-plan` → `/10x-plan-review` → `/10x-implement`. Lesson pack: `get m4l2`.

**Artifacts produced:** lean `AGENTS.md` + `context/` split, `context/map/artifact-1-territory.md`, `artifact-2-structure.md`, `artifact-3-contributors.md`, `context/map/repo-map.md`, refactor `plan.md` with a characterizing-test phase.

**Steps (mostly 🏚️; 🌱 projects only need this once they grow):**

1. **Scale context:** keep root `AGENTS.md` as a table of contents; push detail into `context/foundation/`, per-change folders in `context/changes/`, finished work to `context/archive/`. Escalate to per-module `AGENTS.md`/`context/` only when the monolith starts to hurt.
2. **Wide Scan → Deep Focus** to build `repo-map.md` (full procedure → **Playbook C**): cheap CLI signals → agent synthesis → operational map with modules, dependencies, risk zones, unknowns.
3. **Feature analysis:** `/10x-feature-analysis` → `research.md` (what works, what limps, what to modernize).
4. **Domain extraction (DDD):** identify the target archetype (Transaction Script / Table Module / Domain Model + Service Layer) — it's a fit decision, not a ranking.
5. **Refactor reversibly:** `/10x-new refactor-opportunities` → `/10x-research` (shape + history + feasibility) → read `research.md` *outside* the session → verify structural claims with `ast-grep`/`grep` → `/10x-plan` (the decision gate) → `/10x-plan-review` → `/10x-implement phase 1`.

**Do-not-miss checklist:**
- [ ] **Add a characterizing test before touching uncovered legacy code** (the first refactor phase).
- [ ] Check git archaeology (`git log -L`, blame, ADRs) before "fixing" — distinguish deliberate constraint from accidental complexity.
- [ ] Pick a reversible route: Strangler Fig / Branch by Abstraction / Guard / Mikado.
- [ ] Record tool blind spots (runtime/reflection/DI/codegen deps) as explicit `unknowns`, not "no dependencies".

**Certification relevance:** **Level 3** mastery of advanced modules; brownfield path for Level 1 artefacts (`stack-assessment.md`/`health-check.md` substitute for `tech-stack.md`).

---

## Module 5 — Parallel & advanced (10xChampion track)

**Objective:** Scale beyond one agent: research-heavy streams, parallel/worktree work, async/remote agents, your first SDK team agent, and a **CI/CD code-review agent**.

**Lessons covered:** [[Research i implementacja trudniejszy stream z AI]] · [[Innovate więcej ficzerów, mniej czekania z wieloma agentami]] · [[Innovate Async & Remote Agents - deleguj i zajmij się czymś innym]] · [[Twój pierwszy Agent zespołowy SDK, koszty, metryki]] · [[AI Internal Builders wewnętrzne narzędzia, serwisy i automatyzacje]] · [[Code Review w erze AI standardy, DoD i Agent w pipeline]]

**Skills / commands:** `/goal` (delegated mode), Git Worktrees, `/10x-opportunity-map`, `/10x-mom-test`, `/10x-new` → `/10x-research` → `/10x-plan` → `/10x-implement` for the pipeline itself, `/10x-impl-review-ci`. Lesson packs: `get m5l1` … `get m5l3`.

**Artifacts produced:** parallel worktree branches, `context/changes/ci-cd-code-review/requirements.md` + `research.md` + `plan.md`, `.github/workflows/review.yml`, a Composite Action (`action.yml`), `promptfooconfig.yaml`, an opportunity map.

**Steps:**

1. **Research+implementation stream:** harder features go research-first; isolate exploration in a subagent so the main window stays clean.
2. **Parallel agents:** pick two independent slices (verify no shared files/contracts/layers first). Use worktrees:
   ```bash
   git worktree add ../myapp-slice-a -b feature/slice-a
   git worktree add ../myapp-slice-b -b feature/slice-b
   ```
   Watch for shared ports/DB between worktrees.
3. **Delegated mode:** when the plan is concrete and the finish condition measurable:
   ```text
   /goal Use 10x-implement skill to implement all phases of context/changes/slice-a/plan.md.
         Each phase is committed separately. Stop after 20 turns if not complete.
   ```
4. **Async/remote agents:** delegate long-running work; review results when ready.
5. **First team agent (SDK):** wrap an LLM as a `ToolLoopAgent` scorer (one input, one structured output via `Output.object`), then climb the agency ladder by adding `tools` (read → write → whole-GitHub → beyond). Keep a hard step cap (`stopWhen: stepCountIs(8)`) and measure cost with `onStepFinish`.
6. **Internal builders:** qualify friction with `/10x-opportunity-map` (buy / complement / build) and validate with `/10x-mom-test` before building. Prefer 2–3 thin helpers that remove real friction over 10 prototypes.
7. **CI/CD code-review agent:** build the GitHub review pipeline (full procedure → **Playbook D**).

**Do-not-miss checklist:**
- [ ] Hard step limit on any tool-loop agent (`stepCountIs`) — on CI the cost multiplies per PR; never run unbounded `isLoopFinished()`.
- [ ] Each subagent costs tokens independently (5 parallel ≈ 5× cost).
- [ ] Treat the CI/CD pipeline as a normal feature: research → plan → implement, not copy-paste from Stack Overflow.

**Certification relevance:** **Level 3.B** (multi-agent / worktree / headless), **Level 3.C** (≥3 lessons), and the **10xChampion** badge (pipeline screenshots: pipeline view + job + LLM review comment on a PR).

---

# Deep-dive playbooks

## A. CI/CD playbook

**Goal:** build + test on every push/PR, deploy to Cloudflare after tests pass, secrets handled safely, agent kept on a least-privilege leash.

1. **Minimal `ci.yml`** (build+test gate — this is the Level 1.6 minimum):
   ```yaml
   # .github/workflows/ci.yml
   on: [push, pull_request]
   jobs:
     build-and-test:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with: { node-version: 20 }
         - run: npm ci
         - run: npm run build
         - run: npm test
   ```
2. **Deploy to Cloudflare** after the test job (Level 2.E):
   ```yaml
   - name: Deploy to Cloudflare Pages
     uses: cloudflare/pages-action@v1
     with:
       apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
       accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
       projectName: your-project-name
       directory: dist
   ```
   For Workers, deploy with `npx wrangler deploy`; for Pages, `npx wrangler pages deploy` — **these are not the same command**, decide Pages vs Workers in `infrastructure.md`.
3. **First deploy via Plan Mode**, saved as `context/deployment/deploy-plan.md`. The plan must list: agent-automated steps, accounts/services to configure by hand, secrets to set, and the exact deploy commands.
4. **Preview-per-PR + `gh`:** Cloudflare posts a preview deployment per push; the agent inspects it with `gh`:
   ```bash
   gh pr create --fill            # PR from last commit; add --draft to hold reviewers
   gh pr view <n> --web
   wrangler pages deployment list --project-name 10xcards
   wrangler pages deployment tail --project-name 10xcards   # live logs
   wrangler pages secret list --project-name 10xcards
   ```
5. **Secrets:** GitHub Secrets for CI; Cloudflare Workers/Pages Secrets for runtime. Put tokens in env, not in `.mcp.json`. Reference them as `${{ secrets.NAME }}` so they never appear in logs or history.
6. **Environment / approval gates:** for maturer pipelines use GitHub Actions *environments* with required reviewers (approval gates) on the production deploy.
7. **Agent→prod boundary (least privilege):** scope the Cloudflare token to *one* project's Pages/Workers — no DNS, no billing, no unrelated secrets. **Destructive/irreversible actions stay human** (drop DB, rotate main secret, delete project): the agent suggests, you click. Natural evolution: agent gets full access to staging, read-only to prod.

**Certification relevance:** Level 1.6 (CI), Level 2.E (auto-deploy + live URL in README).

---

## B. Testing playbook

**Goal:** tests that protect risk and verify behavior, green in CI, with hooks for fast feedback.

1. **Plan by risk:** `/10x-test-plan` → `test-plan.md`. Protect the risky paths (auth, data writes, the business rule), not file coverage.
2. **Failing test first:** `/10x-tdd` for the one-sentence business-logic function. Give a concrete input/scenario tied to the risk.
3. **Unit tests (Vitest):** assert the *decision* the rule makes, with edge cases, not the implementation shape.
4. **E2E happy path (Playwright):** `/10x-e2e` drives the main user flow. Example skeleton:
   ```ts
   import { test, expect } from '@playwright/test';

   test('user logs in and sees their dashboard', async ({ page }) => {
     await page.goto('/login');
     await page.getByLabel('Email').fill(process.env.E2E_USER!);
     await page.getByLabel('Password').fill(process.env.E2E_PASS!);
     await page.getByRole('button', { name: 'Sign in' }).click();
     await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
   });
   ```
5. **The oracle problem:** agents tend to test what the code *does*. Naive tests hit ~92% coverage on toy examples but ~45% on real complex functions. Supply the expected behavior; verify the assertion yourself. Green coverage + weak assertion ⇒ go back to `/10x-research` or `/10x-tdd`, don't add random cases.
6. **Must pass in CI to count.** Wire `npm test` and the Playwright run into `ci.yml` (Playbook A). Local-only tests do not satisfy certification.
7. **Hooks (run outside the model):**
   - **post-edit:** lint / format / typecheck on the changed file.
   - **pre-commit:** staged files (e.g. `lint-staged`).
   - **pre-push / CI:** the heavy suite.
   Hooks shorten the change→feedback loop; they don't replace the plan or the tests.

**Certification relevance:** Level 1.5, Level 2.D.

---

## C. Agent on an old/legacy codebase playbook

**Goal:** make a repo you don't know workable without burning the context window — produce `context/map/repo-map.md`.

1. **Entry assessment:** `/10x-stack-assess` (rates existing stack) + `/10x-health-check` (deps, test runner, CI, missing config → `health-check.md`). Never bootstrap a brownfield repo.
2. **Wide Scan → Deep Focus:** cheap, deterministic CLI signals first (they run *outside* the context window; only condensed results return), then agent interpretation, then one deep dive. Work in `context/map/` and create it with `/10x-init` if missing.
3. **Three working artifacts → `repo-map.md`:**
   - **Territory** (`artifact-1-territory.md`) — git activity & co-change. Prompt the agent:
     ```text
     Using git history over the last 12 months, show the TOP 10 most-modified
     a) folders/modules  b) files. Filter noise: lockfiles, snapshots, generated
     files, dotenvs, configs. Go one level deeper if results are too coarse
     (e.g. "src/frontend"). Then: which folder pairs/triples appear in the same
     commits (coupling)? Is any single file changing together with many areas?
     ```
   - **Structure** (`artifact-2-structure.md`) — static import graph with `dependency-cruiser` (`depcruise`). Ask for **Markdown tables first, not images**: cycles in active areas (`no-circular`), layer-boundary violations, test-isolation risk. Use `--focus` / `--include-only` / `--collapse` / `--metrics` (Ca, Ce, instability). Render one SVG via Graphviz only after the decision is clear. Exclude noise: `--exclude 'node_modules|\.test\.|\.stories\.|__snapshots__|\.d\.ts$'`.
   - **Contributors** (`artifact-3-contributors.md`) — who has context per risk area (filter out bots and Claude/Codex/Copilot commits); thematic, not a `git blame` line count.
4. **Per-stack dependency-graph alternatives** (same pattern: static import graph → DOT/SVG/JSON → agent synthesis):

   | Stack | Tools | CLI / output |
   |-------|-------|--------------|
   | JS/TS | `dependency-cruiser`, `madge`, `skott` | DOT, SVG, JSON, Mermaid (`skott` handles path aliases) |
   | Python | `Tach`, `pydeps` | `tach show` → DOT, `--web`; `pydeps -T svg`, `--show-cycles` |
   | Java | `jdeps`, Maven Dependency Plugin | `jdeps --dot-output`; `dependency:tree -DoutputType=dot` |
   | Go | `goda`, `go mod graph` | `goda graph ./...` → DOT (`-cluster`); `go mod graph` text |
   | C#/.NET | `dotnet-deptree`, `NDepend` | `-f svg/png/dot`; NDepend matrix (commercial) |
   | Swift | `spmgraph`, `swift package show-dependencies` | `visualize`/`lint`; `--format dot/json` |
   | Kotlin/Gradle | vanniktech `gradle-dependency-graph-generator`, `modules-graph-assert` | Gradle tasks → png/svg/dot |

   Record each tool's blind spots (reflection, DI, dynamic require, codegen, feature flags) as `unknowns` in the map.
5. **Final synthesis:** ask the agent to merge the three artifacts into `context/map/repo-map.md` (TL;DR + Mermaid layers → territory → real coupling → risk zones → who to ask → first 5–8 files to read → limitations). Don't paste a hairball graph.
6. **DDD modernization:** extract a domain, choose the target archetype, then delegate the refactor.
7. **Refactor flow:** `/10x-new refactor-opportunities` → `/10x-research` → read outside session → `/10x-plan` (decision gate) → `/10x-plan-review` → `/10x-implement`. The plan must **add a characterizing test before touching uncovered code**, order phases cheapest-first, give each a verification criterion, and state explicitly what it will NOT do. Reversible routes: Strangler Fig, Branch by Abstraction, Guard, Mikado.
8. **Context scaling:** lean root `AGENTS.md` + centralized `context/`; per-module split only on escalation signals.

**Certification relevance:** Level 3 advanced-module mastery; brownfield substitutes for Level 1 stack artefacts.

---

## D. GitHub code-review agent playbook

**Goal:** an AI reviewer that runs on every PR, scores against your Definition of Done, gates the merge, and is regression-tested. Build it with the same research→plan→implement workflow as any feature.

1. **Open the change + write `requirements.md`** (a brainstorm note is enough context here):
   ```text
   /10x-new ci-cd-code-review introducing first ci/cd workflow for pr code reviews
   ```
   ```md
   ## Overall concept
   - GHA workflow for every PR to master
   - composite action for the review itself (main workflow stays simple)
   ## Input parameters
   - PR title, PR description (cost tradeoff), git diff
   ## Code Review Criteria  (each scored 1–10, with "1" and "10" defined)
   - correctness, idiomatic style, complexity, test/risk coverage, docs, security
   ## Parked for later
   - business alignment, architectural fit (need broader context)
   ## Expected side-effects
   - PR comment with summary; labels ai-cr:passed (green) / ai-cr:failed (red)
   ## Expected behavior
   - on-demand retry when label ai-cr:review is added
   ```
2. **Research → plan the workflow itself:**
   ```text
   /10x-research ci-cd-code-review based on requirements from '@context/changes/ci-cd-code-review/requirements.md'
   /10x-plan ci-cd-code-review Plan the implementation based on research and the requirements.
   ```
3. **Minimal workflow** (`pull_request` + manual `workflow_dispatch` so you can test without a PR):
   ```yaml
   # .github/workflows/review.yml
   name: AI Code Review
   on:
     pull_request:
       branches: [master]
     workflow_dispatch:
   jobs:
     review:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with: { node-version-file: '.nvmrc' }
         - run: npm ci
         - run: npm run review
           env:
             LLM_PROVIDER_API_KEY: ${{ secrets.LLM_PROVIDER_API_KEY }}
   ```
4. **Composite Action** (reusable across repos). Start in-repo at `.github/actions/<name>/`, extract to a separate repo later:
   ```yaml
   # action.yml
   name: AI Reviewer
   description: Run the team's code review agent
   inputs:
     api-key: { description: API key, required: true }
   outputs:
     verdict:
       description: Pass/fail verdict from the agent
       value: ${{ steps.agent.outputs.verdict }}
   runs:
     using: composite
     steps:
       - name: Run agent
         id: agent
         run: node ${{ github.action_path }}/dist/review.js
         shell: bash          # composite steps MUST set shell explicitly
         env:
           LLM_PROVIDER_API_KEY: ${{ inputs.api-key }}
   ```
   The action defines **no trigger and no OS** — the consumer's workflow decides. Consumer shrinks to one step: `uses: twoj-zespol/ai-reviewer@<sha>`.
5. **Pass PR title/body/diff** — note the shallow-checkout trap:
   ```yaml
   - uses: actions/checkout@v4
     with:
       fetch-depth: 0   # full history — else git diff has nothing to compare
   - id: diff
     run: echo "value=$(git diff origin/${{ github.base_ref }}...HEAD)" >> "$GITHUB_OUTPUT"
   - uses: twoj-zespol/ai-reviewer@<sha>
     with:
       api-key:  ${{ secrets.LLM_PROVIDER_API_KEY }}
       pr-title: ${{ github.event.pull_request.title }}
       pr-body:  ${{ github.event.pull_request.body }}
       diff:     ${{ steps.diff.outputs.value }}
   ```
6. **Claude Code Action** (`anthropics/claude-code-action@v1`) — the ready-made path; same Claude Code, on the runner, with intelligent mode detection:
   - **Interactive** (`@claude` in a comment): trigger on `issue_comment` / `pull_request_review_comment`.
   - **Auto-review:** trigger on `pull_request: [opened, synchronize]` with an explicit `prompt`.
   - **Criteria-driven:** put your DoD criteria (or a skill) in the `prompt`; return structured JSON for the merge gate.
   ```yaml
   - uses: anthropics/claude-code-action@v1
     with:
       prompt: |
         Review this PR for correctness, security and readability.
         Give concrete suggestions per changed file.
       anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
       github_token: ${{ secrets.GITHUB_TOKEN }}
   ```
7. **Mount the `10x-impl-review-ci` skill** (allowed to live in a public repo) so Claude Code Action reviews against your DoD:
   ```yaml
   - name: Provide the skill to the agent
     run: |
       mkdir -p "$HOME/.claude/skills"
       cp -r .github/skills/10x-impl-review-ci "$HOME/.claude/skills/"
   - uses: anthropics/claude-code-action@v1
     with:
       anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
       prompt: |
         /10x-impl-review-ci
         You run in CI on a PR. Compare the PR with its plan, save the report,
         and post a comment on the PR.
   ```
   Verdicts: `APPROVED` / `NEEDS ATTENTION` / `REJECTED`.
8. **promptfoo evals** (turn "model A or B?" from a hunch into a results matrix; also a regression gate):
   ```yaml
   # promptfooconfig.yaml
   providers:
     - id: openrouter:anthropic/claude-haiku-4.5
     - id: openrouter:anthropic/claude-sonnet-4.6
     - id: openrouter:openai/gpt-5-mini
   prompts:
     - file://prompts/review.txt
   tests:
     - vars:
         diff: file://fixtures/sql-injection.diff
       assert:
         - type: is-json
         - type: llm-rubric
           value: Verdict rejects the change and flags the SQL injection
         - type: javascript
           value: JSON.parse(output).score <= 3
   ```
   ```bash
   export OPENROUTER_API_KEY=...   # one key, many vendors
   npx promptfoo eval
   ```
   Default threshold is absolute (one failing case → red); loosen only with `PROMPTFOO_PASS_RATE_THRESHOLD=95` if the set is noisy. Keep this as a regression gate before every prompt change (guards against silent quality regressions).
9. **Definition of Done → merge gate:** the action's structured `verdict`/`score` output drives labels (`ai-cr:passed`/`ai-cr:failed`) and a status check that blocks merge.
10. **Security:** pin every action to `@<sha>`, not a moving `@v1` — it's third-party code with access to your secrets. Treat `inputs` as untrusted. Keep a hard `stepCountIs(...)` cost guard; never run unbounded on CI where cost multiplies per PR.

**Certification relevance:** Level 3.B (headless/SDK/agent-in-pipeline) and the **10xChampion** badge evidence (pipeline view + job logs + LLM review comment on a PR).

---

# Certification gate matrix

Maps each completion-plan requirement → the module that delivers it → the artifact/file → a verification step. The authoritative criteria live in [[Learning/10xDevs/10xDevs Course Completion Plan]] — this is the routing table, not a copy.

| Cert item | Level | Module | Artifact / file | Verify |
|-----------|-------|--------|-----------------|--------|
| PRD exists & non-empty | 1.1 | M1 | `context/foundation/prd.md` | open file; one-sentence rule passes |
| Project rules | 1.1 | M1 | `AGENTS.md` (<200 lines) | `/10x-rule-review AGENTS.md` |
| Tech stack contract | 1.1 | M1 | `tech-stack.md` 🌱 / `stack-assessment.md`+`health-check.md` 🏚️ | file present |
| Per-feature plan | 1.1 | M2 | `context/changes/<id>/plan.md` | `git log` shows phase commits |
| Test plan | 1.1 | M3 | `context/foundation/test-plan.md` | file present |
| Access control | 1.2 | M1 | Supabase auth + protected route/RLS | manual login flow |
| CRUD on domain entity | 1.3 | M2 | feature code + tests | E2E/integration green |
| Business logic | 1.4 | M2 | the rule's function + README | one-sentence statement in README |
| ≥1 E2E/integration test in CI | 1.5 | M3 | Playwright/Vitest spec | **CI job green**, not local |
| CI pipeline | 1.6 | M1–M2 | `.github/workflows/ci.yml` | green badge on `main` |
| Workflow in git history | 2.A | M2 | phase commits | `git log --oneline` |
| Solo Code Review artefact | 2.B | M2 | `review.md` / PR comments | six-dimension scorecard present |
| Context managed | 2.C | M0/M1/M4 | lean `AGENTS.md` + `context/` | `/10x-rule-review` |
| Tests beyond minimum | 2.D | M3 | unit + E2E | deterministic, green in CI |
| Public deployment | 2.E | M1/Playbook A | live URL in README + auto-deploy | open URL; CI deploy step |
| Roadmap w/ milestones | 3.A | M2 | `context/foundation/roadmap.md` | MVP slice marked |
| Multi-agent / worktree / headless | 3.B | M5 | parallel branches / `claude -p` / pipeline | `git log --all`; workflow run |
| ≥3 lessons | 3.C | M2–M3 | `context/foundation/lessons.md` | rule → Why → How format |
| U-shaped AGENTS.md | 3.D | M1 | `AGENTS.md` | critical rules top & bottom |
| Demo-day readiness | 3.E | all | README + demo + screenshot | ≤3-min flow |

---

# Master artifact + commit checklist

**Files a reviewer looks for:**
- [ ] `context/foundation/prd.md`
- [ ] `AGENTS.md` (< 200 lines, U-shaped, ends with a "must NOT do" section)
- [ ] `context/foundation/tech-stack.md` 🌱 / `stack-assessment.md` + `health-check.md` 🏚️
- [ ] `context/foundation/infrastructure.md`
- [ ] `context/foundation/roadmap.md`
- [ ] `context/foundation/test-plan.md`
- [ ] `context/foundation/lessons.md` (≥3 lessons)
- [ ] `context/changes/<id>/plan.md` (+ `plan-brief.md`, `review.md`)
- [ ] `context/deployment/deploy-plan.md`
- [ ] `context/map/repo-map.md` (🏚️ / large projects)
- [ ] `.github/workflows/ci.yml` (+ `review.yml` for the M5 agent)
- [ ] `.claude/settings.json` (permissions + hooks)
- [ ] README: description, **live URL**, local setup, CI badge, ≥1 screenshot/GIF

**Conventions:**
- Project repo commits: `feat: [S-xx phase n] …`, `test: [S-xx] …` — one per plan phase.
- Vault note commits (this runbook etc.): `[LEARNING]: …` per the vault `AGENTS.md`.
- Pin GitHub Actions to `@<sha>`. Secrets in GitHub/Workers Secrets only.
- CI must be green on `main` before submission.

---

## Sources

**This runbook's two companions**
- [[Learning/10xDevs/10xDevs Course Completion Plan]] — Level 1/2/3 pass criteria
- [[Learning/10xDevs/Proces pracy z agentem w 10xDevs]] — consolidated process map

**Prework**
- [[1.1 Co potrafi AI w 2026 r. - 10xDevs 3.0 Prework]] · [[1.2 Chatbot vs Agent vs Harness — definicje - 10xDevs 3.0 Prework]] · [[1.3 Jak uczyć się i rozwijać z AI - 10xDevs 3.0 Prework]]
- [[2.1 Agent w IDE, Terminalu czy w Chmurze - 10xDevs 3.0 Prework]] · [[2.3 Claude Code — Podstawy operacyjne - 10xDevs 3.0 Prework]]
- [[3.2 Wzorce i antywzorce promptowania - 10xDevs 3.0 Prework]] · [[3.3 Cykl życia wątku i zarządzanie kontekstem - 10xDevs 3.0 Prework]] · [[3.5 Rekomendowane modele i jak być na bieżąco - 10xDevs 3.0 Prework]]
- [[4.1 Tech Stack Overview - 10xDevs 3.0 Prework]] · [[4.2 Dobry i zły projekt kursowy - 10xDevs 3.0 Prework]] · [[4.3 Checklista uczestnika i support (Circle) - 10xDevs 3.0 Prework]]

**Module 1**
- [[Od pomysłu do PRD Metoda Sokratejska z Agentem]] · [[Od chatbota do Agenta tech stack, skille i metaprompting]] · [[AI-Powered Bootstrap boilerplate i bezpieczna praca z Agentem]] · [[Agent Onboarding Agents.md, AI Rules i feedback loops]] · [[Shared AI Registry skille, komendy i reguły dla zespołu]]

**Module 2**
- [[Od roadmapy do kodu plan, review, implementacja]] · [[Roadmapa MVP milestony, zależności i priorytety]] · [[Od localhosta na produkcję]] · [[Solo Code Review weryfikuj kod AI szybko i skutecznie]] · [[Code Review w erze AI standardy, DoD i Agent w pipeline]]

**Module 3**
- [[Plan testów z AI quality gates, test-plan i priorytety]] · [[Od planu do testów implementacja unitów z Agentem]] · [[Testy E2E Playwright, MCP i multimodalne scenariusze]] · [[Hooki i triggery Agent, który sam reaguje na błędy]] · [[Debugowanie z AI od stack trace]]

**Module 4**
- [[Skalowanie kontekstu dla AI w dużych projektach]] · [[Agent w projekcie legacy - generowanie Mapy projektu]] · [[Refaktoryzacja z Agentem testy, zmiany, weryfikacja]] · [[Modernizacja legacy z DDD wydzielaj domeny, potem deleguj Agentowi]] · [[Analiza feature z AI co działa, co kuleje, co zmodernizować]]

**Module 5**
- [[Research i implementacja trudniejszy stream z AI]] · [[Innovate więcej ficzerów, mniej czekania z wieloma agentami]] · [[Innovate Async & Remote Agents - deleguj i zajmij się czymś innym]] · [[Twój pierwszy Agent zespołowy SDK, koszty, metryki]] · [[AI Internal Builders wewnętrzne narzędzia, serwisy i automatyzacje]]
