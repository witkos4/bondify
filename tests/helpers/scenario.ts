import { randomUUID } from "node:crypto";
import type { CleanupRegistry } from "./cleanup";
import {
  acceptInviteAs,
  createTeamAs,
  inviteToTeamAs,
  mintUser,
  type InviteFixture,
  type TeamFixture,
  type TestUser,
} from "./fixtures";

export interface TwoTeamScenario {
  inviteToTeamA: InviteFixture;
  memberA2: TestUser;
  outsiderB: TestUser;
  ownerA: TestUser;
  teamA: TeamFixture;
  teamAMemberMembershipId: string;
  teamB: TeamFixture;
}

export async function setupTwoTeamScenario(cleanup: CleanupRegistry): Promise<TwoTeamScenario> {
  const suffix = randomUUID().slice(0, 6);
  const ownerA = await mintUser(`owner-a-${suffix}`, cleanup);
  const memberA2 = await mintUser(`member-a2-${suffix}`, cleanup);
  const outsiderB = await mintUser(`outsider-b-${suffix}`, cleanup);

  const teamA = await createTeamAs(ownerA, `Bondify Test Team A ${suffix}`, cleanup);
  const inviteToTeamA = await inviteToTeamAs(ownerA, teamA.id, memberA2.email);
  const acceptedInvite = await acceptInviteAs(memberA2, inviteToTeamA.id);
  const teamB = await createTeamAs(outsiderB, `Bondify Test Team B ${suffix}`, cleanup);

  return {
    inviteToTeamA,
    memberA2,
    outsiderB,
    ownerA,
    teamA,
    teamAMemberMembershipId: acceptedInvite.membershipId,
    teamB,
  };
}
