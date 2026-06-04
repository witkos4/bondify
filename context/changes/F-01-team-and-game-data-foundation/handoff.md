# Team and game foundation handoff

This note captures the foundation rules that downstream slices should treat as the working Bondify contract.

## Identity and invites

- The MVP invite identifier is **email**, not username.
- Invite matching is done against `profiles.normalized_email`.
- Pending invites can exist before the invited account is created.
- Invite acceptance is an explicit action that turns a pending invite into an accepted invite and then creates membership.

## Membership and team rules

- `team_memberships` is the canonical record of active participation.
- A profile can belong to multiple teams.
- A team cannot contain duplicate memberships for the same profile.
- A pending invite email cannot be duplicated within the same team while the invite is unresolved.

## Gameplay and privacy rules

- `game_templates` -> `game_rounds` -> `game_responses` is the required data flow.
- The database stores responder identity for integrity and one-response enforcement.
- Participant-facing contracts must not expose `profile_id` or `membership_id` from responses.
- Shared reveal and history payloads should be built from the service layer, not raw table reads in UI code.

## History and retention rules

- Only history-enabled templates should appear in team history.
- History visibility is controlled by `game_rounds.history_visible_until`.
- Owner-clear behavior should use `game_rounds.history_cleared_at`.
- Automated expiry is still deferred; later cleanup work should build on these fields rather than redesigning the schema.

## Next-slice expectations

- `S-01` should reuse the service layer for profile reads, team creation, pending invite creation, invite listing, and invite acceptance.
- `S-02` should reuse the service layer for template listing, round creation, and one-response submission.
- `S-03` and `S-04` should keep using participant-safe reveal/history service payloads instead of exposing raw response records.
