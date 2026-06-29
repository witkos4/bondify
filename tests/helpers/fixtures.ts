import { randomUUID } from "node:crypto";
import { adminClient, userClient, type TestActor } from "./clients";
import type { CleanupRegistry } from "./cleanup";
import { withRetry } from "./resilient";

interface ProfileRow {
  id: string;
  email: string;
  normalized_email: string;
}

interface InviteRow {
  id: string;
  team_id: string;
  email: string;
  normalized_email: string;
  status: string;
  accepted_profile_id: string | null;
  accepted_at: string | null;
}

interface GameTemplateRow {
  id: string;
  slug: string;
}

export interface TestUser extends TestActor {
  normalizedEmail: string;
}

export interface TeamFixture {
  id: string;
  name: string;
  ownerMembershipId: string;
  ownerUserId: string;
}

export interface InviteFixture {
  acceptedAt: string | null;
  acceptedProfileId: string | null;
  email: string;
  id: string;
  normalizedEmail: string;
  status: string;
  teamId: string;
}

export interface AcceptedInviteFixture {
  invite: InviteFixture;
  membershipId: string;
}

export interface RoundFixture {
  id: string;
  teamId: string;
  templateId: string;
  templateSlug: string;
}

export interface EmojiSessionFixture {
  id: string;
  sessionDate: string;
  teamId: string;
}

export interface TwoTruthsVotingFixture {
  memberEntryId: string;
  ownerEntryId: string;
  round: RoundFixture;
  targetEntryId: string;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function waitForProfileRow(userId: string) {
  const admin = adminClient();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data, error } = await withRetry(`verify mirrored profile row for ${userId}`, () =>
      admin.from("profiles").select("id, email, normalized_email").eq("id", userId).maybeSingle<ProfileRow>(),
    );

    if (error) {
      throw new Error(`Failed to verify mirrored profile row for ${userId}: ${error.message}`);
    }

    if (data) {
      return data;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  }

  throw new Error(`Timed out waiting for mirrored profile row for ${userId}.`);
}

async function requireTemplateBySlug(client: TestActor["client"], slug: string) {
  const { data, error } = await withRetry(`read template ${slug}`, () =>
    client.from("game_templates").select("id, slug").eq("slug", slug).maybeSingle<GameTemplateRow>(),
  );

  if (error) {
    throw new Error(`Failed to read template ${slug}: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Template ${slug} was not found in the seeded catalog.`);
  }

  return data;
}

export async function mintUser(label: string, cleanup: CleanupRegistry): Promise<TestUser> {
  const suffix = randomUUID().slice(0, 8);
  const email = `bondify+${label}-${suffix}@example.com`;
  const password = `Bondify!${randomUUID()}`;
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
  });

  if (error) {
    throw new Error(`Failed to mint ${label}: ${error.message}`);
  }

  cleanup.registerUser(data.user.id);

  const profile = await waitForProfileRow(data.user.id);
  const actor = await userClient({
    email,
    label,
    password,
  });

  return {
    ...actor,
    normalizedEmail: profile.normalized_email,
  };
}

export async function createTeamAs(user: TestUser, name: string, cleanup: CleanupRegistry): Promise<TeamFixture> {
  // Mirrors the production create-team sequence in bondify.ts:1828-1845.
  const teamId = randomUUID();
  const membershipId = randomUUID();
  const { error: createTeamError } = await withRetry(`create team ${name} as ${user.label}`, () =>
    user.client.from("teams").insert({
      created_by: user.userId,
      id: teamId,
      name,
    }),
  );

  if (createTeamError) {
    throw new Error(`Failed to create team ${name} as ${user.label}: ${createTeamError.message}`);
  }

  const { error: membershipError } = await withRetry(`create owner membership for ${name} as ${user.label}`, () =>
    user.client.from("team_memberships").insert({
      id: membershipId,
      profile_id: user.userId,
      team_id: teamId,
    }),
  );

  if (membershipError) {
    throw new Error(`Failed to create owner membership for ${name} as ${user.label}: ${membershipError.message}`);
  }

  cleanup.registerTeam(teamId);

  return {
    id: teamId,
    name,
    ownerMembershipId: membershipId,
    ownerUserId: user.userId,
  };
}

