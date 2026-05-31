---
project: Bondify
version: 1
status: proposed
created: 2026-05-27
updated: 2026-06-01
prd_version: 1
main_goal: speed
top_blocker: time
---

## Vision recap

Bondify is ordered around one job: help a newly formed team build rapport through a fast shared ritual instead of a heavyweight team-building event. This roadmap is biased toward speed, so it strips the MVP to the shortest sequence that can get a team from sign-in to shared participation without adding side systems that do not directly support that path.

## North star

The north star here means the smallest user-visible milestone that proves the product can start a team ritual in the real world. For this roadmap, that milestone is **S-01**, because getting a signed-in user through team creation and teammate setup is the first point where Bondify becomes usable by an actual team instead of a solo visitor.

## At a glance

| ID | Change ID | Outcome | Prerequisites | PRD refs | Status |
| --- | --- | --- | --- | --- | --- |
| F-01 | team-and-game-data-foundation | Teams, memberships, game rounds, anonymous responses, and 30-day history storage exist with privacy rules enforced. | — | FR-002, FR-003, FR-005, FR-007, US-01 | ready |
| S-01 | auth-and-team-setup | A signed-in user can create a team, use a visible email identity for teammate setup, add teammates, and see members join the team space. | F-01 | FR-001, FR-002, FR-003, US-01 | proposed |
| S-02 | game-round-and-anonymous-submission | Any team member can open one micro-game and each teammate can submit exactly one anonymous response without a separate session flow. | S-01 | FR-004, FR-005, US-01 | proposed |
| S-03 | shared-reveal-results | Participants see one shared results screen with every submitted response once the round ends. | S-02 | FR-006, US-01 | proposed |
| S-04 | selected-game-history | Selected games leave a simple 30-day team history that the team owner can clear. | S-03 | FR-007, US-01 | proposed |

## Baseline

- Frontend: present. The app already has a working server-rendered web shell and interactive UI support.
- Backend/API: partial. Authentication routes exist, but team, game, response, reveal, and history flows are not yet implemented.
- Data: partial. The project is set up to use a hosted data platform, but Bondify domain storage for teams, games, responses, and history is not yet evidenced.
- Auth: present. Sign-in, sign-up, session handling, and protected-route checks already exist.
- Deploy/infra: present. The app already has a deployment target and CI validation path.
- Observability: absent. No dedicated launch monitoring path is currently evidenced.

## Foundations

### F-01: Team and game data foundation

Outcome: Teams, memberships, game rounds, anonymous responses, and 30-day history storage exist with privacy rules enforced.
Change ID: team-and-game-data-foundation
PRD refs: FR-002, FR-003, FR-005, FR-007, US-01
Prerequisites: —
Parallel with: —
Blockers: —
Unknowns:
- What ballpark 30-day data volume should Bondify expect at the target scale? (Owner: user, Block: no)
Risk: This comes first because every user-visible slice depends on stable team, response, and history storage; skipping it would force rework across the rest of the MVP path.
Status: ready
Unlocks: S-01, S-02, S-03, S-04

## Slices

### S-01: Auth and team setup

Outcome: A signed-in user can create a team, use a visible email identity for teammate setup, add teammates, and see members join the team space.
Change ID: auth-and-team-setup
PRD refs: FR-001, FR-002, FR-003, US-01
Prerequisites: F-01
Parallel with: —
Blockers: —
Unknowns: —
Risk: This is sequenced first because the chosen speed strategy needs a usable multi-user entry path before deeper gameplay work can be validated with real teams.
Status: proposed

### S-02: Game round and anonymous submission

Outcome: Any team member can open one micro-game and each teammate can submit exactly one anonymous response without a separate session flow.
Change ID: game-round-and-anonymous-submission
PRD refs: FR-004, FR-005, US-01
Prerequisites: S-01
Parallel with: —
Blockers: —
Unknowns:
- What ballpark QPS should Bondify support in the first live version? (Owner: user, Block: no)
Risk: This comes after team setup so the game flow can be built against real memberships and permissions instead of a throwaway single-user shortcut.
Status: proposed

### S-03: Shared reveal results

Outcome: Participants see one shared results screen with every submitted response once the round ends.
Change ID: shared-reveal-results
PRD refs: FR-006, US-01
Prerequisites: S-02
Parallel with: —
Blockers: —
Unknowns: —
Risk: This is the emotional payoff of the product, but putting it after submission keeps the reveal tied to real team participation instead of a mocked display.
Status: proposed

### S-04: Selected-game history

Outcome: Selected games leave a simple 30-day team history that the team owner can clear.
Change ID: selected-game-history
PRD refs: FR-007, US-01
Prerequisites: S-03
Parallel with: —
Blockers: —
Unknowns:
- Should history volume assumptions stay small enough that simple storage and cleanup rules remain acceptable for the MVP? (Owner: user, Block: no)
Risk: History is intentionally last because it extends the core ritual loop rather than proving it; shipping it earlier would slow the shortest path to a usable team experience.
Status: proposed

## Backlog Handoff

| Roadmap ID | Change ID | Outcome | Status |
| --- | --- | --- | --- |
| F-01 | team-and-game-data-foundation | Teams, memberships, game rounds, anonymous responses, and 30-day history storage exist with privacy rules enforced. | ready |
| S-01 | auth-and-team-setup | A signed-in user can create a team, use a visible email identity for teammate setup, add teammates, and see members join the team space. | proposed |
| S-02 | game-round-and-anonymous-submission | Any team member can open one micro-game and each teammate can submit exactly one anonymous response without a separate session flow. | proposed |
| S-03 | shared-reveal-results | Participants see one shared results screen with every submitted response once the round ends. | proposed |
| S-04 | selected-game-history | Selected games leave a simple 30-day team history that the team owner can clear. | proposed |

## Open Roadmap Questions

- What ballpark QPS should Bondify support in the first live version? Owner: user. Why it matters: it sets how conservative the first gameplay and reveal path needs to be.
- What ballpark 30-day data volume should Bondify expect at the target scale? Owner: user. Why it matters: it shapes how much lifecycle and cleanup work the history slice should absorb in the MVP.

## Parked

- Team chat, video, or meeting features stay parked because the MVP is meant to create connection rituals, not replace communication tools.
- Individual teammate analytics or scoring stay parked because the MVP should not rank or profile people.
- Advanced admin features and multi-workspace management stay parked because the first version is focused on one lightweight team space at a time.
- Long-term archives beyond the 30-day history window stay parked because recent interaction history is enough for the MVP.
- Dedicated observability investment stays parked unless launch feedback shows reliability gaps that the current lightweight path cannot cover.
- Unique team-name enforcement stays parked for a later stage; the current MVP setup flow allows duplicate team names while the product validates the core team ritual.

## Done

- None yet.
