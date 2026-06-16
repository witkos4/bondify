import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { signInAs } from "./helpers";
import { createCleanupRegistry } from "../helpers/cleanup";
import {
  createEmojiSessionAs,
  createTeamAs,
  mintUser,
  type EmojiSessionFixture,
  type TestUser,
} from "../helpers/fixtures";
import { ensureLocalSupabaseTestEnv } from "../helpers/supabase-env";

async function createEmojiCheckInScenario(label: string): Promise<{
  cleanup: ReturnType<typeof createCleanupRegistry>;
  owner: TestUser;
  session: EmojiSessionFixture;
  teamId: string;
}> {
  ensureLocalSupabaseTestEnv();

  const cleanup = createCleanupRegistry();
  const suffix = randomUUID().slice(0, 6);
  const owner = await mintUser(`${label}-${suffix}`, cleanup);
  const team = await createTeamAs(owner, `Bondify Browser Team ${suffix}`, cleanup);
  const session = await createEmojiSessionAs(owner, team.id);

  return {
    cleanup,
    owner,
    session,
    teamId: team.id,
  };
}

test.describe("Emoji Check-In picker", () => {
  test("lets a teammate pick up to three emojis and submit without rendering picker descriptions", async ({ page }) => {
    const { cleanup, owner } = await createEmojiCheckInScenario("playwright-picker");

    try {
      await signInAs(page, owner);

      const ritualSection = page.locator("#emoji-check-in");
      await expect(ritualSection.getByText("Pick the emojis that fit today")).toBeVisible();
      await expect(ritualSection.getByText("Energy is high and things feel bright.")).toHaveCount(0);

      const submitButton = ritualSection.getByRole("button", { name: "Save today's emojis" });
      await expect(submitButton).toBeDisabled();

      const upbeatCard = ritualSection.locator("label").filter({ hasText: "Upbeat" });
      const connectedCard = ritualSection.locator("label").filter({ hasText: "Connected" });
      const calmCard = ritualSection.locator("label").filter({ hasText: "Calm" });
      const steadyCard = ritualSection.locator("label").filter({ hasText: "Steady" });

      await upbeatCard.click();
      await expect(ritualSection.getByLabel("Upbeat")).toBeChecked();
      await expect(ritualSection.locator("[data-selected-count]")).toHaveText("1/3");
      await expect(submitButton).toBeEnabled();

      await connectedCard.click();
      await calmCard.click();
      await expect(ritualSection.locator("[data-selected-count]")).toHaveText("3/3");
      await expect(ritualSection.getByLabel("Connected")).toBeChecked();
      await expect(ritualSection.getByLabel("Calm")).toBeChecked();

      await steadyCard.click();
      await expect(ritualSection.getByLabel("Steady")).not.toBeChecked();
      await expect(ritualSection.locator("[data-selected-count]")).toHaveText("3/3");

      await submitButton.click();

      await expect(ritualSection.getByText("Your signal is in for today")).toBeVisible();
      await expect(ritualSection.getByText("Upbeat")).toBeVisible();
      await expect(ritualSection.getByText("Connected")).toBeVisible();
      await expect(ritualSection.getByText("Calm")).toBeVisible();
    } finally {
      await cleanup.cleanup();
    }
  });

  test("lets a signed-in teammate reveal the mood after submitting and shows the anonymous reveal summary", async ({
    page,
  }) => {
    const { cleanup, owner } = await createEmojiCheckInScenario("playwright-reveal");

    try {
      await signInAs(page, owner);

      const ritualSection = page.locator("#emoji-check-in");
      await ritualSection.locator("label").filter({ hasText: "Upbeat" }).click();
      await ritualSection.locator("label").filter({ hasText: "Calm" }).click();
      await ritualSection.getByRole("button", { name: "Save today's emojis" }).click();

      await expect(ritualSection.getByText("Your signal is in for today")).toBeVisible();
      await expect(ritualSection.getByRole("button", { name: "Reveal team mood" })).toBeVisible();

      await ritualSection.getByRole("button", { name: "Reveal team mood" }).click();

      await expect(ritualSection.getByText("Team mood revealed")).toBeVisible();
      await expect(ritualSection.getByText("Today's signal is in the open")).toBeVisible();
      await expect(ritualSection.getByText("1 teammate checked in.")).toBeVisible();
      await expect(ritualSection).toContainText("Upbeat");
      await expect(ritualSection).toContainText("Calm");
      await expect(ritualSection.getByText("1 vote")).toHaveCount(2);
    } finally {
      await cleanup.cleanup();
    }
  });
});
