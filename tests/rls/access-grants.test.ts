import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCleanupRegistry } from "../helpers/cleanup";
import { createTeamAs, openRoundAs } from "../helpers/fixtures";
import { setupTwoTeamScenario, type TwoTeamScenario } from "../helpers/scenario";

interface TeamSummaryShape {
  id: string;
  team_invites: { id: string; status: string }[];
  team_memberships: {
    id: string;
    profile: { email: string; id: string; normalized_email: string }[];
    profile_id: string;
  }[];
}

describe("access grants", () => {
  const cleanup = createCleanupRegistry();
  let scenario: TwoTeamScenario;

  beforeAll(async () => {
    scenario = await setupTwoTeamScenario(cleanup);
  });

  afterAll(async () => {
    await cleanup.cleanup();
  });

  it("lets a member create a second team without regressing the creator membership helper", async () => {
    const secondTeam = await createTeamAs(scenario.ownerA, "Bondify Test Team A Second", cleanup);
    const { data, error } = await scenario.ownerA.client
      .from("team_memberships")
      .select("id, team_id, profile_id")
      .eq("id", secondTeam.ownerMembershipId)
      .maybeSingle<{ id: string; profile_id: string; team_id: string }>();

    expect(error).toBeNull();
    expect(data?.team_id).toBe(secondTeam.id);
    expect(data?.profile_id).toBe(scenario.ownerA.userId);
  });

  it("grants team visibility after a real invite acceptance flow", async () => {
    const { data, error } = await scenario.memberA2.client
      .from("teams")
      .select("id, name, created_by")
      .eq("id", scenario.teamA.id)
      .maybeSingle<{ created_by: string; id: string; name: string }>();

    expect(error).toBeNull();
    expect(data?.id).toBe(scenario.teamA.id);
    expect(data?.created_by).toBe(scenario.ownerA.userId);
  });

  it("returns the dashboard team list shape with both visible roster members", async () => {
    const { data, error } = await scenario.memberA2.client
      .from("teams")
      .select(
        `
          id,
          team_memberships (
            id,
            profile_id,
            profile:profiles (
              id,
              email,
              normalized_email
            )
          ),
          team_invites (
            id,
            status
          )
        `,
      )
      .eq("id", scenario.teamA.id)
      .single<TeamSummaryShape>();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    if (!data) {
      throw new Error("Expected the invited member to load their team summary.");
    }

    const team = data;

    expect(team.team_memberships).toHaveLength(2);
    expect(team.team_memberships.map((membership) => membership.profile_id).sort()).toEqual(
      [scenario.memberA2.userId, scenario.ownerA.userId].sort(),
    );
    expect(team.team_invites.map((invite) => invite.id)).toContain(scenario.inviteToTeamA.id);
  });

  it("lets invited members read rounds opened by another teammate", async () => {
    const round = await openRoundAs(scenario.ownerA, scenario.teamA.id, "emoji-check-in");
    const { data, error } = await scenario.memberA2.client
      .from("game_rounds")
      .select("id, team_id, opened_by_profile_id, status")
      .eq("id", round.id)
      .maybeSingle<{ id: string; opened_by_profile_id: string; status: string; team_id: string }>();

    expect(error).toBeNull();
    expect(data?.id).toBe(round.id);
    expect(data?.team_id).toBe(scenario.teamA.id);
    expect(data?.opened_by_profile_id).toBe(scenario.ownerA.userId);
    expect(data?.status).toBe("open");
  });

  it("lets teammates read each other's profiles under the shared-team policy", async () => {
    const { data: ownerProfile, error: ownerProfileError } = await scenario.memberA2.client
      .from("profiles")
      .select("id, email")
      .eq("id", scenario.ownerA.userId)
      .maybeSingle<{ email: string; id: string }>();

    const { data: ownProfile, error: ownProfileError } = await scenario.memberA2.client
      .from("profiles")
      .select("id, email")
      .eq("id", scenario.memberA2.userId)
      .maybeSingle<{ email: string; id: string }>();

    expect(ownerProfileError).toBeNull();
    expect(ownerProfile?.id).toBe(scenario.ownerA.userId);
    expect(ownerProfile?.email).toBe(scenario.ownerA.email);

    expect(ownProfileError).toBeNull();
    expect(ownProfile?.id).toBe(scenario.memberA2.userId);
    expect(ownProfile?.email).toBe(scenario.memberA2.email);
  });

  it("shows the silent-filtering baseline for an unrelated outsider", async () => {
    const round = await openRoundAs(scenario.ownerA, scenario.teamA.id, "how-i-work");
    const { data: teams, error: teamsError } = await scenario.outsiderB.client
      .from("teams")
      .select("id")
      .eq("id", scenario.teamA.id);
    const { data: memberships, error: membershipsError } = await scenario.outsiderB.client
      .from("team_memberships")
      .select("id")
      .eq("team_id", scenario.teamA.id);
    const { data: rounds, error: roundsError } = await scenario.outsiderB.client
      .from("game_rounds")
      .select("id")
      .eq("id", round.id);

    expect(teamsError).toBeNull();
    expect(teams).toEqual([]);

    expect(membershipsError).toBeNull();
    expect(memberships).toEqual([]);

    expect(roundsError).toBeNull();
    expect(rounds).toEqual([]);
  });
});
