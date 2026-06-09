---
project: Bondify
version: 2
status: draft
created: 2026-06-04
context_type: brownfield
product_type: web-app
target_scale:
  users: medium
  qps: "# TODO: target_scale.qps — see Open Questions"
  data_volume: "# TODO: target_scale.data_volume — see Open Questions"
timeline_budget:
  delivery_weeks: 2
  hard_deadline: null
  after_hours_only: true
---

## Current System Overview

Bondify is a web app for team-based micro-games that helps teams participate in lightweight shared rituals. It already supports authentication, team membership, game sessions, shared reveal, and limited history behavior.

The current system is a server-rendered web application with an Astro frontend and a Supabase-backed authentication and data layer. It already supports authenticated sessions, team membership and invite flows, multi-team participation, game sessions, reveal results, and selected history behavior.

The current user base is made up of authenticated team participants who belong to one or more teams and use Bondify to play lightweight team games together. The current product supports both ordinary team members and team owners, but the main user-facing flow is still too fragmented for regular team use.

Core functionality today includes:

- authenticated session handling
- team creation, membership, and invite flow
- multi-team participation
- team-scoped game sessions
- shared reveal results
- selected history behavior for some games

## Problem Statement & Motivation

The current Bondify experience works functionally, but the day-to-day member flow is not cohesive enough for repeated team use. After sign-in, users can still encounter generic or redundant entry states, team and game actions are not organized around the most important next step, and the landing experience does not clearly show active games or today's sessions for the selected team.

This change is needed now because the product has reached the point where functional completeness is no longer the main blocker; the bigger issue is whether the product feels ready for real use by teams. Earlier work had very little UX direction, so interface and flow decisions were mostly left to default AI generation rather than an intentional product experience.

The current workaround is that users can still reach the product capabilities through the existing dashboard and game flows, but they have to navigate a cluttered member experience and game logic that does not yet match the intended daily ritual model. That costs clarity, speed of entry, and overall confidence in the product.

## User & Persona

### Primary persona

A team member participating in Bondify as part of a real team rhythm. They care most about landing in the right place immediately after login, understanding which team and game context is active, entering a game quickly, and completing the daily interaction with minimal friction.

### Secondary persona

A team lead or team owner who still needs management capabilities such as creating teams, inviting members, removing members, viewing pending invites, and deleting teams, but whose workflow in this revision is more about clean separation and access than about deep behavioral redesign.

## Success Criteria

### Primary

- A signed-in team member lands directly in an authenticated games overview for the selected team, can switch teams in one action from the top bar, and can enter the right active game or today's session without navigating through team-management clutter.
- The Emoji Check-In flow works as a daily team ritual: one shared daily session per team, emoji-only submission through a picker, one submission per user per day, a reveal moment, and a 30-day rolling history that makes team mood trends visually legible.

### Secondary

- Team-management capabilities remain available through a separate dedicated page so owner actions stay reachable without dominating the main member experience.
- Two Truths and a Lie moves from a loose submission flow toward a structured multiplayer guessing game with clearer data capture and participation rules.

### Guardrails

- Team membership and invite behavior must not regress.
- Existing auth and session stability must not regress.
- Team-based scoping and multi-team support must remain intact.
- The revision should stay within a two-week delivery window, so scope must be disciplined toward the member-first flow.
- A valid signed-in session must land directly in the authenticated team experience without exposing redundant signed-in landing states.
- Team switching must complete in one user action and return a fully refreshed selected-team view.
- Emoji Check-In history must show a rolling 30-day window in a form that is visually comparable across days.

## User Stories

### US-01: Team member lands directly in the right team game context

- **Given** a signed-in user with a valid session and access to one or more teams
- **When** they enter Bondify after login or on a returning visit
- **Then** they land directly on the authenticated games overview for the selected team and can immediately see active games or today's sessions

#### Acceptance Criteria

- A valid signed-in session does not leave the user on a generic landing page with redundant sign-in UI.
- The persistent top bar shows the signed-in user's email and selected team context.
- Switching teams from the top bar changes the team in one action and reloads the page without a second confirmation click.
- The selected team's landing view shows game entry points and current day/session status clearly enough that a member can choose the next action immediately.

### US-02: Team member completes a daily Emoji Check-In ritual

- **Given** a team member is viewing the selected team's daily Emoji Check-In
- **When** they submit emojis for the current day
- **Then** their response joins the team's shared daily session, participates in a reveal moment, and later appears in the rolling team timeline

#### Acceptance Criteria

- The Emoji Check-In input allows emoji-only submission and does not accept freeform text.
- The input supports selecting multiple emojis through a rich emoji picker.
- Each team member can submit only once per day for the team's daily Emoji Check-In session.
- The system creates one shared Emoji Check-In session per team per day without manual session creation.
- Reveal produces a visual emoji burst or comparable reaction-style animation before settling into a readable result state.
- A 30-day rolling timeline shows prior daily emoji results in a way that makes mood patterns visually comparable across days.

### US-03: Team member plays a structured round of Two Truths and a Lie

- **Given** a team member joins an active Two Truths and a Lie session with teammates
- **When** they submit their statements and later vote on other participants' sets
- **Then** the system records which statement is the lie, prevents self-guessing, and supports a multiplayer guessing flow

