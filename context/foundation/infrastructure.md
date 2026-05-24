---
project: bondify
researched_at: 2026-05-24T19:56:54+02:00
recommended_platform: Cloudflare Workers
runner_up: Netlify
context_type: mvp
tech_stack:
  language: JavaScript/TypeScript
  framework: Astro 6 SSR + React islands
  runtime: Cloudflare Workers via @astrojs/cloudflare 13.5.4
---

## Recommendation

**Deploy on Cloudflare Workers.**

This repo already targets Cloudflare at the adapter, config, and tooling level (`astro` 6.3.7, `@astrojs/cloudflare` 13.5.4, `wrangler` 4.90.0, and `wrangler.jsonc`), so it is the lowest-friction path to production. Your answers reinforce that fit: no persistent-process requirement, single-region is fine, external services are fine, and cost and DX are roughly balanced.

In short: this is the option that lets Bondify ship fastest with the least platform churn.

## Platform Comparison

This comparison favors delivery speed and low operational overhead for the current repo, not theoretical platform headroom.

| Platform           | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP / Integration | Total |
| ------------------ | --------- | ------------------ | ------------------- | ----------------- | ----------------- | ----- |
| Cloudflare Workers | Pass      | Pass               | Pass                | Pass              | Pass              | 5.0   |
| Netlify            | Pass      | Pass               | Pass                | Partial           | Pass              | 4.5   |
| Railway            | Pass      | Partial            | Pass                | Partial           | Pass              | 4.0   |
| Vercel             | Pass      | Pass               | Pass                | Pass              | Pass              | 4.0   |
| Render             | Pass      | Partial            | Pass                | Partial           | Partial           | 3.5   |
| Fly.io             | Pass      | Partial            | Partial             | Partial           | Pass              | 3.0   |

Cloudflare Workers scored highest because it matches the current codebase without an adapter swap. Astro supports SSR on Workers directly, Cloudflare's CLI workflow is strong (`wrangler deploy`, `wrangler rollback`, `wrangler tail`), and pricing stays MVP-friendly at low traffic. The main caveat is stale documentation: Astro 6 favors Workers, while older Pages tutorials can still mislead setup work.

Netlify scored second because it has strong Astro support, readable docs, an official MCP story, and friendly MVP pricing. It lost to Cloudflare because this repo is not already pointed at Netlify, rollback is more UI-centered, and the runtime assumptions are less aligned with the current setup.

Railway scored third because it offers strong DX, good docs, solid logs, and simple co-located services if the project later wants them. It ranks below Netlify because this Astro app would need a Node adapter path and its pricing is shaped more by always-on uptime than request volume.

Vercel remains a strong general-purpose option with one of the best docs and MCP stories, but it still requires a platform migration and the Hobby plan is not a clean long-term commercial answer. Render is practical if you want a conventional Node web service, but it adds more service-style operational surface area than this MVP needs. Fly.io is powerful, especially for persistent workloads, but that flexibility brings extra operational judgment that this project does not need yet.

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Cloudflare wins because Bondify already ships with the adapter and Wrangler setup it needs. It offers a solid preview, deploy, and logging workflow, strong agent-readable docs, and a cost floor low enough that the team does not need to overthink traffic economics at 10k-100k monthly requests.

#### 2. Netlify

Netlify is the best alternate if the team wants a more familiar JAMstack-style workflow with strong Astro support and polished docs/MCP support. It lands just behind Cloudflare because it still requires a deployment-target change and less directly matches the current repo assumptions.

#### 3. Railway

Railway is the best alternate if the team later wants a more traditional service/container model with easy logs and built-in databases. It ranks third because that would move the project off its current Cloudflare runtime and add migration work that is hard to justify for this MVP.

## Anti-Bias Cross-Check: Cloudflare Workers

This section exists to pressure-test the recommendation, not overturn it unless the hidden costs outweigh the migration savings.

### Devil's Advocate - Weaknesses

1. Astro 6 expects a Workers-first deployment path, so following stale Cloudflare Pages tutorials can produce broken or misleading setup steps.
2. `nodejs_compat` helps, but some npm packages still assume fuller Node behavior and can fail only after deployment.
3. Local development with `astro dev` is convenient, but it does not guarantee every production runtime edge case will appear before deploy.
4. Rollback is strong for code versions, but it does not roll back Supabase schema or data changes, so incidents can span code and database layers.
5. Cloudflare exposes many adjacent primitives, which makes it easy to over-engineer an MVP if the team starts adopting platform features without a clear need.

### Pre-Mortem - How This Could Fail

The team chose Cloudflare because it looked like the path of least resistance, but they never fully aligned on what that meant in practice. Some contributors kept thinking in terms of Cloudflare Pages, others in terms of Workers, and deployment knowledge became a mix of old tutorials and current docs. During implementation, a dependency that behaved fine in local development relied on Node behavior that Workers only partially supports, and the problem did not become obvious until production traffic exercised the failing path. At the same time, releases included Supabase schema changes, so when the team rolled back application code, the incident was only half-fixed because the data layer had already moved on. Logs existed, but there was no routine for checking preview URLs, validating secrets, or rehearsing rollback. After several stressful deploys, the team concluded the platform was the issue, when the deeper problem was that they treated a runtime-specific target as interchangeable with generic Node hosting and never put guardrails around compatibility, previews, and migration discipline.

The takeaway is simple: Cloudflare is a good fit here, but only if the team treats it as a specific runtime with specific guardrails.

