---
date: 2026-06-16T22:14:43.1018016+02:00
researcher: Codex
git_commit: 5f590a1c8d79754c06de183a07b9092d92a948b2
branch: main
repository: bondify
topic: "What test could be implemented so these regressions do not happen again?"
tags: [research, testing, emoji-check-in, supabase, compatibility]
status: complete
last_updated: 2026-06-16
last_updated_by: Codex
---

# Research: What test could be implemented so these regressions do not happen again?

**Date**: 2026-06-16T22:14:43.1018016+02:00  
**Researcher**: Codex  
**Git Commit**: `5f590a1c8d79754c06de183a07b9092d92a948b2`  
**Branch**: `main`  
**Repository**: `bondify`

## Research Question

What automated tests give the best protection against:

1. the Emoji Check-In picker looking interactive but not actually being usable, and
2. remote environments still failing when `team_memberships.removed_at` is missing?

## Summary

The highest-value next addition is a browser-level test for the Emoji Check-In picker. The current picker is intentionally server-first, with native checkbox inputs and a small enhancement script, so the regression to guard against is behavioral: can a signed-in teammate actually click emoji cards, see state change, and submit valid selections. A browser test is the cheapest layer that proves that outcome end to end.

For the schema-drift issue, the best protection is not one broad end-to-end test, but a small compatibility test family around the service helpers that now centralize fallback behavior. The existing compatibility test already proves the team-summary fallback once; the missing guard is coverage for every membership-sensitive entrypoint that depends on the shared helper path.

## Detailed Findings

### Emoji picker is now a server-rendered interaction surface

