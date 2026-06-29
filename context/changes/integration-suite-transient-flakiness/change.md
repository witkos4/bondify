---
change_id: integration-suite-transient-flakiness
title: RLS integration suite has no resilience to transient local-Supabase gateway errors
status: implemented
created: 2026-06-29
updated: 2026-06-29
archived_at: null
---

## Notes

- Origin: CI run 28336727030 (push of `534973e`) failed on a single test,
  `tests/rls/harness.test.ts > "builds the standard two-team scenario through real RLS paths"`,
  at the `teams` insert with `An invalid response was received from the upstream server`
  (PostgREST/Kong gateway 502-class message).
- Framed with /10x-frame before planning a fix. See `frame.md`.
- Key finding: not a test/RLS bug — a transient gateway flake the integration
  suite cannot absorb because the fixtures have no retry and vitest runs the RLS
  files in parallel against one local stack.

## Verification — 2026-06-29

- Re-ran the failed CI run (`gh run rerun 28336727030 --failed`). Attempt 2
  passed (`success`) on **byte-identical code**: the previously failing
  "Run unit + integration tests" step and the full pipeline (incl. Playwright
  E2E) all went green. Confirms the transient-flake reframe — the suite is
  non-deterministic under load, not broken. Hardening (bounded retry on
  idempotent setup writes / bounded RLS-file concurrency) is still pending.
