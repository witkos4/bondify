import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["tests/setup/global.ts"],
    include: ["tests/**/*.test.ts"],
    hookTimeout: 30000,
    testTimeout: 15000,
  },
});
