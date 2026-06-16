import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { signInAs } from "./helpers";
import { createCleanupRegistry } from "../helpers/cleanup";
import {
  acceptInviteAs,
  createTeamAs,
  inviteToTeamAs,
  mintUser,
  prepareTwoTruthsCollectionRound,
  prepareTwoTruthsVotingRound,
  type TestUser,
} from "../helpers/fixtures";
import { ensureLocalSupabaseTestEnv } from "../helpers/supabase-env";

async function createTeamScenario(label: string): Promise<{
  cleanup: ReturnType<typeof createCleanupRegistry>;
  gamePath: string;
  member: TestUser;
  memberMembershipId: string;
  owner: TestUser;
  ownerMembershipId: string;
  teamId: string;
}> {
  ensureLocalSupabaseTestEnv();

  const cleanup = createCleanupRegistry();
  const suffix = randomUUID().slice(0, 6);
  const owner = await mintUser(`${label}-owner-${suffix}`, cleanup);
  const member = await mintUser(`${label}-member-${suffix}`, cleanup);
  const team = await createTeamAs(owner, `Bondify Two Truths Team ${suffix}`, cleanup);
  const invite = await inviteToTeamAs(owner, team.id, member.email);
  const acceptedInvite = await acceptInviteAs(member, invite.id);

  return {
    cleanup,
    gamePath: `/teams/${encodeURIComponent(team.id)}/games/two-truths-and-a-lie`,
    member,
    memberMembershipId: acceptedInvite.membershipId,
    owner,
    ownerMembershipId: team.ownerMembershipId,
    teamId: team.id,
  };
}

