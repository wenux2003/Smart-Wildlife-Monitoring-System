import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["{apps,packages}/**/*.test.ts", "{apps,packages}/**/*.test.tsx"],
    environment: "node",
  },
});
