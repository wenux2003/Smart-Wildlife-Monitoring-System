import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: [
      "apps/api/src/modules/incidents/**/*.test.ts",
      "packages/offline/src/**/*.test.ts",
      "packages/shared/src/incidents.test.ts",
      "apps/ranger/src/**/*Incident*.test.tsx",
      "apps/ranger/src/auth/offlineIdentity.test.ts",
      "apps/ranger/src/lib/incidents.test.ts",
      "apps/ops/src/**/*Incident*.test.tsx",
      "apps/ops/src/**/*Camera*.test.tsx",
      "packages/ui/src/IncidentFields.test.tsx",
    ],
    testTimeout: 15000,
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage/m1",
      reporter: ["text", "json-summary", "html"],
      include: [
        "apps/api/src/modules/incidents/{service,routes,repository}.ts",
        "packages/offline/src/incidents.ts",
        "packages/shared/src/incidents.ts",
        "packages/ui/src/IncidentFields.tsx",
        "apps/ranger/src/{lib/incidents.ts,auth/offlineIdentity.ts,components/IncidentSync.tsx,pages/*Incident*Page.tsx,pages/CommunityReportPage.tsx}",
        "apps/ops/src/{components/IncidentLayout.tsx,pages/Incident*Page.tsx,pages/CameraReviewPage.tsx}",
      ],
      thresholds: { lines: 81, statements: 81, functions: 81, branches: 81 },
    },
  },
});
