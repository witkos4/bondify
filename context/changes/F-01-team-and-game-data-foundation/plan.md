# Team and game data foundation

## Summary

Create the first Bondify domain data layer so later slices can build team setup, game participation, shared reveal, and history on stable storage contracts instead of one-off schema decisions. This change covers the Supabase schema, row-level access rules, domain-facing TypeScript contracts, and reference data needed for the MVP team ritual loop.

This plan is intentionally biased toward speed. It does not try to solve long-term scale, advanced moderation, or perfect anonymity. It establishes the smallest durable foundation that still honors the PRD's core rules: multi-user team membership, one response per participant per round, pending invites, selected games, and 30-day history retention semantics.

## Current State Analysis

- Auth and authenticated session handling already exist through Supabase SSR in `src/lib/supabase.ts` and route protection in `src/middleware.ts`.
- The app already ships sign-in, sign-up, confirm-email, and sign-out paths in `src/pages/api/auth/` and `src/pages/auth/`.
- The product domain does not exist yet. There is no evidence of Bondify-specific tables, migrations, service modules, or typed entities for teams, memberships, rounds, responses, or history.
- The roadmap marks `F-01: team-and-game-data-foundation` as the only `ready` item, and downstream slices `S-01` through `S-04` all depend on it.
- A planning-session product decision changed teammate identity from username-based invites in the PRD/roadmap to email-based invites for the MVP. This plan treats that as authoritative and includes doc-alignment work so downstream implementation does not follow stale requirements.

## Goals

- Add an app-owned schema for teams, memberships, pending invites, game templates, live rounds, and responses.
- Preserve the MVP rule that one user can belong to multiple teams.
- Allow pending invites to be created for any email address, even before that person signs up.
- Support anonymous-by-default gameplay using application-level anonymity while still storing responder identity for integrity checks and later history access.
- Encode 30-day history retention in the data model so later slices can implement cleanup and owner-clearing without redesigning tables.
- Expose stable TypeScript and service-layer contracts that later slices can reuse instead of querying raw tables ad hoc.

## Non-Goals

- No UI for team creation, invite acceptance, gameplay, reveal, or history in this change.
- No full scheduled deletion worker or cron-based cleanup implementation yet.
- No stricter anonymity model than the one chosen in planning; responder identity remains stored and hidden by application behavior.
- No analytics, scoring, chat, multi-workspace administration, or observability expansion.
- No auth-provider migration from the current email/password flow to OAuth in this change.

## Confirmed Planning Decisions

- **Invite identifier:** use email, not a separate Bondify username.
- **Invite timing:** owners can create pending invites for any email before account creation.
- **Membership shape:** support many-to-many user/team membership from the first migration.
- **Invite lifecycle:** represent team invitations as pending membership records, not as informal UI-only state.
- **Anonymity model:** store responder identity directly and enforce anonymity through application queries and presentation, not through irreversible anonymization.
- **Retention model:** store retention metadata now and leave automated expiry execution for a later slice.
- **Game model:** use reusable game templates plus team-specific game rounds and responses; history is derived from completed rounds rather than from a separate duplicated history table.

## Desired End State

- Every authenticated user can be represented in the app domain by an app-owned profile row keyed to their auth user.
- Teams, memberships, and pending invites exist with clear uniqueness and lifecycle rules.
- Selected micro-games exist as reusable templates that later slices can open without reworking the schema.
- Each team round can collect one response per participant, store the responder identity, and later expose a reveal/history view without schema changes.
- Later slices can build on server-side service contracts and shared types instead of inventing table access patterns as they go.
- The PRD and roadmap language around invite identity is aligned with the decision to use email-based invites for the MVP.

## Scope

**In scope**

- Supabase migration(s) for domain tables, constraints, indexes, foreign keys, retention fields, and RLS policies
- App-owned profile synchronization contract for authenticated users
- Reference data contract for selected micro-game templates
- TypeScript entity/DTO types for teams, invites, rounds, responses, and history-facing records
- Server-only service modules under `src/lib/services/` for downstream slices to reuse
- Documentation updates where this plan intentionally changes product wording from usernames to email-based invites

**Out of scope**

