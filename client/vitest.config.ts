import { defineConfig } from "vitest/config";

/** Тесты только для чистой логики (domain, utils): без React Native и сети. */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
