import type { Page } from "@playwright/test";

interface BrowserSignInCredentials {
  email: string;
  password: string;
  redirectPath: string;
}

export async function signInAs(
  page: Page,
  credentials: Pick<BrowserSignInCredentials, "email" | "password">,
  redirectPath = "/dashboard",
) {
  await page.goto("/auth/signin");
  await page.evaluate(
    async (input) => {
      const response = await fetch("/api/auth/signin", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          email: input.email,
          password: input.password,
        }).toString(),
        credentials: "same-origin",
      });

      if (!response.ok) {
        throw new Error(`Sign-in request failed with ${response.status}.`);
      }

      window.location.href = input.redirectPath;
    },
    {
      email: credentials.email,
      password: credentials.password,
      redirectPath,
    } satisfies BrowserSignInCredentials,
  );

  await page.waitForURL((url) => url.pathname === redirectPath);
}
