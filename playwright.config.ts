import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  reporter: "list",
  timeout: 45_000,
  use: {
    baseURL: "http://127.0.0.1:4323",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev:local -- --host 127.0.0.1 --port 4323",
    url: "http://127.0.0.1:4323/auth/signin",
    reuseExistingServer: true,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
