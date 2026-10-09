import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "apps/api/src/modules/patrols/patrols.test.ts",
      "apps/ranger/src/lib/patrolSync.test.ts",
      "apps/ranger/src/pages/AuthFlow.test.tsx",
      "packages/offline/src/index.test.ts",
    ],
    testNamePattern: /patrol|waypoint|gps/i,
    environment: "node",
    testTimeout: 15_000,
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      reporter: ["text", "html", "json-summary", "lcov"],
      include: [
        "apps/api/src/modules/patrols/{repository,routes,seed,service,types}.ts",
        "apps/ranger/src/HomePage.tsx",
        "apps/ranger/src/app/PatrolSyncCoordinator.tsx",
        "apps/ranger/src/auth/AuthContext.tsx",
        "apps/ranger/src/lib/{patrols,patrolSync,useGpsPosition,useNetworkStatus}.ts",
        "apps/ranger/src/pages/{NewWaypointPage,PatrolMapPage,PatrolSummaryPage}.tsx",
        "packages/offline/src/index.ts",
        "packages/shared/src/{enums,schemas}.ts",
        "packages/ui/src/PatrolMap.tsx",
      ],
    },
  },
});
