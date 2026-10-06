import { afterEach, describe, expect, it } from "vitest";
import { createServer } from "../../server.js";
import type { AuthRepository, AuthUser } from "./repository.js";
import { hashPassword, tokenHash, verifyPassword } from "./security.js";

function memoryRepository() {
  const users = new Map<string, AuthUser>();
  const sessions = new Map<string, { id: string; expires: Date }>();
  const repository: AuthRepository = {
    async findUser(email) {
      return [...users.values()].find((user) => user.email === email);
    },
    async createUser(user) {
      if ([...users.values()].some((existing) => existing.email === user.email))
        return false;
      users.set(user.id, user);
      return true;
    },
    async saveSession(hash, id, expires) {
      sessions.set(hash, { id, expires });
    },
    async sessionUser(hash, now) {
      const session = sessions.get(hash);
      return session && session.expires > now
        ? users.get(session.id)
        : undefined;
    },
    async removeSession(hash) {
      sessions.delete(hash);
    },
  };
  return { repository, users, sessions };
}
const servers: ReturnType<typeof createServer>[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});
function setup() {
  const state = memoryRepository();
  let now = new Date("2026-10-06T00:00:00Z");
  const server = createServer({
    repository: state.repository,
    clock: { now: () => now },
    secure: true,
  });
  servers.push(server);
  return {
    ...state,
    server,
    advance: () => {
      now = new Date("2026-10-14T00:00:00Z");
    },
  };
}
const headers = { origin: "http://localhost:5174" };
const account = {
  name: "Test Ranger",
  email: "TEST@example.com",
  password: "a-long-test-passphrase",
};

describe("real account authentication", () => {
  it("salts password hashes and rejects incorrect passwords", async () => {
    const first = await hashPassword(account.password);
    const second = await hashPassword(account.password);
    expect(first).not.toBe(second);
    expect(first).not.toContain(account.password);
    expect(await verifyPassword(account.password, first)).toBe(true);
    expect(await verifyPassword("wrong", first)).toBe(false);
    expect(await verifyPassword(account.password, "corrupted")).toBe(false);
  });
  it("registers a least-privilege account with a hashed, HttpOnly session", async () => {
    const { server, users, sessions } = setup();
    const response = await server.inject({
      method: "POST",
      url: "/api/auth/register",
      headers,
      payload: account,
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().user).toMatchObject({
      email: "test@example.com",
      role: "RESEARCHER",
      parkId: null,
    });
    expect(response.body).not.toContain("password");
    const cookie = String(response.headers["set-cookie"]);
    expect(cookie).toContain("HttpOnly; SameSite=Lax");
    expect(cookie).toContain("Secure");
    const raw = cookie.split(";")[0].split("=")[1];
    expect(sessions.has(raw)).toBe(false);
    expect(sessions.has(tokenHash(raw))).toBe(true);
    expect([...users.values()][0].password_hash).not.toBe(account.password);
    expect(
      (await server.inject({ url: "/api/auth/me", headers: { cookie } }))
        .statusCode,
    ).toBe(200);
  });
  it("handles duplicate emails case-insensitively and refuses privilege fields", async () => {
    const { server, users } = setup();
    await server.inject({
      method: "POST",
      url: "/api/auth/register",
      headers,
      payload: account,
    });
    expect(
      (
        await server.inject({
          method: "POST",
          url: "/api/auth/register",
          headers,
          payload: { ...account, email: "test@example.com" },
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await server.inject({
          method: "POST",
          url: "/api/auth/register",
          headers,
          payload: { ...account, role: "PARK_MANAGER" },
        })
      ).statusCode,
    ).toBe(400);
    expect(users.size).toBe(1);
  });
  it("rejects weak credentials and cross-origin mutations", async () => {
    const { server, users } = setup();
    expect(
      (
        await server.inject({
          method: "POST",
          url: "/api/auth/register",
          headers,
          payload: { ...account, password: "short" },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await server.inject({
          method: "POST",
          url: "/api/auth/register",
          headers: { origin: "https://untrusted.example" },
          payload: account,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await server.inject({
          method: "POST",
          url: "/api/auth/register",
          payload: account,
        })
      ).statusCode,
    ).toBe(403);
    expect(users.size).toBe(0);
  });
  it("rejects wrong credentials, rotates sessions, and revokes on logout", async () => {
    const { server } = setup();
    const registered = await server.inject({
      method: "POST",
      url: "/api/auth/register",
      headers,
      payload: account,
    });
    const previous = String(registered.headers["set-cookie"]).split(";")[0];
    const wrong = await server.inject({
      method: "POST",
      url: "/api/auth/login",
      headers,
      payload: { email: account.email, password: "wrong" },
    });
    const absent = await server.inject({
      method: "POST",
      url: "/api/auth/login",
      headers,
      payload: { email: "missing@example.com", password: "wrong" },
    });
    expect(wrong.statusCode).toBe(401);
    expect(absent.json()).toEqual(wrong.json());
    const login = await server.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { ...headers, cookie: previous },
      payload: { email: account.email, password: account.password },
    });
    expect(login.statusCode).toBe(200);
    const current = String(login.headers["set-cookie"]).split(";")[0];
    expect(current).not.toBe(previous);
    expect(
      (
        await server.inject({
          url: "/api/auth/me",
          headers: { cookie: previous },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await server.inject({
          method: "POST",
          url: "/api/auth/logout",
          headers: { ...headers, cookie: current },
        })
      ).statusCode,
    ).toBe(204);
    expect(
      (
        await server.inject({
          url: "/api/auth/me",
          headers: { cookie: current },
        })
      ).statusCode,
    ).toBe(401);
  });
  it("rejects missing, tampered and expired sessions", async () => {
    const { server, advance } = setup();
    expect((await server.inject({ url: "/api/auth/me" })).statusCode).toBe(401);
    expect(
      (
        await server.inject({
          url: "/api/auth/me",
          headers: { cookie: "wr_session=invalid" },
        })
      ).statusCode,
    ).toBe(401);
    const registered = await server.inject({
      method: "POST",
      url: "/api/auth/register",
      headers,
      payload: account,
    });
    advance();
    expect(
      (
        await server.inject({
          url: "/api/auth/me",
          headers: { cookie: String(registered.headers["set-cookie"]) },
        })
      ).statusCode,
    ).toBe(401);
  });
  it("rate limits repeated attempts", async () => {
    const { server } = setup();
    for (let i = 0; i < 30; i++)
      await server.inject({
        method: "POST",
        url: "/api/auth/login",
        headers,
        payload: {},
      });
    const response = await server.inject({
      method: "POST",
      url: "/api/auth/login",
      headers,
      payload: {},
    });
    expect(response.statusCode).toBe(429);
    expect(response.headers["retry-after"]).toBe("900");
  });
  it("keeps database failures private", async () => {
    const { server, repository } = setup();
    repository.findUser = async () => {
      throw new Error("private database connection string");
    };
    const response = await server.inject({
      method: "POST",
      url: "/api/auth/login",
      headers,
      payload: account,
    });
    expect(response.statusCode).toBe(503);
    expect(response.body).not.toContain("private database");
  });
});
