import { afterAll, describe, expect, it } from "vitest";
import { adminClient } from "../helpers/clients";
import { createCleanupRegistry } from "../helpers/cleanup";
import { createEmojiSessionAs, openRoundAs, prepareTwoTruthsVotingRound } from "../helpers/fixtures";
import { setupTwoTeamScenario } from "../helpers/scenario";

async function countRows(table: string, column: string, value: string) {
  const admin = adminClient();
  const { count, error } = await admin.from(table).select("*", { count: "exact", head: true }).eq(column, value);

  if (error) {
    throw new Error(`Failed to count ${table} rows for ${column}=${value}: ${error.message}`);
  }

  return count ?? 0;
}

describe("cross-team denial", () => {
  const cleanup = createCleanupRegistry();

  afterAll(async () => {
    await cleanup.cleanup();
  });

  it("denies foreign inserts across game responses, emoji submissions, and Two Truths guesses", async () => {
    const scenario = await setupTwoTeamScenario(cleanup);
    const round = await openRoundAs(scenario.ownerA, scenario.teamA.id, "emoji-check-in");
    const emojiSession = await createEmojiSessionAs(scenario.ownerA, scenario.teamA.id);
    const votingRound = await prepareTwoTruthsVotingRound({
      member: scenario.memberA2,
      memberMembershipId: scenario.teamAMemberMembershipId,
      owner: scenario.ownerA,
      ownerMembershipId: scenario.teamA.ownerMembershipId,
      teamId: scenario.teamA.id,
    });

    const beforeResponseCount = await countRows("game_responses", "round_id", round.id);
    const beforeEmojiCount = await countRows("emoji_check_in_submissions", "session_id", emojiSession.id);
    const beforeGuessCount = await countRows("two_truths_guesses", "game_round_id", votingRound.round.id);

    const { error: responseError } = await scenario.outsiderB.client.from("game_responses").insert({
      id: crypto.randomUUID(),
      membership_id: scenario.teamB.ownerMembershipId,
      profile_id: scenario.outsiderB.userId,
      response_text: "Nope",
      round_id: round.id,
    });
    const { error: emojiError } = await scenario.outsiderB.client.from("emoji_check_in_submissions").insert({
      emojis: ["🔥"],
      id: crypto.randomUUID(),
      membership_id: scenario.teamB.ownerMembershipId,
      profile_id: scenario.outsiderB.userId,
      session_id: emojiSession.id,
    });
    const { error: guessError } = await scenario.outsiderB.client.from("two_truths_guesses").insert({
      game_round_id: votingRound.round.id,
      guessed_lie_index: 1,
      id: crypto.randomUUID(),
      target_entry_id: votingRound.targetEntryId,
      voter_membership_id: scenario.teamB.ownerMembershipId,
      voter_profile_id: scenario.outsiderB.userId,
    });

    expect(responseError?.code).toBe("42501");
    expect(emojiError?.code).toBe("42501");
    expect(guessError?.code).toBe("42501");

    expect(await countRows("game_responses", "round_id", round.id)).toBe(beforeResponseCount);
    expect(await countRows("emoji_check_in_submissions", "session_id", emojiSession.id)).toBe(beforeEmojiCount);
    expect(await countRows("two_truths_guesses", "game_round_id", votingRound.round.id)).toBe(beforeGuessCount);
  });

  it("denies owner RPCs to outsiders and non-owner teammates without mutating team state", async () => {
    const scenario = await setupTwoTeamScenario(cleanup);
    const beforeMembershipCount = await countRows("team_memberships", "team_id", scenario.teamA.id);

    const { error: outsiderRemoveError } = await scenario.outsiderB.client.rpc("remove_team_member", {
      membership_uuid: scenario.teamAMemberMembershipId,
      team_uuid: scenario.teamA.id,
    });
    const { error: teammateRemoveError } = await scenario.memberA2.client.rpc("remove_team_member", {
      membership_uuid: scenario.teamA.ownerMembershipId,
      team_uuid: scenario.teamA.id,
    });
    const { error: outsiderDeleteError } = await scenario.outsiderB.client.rpc("delete_owned_team", {
      team_uuid: scenario.teamA.id,
    });
    const { error: teammateDeleteError } = await scenario.memberA2.client.rpc("delete_owned_team", {
      team_uuid: scenario.teamA.id,
    });

    expect(outsiderRemoveError?.message).toContain("Only the team owner");
    expect(teammateRemoveError?.message).toContain("Only the team owner");
    expect(outsiderDeleteError?.message).toContain("Only the team owner");
    expect(teammateDeleteError?.message).toContain("Only the team owner");

    expect(await countRows("team_memberships", "team_id", scenario.teamA.id)).toBe(beforeMembershipCount);
    expect(await countRows("teams", "id", scenario.teamA.id)).toBe(1);
  });

  it("keeps silent zero-row updates side-effect free for foreign invites and rounds", async () => {
    const scenario = await setupTwoTeamScenario(cleanup);
    const round = await openRoundAs(scenario.ownerA, scenario.teamA.id, "rose-thorn-bud");
    const beforeInviteRead = await adminClient()
      .from("team_invites")
      .select("status, accepted_profile_id")
      .eq("id", scenario.inviteToTeamA.id)
      .single<{ accepted_profile_id: string | null; status: string }>();
    const beforeRoundRead = await adminClient()
      .from("game_rounds")
      .select("revealed_at, status")
      .eq("id", round.id)
      .single<{ revealed_at: string | null; status: string }>();

    if (beforeInviteRead.error) {
      throw new Error(beforeInviteRead.error.message);
    }

    if (beforeRoundRead.error) {
      throw new Error(beforeRoundRead.error.message);
    }

    const { data: inviteUpdateRows, error: inviteUpdateError } = await scenario.outsiderB.client
      .from("team_invites")
      .update({ status: "revoked" })
      .eq("id", scenario.inviteToTeamA.id)
      .select("id");
    const { data: roundUpdateRows, error: roundUpdateError } = await scenario.outsiderB.client
      .from("game_rounds")
      .update({ revealed_at: new Date().toISOString() })
      .eq("id", round.id)
      .select("id");

    expect(inviteUpdateError).toBeNull();
    expect(inviteUpdateRows).toEqual([]);

    expect(roundUpdateError).toBeNull();
    expect(roundUpdateRows).toEqual([]);

    const afterInviteRead = await adminClient()
      .from("team_invites")
      .select("status, accepted_profile_id")
      .eq("id", scenario.inviteToTeamA.id)
      .single<{ accepted_profile_id: string | null; status: string }>();
    const afterRoundRead = await adminClient()
      .from("game_rounds")
      .select("revealed_at, status")
      .eq("id", round.id)
      .single<{ revealed_at: string | null; status: string }>();

    if (afterInviteRead.error) {
      throw new Error(afterInviteRead.error.message);
    }

    if (afterRoundRead.error) {
      throw new Error(afterRoundRead.error.message);
    }

    expect(afterInviteRead.data).toEqual(beforeInviteRead.data);
    expect(afterRoundRead.data).toEqual(beforeRoundRead.data);
  });

  it("turns a removed member into the same zero-row reader and denied writer shape as an outsider", async () => {
    const scenario = await setupTwoTeamScenario(cleanup);
    const round = await openRoundAs(scenario.ownerA, scenario.teamA.id, "how-i-work");
    const { error: removeError } = await scenario.ownerA.client.rpc("remove_team_member", {
      membership_uuid: scenario.teamAMemberMembershipId,
      team_uuid: scenario.teamA.id,
    });

    expect(removeError).toBeNull();

    const { data: visibleTeams, error: teamsError } = await scenario.memberA2.client
      .from("teams")
      .select("id")
      .eq("id", scenario.teamA.id);
    const { error: responseError } = await scenario.memberA2.client.from("game_responses").insert({
      id: crypto.randomUUID(),
      membership_id: scenario.teamAMemberMembershipId,
      profile_id: scenario.memberA2.userId,
      response_text: "Locked out",
      round_id: round.id,
    });

    expect(teamsError).toBeNull();
    expect(visibleTeams).toEqual([]);
    expect(responseError?.code).toBe("42501");
  });

  it("does not expose a foreign invite row by id under the current select policy", async () => {
    const scenario = await setupTwoTeamScenario(cleanup);
    const { data, error } = await scenario.outsiderB.client
      .from("team_invites")
      .select("id, email, normalized_email, status")
      .eq("id", scenario.inviteToTeamA.id);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
