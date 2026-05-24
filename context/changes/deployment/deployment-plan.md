# Bondify First Deployment Plan on Cloudflare Workers

## Summary

The first deployment should target **Cloudflare Workers**, not Cloudflare Pages. That follows from the current repository state: `astro.config.mjs` uses `@astrojs/cloudflare`, `wrangler.jsonc` defines a Worker, and the repo is already prepared for deployment through `wrangler`.
The chosen model is: **first deploy manually**, publish to **`*.workers.dev`**, and have the eventual **auto-deploy after pushes to `master`** handled by **Cloudflare**, not GitHub Actions.

## Prerequisites

### 1. Wrangler CLI setup

- `wrangler` must be available through the repository toolchain and usable from this repo via `npx wrangler ...`.
- The operator performing the first deploy must be able to authenticate successfully with `npx wrangler login`.
- The authenticated Wrangler session must point to the intended Cloudflare account, not a personal test account or a different client account.
- Before the first deploy, verify that:
  - `npm ci` succeeds locally
  - `npx astro sync` runs successfully
  - `npm run build` completes without runtime adapter errors
  - `npx wrangler whoami` or the equivalent account check confirms the expected Cloudflare identity
- Treat Wrangler as the source of truth for manual deployment operations, including:
  - secret upload
  - first production deployment
  - log inspection
  - rollback
- If the local machine cannot complete the full `build -> login -> deploy` flow, it is not ready to perform the first production rollout.

### 2. Cloudflare account and access

- A Cloudflare account must already exist and be the account that will own the Bondify production Worker.
- The operator must have sufficient permissions to:
  - create and update Workers
  - manage Worker secrets
  - inspect deployment history and logs
  - configure Git integration / Workers Builds for later automation
- The team should decide up front which Cloudflare account owns production. This should not be left ambiguous, because changing ownership later creates unnecessary migration and operational risk.
- Before the first deploy, confirm:
  - the account has Workers enabled
  - the account can serve a `workers.dev` deployment
  - the account has access to the GitHub repository that will later be connected for automatic deploys from `master`
- For this first deployment, the required Cloudflare outcome is:
  - one production Worker
  - one public `workers.dev` URL
  - a clear path to enable Cloudflare-managed auto-deploys after pushes to `master`
- Custom domains, Access policies, and other Cloudflare platform features are optional at this stage and should not block the first production release.

### 3. Supabase cloud project

- Production must use a real hosted Supabase project, not local Supabase started through Docker.
- This cloud Supabase project is the load-bearing production dependency for:
  - authentication
  - session handling
  - application data storage
  - any schema migrations required by the live app
- The team must have the correct production values for:
  - `SUPABASE_URL`
  - `SUPABASE_KEY`
- These values must come from the intended production Supabase project and must be tested as production credentials, not copied from local development setup.
- Before the first deploy, confirm that the cloud project is operational:
  - the project exists in Supabase Cloud
  - auth is enabled in the way the app expects
  - the required schema and migrations have been applied, if the live app depends on them
  - the team knows which Supabase environment is production versus any staging or personal test projects
- The deployment plan should treat local Supabase and production Supabase as fundamentally different concerns:
  - local Supabase is a developer convenience
  - the hosted Supabase project is a production system dependency
- If the cloud Supabase project is missing, misconfigured, or using the wrong credentials, the app may deploy successfully but still fail in production. That makes Supabase readiness more important than local Docker readiness for this rollout.

### 4. Production secret ownership

- The team must explicitly know who is responsible for:
  - writing Cloudflare Worker secrets
  - rotating those secrets later
  - owning the Supabase production project
  - approving production credential changes
- These responsibilities matter during the first rollout because several critical steps are still manual:
  - adding runtime secrets to Cloudflare
  - validating the correct production Supabase credentials
  - recovering from a broken deploy caused by bad configuration
- At minimum, the team should define:
  - who can perform the first production deploy
  - who can update `SUPABASE_URL` and `SUPABASE_KEY`
  - who can verify that the production Supabase project is the right one
  - who approves rollback if production authentication or data access fails
- Secret ownership should be documented in practical terms, even if the team is currently one person, so there is no ambiguity later when automation or collaborators are added.
- The first deployment should not proceed until secret ownership is clear, because configuration mistakes in Cloudflare or Supabase are one of the most likely ways to ship a broken production release.

