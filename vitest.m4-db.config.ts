import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["apps/api/src/modules/analytics/**/*.db.test.ts"],
    fileParallelism: false,
    testTimeout: 15000,
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage/m4-db",
      reporter: ["text", "json-summary", "html"],
      include: ["apps/api/src/modules/analytics/repository.ts"],
    },
  },
});