test.describe("Two Truths structured round", () => {
  test("submits a structured set, locks it, and closes collection into voting", async ({ page }) => {
    const { cleanup, gamePath, member, owner, teamId } = await createTeamScenario("playwright-two-truths-collection");

    try {
      await prepareTwoTruthsCollectionRound({
        owner,
        teamId,
      });

      await signInAs(page, member, gamePath);

      await expect(page.getByRole("heading", { name: "Collection is open" })).toBeVisible();
      await expect(
        page.getByText("Nobody has submitted yet. The first set opens the round history window automatically."),
      ).toBeVisible();
      await expect(page.getByText("You need at least two submitted sets before voting can begin.")).toBeVisible();
      await expect(page.getByRole("button", { name: "Close collection and open voting" })).toHaveCount(0);

      const memberEntryForm = page.locator('form[action="/api/games/two-truths-entry"]');
      await memberEntryForm.getByRole("textbox", { name: "Statement 1" }).fill("Member statement one");
      await memberEntryForm.getByRole("textbox", { name: "Statement 2" }).fill("Member lie statement");
      await memberEntryForm.getByRole("textbox", { name: "Statement 3" }).fill("Member statement three");
      await memberEntryForm.getByRole("radio", { name: "Statement 2" }).check();
      await memberEntryForm.getByRole("button", { name: "Save structured set" }).click();

      await expect(page.getByText("Your structured set is saved. You are locked in for this round.")).toBeVisible();
      await expect(page.getByText("Your set is saved")).toBeVisible();
      await expect(page.getByText("Your locked set")).toBeVisible();
      await expect(page.getByText("Member statement one")).toBeVisible();
      await expect(page.getByText("Member lie statement")).toBeVisible();
      await expect(page.getByText("Member statement three")).toBeVisible();
      await expect(page.getByRole("button", { name: "Save structured set" })).toHaveCount(0);
      await expect(page.getByText("1 set is ready for this round")).toBeVisible();
      await expect(page.getByText("You need at least two submitted sets before voting can begin.")).toBeVisible();

      await page.context().clearCookies();
      await signInAs(page, owner, gamePath);

      await expect(page.getByRole("heading", { name: "Collection is open" })).toBeVisible();
      await expect(page.getByText("1 set is ready for this round")).toBeVisible();
      await expect(page.getByText(member.email)).toBeVisible();

      const ownerEntryForm = page.locator('form[action="/api/games/two-truths-entry"]');
      await ownerEntryForm.getByRole("textbox", { name: "Statement 1" }).fill("Owner lie statement");
      await ownerEntryForm.getByRole("textbox", { name: "Statement 2" }).fill("Owner statement two");
      await ownerEntryForm.getByRole("textbox", { name: "Statement 3" }).fill("Owner statement three");
      await ownerEntryForm.getByRole("radio", { name: "Statement 1" }).check();
      await ownerEntryForm.getByRole("button", { name: "Save structured set" }).click();

      await expect(page.getByText("Your structured set is saved. You are locked in for this round.")).toBeVisible();
      await expect(page.getByText("Sets are ready for this round")).toBeVisible();
      await expect(page.getByText("Collection can close whenever the team is ready.")).toBeVisible();
      await expect(page.getByRole("button", { name: "Close collection and open voting" })).toBeVisible();

      await page.getByRole("button", { name: "Close collection and open voting" }).click();

      await expect(page.getByText("Collection is locked. Structured voting is ready.")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Voting is active" })).toBeVisible();
      await expect(page.getByText("0/2")).toBeVisible();
      await expect(page.getByText("Reveal triggers automatically when the last required guess lands")).toBeVisible();
      await expect(page.getByText("Owner lie statement")).toBeVisible();
      await expect(
        page.locator("article").filter({ has: page.getByRole("heading", { name: member.email }) }),
      ).toBeVisible();
    } finally {
      await cleanup.cleanup();
    }
  });

  test("locks the first vote and auto-reveals after the final required guess", async ({ page }) => {
    const { cleanup, gamePath, member, memberMembershipId, owner, ownerMembershipId, teamId } =
      await createTeamScenario("playwright-two-truths");

    try {
      await prepareTwoTruthsVotingRound({
        member,
        memberMembershipId,
        owner,
        ownerMembershipId,
        teamId,
      });

      await signInAs(page, member, gamePath);

      await expect(page.getByRole("heading", { name: "Voting is active" })).toBeVisible();
      await expect(page.getByText("Every submitted participant votes once on every other set.")).toBeVisible();
      await expect(page.getByText("0/2")).toBeVisible();
      await expect(page.getByText("Your locked set")).toBeVisible();
      await expect(page.getByText("Member lie")).toBeVisible();

      const ownerVotingCard = page.locator("article").filter({
        has: page.getByRole("heading", { name: owner.email }),
      });

      await expect(ownerVotingCard.getByText("Owner lie")).toBeVisible();
      await ownerVotingCard.getByLabel("Statement 1").check();
      await ownerVotingCard.getByRole("button", { name: "Save guess" }).click();

      await expect(page.getByText("Your guess is saved.")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Voting is active" })).toBeVisible();
      await expect(page.getByText("1/2")).toBeVisible();
      await expect(ownerVotingCard.getByText("Locked guess: Statement 1")).toBeVisible();
      await expect(page.getByRole("button", { name: "Close voting and reveal recorded guesses" })).toBeVisible();

      await page.context().clearCookies();
      await signInAs(page, owner, gamePath);

      const memberVotingCard = page.locator("article").filter({
        has: page.getByRole("heading", { name: member.email }),
      });

      await expect(page.getByRole("heading", { name: "Voting is active" })).toBeVisible();
      await expect(memberVotingCard.getByText("Member lie")).toBeVisible();
      await memberVotingCard.getByLabel("Statement 2").check();
      await memberVotingCard.getByRole("button", { name: "Save guess" }).click();

      await expect(page.getByText("Your guess is saved. The round is now revealed.")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Reveal is ready" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Correct guesses plus teammates fooled" })).toBeVisible();
      await expect(page.getByText("2/2")).toBeVisible();
      await expect(page.getByText("2 total guesses counted")).toBeVisible();
      await expect(page.getByText("This was the lie")).toHaveCount(2);
      await expect(page.getByText("1 correct guess and 0 teammates fooled")).toHaveCount(2);
    } finally {
      await cleanup.cleanup();
    }
  });

  test("lets the team close voting early and reveals only the recorded guesses", async ({ page }) => {
    const { cleanup, gamePath, member, memberMembershipId, owner, ownerMembershipId, teamId } =
      await createTeamScenario("playwright-two-truths-manual-close");

    try {
      await prepareTwoTruthsVotingRound({
        member,
        memberMembershipId,
        owner,
        ownerMembershipId,
        teamId,
      });

      await signInAs(page, member, gamePath);

      const ownerVotingCard = page.locator("article").filter({
        has: page.getByRole("heading", { name: owner.email }),
      });

      await expect(page.getByRole("heading", { name: "Voting is active" })).toBeVisible();
      await expect(page.getByText("0/2")).toBeVisible();
      await expect(page.getByText("Missing guesses are ignored during scoring.")).toBeVisible();
      await ownerVotingCard.getByLabel("Statement 1").check();
      await ownerVotingCard.getByRole("button", { name: "Save guess" }).click();

      await expect(page.getByText("Your guess is saved.")).toBeVisible();
      await expect(page.getByText("1/2")).toBeVisible();
      await expect(page.getByRole("button", { name: "Close voting and reveal recorded guesses" })).toBeVisible();

      await page.context().clearCookies();
      await signInAs(page, owner, gamePath);

      await expect(page.getByRole("heading", { name: "Voting is active" })).toBeVisible();
      await expect(page.getByText("1/2")).toBeVisible();
      await expect(page.getByText("Missing guesses are ignored during scoring.")).toBeVisible();
      await page.getByRole("button", { name: "Close voting and reveal recorded guesses" }).click();

      await expect(page.getByText("Voting is closed. Reveal is ready.")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Reveal is ready" })).toBeVisible();
      await expect(page.getByText("1/2")).toBeVisible();
      await expect(page.getByText("1 total guess counted")).toBeVisible();
      await expect(page.getByText("1 recorded guess")).toBeVisible();
      await expect(page.getByText("This was the lie")).toHaveCount(2);
      await expect(page.getByText("1 correct guess and 0 teammates fooled")).toHaveCount(1);
      await expect(page.getByText("0 correct guesses and 0 teammates fooled")).toHaveCount(1);

      const ownerRevealCard = page.locator("article").filter({
        has: page.getByRole("heading", { name: owner.email }),
      });
      const memberRevealCard = page.locator("article").filter({
        has: page.getByRole("heading", { name: member.email }),
      });

      await expect(ownerRevealCard.getByText("Correct guess")).toHaveCount(1);
      await expect(
        memberRevealCard.getByText("No teammate guesses were recorded for this set before reveal."),
      ).toBeVisible();
    } finally {
      await cleanup.cleanup();
    }
  });
});
