# Remaining Manual Checks

Use this checklist for the items Codex cannot verify without Cloudflare dashboard access or real API keys. Do not paste secret values into chat or commit them to the repo.

## Cloudflare Workers Builds

You already confirmed the watch branch is `main`. The remaining Cloudflare Builds check is the deployment record.

1. Open `https://dash.cloudflare.com/` and choose the account that owns `witkos4.workers.dev`.
2. In the left navigation, open **Workers & Pages**.
3. Open the worker/project named **bondify**.
4. Open the project's **Deployments** tab.
5. Confirm there is a successful production deployment from branch `main` after the latest main-branch push.

## Cloudflare Runtime Secrets

1. In the same **bondify** Worker/project, open **Settings**.
2. Open **Variables and Secrets**.
3. Check the production runtime variables/secrets, not only build-time variables.
4. Confirm these names exist:
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
5. If either is missing, add it as an encrypted secret or protected variable using the hosted Supabase project values.
6. Save/deploy if Cloudflare asks for a redeploy after changing variables.

## GitHub Secret For AI Review

1. Open `https://github.com/witkos4/bondify`.
2. Open **Settings**.
3. Open **Secrets and variables**.
4. Open **Actions**.
5. Open the **Secrets** tab, then check **Repository secrets**.
6. Add a repository secret named `OPENROUTER_API_KEY`.
7. Do not add quotes around the value.
8. Tell Codex when it is added; Codex can then create/use a demo PR, add the `ai-cr:review` label, and verify the review workflow.

## Optional GitHub Supabase Secrets

These are the place to check whether a GitHub repo has a base URL and Supabase key. For this project they are optional build-time values; production runtime credentials belong in Cloudflare.

1. Open `https://github.com/witkos4/bondify`.
2. Open **Settings**.
3. Open **Secrets and variables**.
4. Open **Actions**.
5. Open the **Secrets** tab, then check **Repository secrets**.
6. Look for:
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
7. If they are absent, that is OK for current CI because the local Supabase stack provides test credentials. Add them only if you intentionally want the GitHub build step to receive hosted Supabase values.

## OpenRouter Key For Promptfoo

1. Use the same `OPENROUTER_API_KEY` as a local environment variable or GitHub Actions secret.
2. Do not write it to `.env`, `.dev.vars`, or any tracked file.
3. After it is available to the current shell/session, tell Codex to run `npx promptfoo eval`.
