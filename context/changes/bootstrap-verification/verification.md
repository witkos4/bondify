---
bootstrapped_at: 2026-05-24T00:54:34Z
starter_id: 10x-astro-starter
starter_name: 10x Astro Starter (Astro + Supabase + Cloudflare)
project_name: bondify
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: npm audit --json
---

## Hand-off

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: bondify
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
```

### Why this stack

Bondify is a web app with auth, a short three-week after-hours MVP window, and a medium initial scale, which favors a mainstream, opinionated starter that reduces assembly work. 10x Astro Starter is the vetted JavaScript default for this shape and keeps auth, database, and deployment aligned in one stack rather than making you stitch together separate choices before shipping. Cloudflare Pages is the starter's default deployment path, GitHub Actions fits the repository workflow cleanly, and auto-deploy on merge keeps the delivery loop short. Scaffolding support is first-class rather than fully verified, so the setup should be mostly smooth with occasional manual adjustments.

## Pre-scaffold verification

| Signal      | Value     | Severity | Notes |
| ----------- | --------- | -------- | ----- |
| npm package | not run   | n/a      | `cmd_template` starts with `git clone`, so no `create-*` npm package was derived |
| GitHub repo | not run   | n/a      | `gh` unavailable: `/usr/bin/bash: line 1: gh: command not found` |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 0
**Files moved**: 31521
**Conflicts (.scaffold siblings)**: `README.md`
**.gitignore handling**: append-merged
**.bootstrap-scaffold cleanup**: deleted

## Post-scaffold audit

**Tool**: `npm audit --json`
**Summary**: 0 CRITICAL, 1 HIGH, 9 MODERATE, 0 LOW
**Direct vs transitive**: 0/0/2/0 direct of total 0/1/9/0

#### CRITICAL findings

None.

#### HIGH findings

- `devalue` - affected range `5.6.3 - 5.8.0`; advisory `GHSA-77vg-94rm-hx3p`; Svelte devalue DoS via sparse array deserialization; fix available.

#### MODERATE findings

- `@astrojs/check` - direct dependency; affected via `@astrojs/language-server`; fix available by changing `@astrojs/check` to `0.9.2` (semver-major).
- `@astrojs/language-server` - transitive dependency; affected via `volar-service-yaml`; fix available through `@astrojs/check` `0.9.2`.
- `@cloudflare/vite-plugin` - transitive dependency; affected via `miniflare`, `wrangler`, and `ws`; fix available.
- `miniflare` - transitive dependency; affected via `ws`; fix available.
- `volar-service-yaml` - transitive dependency; affected via `yaml-language-server`; fix available through `@astrojs/check` `0.9.2`.
- `wrangler` - direct dependency; affected via `miniflare`; fix available.
- `ws` - transitive dependency; advisory `GHSA-58qx-3vcg-4xpx`; uninitialized memory disclosure; fix available.
- `yaml` - transitive dependency; advisory `GHSA-48c2-rrv3-qjmp`; stack overflow via deeply nested YAML collections; fix available through `@astrojs/check` `0.9.2`.
- `yaml-language-server` - transitive dependency; affected via `yaml`; fix available through `@astrojs/check` `0.9.2`.

#### LOW / INFO findings

None.

## Hints recorded but not acted on

| Hint | Value |
| ---- | ----- |
| bootstrapper_confidence | first-class |
| quality_override | false |
| path_taken | standard |
| self_check_answers | null |
| team_size | solo |
| deployment_target | cloudflare-pages |
| ci_provider | github-actions |
| ci_default_flow | auto-deploy-on-merge |
| has_auth | true |
| has_payments | false |
| has_realtime | false |
| has_ai | false |
| has_background_jobs | false |

## Next steps

Next: a future skill will set up agent context (`CLAUDE.md`, `AGENTS.md`). For now, your project is scaffolded and verified - happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep.
- Address audit findings per your project's risk tolerance - the full breakdown is in this log.