export async function inviteToTeamAs(owner: TestUser, teamId: string, email: string): Promise<InviteFixture> {
  // Mirrors the production invite insert path in bondify.ts:1891-1995.
  const inviteId = randomUUID();
  const normalizedEmail = normalizeEmail(email);
  const { error } = await withRetry(`invite ${email} to ${teamId} as ${owner.label}`, () =>
    owner.client.from("team_invites").insert({
      accepted_at: null,
      accepted_profile_id: null,
      email,
      id: inviteId,
      inviter_profile_id: owner.userId,
      normalized_email: normalizedEmail,
      status: "pending",
      team_id: teamId,
    }),
  );

  if (error) {
    throw new Error(`Failed to invite ${email} to ${teamId} as ${owner.label}: ${error.message}`);
  }

  return {
    acceptedAt: null,
    acceptedProfileId: null,
    email,
    id: inviteId,
    normalizedEmail: normalizedEmail,
    status: "pending",
    teamId,
  };
}

export async function acceptInviteAs(user: TestUser, inviteId: string): Promise<AcceptedInviteFixture> {
  // Mirrors the production accept-invite sequence in bondify.ts:2039-2098.
  const { data: invite, error: inviteReadError } = await withRetry(`read invite ${inviteId} as ${user.label}`, () =>
    user.client
      .from("team_invites")
      .select("id, team_id, email, normalized_email, status, accepted_profile_id, accepted_at")
      .eq("id", inviteId)
      .maybeSingle<InviteRow>(),
  );

  if (inviteReadError) {
    throw new Error(`Failed to read invite ${inviteId} as ${user.label}: ${inviteReadError.message}`);
  }

  if (!invite) {
    throw new Error(`Invite ${inviteId} was not visible to ${user.label}.`);
  }

  const acceptedAt = new Date().toISOString();
  const { data: updatedInvite, error: inviteUpdateError } = await withRetry(
    `accept invite ${inviteId} as ${user.label}`,
    () =>
      user.client
        .from("team_invites")
        .update({
          accepted_at: acceptedAt,
          accepted_profile_id: user.userId,
          status: "accepted",
        })
        .eq("id", inviteId)
        .select("id, team_id, email, normalized_email, status, accepted_profile_id, accepted_at")
        .single<InviteRow>(),
  );

  if (inviteUpdateError) {
    throw new Error(`Failed to accept invite ${inviteId} as ${user.label}: ${inviteUpdateError.message}`);
  }

  const membershipId = randomUUID();
  const { error: membershipError } = await withRetry(`create accepted membership for ${user.label}`, () =>
    user.client.from("team_memberships").insert({
      id: membershipId,
      profile_id: user.userId,
      team_id: updatedInvite.team_id,
    }),
  );

  if (membershipError) {
    throw new Error(`Failed to create accepted membership for ${user.label}: ${membershipError.message}`);
  }

  return {
    invite: {
      acceptedAt: updatedInvite.accepted_at,
      acceptedProfileId: updatedInvite.accepted_profile_id,
      email: updatedInvite.email,
      id: updatedInvite.id,
      normalizedEmail: updatedInvite.normalized_email,
      status: updatedInvite.status,
      teamId: updatedInvite.team_id,
    },
    membershipId,
  };
}

export async function openRoundAs(user: TestUser, teamId: string, slug: string): Promise<RoundFixture> {
  const template = await requireTemplateBySlug(user.client, slug);
  const roundId = randomUUID();
  const { error } = await withRetry(`open ${slug} round for ${teamId} as ${user.label}`, () =>
    user.client.from("game_rounds").insert({
      game_template_id: template.id,
      id: roundId,
      opened_by_profile_id: user.userId,
      status: "open",
      team_id: teamId,
    }),
  );

  if (error) {
    throw new Error(`Failed to open ${slug} round for ${teamId} as ${user.label}: ${error.message}`);
  }

  return {
    id: roundId,
    teamId,
    templateId: template.id,
    templateSlug: template.slug,
  };
}

