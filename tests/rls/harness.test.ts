import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCleanupRegistry } from "../helpers/cleanup";
import { setupTwoTeamScenario, type TwoTeamScenario } from "../helpers/scenario";

describe("fixture harness", () => {
  const cleanup = createCleanupRegistry();
  let scenario: TwoTeamScenario;

  beforeAll(async () => {
    scenario = await setupTwoTeamScenario(cleanup);
  });

  afterAll(async () => {
    await cleanup.cleanup();
  });

  it("builds the standard two-team scenario through real RLS paths", async () => {
    expect(new Set([scenario.ownerA.userId, scenario.memberA2.userId, scenario.outsiderB.userId]).size).toBe(3);
    expect(new Set([scenario.teamA.id, scenario.teamB.id]).size).toBe(2);

    const { data: visibleTeam, error: visibleTeamError } = await scenario.memberA2.client
      .from("teams")
      .select("id, name")
      .eq("id", scenario.teamA.id)
      .maybeSingle<{ id: string; name: string }>();

    expect(visibleTeamError).toBeNull();
    expect(visibleTeam?.id).toBe(scenario.teamA.id);

    const { data: acceptedInvite, error: inviteError } = await scenario.ownerA.client
      .from("team_invites")
      .select("id, status, accepted_profile_id")
      .eq("id", scenario.inviteToTeamA.id)
      .maybeSingle<{ accepted_profile_id: string | null; id: string; status: string }>();

    expect(inviteError).toBeNull();
    expect(acceptedInvite?.status).toBe("accepted");
    expect(acceptedInvite?.accepted_profile_id).toBe(scenario.memberA2.userId);
  });
});