- Team-management UI
- Invite acceptance screens or email delivery
- Game prompt UX
- Shared reveal UI
- History UI and manual clear actions
- Background deletion jobs

## Architecture Decisions

### Identity and profile boundary

- Keep Supabase Auth as the source of authentication.
- Add one app-owned profile table keyed by auth user id so the rest of the app can join on a stable user record without depending on raw auth tables everywhere.
- Use normalized email as the shareable invite identifier for the MVP. This means the profile contract must expose email in a form the app can safely query for invite matching.

### Team and invite model

- Use separate `teams`, `team_memberships`, and `team_invites` tables.
- `team_memberships` is the canonical source of active participation.
- `team_invites` holds pending email-based invitations and later claim/acceptance lifecycle.
- Do not collapse pending and active states into one table. The extra table keeps later acceptance rules and uniqueness constraints simpler.

### Game and history model

- Use `game_templates` for reusable game definitions and metadata such as prompt text and whether the game participates in history.
- Use `game_rounds` for each live team play instance.
- Use `game_responses` for one submission per participating member per round.
- Derive history from completed rounds plus the template metadata and retention timestamps. Do not create a separate duplicated history table.

### Privacy model

- Because planning chose app-level anonymity, `game_responses` keeps a direct link to the responding membership or user.
- Later reveal/history queries must explicitly omit identity in participant-facing payloads.
- Admin-only or owner-only access should not be invented in this change; the flat MVP role model still applies except where team ownership is needed for invite creation and future history clearing.

### Retention model

- Each history-eligible round must carry retention metadata such as `history_visible_until` or an equivalent expiry timestamp.
- Owner-clear behavior should be expressible as a soft-clear marker or deletion contract without changing table shape later.
- Full automated cleanup is deferred, but the schema must make the future cleanup query obvious and safe.

## Phase 1: Domain schema and access rules

### Goal

Create the Bondify domain schema in Supabase so team relationships, pending invites, games, rounds, and responses have durable storage and enforceable access boundaries.

### Changes Required

1. **Create the foundational migration**
   **Intent:** Add the first Bondify domain tables and constraints in one coherent migration so downstream slices inherit one schema vocabulary.
   **Contract:** Add a migration in `supabase/migrations/` that creates the app-owned profile table plus `teams`, `team_memberships`, `team_invites`, `game_templates`, `game_rounds`, and `game_responses`, with timestamps, foreign keys, uniqueness constraints, and indexes sized for the MVP.

2. **Define the profile synchronization rule**
   **Intent:** Ensure every authenticated user can be represented in the app domain without later slices hand-rolling profile creation.
   **Contract:** The migration must encode one deterministic rule that guarantees an app profile row exists for each authenticated user before team/invite/game writes rely on it. The implementation may use a database-side sync mechanism or an equivalent server-enforced creation path, but the contract must be single-source and not optional.

3. **Encode membership and invite invariants**
   **Intent:** Prevent duplicate memberships and ambiguous pending invites before UI exists.
   **Contract:** Enforce at least these invariants:
   - a user cannot have duplicate active membership in the same team
   - a pending invite email cannot be duplicated in the same unresolved team-invite state
   - teams can have multiple members
   - users can belong to multiple teams

4. **Model game rounds and responses for one-response-per-participant**
   **Intent:** Give gameplay slices a stable structure for opening a round and enforcing a single submission per participant.
   **Contract:** `game_rounds` must represent one live team play instance tied to a game template and team. `game_responses` must support exactly one response per active participant per round through a uniqueness constraint at the database layer.

5. **Add retention metadata instead of full expiry automation**
   **Intent:** Keep the data shape aligned with the 30-day history rule while avoiding background-job scope now.
   **Contract:** Completed rounds that participate in history must persist enough metadata to determine history visibility and future cleanup timing without schema changes.

6. **Write row-level security policies**
   **Intent:** Keep data access bounded to authenticated users and relevant teams from day one.
   **Contract:** Policies must ensure users can only read or write teams, memberships, invites, rounds, and responses that they are entitled to through their own membership, ownership, or invite-claim path. New tables must not ship with open authenticated read/write access.

