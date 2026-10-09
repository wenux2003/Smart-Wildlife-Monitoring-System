import { expect, it } from "vitest";
import { checkSeedTarget, seedId } from "./seed.js";
it("uses stable namespaced UUIDs and restricts remote and production seeding", () => {
  expect(seedId("YALA:incident:1")).toBe(seedId("YALA:incident:1"));
  expect(seedId("YALA:incident:1")).toMatch(/^[a-f0-9-]{14}5[a-f0-9-]{21}$/);
  expect(seedId("YALA:incident:1")).not.toBe(seedId("YALA:incident:2"));
  expect(() =>
    checkSeedTarget("postgres://a:b@127.0.0.1/test", false, false),
  ).not.toThrow();
  expect(() =>
    checkSeedTarget("postgres://a:b@example.org/test", false, false),
  ).toThrow("confirm");
  expect(() =>
    checkSeedTarget("postgres://a:b@example.org/test", false, true),
  ).not.toThrow();
  expect(() =>
    checkSeedTarget("postgres://a:b@localhost/test", true, true),
  ).toThrow("production");
});
