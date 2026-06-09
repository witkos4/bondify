---
project: Bondify
context_type: brownfield
product_type: web-app
target_scale:
  users: medium
timeline_budget:
  delivery_weeks: 2
  hard_deadline: null
  after_hours_only: true
created: 2026-06-04
updated: 2026-06-04
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: change category
      decision: Significant brownfield feature revision spanning UX/information architecture changes plus game-logic redesign.
    - topic: insight
      decision: Earlier work had little UX guidance, so the interface direction was mostly left to default AI generation rather than an intentional product flow.
    - topic: primary persona
      decision: Team members are the primary persona for this revision; team-lead operations remain important but are mostly being reorganized onto a dedicated page rather than fundamentally redesigned.
    - topic: auth model
      decision: No auth-model change. Preserve the current authenticated session flow.
    - topic: role model
      decision: Preserve the current member-versus-owner capability split and do not add new roles in this revision.
    - topic: access-change scope
      decision: This revision changes navigation, page organization, and gameplay flow, not the underlying permission model.
    - topic: smallest proving flow
      decision: The smallest successful revision is a member-first post-login flow where a valid session lands directly on the authenticated games overview, selected-team context is visible and switchable in one action, active games and today's sessions are visible immediately, and a user can enter the redesigned daily emoji game directly from that overview.
    - topic: delivery window
      decision: Target a two-week brownfield delivery for this revision.
    - topic: must-have anchor
      decision: Emoji Check-In redesign is the primary anchor for this revision.
    - topic: easiest cut
      decision: Team-management separation is the first area to cut or defer if the two-week scope becomes too tight.
    - topic: two-truths-and-a-lie scope
      decision: Keep Two Truths and a Lie in scope during this revision, even though some rules remain open for later clarification.
    - topic: emoji business rule
      decision: Bondify collects one emoji-only check-in per team member per day and turns them into a shared daily team mood snapshot that can be revealed together and compared across a rolling 30-day timeline.
    - topic: two-truths business rule
      decision: Bondify collects one structured truth-truth-lie set from each participant and turns those sets into a multiplayer guessing round where teammates identify the lie in other participants' entries while self-guessing is disallowed.
    - topic: data preservation
      decision: Old data can be discarded if needed during the revision.
    - topic: route compatibility
      decision: Existing game URLs do not need to be preserved; new routes are acceptable.
    - topic: team-management fallback
      decision: If the dedicated team-management page slips for scope, existing management actions should temporarily remain on the dashboard.
    - topic: two-truths reveal timing
      decision: Reveal timing remains undecided and should stay open for later refinement.
    - topic: product type
      decision: No change — Bondify remains a web app.
    - topic: user-base change
      decision: No meaningful user-base change; this revision improves the experience for existing team members rather than expanding to a new audience.
    - topic: hard deadline
      decision: No hard deadline.
    - topic: work mode
      decision: This revision remains after-hours work.
    - topic: non-goals
      decision: No auth-model rewrite, no role or permission redesign, no requirement to preserve old game URLs, no requirement to preserve old game data if redesign needs a clean break, no forced delivery of the dedicated team-management page if core member gameplay needs the time, and no final decision yet on Two Truths and a Lie scoring, anonymity, or reveal timing.
  frs_drafted: 0
  quality_check_status: accepted
---

## Current System

Bondify already exists as a web app for team-based micro-games with authentication, team membership, game sessions, shared reveal, and limited history support. The first feature set is implemented end to end, but the product experience still feels fragmented: post-login entry is weak, navigation is scattered, and some game flows do not yet match the intended day-to-day ritual experience.

The current implementation uses an Astro web app with Supabase-backed authentication and data storage. It already supports authenticated sessions, team membership and invite flows, multi-team participation, game sessions, reveal results, and selected history behavior.

Existing users are authenticated team participants who belong to one or more teams and use Bondify to play lightweight team games together. This revision primarily optimizes for ordinary team members who need a clearer landing experience, easier game entry, and better daily participation flow, while team owners still need access to management operations that are already mostly present but should move to a dedicated page.

Must preserve:

- the existing team membership and invite flow
- existing auth and session stability
- team-based scoping across the app
- multi-team support
- the already-working slices unless a behavior is intentionally redesigned

## Vision & Problem Statement

The current Bondify product works functionally, but the day-to-day experience is not yet cohesive enough for regular team use. After sign-in, users can still encounter generic or redundant entry states, team and game actions are not organized around the most important next step, and the dashboard does not clearly communicate active games or today's sessions for the selected team.

