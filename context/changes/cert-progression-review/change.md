---
change_id: cert-progression-review
title: Certification progression review and gap closure plan
status: implementing
created: 2026-06-27
updated: 2026-06-27
archived_at: null
---

## Notes

- Framing exercise: map current project state against the checkup.md certification gate matrix.
- Target: Level 3 + 10xChampion badge. Submission deadline 2026-07-05.
- See frame.md for the complete gap analysis and prioritized action list.
- Phase 0 runtime credential finding: ongoing deploys are documented as Cloudflare Workers Builds / Git integration, not a GitHub deploy job. `SUPABASE_URL` and `SUPABASE_KEY` therefore belong in Cloudflare Workers runtime/build environment settings; the GitHub Actions `ci.yml` build env only references optional build-time secrets and is not the production runtime source.
- Phase 2 CI review prerequisites: set `ANTHROPIC_API_KEY` as a GitHub Actions secret before running the `AI Code Review` workflow on a labeled PR. For promptfoo regression checks, provide `OPENROUTER_API_KEY` locally/CI before `npx promptfoo eval`; leave `PROMPTFOO_PASS_RATE_THRESHOLD` unset for the default all-tests-must-pass gate unless a noisy eval set is intentionally being triaged.
