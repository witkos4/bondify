---
change_id: cert-ci-test-gate
title: Wire integration test suite into CI (test-plan Phase 4)
status: superseded
created: 2026-06-27
updated: 2026-06-27
archived_at: null
---

## Notes

- Corresponds to test-plan.md §3 Phase 4: "Quality gates and environment parity".
- Closes Level 1.5 (≥1 integration test green in CI) and Level 2.D (tests beyond minimum).
- Cert submission deadline: 2026-07-05.
- The test suite (Phase 1 of testing-foundation-access-control) is already complete locally.
  This change only touches .github/workflows/ci.yml.
- Superseded by `context/changes/cert-progression-review/`, which first fixed the dead
  `master` branch trigger and then folded this CI test gate into Phase 1.