This revision is motivated by the gap between "feature-complete enough to work" and "clear enough to feel ready for real use." Earlier work had very little UX direction, so interface decisions were mostly left to default AI generation. The next step is to intentionally redesign the participation flow for team members while reorganizing team-management operations into a separate surface that preserves current capabilities without crowding the main experience.

## User & Persona

### Primary persona

A team member participating in Bondify as part of a real team rhythm. They care most about landing in the right place immediately after login, understanding which team and game context is active, entering a game quickly, and completing the daily interaction with minimal friction.

### Secondary persona

A team lead or team owner who still needs management capabilities such as creating teams, inviting members, removing members, viewing pending invites, and deleting teams, but whose workflow in this revision is more about clean separation and access than about deep behavioral redesign.

## Access Control

The current authenticated session model is preserved. Users still sign in through the existing auth flow and should land directly in the authenticated product experience when their session is valid.

The current role split is also preserved. Ordinary team members participate in team games and day-to-day interaction flows, while team owners retain elevated team-management capabilities such as team administration and destructive actions.

No new roles are introduced in this revision. The change is about reorganizing where users encounter capabilities: member-facing gameplay and daily team participation should become the primary post-login experience, while owner-oriented team-management operations move to a dedicated page without changing the permission boundary underneath.

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

## Business Logic Changes

The system currently supports team-scoped game participation, reveal, and limited history, but the revision changes the product's domain logic in two important places: the daily ritual model for Emoji Check-In and the structured multiplayer guessing model for Two Truths and a Lie.

Bondify collects one emoji-only check-in per team member per day and turns them into a shared daily team mood snapshot that can be revealed together and compared across a rolling 30-day timeline.

This change replaces a looser manual-session interaction with a daily shared ritual model. The rule consumes the team, the calendar day, and each member's emoji-only submission. It produces one shared daily state for the team, one reveal moment, and a timeline-friendly record that makes mood patterns visually comparable across days.

Bondify collects one structured truth-truth-lie set from each participant and turns those sets into a multiplayer guessing round where teammates identify the lie in other participants' entries while self-guessing is disallowed.

This change replaces a loose response flow with explicit per-field structure and a distinct guessing stage. The rule consumes one participant-authored set per player and produces a teammate voting round in which the system enforces that users only guess on other participants' submissions. Scoring, anonymity, and reveal timing remain intentionally open.

## Constraints & Compatibility

- Existing auth and session behavior must remain stable.
- Existing team membership and invite behavior must remain stable.
- Existing team-management actions may remain on the dashboard temporarily if the separate management page is deferred for scope.
- Existing game URLs do not need to remain stable; route changes are acceptable if the revised experience benefits from them.
- Old revision-sensitive data does not need strict preservation; existing game data may be discarded if needed to support the redesigned flows.
- Multi-team support and team-scoped behavior must continue working across the revision.
- Open rule questions for Two Truths and a Lie remain unresolved on purpose: scoring, guess anonymity, and reveal timing.

## Non-Functional Requirements

- A valid signed-in session lands directly in the authenticated team experience without exposing redundant signed-in landing states.
- Team switching completes in one user action and returns a fully refreshed selected-team view.
- A team member can reach the correct active game or today's session from the main landing experience with minimal navigation overhead.
- Emoji Check-In history shows a rolling 30-day window in a form that is visually comparable across days.
- The revised member-facing gameplay flow remains usable on the same supported browser/device footprint as the current product.

## Non-Goals

- This revision does not rewrite the underlying auth model because the current authenticated session flow should stay stable.
- This revision does not redesign the owner/member permission boundary or introduce new roles because the problem is surface organization and gameplay flow, not access-model complexity.
- This revision does not require preserving old game URLs because route changes are acceptable if they improve the revised experience.
- This revision does not require preserving old game data when a clean break makes the redesigned game flows simpler or safer to land.
- This revision does not force delivery of the separate team-management page if the two-week window gets tight; existing management actions may temporarily remain on the dashboard.
- This revision does not finalize Two Truths and a Lie scoring, vote anonymity, or reveal timing; those decisions remain open for later refinement.

## Quality cross-check

- Access Control: present.
- Business Logic: present as explicit brownfield rule changes for Emoji Check-In and Two Truths and a Lie.
- Project artifacts: present.
- Timeline-cost acknowledgment: present because the revision is explicitly capped at two weeks of after-hours work.
- Non-Goals: present.
- Preserved behavior: present in Constraints & Compatibility.
