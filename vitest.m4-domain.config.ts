import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["apps/api/src/modules/analytics/domain/*.test.ts"],
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage/m4-domain",
      reporter: ["text", "json-summary"],
      include: ["apps/api/src/modules/analytics/domain/*.ts"],
      exclude: ["**/*.test.ts"],
      thresholds: {
        lines: 100,
        statements: 100,
        functions: 100,
        branches: 100,
      },
    },
  },
});
