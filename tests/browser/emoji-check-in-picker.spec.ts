import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createCleanupRegistry } from "../helpers/cleanup";
import { createEmojiSessionAs, createTeamAs, mintUser, type TestUser } from "../helpers/fixtures";
import { ensureLocalSupabaseTestEnv } from "../helpers/supabase-env";

const cleanup = createCleanupRegistry();
let owner: TestUser;
let teamId = "";

test.describe("Emoji Check-In picker", () => {
  test.beforeAll(async () => {
    ensureLocalSupabaseTestEnv();

    const suffix = randomUUID().slice(0, 6);
    owner = await mintUser(`playwright-owner-${suffix}`, cleanup);
    const team = await createTeamAs(owner, `Bondify Browser Team ${suffix}`, cleanup);
    teamId = team.id;
    await createEmojiSessionAs(owner, teamId);
  });

  test.afterAll(async () => {
    await cleanup.cleanup();
  });

  test("lets a teammate pick up to three emojis and submit without rendering picker descriptions", async ({ page }) => {
    await page.goto("/auth/signin");
    await page.evaluate(
      async (credentials) => {
        const response = await fetch("/api/auth/signin", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams(credentials).toString(),
          credentials: "same-origin",
        });

        if (!response.ok) {
          throw new Error(`Sign-in request failed with ${response.status}.`);
        }

        window.location.href = "/dashboard";
      },
      {
        email: owner.email,
        password: owner.password,
      },
    );

    await page.waitForURL(/\/dashboard/);

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
  });
});
