---
project: Bondify
assessed_at: 2026-06-05T00:05:37.9830973+02:00
agent_readiness: ready-with-compensation
context_type: brownfield
stack_components:
  language: TypeScript
  framework: Astro 6 SSR with React 19 islands
  build_tool: Astro + Vite
  test_runner: null
  package_manager: npm
  ci_provider: GitHub Actions
  deployment_target: Cloudflare Workers
gates_passed: 3
gates_failed: 1
---

## Stack Components

**Language:** The project uses TypeScript, evidenced by [tsconfig.json](/D:/REPOS/bondify/tsconfig.json) extending `astro/tsconfigs/strict` and by the TypeScript toolchain in [package.json](/D:/REPOS/bondify/package.json). This is a strong base for agent workflows because contracts are visible in source and the repo already enforces type-aware linting through [eslint.config.js](/D:/REPOS/bondify/eslint.config.js).

**Framework:** The application is an Astro 6 SSR app with React 19 islands and Tailwind 4, evidenced by [astro.config.mjs](/D:/REPOS/bondify/astro.config.mjs), [astro.local.config.mjs](/D:/REPOS/bondify/astro.local.config.mjs), and the dependency set in [package.json](/D:/REPOS/bondify/package.json). Astro gives the project file-based routing and a convention-heavy structure that is already reinforced by [AGENTS.md](/D:/REPOS/bondify/AGENTS.md) and [.github/copilot-instructions.md](/D:/REPOS/bondify/.github/copilot-instructions.md).

**Build tool:** The repo builds through Astro on top of Vite, with standard scripts in [package.json](/D:/REPOS/bondify/package.json) and the Tailwind Vite plugin in [astro.config.mjs](/D:/REPOS/bondify/astro.config.mjs). Vite by itself is relatively minimal, but in this project its ambiguity is reduced by Astro's conventions and the documented repo rules in [AGENTS.md](/D:/REPOS/bondify/AGENTS.md).

**Test runner:** No test runner is detected. There is no `test` script in [package.json](/D:/REPOS/bondify/package.json), and no Vitest, Jest, Playwright, or Cypress config file was found at the repo root during inspection. This is the main stack gap for agent workflows because the assistant has no fast verification loop beyond lint/build/manual checks.

**Package manager / CI / deployment:** The repo uses `npm` via [package-lock.json](/D:/REPOS/bondify/package-lock.json), GitHub Actions via [.github/workflows/ci.yml](/D:/REPOS/bondify/.github/workflows/ci.yml), and Cloudflare Workers via [wrangler.jsonc](/D:/REPOS/bondify/wrangler.jsonc).

## Quality Gate Assessment

| Component   | Typed | Convention | Training Data | Documented | Verdict |
|-------------|-------|------------|---------------|------------|---------|
| Language    | ✓     | —          | —             | —          | pass    |
| Framework   | —     | ✓          | ✓             | ✓          | pass    |
| Build tool  | —     | ~          | ✓             | ✓          | pass    |
| Test runner | —     | —          | ✗             | ✗          | fail    |

Legend: `✓` = pass, `✗` = fail, `~` = partial, `—` = not applicable

### Gate Details

**Type safety**

- **Pass (language):** [tsconfig.json](/D:/REPOS/bondify/tsconfig.json) extends `astro/tsconfigs/strict`, which is strong evidence of explicit type discipline. [eslint.config.js](/D:/REPOS/bondify/eslint.config.js) also enables `typescript-eslint` strict type-checked rules.

**Convention strength**

- **Pass (framework):** [astro.config.mjs](/D:/REPOS/bondify/astro.config.mjs) plus the Astro file-based app structure and the conventions documented in [AGENTS.md](/D:/REPOS/bondify/AGENTS.md) make the framework layer predictable to navigate.
- **Partial pass (build tool):** Vite itself is not highly opinionated, but in this repo it sits beneath Astro and is therefore constrained by Astro's conventions and repo-level guidance in [AGENTS.md](/D:/REPOS/bondify/AGENTS.md).

**Popularity in training data**

- **Pass (framework/build tool):** Astro, React, Tailwind, Vite, and npm are all mainstream choices within the JS/TS ecosystem and should be well represented in model training data.
- **Fail (test runner):** no runner is present, so the repo provides no standardized verification tool for the agent to learn and reuse.

**Documentation quality**

- **Pass (framework/build tool):** Astro, React, Tailwind, Vite, npm, and GitHub Actions all have current, versioned official docs. The repo also adds local documentation through [AGENTS.md](/D:/REPOS/bondify/AGENTS.md) and [.github/copilot-instructions.md](/D:/REPOS/bondify/.github/copilot-instructions.md).
- **Fail (test runner):** no local test framework or documented testing workflow exists, so the agent has no project-specific testing guidance to rely on.

## Gaps & Compensation

### Missing automated test runner

The main gap is not the core stack choice; it is the lack of a reusable automated test runner. Without one, the assistant can lint and build the project, but it cannot quickly verify behavior changes, regressions, or critical user flows in a repeatable way.

**Why this matters for agent workflows**

- behavior changes are harder to verify safely
- regression confidence is low for refactors and UI/flow changes
- the repo depends more heavily on manual verification discipline than on executable checks

**Compensation strategy**

- document a strict manual verification loop in the instruction files
- require `npm run lint` and `npm run build` for every change
- require a task-specific manual verification checklist for behavior changes until a test runner is introduced
- prefer adding a lightweight runner such as Vitest or Playwright before larger flow rewrites

### Build-tool convention relies on repo guidance

The Astro + Vite layer is workable, but the clarity comes partly from repo documentation rather than from the build tool alone. That is acceptable, but it means the instruction files remain load-bearing.

**Why this matters for agent workflows**

- if instruction files drift, navigation and change placement become less predictable
- new contributors or agents will lean heavily on the written conventions

**Compensation strategy**

- keep AGENTS/Copilot guidance aligned with actual folder usage
- add explicit verification notes for where interactive behavior belongs versus static Astro rendering

### Recommended Instruction File Additions

Paste-ready additions for [AGENTS.md](/D:/REPOS/bondify/AGENTS.md) or [CLAUDE.md](/D:/REPOS/bondify/CLAUDE.md):

```md
## Verification Loop

- This repo currently has no automated test runner. For every change, run `npm run lint` and `npm run build`.
- For any behavior-changing work, record a manual verification checklist tied to the touched flow (for example: login redirect, team switch, reveal flow, history flow) and complete it before considering the task done.
- Prefer adding executable tests before large refactors or high-risk game-flow changes.
```

```md
## Astro And React Boundaries

- Keep static page structure and routing in Astro files.
- Use React components only for clearly interactive islands.
- When changing a feature, preserve that split unless the task explicitly requires moving the boundary.
```

## Summary

Bondify's stack is broadly agent-friendly. Type safety is strong, the framework is convention-based, the ecosystem is mainstream, and the repo already includes meaningful instruction files. The main readiness gap is operational rather than architectural: there is no automated test runner, so agents need a stricter manual verification loop until one is introduced.

Overall verdict: `ready-with-compensation`. The current stack is a good fit for agent work, but the project should document and enforce its verification loop more explicitly, and ideally add a test runner before larger gameplay or routing revisions.
