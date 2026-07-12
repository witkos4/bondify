import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";
import { createTeamAs, mintUser } from "../helpers/fixtures";
import { createCleanupRegistry } from "../helpers/cleanup";

test.describe("team name editing", () => {
  test("lets the owner rename the selected team from management", async ({ page }) => {
    const cleanup = createCleanupRegistry();
    const owner = await mintUser("playwright-team-name", cleanup);
    const team = await createTeamAs(owner, `Bondify Rename Team ${Date.now()}`, cleanup);
    const managementPath = `/teams/${encodeURIComponent(team.id)}/manage`;
    const updatedName = `Bondify Updated Team ${Date.now()}`;

    try {
      await signInAs(page, owner, managementPath);

      const editForm = page.getByRole("form", { name: "Edit team name" });
      await expect(editForm).toBeVisible();
      await editForm.getByRole("textbox", { name: "Team name" }).fill(`  ${updatedName}  `);
      await editForm.getByRole("button", { name: "Save team name" }).click();

      await expect(page).toHaveURL(new RegExp(`${managementPath}$`));
      await expect(page.getByRole("heading", { name: updatedName }).first()).toBeVisible();
      await expect(page.getByText(`${updatedName} was renamed successfully.`)).toBeVisible();

      const invalidResponse = await page.request.post("/api/teams/update", {
        headers: {
          Origin: "http://127.0.0.1:4323",
          Referer: `http://127.0.0.1:4323${managementPath}`,
        },
        maxRedirects: 0,
        form: {
          teamId: team.id,
          surface: "management",
          teamName: "   ",
        },
      });

      expect(invalidResponse.status()).toBe(302);
      expect(invalidResponse.headers().location).toBe(`${managementPath}#edit-team-name`);
    } finally {
      await cleanup.cleanup();
    }
  });
});
