# Remaining Manual Checks

Use this checklist for the items Codex cannot verify without Cloudflare dashboard access or real API keys. Do not paste secret values into chat or commit them to the repo.

## Cloudflare Workers Builds

1. Open `https://dash.cloudflare.com/` and choose the account that owns `witkos4.workers.dev`.
2. In the left navigation, open **Workers & Pages**.
3. Open the worker/project named **bondify**.
4. Open **Settings** and look for **Builds**, **Builds & deployments**, or **Git integration**.
5. Confirm the connected GitHub repo is `witkos4/bondify`.
6. Confirm the production branch is `main`, not `master`.
7. Open the project's **Deployments** tab.
8. Confirm there is a successful production deployment from branch `main` after the latest main-branch push.

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
5. Add a repository secret named `ANTHROPIC_API_KEY`.
6. Do not add quotes around the value.
7. Tell Codex when it is added; Codex can then create/use a demo PR, add the `ai-cr:review` label, and verify the review workflow.

## OpenRouter Key For Promptfoo

1. Provide `OPENROUTER_API_KEY` only as a local environment variable or CI secret.
2. Do not write it to `.env`, `.dev.vars`, or any tracked file.
3. After it is available to the current shell/session, tell Codex to run `npx promptfoo eval`.