### Success Criteria

#### Automated Verification

- The migration applies cleanly in the local Supabase environment without SQL, foreign-key, or RLS-policy errors.
- `npm run lint` passes after any TypeScript or documentation updates included in this phase.
- `npm run build` passes with the new schema-facing code and types in place.

#### Manual Verification

- Inspect the local database and confirm all planned domain tables, uniqueness constraints, and indexes exist.
- Confirm a seeded or test user can own one team, belong to another team, and still satisfy the many-to-many membership contract.
- Confirm a pending invite can exist for an email that has not yet created a Bondify account.

---

## Phase 2: App-facing types and service contracts

### Goal

Expose the schema through stable application contracts so later slices can build features without embedding raw-table assumptions throughout the codebase.

### Changes Required

1. **Add shared domain types**
   **Intent:** Give the app one typed vocabulary for teams, invites, templates, rounds, responses, and history records.
   **Contract:** Add or extend shared types in `src/types.ts` for the domain entities and the minimal DTO/view-model shapes later slices need, including pending invites by email and participant-safe reveal/history payloads that omit responder identity.

2. **Create server-only service modules**
   **Intent:** Keep future pages and API routes from querying Supabase tables directly in ad hoc ways.
   **Contract:** Add server-only modules under `src/lib/services/` that define the read/write contracts for:
   - ensuring/reading the current user's app profile
   - creating teams and memberships
   - creating and resolving pending invites
   - listing selected game templates
   - creating rounds and recording one response per participant
   - reading participant-safe history/reveal data

3. **Separate participant-safe payloads from internal records**
   **Intent:** Respect the chosen app-level anonymity model by making the privacy boundary explicit in code contracts.
   **Contract:** Internal service records may include responder identity, but participant-facing result/history contracts must not expose that identity. The service layer, not the UI, should be the first boundary where responder identity gets removed from teammate-visible payloads.

4. **Prepare clear failure surfaces for downstream slices**
   **Intent:** Make later implementation simpler by normalizing expected domain errors now.
   **Contract:** Service contracts must define how callers distinguish:
   - duplicate membership attempts
   - unresolved or already-consumed invites
   - non-member access to a team
   - duplicate response submission for the same round
   - expired or cleared history visibility

### Success Criteria

#### Automated Verification

- `npm run lint` passes with the new shared types and service modules.
- `npm run build` passes with no server/client boundary violations from the new service layer.

#### Manual Verification

- Review the service contracts and confirm they are sufficient for roadmap slices `S-01` through `S-04` without needing schema redesign.
- Confirm participant-facing contracts omit responder identity even though the stored response record keeps it.

---

## Phase 3: Reference data, verification path, and doc alignment

### Goal

Finish the foundation so the next implementation slice can start immediately with stable reference data, validated assumptions, and aligned product docs.

### Changes Required

1. **Seed or initialize selected game templates**
   **Intent:** Make the MVP's “selected games” concept concrete so gameplay work starts from real template records instead of placeholder assumptions.
   **Contract:** Add a deterministic initialization path for a minimal template catalog in the database layer. The catalog only needs enough fields to support the MVP prompt-selection and history-eligibility rules; it does not need a full authoring system.

2. **Document the email-based invite decision**
   **Intent:** Prevent drift between what the plan implements and what the PRD/roadmap currently say.
   **Contract:** Update the relevant planning artifacts so teammate identity for the MVP is described as email-based rather than username-based wherever that wording would otherwise mislead `S-01` implementation.

3. **Capture verification guidance for downstream work**
   **Intent:** Make it obvious how later slices should rely on the foundation safely.
   **Contract:** Document the key schema invariants, privacy caveat, retention assumption, and invite-claim expectations in change-local references or plan notes so the implementer of `S-01` and `S-02` does not have to rediscover them.

### Success Criteria

#### Automated Verification

- The chosen template initialization path runs without creating duplicate selected-game records.
- `npm run lint` passes after doc and service-contract updates.
- `npm run build` passes with the final foundation shape.

#### Manual Verification

