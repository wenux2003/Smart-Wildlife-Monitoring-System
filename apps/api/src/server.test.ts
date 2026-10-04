import { afterEach, describe, expect, it } from "vitest";
import { createServer } from "./server.js";

describe("health endpoint", () => {
  const server = createServer();

  afterEach(async () => {
    if (server.server.listening) {
      await server.close();
    }
  });

  it("returns a successful health response", async () => {
    const response = await server.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });
});
