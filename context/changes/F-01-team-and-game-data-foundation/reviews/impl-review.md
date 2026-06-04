<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Team and game data foundation

- **Plan**: `context/changes/F-01-team-and-game-data-foundation/plan.md`
- **Scope**: Full plan, all 3 phases
- **Date**: 2026-06-01
- **Verdict**: APPROVED WITH WARNING
- **Findings**: 0 critical, 1 warning, 0 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

## Findings

### F1 — Participant-safe response reads are not reveal-gated

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/lib/services/bondify.ts:1136`, `src/lib/services/bondify.ts:1190`
- **Detail**: `getParticipantSafeRoundReveal()` and `getParticipantSafeHistory()` strip responder identity, which matches the app-level anonymity decision. But they return `responseText` without requiring the round to be revealed or closed. If a future S-03/S-04 UI or API calls these methods too early, response content can appear before the shared reveal moment. History has the same shape: it filters by `history_visible_until` and `history_cleared_at`, but not by `status = 'revealed'`.
- **Fix**: Gate participant-facing response-content reads behind revealed/completed round status. For example, `getParticipantSafeRoundReveal()` should reject or return no responses unless `round.status === "revealed"`, and `getParticipantSafeHistory()` should include only revealed history-visible rounds.
  - Strength: Preserves the foundation's anonymity boundary before S-03 builds on it.
  - Tradeoff: S-03 must explicitly set round status to `revealed` before using these reads.
  - Confidence: HIGH — the current methods return response text via `toParticipantSafeResponses()` and no status gate is present.
  - Blind spot: I did not inspect an S-03 plan yet, so the exact error code/empty-state behavior can be decided there.
- **Decision**: PENDING

## Verification

- `npm run lint` passed.
- `npm run build` passed.
- `npx supabase db lint --local` passed.
- `npx supabase migration list` showed local and remote migrations aligned.
- Manual checks in the foundation plan are marked complete, and later S-01/S-02 work confirms the schema/service contracts are usable.