- Confirm at least one selected game template exists and is available to later round creation logic.
- Confirm the PRD/roadmap wording no longer conflicts with the implemented email-based invite approach.
- Confirm the next slice can begin team-setup work without reopening this change for schema redesign.

---

## Testing Strategy

### Unit Tests

- Validate service-layer mapping for pending invite states, duplicate membership detection, and participant-safe response/history payload shaping if the repo adds or already contains a lightweight service-test pattern during implementation.
- Validate any pure data helpers that compute retention visibility windows or normalize invite emails.

### Integration Tests

- Migration-level verification against local Supabase covering table creation, uniqueness constraints, and basic RLS access paths.
- Service-level flow verification for:
  - create team as authenticated user
  - add pending invite by email
  - claim/activate membership for a matching account
  - create a round and reject a second response from the same participant

### Manual Testing Steps

1. Create two test accounts in local Supabase and verify one can own a team while both can become members of the same team.
2. Create a pending invite for an email that does not yet have a Bondify account, then create that account and verify the foundation contract can resolve it.
3. Create a history-eligible round, submit responses, and confirm the stored record contains responder identity internally while participant-facing reads do not expose it.
4. Clear or expire a history-eligible record using the chosen contract and verify later reads can distinguish hidden history from active history.

## Performance Considerations

- Optimize for the shaped MVP scale: dozens to roughly a hundred users, not broad public traffic.
- Add indexes for the query paths that downstream slices will certainly use: memberships by user/team, invites by team/email/state, rounds by team/status/created time, and responses by round/participant.
- Avoid over-normalizing into tables that add joins without buying MVP clarity.
- Do not add caching, queues, or background workers in this change.

## Migration Notes

- This is a greenfield domain migration, so backward compatibility risk is low.
- The biggest migration risk is getting RLS wrong early and forcing every later slice to work around it; prioritize clear membership-based policies over clever abstractions.
- If implementation chooses database-side profile synchronization, verify the behavior against both local sign-up and future provider changes so account creation remains deterministic.
- Because history cleanup automation is intentionally deferred, the schema should make eventual deletion or hiding idempotent and easy to audit.

## References

- Product requirements: `context/foundation/prd.md`
- Roadmap item: `context/foundation/roadmap.md`
- Change identity: `context/changes/F-01-team-and-game-data-foundation/change.md`
- Existing auth client: `src/lib/supabase.ts`
- Existing auth guard: `src/middleware.ts`
- Existing auth routes: `src/pages/api/auth/signin.ts`, `src/pages/api/auth/signup.ts`, `src/pages/api/auth/signout.ts`
- Existing auth UI: `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`, `src/pages/auth/confirm-email.astro`
- Shared type convention: `src/types.ts`
- Service-layer convention: `src/lib/services/`
- Migration convention: `supabase/migrations/`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Domain schema and access rules

#### Automated

- [x] 1.1 Migration applies cleanly in local Supabase — 73497b7
- [x] 1.2 Lint passes with schema-facing updates — 73497b7
- [x] 1.3 Build passes with schema-facing updates — 73497b7

#### Manual

- [x] 1.4 Domain tables, constraints, and indexes verified in local DB — 73497b7
- [x] 1.5 Multi-team membership contract verified manually — 73497b7
- [x] 1.6 Pending pre-sign-up invite verified manually — 73497b7

### Phase 2: App-facing types and service contracts

#### Automated

- [x] 2.1 Lint passes with shared types and service modules — 940bddd
- [x] 2.2 Build passes with service-layer contracts — 940bddd

#### Manual

- [x] 2.3 Downstream slice contract coverage reviewed — 940bddd
- [x] 2.4 Participant-facing payloads verified to omit responder identity — 940bddd

### Phase 3: Reference data, verification path, and doc alignment

#### Automated

- [x] 3.1 Selected-game initialization runs without duplicates — 21ba943
- [x] 3.2 Lint passes after final doc and contract updates — 21ba943
- [x] 3.3 Build passes with final foundation shape — 21ba943

#### Manual

- [x] 3.4 Selected game templates verified locally — 21ba943
- [x] 3.5 Product docs aligned with email-based invite decision — 21ba943
- [x] 3.6 Next slice confirmed unblocked without schema redesign — 21ba943
