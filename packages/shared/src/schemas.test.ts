import { describe, expect, it } from "vitest";
import { HealthResponseSchema } from "./schemas.js";

describe("HealthResponseSchema", () => {
  it("accepts a healthy status response", () => {
    expect(HealthResponseSchema.parse({ status: "ok" })).toEqual({
      status: "ok",
    });
  });

  it("rejects an unknown health status", () => {
    expect(HealthResponseSchema.safeParse({ status: "unhealthy" }).success).toBe(
      false,
    );
  });
});
