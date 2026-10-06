import { afterEach, describe, expect, it } from "vitest";
import { Role } from "@wr/shared";
import { createServer } from "../../server.js";
import type { AuthUser } from "./repository.js";
import { assertParkAccess, canAccessPark } from "./guard.js";
import type { SessionUser } from "./guard.js";
import { hashPassword, sessionToken, tokenHash } from "./security.js";
import { memoryRepository } from "./testing.js";

const YALA = "11111111-1111-4111-8111-111111111111";
const WILPATTU = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-10-06T00:00:00Z");
const servers: ReturnType<typeof createServer>[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

function setup() {
  const state = memoryRepository();
  const server = createServer({
    repository: state.repository,
    clock: { now: () => NOW },
  });
  servers.push(server);
  // Example module routes, written the way M1–M4 will use the guard.
  server.get(
    "/api/test/managers-only",
    { preHandler: server.authorize({ roles: [Role.PARK_MANAGER] }) },
    async (request) => ({ user: request.user }),
  );
  server.get(
    "/api/test/signed-in",
    { preHandler: server.authorize() },
    async (request) => ({ role: request.user!.role }),
  );
  server.get<{ Params: { parkId: string } }>(
    "/api/test/parks/:parkId",
    {
      preHandler: server.authorize({
        roles: [Role.SUPER_ADMIN, Role.PARK_MANAGER, Role.RESEARCHER],
      }),
    },
    async (request) => {
      assertParkAccess(request.user, request.params.parkId);
      return { ok: true };
    },
  );
  server.get("/api/test/crash", async () => {
    throw new Error("private database connection string");
  });
  server.post("/api/test/echo", async (request) => request.body);

  /** Adds an account with a live session and returns its cookie. */
  function signedIn(role: Role, overrides: Partial<AuthUser> = {}) {
    const id = crypto.randomUUID();
    state.users.set(id, {
      id,
      name: `Test ${role}`,
      email: `${id}@example.org`,
      password_hash: "unused",
      role,
      park_id:
        role === Role.SUPER_ADMIN || role === Role.RESEARCHER ? null : YALA,
      park_name: null,
      disabled_at: null,
      must_change_password: false,
      ...overrides,
    });
    const token = sessionToken();
    state.sessions.set(tokenHash(token), {
      id,
      expires: new Date(NOW.getTime() + 60_000),
    });
    return { cookie: `wr_session=${token}`, id };
  }
  return { ...state, server, signedIn };
}

describe("app.authorize route guard", () => {
  it("rejects requests without a valid session", async () => {
    const { server } = setup();
    for (const cookie of [
      undefined,
      "wr_session=not-a-token",
      `wr_session=${sessionToken()}`,
    ]) {
      const response = await server.inject({
        url: "/api/test/signed-in",
        headers: cookie ? { cookie } : {},
      });
      expect(response.statusCode).toBe(401);
      expect(response.json().code).toBe("UNAUTHENTICATED");
    }
  });

  it("allows the listed role and attaches only public account fields", async () => {
    const { server, signedIn } = setup();
    const { cookie } = signedIn(Role.PARK_MANAGER, {
      park_name: "Yala National Park",
    });
    const response = await server.inject({
      url: "/api/test/managers-only",
      headers: { cookie },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().user).toMatchObject({
      role: "PARK_MANAGER",
      parkId: YALA,
      parkName: "Yala National Park",
    });
    expect(response.body).not.toContain("password");
  });

  it("forbids roles that are not listed, including the Super Admin", async () => {
    const { server, signedIn } = setup();
    for (const role of [
      Role.RANGER,
      Role.RESEARCHER,
      Role.LIAISON_OFFICER,
      Role.SUPER_ADMIN,
    ]) {
      const response = await server.inject({
        url: "/api/test/managers-only",
        headers: { cookie: signedIn(role).cookie },
      });
      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({
        code: "FORBIDDEN",
        message: "Your role does not allow this action.",
      });
    }
  });

  it("allows any active role when no roles are listed", async () => {
    const { server, signedIn } = setup();
    const response = await server.inject({
      url: "/api/test/signed-in",
      headers: { cookie: signedIn(Role.RESEARCHER).cookie },
    });
    expect(response.json()).toEqual({ role: "RESEARCHER" });
  });

  it("treats a deactivated account as signed out everywhere", async () => {
    const { server, signedIn } = setup();
    const { cookie } = signedIn(Role.PARK_MANAGER, { disabled_at: NOW });
    expect(
      (
        await server.inject({
          url: "/api/test/managers-only",
          headers: { cookie },
        })
      ).statusCode,
    ).toBe(401);
    const me = await server.inject({
      url: "/api/auth/me",
      headers: { cookie },
    });
    expect(me.statusCode).toBe(401);
    expect(String(me.headers["set-cookie"])).toContain("Max-Age=0");
  });

  it("refuses sign-in for a deactivated account only after the password matches", async () => {
    const { server, users } = setup();
    const password = "a-long-test-passphrase";
    users.set("ranger", {
      id: "ranger",
      name: "Deactivated Ranger",
      email: "ranger@example.org",
      password_hash: await hashPassword(password),
      role: Role.RANGER,
      park_id: YALA,
      disabled_at: NOW,
      must_change_password: false,
    });
    const login = (attempt: string) =>
      server.inject({
        method: "POST",
        url: "/api/auth/login",
        headers: { origin: "http://localhost:5174" },
        payload: { email: "ranger@example.org", password: attempt },
      });
    expect((await login("wrong-password")).statusCode).toBe(401);
    const response = await login(password);
    expect(response.statusCode).toBe(403);
    expect(response.json().message).toContain("deactivated");
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("blocks module routes until a temporary password is changed", async () => {
    const { server, signedIn } = setup();
    const { cookie } = signedIn(Role.PARK_MANAGER, {
      must_change_password: true,
    });
    const response = await server.inject({
      url: "/api/test/managers-only",
      headers: { cookie },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().code).toBe("PASSWORD_CHANGE_REQUIRED");
    const me = await server.inject({
      url: "/api/auth/me",
      headers: { cookie },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.mustChangePassword).toBe(true);
  });

  it("returns 503 without details when the account store fails", async () => {
    const { server, signedIn, repository } = setup();
    const { cookie } = signedIn(Role.PARK_MANAGER);
    repository.sessionUser = async () => {
      throw new Error("private database connection string");
    };
    const response = await server.inject({
      url: "/api/test/managers-only",
      headers: { cookie },
    });
    expect(response.statusCode).toBe(503);
    expect(response.body).not.toContain("private");
  });

  it("returns 503 when no account store is configured", async () => {
    const previous = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      const server = createServer();
      servers.push(server);
      server.get(
        "/api/test/guarded",
        { preHandler: server.authorize() },
        async () => "ok",
      );
      const response = await server.inject({ url: "/api/test/guarded" });
      expect(response.statusCode).toBe(503);
      expect(response.json().code).toBe("AUTH_UNAVAILABLE");
    } finally {
      if (previous !== undefined) process.env.DATABASE_URL = previous;
    }
  });
});

describe("park scoping", () => {
  const user = (role: Role, parkId: string | null): SessionUser => ({
    id: "u",
    name: "U",
    email: "u@example.org",
    role,
    parkId,
    parkName: null,
  });

  it("limits staff to their own park and gives the Super Admin every park", () => {
    expect(canAccessPark(user(Role.PARK_MANAGER, YALA), YALA)).toBe(true);
    expect(canAccessPark(user(Role.PARK_MANAGER, YALA), WILPATTU)).toBe(false);
    expect(canAccessPark(user(Role.RESEARCHER, null), YALA)).toBe(false);
    expect(canAccessPark(user(Role.SUPER_ADMIN, null), WILPATTU)).toBe(true);
    expect(() => assertParkAccess(null, YALA)).toThrow("access to this park");
  });

  it("returns a typed 403 from module routes for another park", async () => {
    const { server, signedIn } = setup();
    const manager = signedIn(Role.PARK_MANAGER).cookie;
    const admin = signedIn(Role.SUPER_ADMIN).cookie;
    const researcher = signedIn(Role.RESEARCHER).cookie;
    const get = (parkId: string, cookie: string) =>
      server.inject({ url: `/api/test/parks/${parkId}`, headers: { cookie } });

    expect((await get(YALA, manager)).statusCode).toBe(200);
    const other = await get(WILPATTU, manager);
    expect(other.statusCode).toBe(403);
    expect(other.json()).toEqual({
      code: "PARK_FORBIDDEN",
      message: "You do not have access to this park.",
    });
    expect((await get(WILPATTU, admin)).statusCode).toBe(200);
    expect((await get(YALA, researcher)).statusCode).toBe(403);
  });
});

describe("server error mapping", () => {
  it("hides unexpected errors behind a generic 500", async () => {
    const { server } = setup();
    const response = await server.inject({ url: "/api/test/crash" });
    expect(response.statusCode).toBe(500);
    expect(response.json().code).toBe("INTERNAL_ERROR");
    expect(response.body).not.toContain("private");
  });

  it("keeps client errors such as malformed JSON as 4xx", async () => {
    const { server } = setup();
    const response = await server.inject({
      method: "POST",
      url: "/api/test/echo",
      headers: { "content-type": "application/json" },
      payload: "{not json",
    });
    expect(response.statusCode).toBe(400);
  });
});
