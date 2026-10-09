import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "apps/api/src/modules/analytics/**/*.test.ts",
      "packages/shared/src/analytics.test.ts",
      "apps/ops/src/features/analytics/**/*.test.{ts,tsx}",
    ],
    testTimeout: 15000,
    fileParallelism: false,
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage/m4",
      reporter: ["text", "json-summary", "json", "html"],
      include: [
        "apps/api/src/modules/analytics/**/*.ts",
        "packages/shared/src/analytics.ts",
        "apps/ops/src/features/analytics/**/*.{ts,tsx}",
      ],
      // Spatial SQL is validated by the isolated database suite and reported separately.
      exclude: [
        "**/*.test.*",
        "**/testing.ts",
        "apps/api/src/modules/analytics/repository.ts",
      ],
      thresholds: { lines: 85, statements: 85, functions: 85, branches: 85 },
    },
  },
});
