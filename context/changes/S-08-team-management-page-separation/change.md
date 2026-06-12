---
change_id: S-08-team-management-page-separation
title: Team management page separation
status: implemented
created: 2026-06-05
updated: 2026-06-12
archived_at: null
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

- Implemented the dedicated `/teams/[teamId]/manage` surface, management-aware redirects, owner-only member removal and team deletion flows, and soft-membership persistence for history-safe removals.
- Automated verification completed on 2026-06-11: `npm run lint`, `npm run build`, local `npx supabase db push --local`, and an HTTP 200 probe against `http://127.0.0.1:4321/`.
- Manual testing on 2026-06-12 confirmed the main management route and extraction work. The `create another team` RLS regression found during that sweep was fixed the same day.
- The invite email field whitespace issue was also fixed during the 2026-06-12 polish pass.
- Owner-only destructive flows still deserve one explicit final QA pass from the plan checklist.
