# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Treat Supabase Seed Data Separately From Schema Migrations

- **Context**: Post-deploy verification and debugging for Bondify features that depend on reference data in Supabase tables, especially `public.game_templates`.
- **Problem**: The remote database schema can be fully up to date while the product still appears broken because required seed data was never pushed. In this chat, the dashboard showed "No game templates are available yet" even after migrations were current, because the hosted `game_templates` table was empty.
- **Rule**: When a Supabase-backed feature depends on reference rows, verify seed data separately from schema migrations. If schema matches but the UI shows missing catalog/template data, check whether the linked remote database needs `supabase/seed.sql` applied.

## Default To Local Verification After User-Facing Auth And Shell Changes

- **Context**: Local verification for the authenticated member shell work in `S-06`, including redirects, dashboard entry, Docker/Supabase recovery after a reboot, and manual confirmation of browser-visible behavior.
- **Problem**: Without an explicit prompt, an agent might stop after code changes or terminal checks and leave user-facing regressions undiscovered, especially when localhost failures are caused by the environment rather than the code.
- **Rule**: After user-facing auth, dashboard, routing, or shell/navigation changes, default to local verification before declaring the work done. Prefer browser-level verification when browser tooling is available; otherwise use HTTP probes plus a focused manual checklist. If localhost appears broken, check the app server, Docker Desktop, WSL2/virtualization, and local Supabase services before assuming the implementation itself is broken.

## CI Configured Is Not CI Running

- **Context**: Certification gap review for Bondify found a registered GitHub Actions workflow that had never executed because it still targeted `master` while the repository default branch was `main`.
- **Problem**: A workflow file can look complete in the repo but provide zero certification or regression value if its trigger branch does not match reality. The stale trigger blocked CI, test-in-CI, and deploy evidence even though the YAML existed.
- **Rule**: Verify CI by checking actual runs on the default branch, not by the presence of `.github/workflows/*.yml`. Use `gh run list --branch <default>` or the Actions API run count to prove the workflow fires, then inspect the latest run's conclusion and job steps.

## Mirror Production Calls In Prompt Evals

- **Context**: Promptfoo and other LLM regression gates for CI review prompts or any structured LLM output contract.
- **Problem**: The eval can fail for reasons the production path does not share, or pass while testing a different behavior. In the OpenRouter review gate, promptfoo originally used an `llm-rubric` assertion that required a separate OpenAI grader key and exposed OpenRouter reasoning as a `Thinking:` prefix before JSON, while the production script used deterministic JSON parsing and a strict system prompt.
- **Rule**: Keep prompt regression gates wired to the same prompt, provider/model, system prompt, output-shaping settings, and parser semantics as production. For structured JSON outputs, prefer deterministic assertions over a second LLM grader unless the grader provider, model, and key are deliberately configured.