export async function createEmojiSessionAs(
  user: TestUser,
  teamId: string,
  sessionDate = new Date().toISOString().slice(0, 10),
): Promise<EmojiSessionFixture> {
  const sessionId = randomUUID();
  const { error } = await withRetry(`create emoji session for ${teamId} as ${user.label}`, () =>
    user.client.from("emoji_check_in_sessions").insert({
      id: sessionId,
      session_date: sessionDate,
      status: "open",
      team_id: teamId,
    }),
  );

  if (error) {
    throw new Error(`Failed to create emoji session for ${teamId} as ${user.label}: ${error.message}`);
  }

  return {
    id: sessionId,
    sessionDate,
    teamId,
  };
}

export async function prepareTwoTruthsCollectionRound(input: {
  owner: TestUser;
  teamId: string;
}): Promise<RoundFixture> {
  const round = await openRoundAs(input.owner, input.teamId, "two-truths-and-a-lie");
  const { error: structuredRoundError } = await withRetry(`create structured Two Truths round ${round.id}`, () =>
    input.owner.client.from("two_truths_rounds").insert({
      game_round_id: round.id,
      phase: "collecting",
    }),
  );

  if (structuredRoundError) {
    throw new Error(`Failed to create structured Two Truths round ${round.id}: ${structuredRoundError.message}`);
  }

  return round;
}

export async function prepareTwoTruthsVotingRound(input: {
  member: TestUser;
  memberMembershipId: string;
  owner: TestUser;
  ownerMembershipId: string;
  teamId: string;
}): Promise<TwoTruthsVotingFixture> {
  const round = await prepareTwoTruthsCollectionRound({
    owner: input.owner,
    teamId: input.teamId,
  });

  const ownerEntryId = randomUUID();
  const memberEntryId = randomUUID();
  const { error: ownerEntryError } = await withRetry("create owner Two Truths entry", () =>
    input.owner.client.from("two_truths_entries").insert({
      author_membership_id: input.ownerMembershipId,
      author_profile_id: input.owner.userId,
      game_round_id: round.id,
      id: ownerEntryId,
      lie_statement_index: 1,
      statement_one: "Owner lie",
      statement_three: "Owner truth two",
      statement_two: "Owner truth one",
    }),
  );

  if (ownerEntryError) {
    throw new Error(`Failed to create owner Two Truths entry: ${ownerEntryError.message}`);
  }

  const { error: memberEntryError } = await withRetry("create member Two Truths entry", () =>
    input.member.client.from("two_truths_entries").insert({
      author_membership_id: input.memberMembershipId,
      author_profile_id: input.member.userId,
      game_round_id: round.id,
      id: memberEntryId,
      lie_statement_index: 2,
      statement_one: "Member truth one",
      statement_three: "Member truth two",
      statement_two: "Member lie",
    }),
  );

  if (memberEntryError) {
    throw new Error(`Failed to create member Two Truths entry: ${memberEntryError.message}`);
  }

  const { error: includeEntriesError } = await withRetry(`mark Two Truths entries in voting for ${round.id}`, () =>
    input.owner.client.from("two_truths_entries").update({ included_in_voting: true }).eq("game_round_id", round.id),
  );

  if (includeEntriesError) {
    throw new Error(`Failed to mark Two Truths entries in voting for ${round.id}: ${includeEntriesError.message}`);
  }

  const { error: phaseError } = await withRetry(`move Two Truths round ${round.id} into voting`, () =>
    input.owner.client
      .from("two_truths_rounds")
      .update({
        collection_closed_at: new Date().toISOString(),
        phase: "voting",
        voting_started_at: new Date().toISOString(),
      })
      .eq("game_round_id", round.id),
  );

  if (phaseError) {
    throw new Error(`Failed to move Two Truths round ${round.id} into voting: ${phaseError.message}`);
  }

  return {
    memberEntryId,
    ownerEntryId,
    round,
    targetEntryId: ownerEntryId,
  };
}
