# GitHub Copilot Instructions

Use [AGENTS.md](../AGENTS.md) as the canonical repository guide for this project.

Key points to follow on every task:

- This is an Astro 6 SSR app with React 19 islands, Tailwind 4, Supabase auth, and shadcn/ui components deployed to Cloudflare Workers.
- Prefer Astro components for static content and React components only when interactivity is needed.
- Use the `@/*` path alias for imports from `src/*`.
- Use the `cn()` helper from `@/lib/utils` for class merging instead of manual string concatenation.
- API routes should use uppercase method exports like `GET` and `POST`, and request data should be validated with zod.
- Shared services and helpers belong in `src/lib/`, hooks in `src/components/hooks/`, and shared types in `src/types.ts`.
- Keep Supabase migrations in `supabase/migrations/` using the `YYYYMMDDHHmmss_short_description.sql` naming format, and always enable RLS with granular policies on new tables.
- Do not add Next.js-specific directives such as `"use client"`.

Before suggesting or making changes, prefer the repo commands documented in `AGENTS.md`, especially:

- `npm run lint`
- `npm run build`
- `npm run format`