### Unknown Unknowns

- Astro 6's Cloudflare deployment story is version-sensitive; older Pages examples can be actively wrong for this repo.
- `wrangler` evolves quickly, so blog-post commands may not match `wrangler` 4.90.0 behavior.
- Secret handling differs between local `.dev.vars`, CI-provided env, and deployed Worker secrets, and auth failures can look like platform bugs when they are actually secret-propagation bugs.
- Supabase SSR cookie handling depends on request headers and runtime behavior, so some auth issues may surface only in preview or production.
- Real-time logs can sample under high traffic, which means incident debugging should not rely only on `wrangler tail` if volume grows.

## Operational Story

What day-to-day deployment actually looks like on the recommended platform:

- **Preview deploys**: Connect the repo in Cloudflare Workers Builds for automatic preview versions and preview URLs on push, or use a non-production upload flow such as `npx wrangler versions upload`; preview URLs exist per version and should be protected with Cloudflare Access if they expose real auth flows.
- **Secrets**: Store production secrets as Worker secrets with `npx wrangler secret put SUPABASE_URL`, `npx wrangler secret put SUPABASE_KEY`, and the OpenRouter key equivalent; use local `.dev.vars` or `.env` for local-only development, and treat secret rotation as a deliberate human-owned action because dashboard values are hidden after write.
- **Rollback**: Use `npx wrangler rollback` or the Workers dashboard Deployments view to promote a prior version; code rollback is typically immediate, but database changes in Supabase do not roll back automatically and must be handled separately.
- **Approval**: An agent can safely build, upload preview versions, and inspect logs read-only; a human should approve production promotion, primary secret rotation, and any irreversible data changes such as Supabase migrations or destructive storage changes.
- **Logs**: Use `npx wrangler tail` for near-real-time runtime logs and the Workers dashboard Logs tab for live inspection; if traffic rises, add persisted Workers Logs or Logpush because tail output can sample and does not serve as durable history.

## Risk Register

| Risk                                                                                 | Source           | Likelihood | Impact | Mitigation                                                                                                                                                                            |
| ------------------------------------------------------------------------------------ | ---------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Team follows outdated Cloudflare Pages setup instead of the current Workers workflow | Research finding | M          | H      | Standardize on `@astrojs/cloudflare` + `wrangler.jsonc` as the only supported deploy path and link the current Astro Cloudflare adapter docs in the repo guide.                       |
| A dependency relies on unsupported or partial Node APIs in Workers                   | Devil's advocate | M          | H      | Validate all new server-side packages against Workers compatibility before adopting them, and add a preview smoke test for auth and API routes before production deploys.             |
| Local development hides a runtime-specific production issue                          | Devil's advocate | M          | M      | Require preview deployment verification for auth, cookies, and server-rendered routes before merge or production promotion.                                                           |
| Code rollback succeeds but Supabase schema state remains broken                      | Devil's advocate | H          | H      | Separate schema migrations from risky feature deploys, document rollback steps for Supabase, and avoid coupling destructive migrations with the same release as auth/session changes. |
| Platform primitives get adopted too early and expand scope                           | Devil's advocate | M          | M      | Keep MVP infrastructure limited to Cloudflare Worker runtime plus external Supabase/OpenRouter unless a concrete bottleneck justifies KV, D1, R2, Durable Objects, or Queues.         |
| Secret handling differs across local, preview, and production environments           | Unknown unknowns | M          | H      | Define one secrets checklist covering `.dev.vars`, CI variables, and Worker secrets, then test sign-in on every new environment before broader use.                                   |
| `wrangler` and Astro adapter changes invalidate copied setup commands                | Unknown unknowns | M          | M      | Pin deployment instructions to the versions in `package.json`, and refresh the deploy playbook whenever `wrangler`, `astro`, or `@astrojs/cloudflare` is upgraded.                    |
| Logs are incomplete during higher traffic because live tailing can sample            | Unknown unknowns | L          | M      | Enable persisted Workers Logs or Logpush once traffic or incident frequency makes ad hoc tailing insufficient.                                                                        |
| Incident recovery is slow because preview/rollback procedures were never rehearsed   | Pre-mortem       | M          | H      | Do one dry run covering preview deploy, secret validation, and rollback before the first public launch.                                                                               |

## Getting Started

These are the minimum next steps to get Bondify deployable without changing its current runtime model.

1. Log in to Cloudflare for this machine with `npx wrangler login` and verify the project name in `wrangler.jsonc` matches the Worker you will create in the dashboard.
2. Keep the current Astro runtime path: use `npm run build` to produce the Worker-ready output for `@astrojs/cloudflare` 13.5.4 instead of switching to a Node adapter.
3. Add production secrets with `npx wrangler secret put SUPABASE_URL`, `npx wrangler secret put SUPABASE_KEY`, and your OpenRouter API key; keep local development secrets in `.dev.vars` or `.env`, not in `wrangler.jsonc`.
4. Create a preview/prod deployment loop using either Cloudflare Workers Builds connected to GitHub or direct CLI deploys with `npx wrangler deploy`, then confirm auth and SSR routes on the preview URL before production use.
5. Verify observability before launch with `npx wrangler tail`, and document one rollback command path (`npx wrangler rollback`) plus one dashboard rollback path for the team.

## Out of Scope

The following were not evaluated in this research:

- Docker image configuration
- CI/CD pipeline setup
- Production-scale architecture (multi-region, HA, DR)