- The picker renders as a regular HTML `<form>` with native checkbox inputs and labels, not a React island ([EmojiCheckInPicker.astro:18](https://github.com/witkos4/bondify/blob/5f590a1c8d79754c06de183a07b9092d92a948b2/src/components/emoji-check-in/EmojiCheckInPicker.astro#L18), [EmojiCheckInPicker.astro:43](https://github.com/witkos4/bondify/blob/5f590a1c8d79754c06de183a07b9092d92a948b2/src/components/emoji-check-in/EmojiCheckInPicker.astro#L43), [EmojiCheckInPicker.astro:51](https://github.com/witkos4/bondify/blob/5f590a1c8d79754c06de183a07b9092d92a948b2/src/components/emoji-check-in/EmojiCheckInPicker.astro#L51)).
- Interactivity depends on click behavior over the label/input pair plus the inline script that updates the count, disabled state, and max-3 lockout ([EmojiCheckInPicker.astro:111](https://github.com/witkos4/bondify/blob/5f590a1c8d79754c06de183a07b9092d92a948b2/src/components/emoji-check-in/EmojiCheckInPicker.astro#L111), [EmojiCheckInPicker.astro:117](https://github.com/witkos4/bondify/blob/5f590a1c8d79754c06de183a07b9092d92a948b2/src/components/emoji-check-in/EmojiCheckInPicker.astro#L117), [EmojiCheckInPicker.astro:162](https://github.com/witkos4/bondify/blob/5f590a1c8d79754c06de183a07b9092d92a948b2/src/components/emoji-check-in/EmojiCheckInPicker.astro#L162), [EmojiCheckInPicker.astro:176](https://github.com/witkos4/bondify/blob/5f590a1c8d79754c06de183a07b9092d92a948b2/src/components/emoji-check-in/EmojiCheckInPicker.astro#L176)).
- The user-facing preference about descriptions is enforced only by template markup right now; the option catalog still contains descriptions for other views ([EmojiCheckInPicker.astro:52](https://github.com/witkos4/bondify/blob/5f590a1c8d79754c06de183a07b9092d92a948b2/src/components/emoji-check-in/EmojiCheckInPicker.astro#L52), [emoji-check-in.ts:6](https://github.com/witkos4/bondify/blob/5f590a1c8d79754c06de183a07b9092d92a948b2/src/lib/emoji-check-in.ts#L6), [emoji-check-in.ts:14](https://github.com/witkos4/bondify/blob/5f590a1c8d79754c06de183a07b9092d92a948b2/src/lib/emoji-check-in.ts#L14)).

### Membership schema compatibility is centralized, but only partially regression-tested

- The code now centralizes compatibility in `isMissingColumnError`, `findActiveMembershipByTeamAndProfile`, and `hasActiveMembershipForNormalizedEmail` ([bondify.ts:384](https://github.com/witkos4/bondify/blob/5f590a1c8d79754c06de183a07b9092d92a948b2/src/lib/services/bondify.ts#L384), [bondify.ts:452](https://github.com/witkos4/bondify/blob/5f590a1c8d79754c06de183a07b9092d92a948b2/src/lib/services/bondify.ts#L452), [bondify.ts:487](https://github.com/witkos4/bondify/blob/5f590a1c8d79754c06de183a07b9092d92a948b2/src/lib/services/bondify.ts#L487)).
- Team summary loading now retries with a legacy select string when `removed_at` is unavailable ([bondify.ts:1126](https://github.com/witkos4/bondify/blob/5f590a1c8d79754c06de183a07b9092d92a948b2/src/lib/services/bondify.ts#L1126), [bondify.ts:1134](https://github.com/witkos4/bondify/blob/5f590a1c8d79754c06de183a07b9092d92a948b2/src/lib/services/bondify.ts#L1134)).
- The same shared helper path is used by at least three higher-level behaviors: membership access checks, create-team completion, invite-member duplicate checks, and invite acceptance ([bondify.ts:935](https://github.com/witkos4/bondify/blob/5f590a1c8d79754c06de183a07b9092d92a948b2/src/lib/services/bondify.ts#L935), [bondify.ts:2068](https://github.com/witkos4/bondify/blob/5f590a1c8d79754c06de183a07b9092d92a948b2/src/lib/services/bondify.ts#L2068), [bondify.ts:2171](https://github.com/witkos4/bondify/blob/5f590a1c8d79754c06de183a07b9092d92a948b2/src/lib/services/bondify.ts#L2171), [bondify.ts:2315](https://github.com/witkos4/bondify/blob/5f590a1c8d79754c06de183a07b9092d92a948b2/src/lib/services/bondify.ts#L2315)).
- There is already one compatibility test proving the summary fallback and a Vitest config fix that ensures this suite is actually discovered ([bondify-compatibility.test.ts:115](https://github.com/witkos4/bondify/blob/5f590a1c8d79754c06de183a07b9092d92a948b2/tests/services/bondify-compatibility.test.ts#L115), [bondify-compatibility.test.ts:122](https://github.com/witkos4/bondify/blob/5f590a1c8d79754c06de183a07b9092d92a948b2/tests/services/bondify-compatibility.test.ts#L122), [vitest.config.ts:6](https://github.com/witkos4/bondify/blob/5f590a1c8d79754c06de183a07b9092d92a948b2/vitest.config.ts#L6), [vitest.config.ts:12](https://github.com/witkos4/bondify/blob/5f590a1c8d79754c06de183a07b9092d92a948b2/vitest.config.ts#L12)).

## Recommended Tests

### 1. Add one browser test for the dashboard Emoji Check-In picker

**Why this is the best next test**

- The regression was user-visible and interaction-based: the UI looked clickable but was not usable.
- Unit or HTML snapshot tests can prove structure, but not real clickability.
- A browser test can also lock in the “no descriptions in the picker” requirement as a visible-contract assertion.

**What it should prove**

- A signed-in teammate can open `/dashboard` and find the Emoji Check-In section.
- Clicking an emoji card toggles the associated checkbox.
- The selected-count badge changes from `0/3` to `1/3`, `2/3`, etc.
- The submit button enables after at least one selection.
- A fourth click does not produce a fourth selected emoji.
- The picker does not render description copy from the option catalog.

**Suggested file**

- `tests/browser/emoji-check-in-picker.spec.ts`

**Critical assertions**

- Count the checked `input[name="emojis"]` elements after each click.
- Assert visible text includes labels but excludes a known description string such as `"Energy is high and things feel bright."` from [emoji-check-in.ts:15](https://github.com/witkos4/bondify/blob/5f590a1c8d79754c06de183a07b9092d92a948b2/src/lib/emoji-check-in.ts#L15).
- Assert form submission succeeds or at least posts the selected emoji values.

### 2. Expand the compatibility suite into a table-driven membership fallback family

**Why this is the best schema-drift guard**

- The failure mode is not “the whole app breaks,” but “one path still queried `removed_at` directly.”
- The shared compatibility helpers are the new seam; tests should pin every public behavior that depends on them.

**What to add**

- Keep the existing team-summary fallback test.
- Add compatibility tests for:
  - `createTeam`
  - `acceptInvite`
  - invite-member duplicate detection / membership existence checks
  - one plain membership-accessed read path such as `getTeamHistoryState` or `getCurrentTeamSummaries`

**Suggested file**

- Extend `tests/services/bondify-compatibility.test.ts`

**Critical assertions**

- The first query may request `removed_at`, receive the legacy error, and then retry without it.
- The service result still returns a normalized membership with `removedAt: null`.
- No call path leaks the raw schema error back to the caller when the legacy fallback should succeed.

### 3. Add one structural “don’t bypass the compatibility seam” test

**Why this helps**

- The schema regression is likely to recur when someone adds a new direct `team_memberships` select and forgets the fallback.
- A lightweight repo test can fail fast before that code ever reaches remote.

**What it should do**

- Scan `src/lib/services/bondify.ts` for raw `removed_at`-based `team_memberships` selects outside the approved compatibility helper/select constants.
- Fail if a new direct query shape appears outside the allowed compatibility seam.

**Suggested file**

- `tests/services/team-membership-query-guard.test.ts`

**Important caution**

- Keep this guard narrow. It should enforce “use the seam,” not freeze harmless refactors.
- This is a supplement to behavior tests, not a replacement for them.

## Code References

- [src/components/emoji-check-in/EmojiCheckInPicker.astro](https://github.com/witkos4/bondify/blob/5f590a1c8d79754c06de183a07b9092d92a948b2/src/components/emoji-check-in/EmojiCheckInPicker.astro#L18) - Server-rendered picker contract and enhancement script.
- [src/lib/emoji-check-in.ts](https://github.com/witkos4/bondify/blob/5f590a1c8d79754c06de183a07b9092d92a948b2/src/lib/emoji-check-in.ts#L14) - Emoji option catalog; descriptions still exist at the data layer.
- [src/lib/services/bondify.ts](https://github.com/witkos4/bondify/blob/5f590a1c8d79754c06de183a07b9092d92a948b2/src/lib/services/bondify.ts#L452) - Shared membership compatibility helper.
- [tests/services/bondify-compatibility.test.ts](https://github.com/witkos4/bondify/blob/5f590a1c8d79754c06de183a07b9092d92a948b2/tests/services/bondify-compatibility.test.ts#L115) - Existing compatibility regression test.
- [vitest.config.ts](https://github.com/witkos4/bondify/blob/5f590a1c8d79754c06de183a07b9092d92a948b2/vitest.config.ts#L6) - Vitest alias + include config that makes service-level regression tests runnable.

## Architecture Insights

- The picker regression lives at the boundary between markup, browser behavior, and progressive enhancement. That makes browser automation the right confidence layer.
- The schema regression lives at the service/query boundary. That makes mocked compatibility tests around the helper seam the right confidence layer.
- The two regressions need different test types; one broad “more E2E” strategy would be more expensive and less targeted than two focused guardrails.

## Historical Context (from prior changes)

- `context/changes/S-07-daily-emoji-check-in-loop/change.md` records prior polish/verification churn around the Emoji Check-In surface, which is a signal that UI regressions here are likely to recur.
- `context/changes/testing-foundation-access-control/change.md` shows the repo has only recently started building out its automated test surface, so narrowly targeted guardrails are more valuable than a large generic suite.
- `context/foundation/lessons.md` already documents that Supabase failures can come from environment drift, which reinforces the need for explicit compatibility tests instead of assuming local schema equals remote schema.

## Related Research

- `context/changes/testing-foundation-access-control/plan.md`
- `context/foundation/test-plan.md`

## Open Questions

- Whether the team wants to adopt Playwright now for one high-signal browser test, or first add a lighter render/DOM contract test and defer browser infrastructure.
- Whether the compatibility seam should remain in one large service file or be extracted into a smaller module that is easier to test directly.