#### Acceptance Criteria

- Input is captured through three separate fields that preserve which statement is the lie and which two are truths.
- A participant cannot guess on their own submitted set.
- The UI supports a multiplayer participation flow where users can vote on each teammate's statements.
- Open rule questions are explicitly preserved for later clarification: scoring, guess anonymity, reveal timing, and whether the game is daily, on-demand, or session-based.

## Scope of Change

- [new] Add a persistent top navigation bar that exposes selected-team context, one-action team switching, and navigation entry points for team management and the games overview.
- [new] Add a dedicated team-management page for create team, invite members, accept invitations, remove members, delete team, and view pending invites.
- [new] Add a games-overview landing page that shows the selected team's active games, today's sessions, and quick game entry.
- [new] Add a daily auto-session model for Emoji Check-In with one shared session per team per day.
- [new] Add emoji-only submission through a rich picker with multi-emoji selection.
- [new] Add a reveal animation for Emoji Check-In and a 30-day rolling visual timeline of daily team emoji history.
- [new] Add a multiplayer guessing interface for Two Truths and a Lie.
- [modified] Change post-login routing so valid sessions land directly on the authenticated team experience instead of a generic landing page.
- [modified] Change the main information architecture so member gameplay and today's sessions become the primary experience.
- [modified] Change Two Truths and a Lie input from a loose response model to structured truth/lie fields.
- [modified] Change Two Truths and a Lie participation logic so users cannot guess their own submission and instead vote on teammates' sets.
- [removed] Remove redundant signed-in landing states that still show generic sign-in/sign-out affordances.
- [removed] Remove manual session creation for Emoji Check-In in favor of one automatic daily session per team.
- [preserved] Preserve the current auth and session model.
- [preserved] Preserve the current team membership and invite flow.
- [preserved] Preserve multi-team support and team-scoped behavior across the app.
- [preserved] Preserve the current member-versus-owner permission split.

## Constraints & Compatibility

- Existing auth and session behavior must remain stable.
- Existing team membership and invite behavior must remain stable.
- Existing team-management actions may remain on the dashboard temporarily if the separate management page is deferred for scope.
- Existing game URLs do not need to remain stable; route changes are acceptable if the revised experience benefits from them.
- Old revision-sensitive data does not need strict preservation; existing game data may be discarded if needed to support the redesigned flows.
- Multi-team support and team-scoped behavior must continue working across the revision.
- The revised member-facing gameplay flow must remain usable on the same supported browser/device footprint as the current product.

## Business Logic Changes

The system currently supports team-scoped game participation, reveal, and limited history, but the revision changes the product's domain logic in two important places: the daily ritual model for Emoji Check-In and the structured multiplayer guessing model for Two Truths and a Lie.

Bondify collects one emoji-only check-in per team member per day and turns them into a shared daily team mood snapshot that can be revealed together and compared across a rolling 30-day timeline.

This change replaces a looser manual-session interaction with a daily shared ritual model. The rule consumes the team, the calendar day, and each member's emoji-only submission. It produces one shared daily state for the team, one reveal moment, and a timeline-friendly record that makes mood patterns visually comparable across days.

Bondify collects one structured truth-truth-lie set from each participant and turns those sets into a multiplayer guessing round where teammates identify the lie in other participants' entries while self-guessing is disallowed.

This change replaces a loose response flow with explicit per-field structure and a distinct guessing stage. The rule consumes one participant-authored set per player and produces a teammate voting round in which the system enforces that users only guess on other participants' submissions.

## Access Control Changes

No access control changes. The current authenticated session model is preserved, and the current member-versus-owner capability split remains in place.

This revision changes navigation, page organization, and gameplay flow, not the underlying permission boundary.

## Non-Goals

- This revision does not rewrite the underlying auth model because the current authenticated session flow should stay stable.
- This revision does not redesign the owner/member permission boundary or introduce new roles because the problem is surface organization and gameplay flow, not access-model complexity.
- This revision does not require preserving old game URLs because route changes are acceptable if they improve the revised experience.
- This revision does not require preserving old game data when a clean break makes the redesigned game flows simpler or safer to land.
- This revision does not force delivery of the separate team-management page if the two-week window gets tight; existing management actions may temporarily remain on the dashboard.
- This revision does not finalize Two Truths and a Lie scoring, vote anonymity, or reveal timing; those decisions remain open for later refinement.

## Open Questions

1. **What is the expected ballpark QPS for the revised product flow?** — Owner: user. Needed to complete `target_scale.qps`.
2. **What is the expected ballpark data volume for the revised product flow?** — Owner: user. Needed to complete `target_scale.data_volume`.
3. **How should Two Truths and a Lie scoring work?** — Owner: user. Block: no.
4. **Are Two Truths and a Lie guesses anonymous or visible?** — Owner: user. Block: no.
5. **When should Two Truths and a Lie results be revealed: immediately or only after all votes?** — Owner: user. Block: no.
6. **Should Two Truths and a Lie run as a daily ritual, an on-demand game, or a session-based activity?** — Owner: user. Block: no.