## Key Changes and Decisions

### 1. Standardize the source of truth for deployment

- Adopt `Cloudflare Workers` as the only supported deployment target.
- Update documents that still refer to `Cloudflare Pages`, especially `context/foundation/tech-stack.md` and `README.md`.
- Document that:
  - the build and deploy runtime is Workers
  - automatic production deployments are triggered by **Cloudflare Git integration / Workers Builds**
  - GitHub Actions remains responsible only for **CI validation** (`lint`, `build`), not releases

### 2. Minimal production configuration

- Confirm the application name in `wrangler.jsonc` and decide whether to keep the starter name `10x-astro-starter` or rename it to `bondify` before the first deploy.
- Prepare two sets of secrets:
  - GitHub Actions: `SUPABASE_URL`, `SUPABASE_KEY` for CI builds only
  - Cloudflare Worker/Build environment: `SUPABASE_URL`, `SUPABASE_KEY` for runtime and deployments
- Do not introduce additional application environments in v1; the first rollout should cover:
  - local development via `.env` / `.dev.vars`
  - production on `workers.dev`
- Do not connect a custom domain in this deployment.

### 3. First manual deploy

- Run the deployment sequence:
  1. `npm ci`
  2. `npx astro sync`
  3. `npm run lint`
  4. `npm run build`
  5. `npx wrangler login`
  6. `npx wrangler secret put SUPABASE_URL`
  7. `npx wrangler secret put SUPABASE_KEY`
  8. `npx wrangler deploy`
- Treat the resulting `workers.dev` URL as the first public production address.
- Do not couple the first deploy with high-risk Supabase migrations; if migrations are required, ship them as a separate explicit step with a rollback plan.

### 4. Post-deploy verification

- Define a production smoke test for SSR and auth:
  - the homepage renders correctly
  - `/auth/signin` works
  - sign-in creates a session cookie
  - `/dashboard` protection works for unauthenticated users
  - sign-out clears the session
- Inspect logs via `npx wrangler tail`.
- Document a simple code rollback procedure:
  - CLI path: `npx wrangler rollback`
  - dashboard path: Workers Deployments
- Explicitly note that **code can be rolled back, but Supabase schema/data do not roll back automatically**.

### 5. Target state after the first deployment

- Connect the repository to **Cloudflare Workers Builds / Git integration**.
- Configure the rule:
  - `master` => automatic production deploy
  - optionally PR/feature branches => preview deploys, if you want to enable them later
- GitHub Actions should continue to run only:
  - `npm ci`
  - `npx astro sync`
  - `npm run lint`
  - `npm run build`
- Do not add a deploy step to the GitHub Actions workflow.
- Document in the repo that release ownership sits with Cloudflare: build triggers, deploy history, and promotion path are managed there.

## Public Interfaces and Configuration

- `wrangler.jsonc`: final Worker name, runtime, and assets binding.
- Cloudflare project settings: repository connection, production branch `master`, and environment variables/secrets for build and runtime.
- GitHub Actions: keep the existing CI workflow with no publish steps.
- Repository documentation: update README / foundation docs so there is no remaining Workers vs Pages or GitHub Actions vs Cloudflare deployment ownership conflict.

## Test Plan

- Build passes locally and in CI with the required secrets set.
- Manual deployment to `workers.dev` completes successfully.
- The SSR/auth smoke test passes on the deployed URL.
- `wrangler tail` shows valid request logs and no environment-related errors.
- A trial code rollback is documented and can be executed without extra decisions.
- After the repo is connected in Cloudflare, a push to `master` triggers a new deploy without GitHub Actions handling release execution.

## Assumptions

- The first deployment means a **public production release on `workers.dev`**, without a custom domain.
- The first deploy is manual, but the target state of this initiative is **auto-deploy on push to `master` managed by Cloudflare**.
- GitHub Actions remains a CI tool, not a CD tool.
- This step does not introduce additional Cloudflare services such as KV, D1, R2, Queues, or Durable Objects.
- Application secrets are currently limited to `SUPABASE_URL` and `SUPABASE_KEY`, based on the current state of the repo.
