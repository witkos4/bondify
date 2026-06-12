---
change_id: S-08-team-management-page-separation
title: Team management page separation
status: implemented
created: 2026-06-05
updated: 2026-06-13
archived_at: null
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

- Implemented the dedicated `/teams/[teamId]/manage` surface, management-aware redirects, owner-only member removal and team deletion flows, and soft-membership persistence for history-safe removals.
- Automated verification completed on 2026-06-11: `npm run lint`, `npm run build`, local `npx supabase db push --local`, and an HTTP 200 probe against `http://127.0.0.1:4321/`.
- Manual testing on 2026-06-12 confirmed the main management route and extraction work. The `create another team` RLS regression found during that sweep was fixed the same day.
- The invite email field whitespace issue was also fixed during the 2026-06-12 polish pass.
- A 2026-06-13 closure pass completed the remaining management QA, including no-membership redirect, management-surface invite/create/accept flows, non-owner denial, owner remove-member, and owner delete-team redirect behavior.
- That same pass exposed one genuine database bug in the owner remove-member RPC (`team_id` ambiguity); it is now fixed locally via `20260613093000_fix_remove_team_member_rpc_ambiguity.sql`.
