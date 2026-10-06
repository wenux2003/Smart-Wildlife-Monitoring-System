import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["{apps,packages}/**/*.test.ts", "{apps,packages}/**/*.test.tsx"],
    environment: "node",
    // Authentication tests intentionally run several expensive scrypt operations.
    // Give slower development machines enough time without weakening production hashing.
    testTimeout: 15_000,
  },
});
