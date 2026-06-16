import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    globalSetup: ["tests/setup/global.ts"],
    include: ["tests/**/*.test.ts"],
    hookTimeout: 30000,
    testTimeout: 15000,
  },
});
