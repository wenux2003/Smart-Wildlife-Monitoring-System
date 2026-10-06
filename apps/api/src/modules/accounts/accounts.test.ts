import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { Role } from "@wr/shared";
import type { AuthUser } from "../auth/repository.js";
import { hashPassword } from "../auth/security.js";
import { memoryRepository } from "../auth/testing.js";
import { createServer } from "../../server.js";
import { memoryAccountRepository } from "./testing.js";

const ORIGIN = "http://localhost:5174";
const PASSWORD = "test-account-password";
const PARK_YALA = "11111111-1111-4111-8111-111111111111";
const PARK_WILPATTU = "22222222-2222-4222-8222-222222222222";
const parks = [
  { id: PARK_YALA, code: "YALA", name: "Yala National Park", terrain: "Scrub" },
  { id: PARK_WILPATTU, code: "WILPATTU", name: "Wilpattu National Park", terrain: "Forest" },
];
const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

async function setup() {
  const auth = memoryRepository();
  const accounts = memoryAccountRepository({
    users: auth.users,
    sessions: auth.sessions,
    parks,
    events: auth.events,
  });
  const passwordHash = await hashPassword(PASSWORD);
  const adminId = randomUUID();
  const managerYalaId = randomUUID();
  const managerWilpattuId = randomUUID();
  const rangerYalaId = randomUUID();
  const rangerWilpattuId = randomUUID();
  const liaisonYalaId = randomUUID();
  const researcherId = randomUUID();
  const researcherYalaId = randomUUID();
  const seed = (
    id: string,
    name: string,
    email: string,
    role: AuthUser["role"],
    parkId: string | null,
  ) => auth.users.set(id, {
    id,
    name,
    email,
    password_hash: passwordHash,
    role,
    park_id: parkId,
    park_name: parkId ? parks.find((park) => park.id === parkId)?.name : null,
    disabled_at: null,
    must_change_password: false,
    created_by: null,
    created_at: new Date("2026-10-01T00:00:00Z"),
  });
  seed(adminId, "National Admin", "admin@example.org", Role.SUPER_ADMIN, null);
  seed(managerYalaId, "Yala Manager", "manager.yala@example.org", Role.PARK_MANAGER, PARK_YALA);
  seed(managerWilpattuId, "Wilpattu Manager", "manager.wilpattu@example.org", Role.PARK_MANAGER, PARK_WILPATTU);
  seed(rangerYalaId, "Yala Ranger", "ranger.yala@example.org", Role.RANGER, PARK_YALA);
  seed(rangerWilpattuId, "Wilpattu Ranger", "ranger.wilpattu@example.org", Role.RANGER, PARK_WILPATTU);
  seed(liaisonYalaId, "Yala Liaison", "liaison.yala@example.org", Role.LIAISON_OFFICER, PARK_YALA);
  seed(researcherId, "New Researcher", "new.researcher@example.org", Role.RESEARCHER, null);
  seed(researcherYalaId, "Yala Researcher", "researcher.yala@example.org", Role.RESEARCHER, PARK_YALA);

  const server = createServer({
    repository: auth.repository,
    accountsRepository: accounts.repository,
  });
  servers.push(server);
  async function login(email: string, password = PASSWORD) {
    const response = await server.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { origin: ORIGIN },
      payload: { email, password },
    });
    return {
      response,
      cookie: String(response.headers["set-cookie"]).split(";")[0],
    };
  }
  async function request(
    method: "GET" | "POST" | "PATCH",
    url: string,
    cookie: string,
    payload?: object,
  ) {
    return server.inject({
      method,
      url,
      headers: { origin: ORIGIN, cookie },
      payload,
    });
  }
  const admin = await login("admin@example.org");
  const manager = await login("manager.yala@example.org");
  const otherManager = await login("manager.wilpattu@example.org");
  return {
    server,
    auth,
    accounts,
    login,
    request,
    adminId,
    managerYalaId,
    managerWilpattuId,
    rangerYalaId,
    rangerWilpattuId,
    liaisonYalaId,
    researcherId,
    researcherYalaId,
    adminCookie: admin.cookie,
    managerCookie: manager.cookie,
    otherManagerCookie: otherManager.cookie,
  };
}

describe("account management API", () => {
  it("creates parks and staff with forced park, temporary passwords, audit, and public-only account data", async () => {
    const state = await setup();
    const createdPark = await state.request("POST", "/api/parks", state.adminCookie, {
      code: "UDAWALA",
      name: "Udawalawe National Park",
      terrain: "Grassland and reservoirs",
    });
    expect(createdPark.statusCode).toBe(201);
    expect(createdPark.json()).toMatchObject({ code: "UDAWALA", name: "Udawalawe National Park" });
    expect(state.auth.events.at(-1)?.action).toBe("PARK_CREATED");

    const createdManager = await state.request("POST", "/api/accounts", state.adminCookie, {
      name: "New Park Manager",
      email: "new.manager@example.org",
      role: "PARK_MANAGER",
      parkId: PARK_YALA,
      temporaryPassword: "temporary-manager-password",
    });
    expect(createdManager.statusCode).toBe(201);
    expect(createdManager.json()).toMatchObject({
      role: "PARK_MANAGER",
      parkId: PARK_YALA,
      mustChangePassword: true,
    });
    expect(createdManager.body).not.toContain("password_hash");
    expect(createdManager.body).not.toContain("temporary-manager-password");
    const managerId = createdManager.json().id as string;

    const signedInManager = await state.login(
      "new.manager@example.org",
      "temporary-manager-password",
    );
    const changedManagerPassword = await state.request(
      "POST",
      "/api/auth/change-password",
      signedInManager.cookie,
      {
        currentPassword: "temporary-manager-password",
        newPassword: "new-manager-password-123",
      },
    );
    const managerCookie = String(changedManagerPassword.headers["set-cookie"]).split(";")[0];
    const requestedOtherPark = await state.request(
      "GET",
      `/api/accounts?parkId=${PARK_WILPATTU}`,
      managerCookie,
    );
    expect(requestedOtherPark.statusCode).toBe(200);
    expect(requestedOtherPark.json().every(
      (account: { parkId: string | null }) => account.parkId === PARK_YALA,
    )).toBe(true);

    const createdRanger = await state.request(
      "POST",
      "/api/accounts",
      managerCookie,
      {
        name: "New Ranger",
        email: "new.ranger@example.org",
        role: "RANGER",
        parkId: PARK_WILPATTU,
        temporaryPassword: "temporary-ranger-password",
      },
    );
    expect(createdRanger.statusCode).toBe(201);
    expect(createdRanger.json()).toMatchObject({
      role: "RANGER",
      parkId: PARK_YALA,
      parkName: "Yala National Park",
      mustChangePassword: true,
    });
    expect(createdRanger.body).not.toContain("password_hash");

    const events = await state.request(
      "GET",
      `/api/accounts/${managerId}/events`,
      state.adminCookie,
    );
    expect(events.statusCode).toBe(200);
    expect(events.json()).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: "CREATED", targetUserId: managerId }),
    ]));
  }, 15_000);

  it("enforces Super Admin-only authority and Park Manager boundaries", async () => {
    const state = await setup();
    const parksResponse = await state.request("GET", "/api/parks", state.managerCookie);
    expect(parksResponse.json()).toHaveLength(1);
    expect(parksResponse.json()[0].id).toBe(PARK_YALA);

    const createPark = await state.request("POST", "/api/parks", state.managerCookie, {
      code: "NOPE",
      name: "Forbidden Park",
    });
    expect(createPark.statusCode).toBe(403);

    const createManager = await state.request("POST", "/api/accounts", state.managerCookie, {
      name: "Escalated Manager",
      email: "escalated@example.org",
      role: "PARK_MANAGER",
      parkId: PARK_YALA,
      temporaryPassword: "temporary-password-123",
    });
    expect(createManager.statusCode).toBe(403);

    const patchRole = await state.request(
      "PATCH",
      `/api/accounts/${state.rangerYalaId}`,
      state.managerCookie,
      { role: "PARK_MANAGER" },
    );
    expect(patchRole.statusCode).toBe(403);

    for (const targetId of [state.rangerWilpattuId, state.managerWilpattuId, state.adminId]) {
      const response = await state.request(
        "POST",
        `/api/accounts/${targetId}/deactivate`,
        state.managerCookie,
      );
      expect(response.statusCode).toBe(403);
    }

    const ownAccounts = await state.request(
      "GET",
      `/api/accounts?parkId=${PARK_YALA}`,
      state.managerCookie,
    );
    expect(ownAccounts.statusCode).toBe(200);
    expect(ownAccounts.json().every((account: { parkId: string | null }) => account.parkId === PARK_YALA)).toBe(true);

    const selfDeactivate = await state.request(
      "POST",
      `/api/accounts/${state.adminId}/deactivate`,
      state.adminCookie,
    );
    expect(selfDeactivate.statusCode).toBe(409);
    expect(selfDeactivate.json().code).toBe("CANNOT_MODIFY_SELF");
    const changeToSuperAdmin = await state.request(
      "PATCH",
      `/api/accounts/${state.rangerYalaId}`,
      state.adminCookie,
      { role: "SUPER_ADMIN" },
    );
    expect(changeToSuperAdmin.statusCode).toBe(403);
    const selfRoleChange = await state.request(
      "PATCH",
      `/api/accounts/${state.adminId}`,
      state.adminCookie,
      { role: "PARK_MANAGER" },
    );
    expect(selfRoleChange.statusCode).toBe(403);
  });

  it("lets only the Super Admin change a non-admin account's role and park and audits both changes", async () => {
    const state = await setup();
    const changed = await state.request(
      "PATCH",
      `/api/accounts/${state.rangerYalaId}`,
      state.adminCookie,
      { role: "LIAISON_OFFICER", parkId: PARK_WILPATTU },
    );
    expect(changed.statusCode).toBe(200);
    expect(changed.json()).toMatchObject({
      role: "LIAISON_OFFICER",
      parkId: PARK_WILPATTU,
      parkName: "Wilpattu National Park",
    });
    expect(changed.body).not.toContain("password_hash");
    const history = await state.request(
      "GET",
      `/api/accounts/${state.rangerYalaId}/events`,
      state.adminCookie,
    );
    expect(history.json()).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: "ROLE_CHANGED" }),
      expect.objectContaining({ action: "PARK_CHANGED" }),
    ]));
  });

  it("forces temporary-password change, rotates the current session and allows access afterward", async () => {
    const state = await setup();
    const created = await state.request("POST", "/api/accounts", state.adminCookie, {
      name: "Temporary Ranger",
      email: "temporary.ranger@example.org",
      role: "RANGER",
      parkId: PARK_YALA,
      temporaryPassword: "temporary-ranger-password",
    });
    const accountId = created.json().id as string;
    const signedIn = await state.login(
      "temporary.ranger@example.org",
      "temporary-ranger-password",
    );
    const locked = await state.request("GET", "/api/parks", signedIn.cookie);
    expect(locked.statusCode).toBe(403);
    expect(locked.json().code).toBe("PASSWORD_CHANGE_REQUIRED");

    const wrongCurrent = await state.request(
      "POST",
      "/api/auth/change-password",
      signedIn.cookie,
      { currentPassword: "incorrect-current-password", newPassword: "new-ranger-password-123" },
    );
    expect(wrongCurrent.statusCode).toBe(400);
    const samePassword = await state.request(
      "POST",
      "/api/auth/change-password",
      signedIn.cookie,
      { currentPassword: "temporary-ranger-password", newPassword: "temporary-ranger-password" },
    );
    expect(samePassword.statusCode).toBe(400);

    const changed = await state.request(
      "POST",
      "/api/auth/change-password",
      signedIn.cookie,
      { currentPassword: "temporary-ranger-password", newPassword: "new-ranger-password-123" },
    );
    expect(changed.statusCode).toBe(200);
    expect(changed.json().user.mustChangePassword).toBe(false);
    const rotatedCookie = String(changed.headers["set-cookie"]).split(";")[0];
    expect(rotatedCookie).not.toBe(signedIn.cookie);
    expect((await state.request("GET", "/api/auth/me", signedIn.cookie)).statusCode).toBe(401);
    expect((await state.request("GET", "/api/auth/me", rotatedCookie)).statusCode).toBe(200);
    const me = await state.request("GET", "/api/auth/me", rotatedCookie);
    expect(me.statusCode).toBe(200);
    expect(me.json().user.mustChangePassword).toBe(false);
    expect(state.auth.events.some((event) =>
      event.action === "PASSWORD_CHANGED" && event.targetUserId === accountId,
    )).toBe(true);
    expect(changed.body).not.toContain("password_hash");
  });

  it("revokes sessions on deactivation and password reset, then supports reactivation", async () => {
    const state = await setup();
    const ranger = await state.login("ranger.yala@example.org");
    const deactivated = await state.request(
      "POST",
      `/api/accounts/${state.rangerYalaId}/deactivate`,
      state.managerCookie,
    );
    expect(deactivated.statusCode).toBe(200);
    expect(deactivated.json().disabledAt).toBeTruthy();
    expect((await state.request("GET", "/api/auth/me", ranger.cookie)).statusCode).toBe(401);
    expect(state.auth.events.at(-1)?.action).toBe("DEACTIVATED");

    const reactivated = await state.request(
      "POST",
      `/api/accounts/${state.rangerYalaId}/reactivate`,
      state.managerCookie,
    );
    expect(reactivated.statusCode).toBe(200);
    expect(reactivated.json().disabledAt).toBeNull();
    expect(state.auth.events.at(-1)?.action).toBe("REACTIVATED");

    const oldSession = await state.login("ranger.yala@example.org");
    const reset = await state.request(
      "POST",
      `/api/accounts/${state.rangerYalaId}/reset-password`,
      state.managerCookie,
      { temporaryPassword: "replacement-temporary-password" },
    );
    expect(reset.statusCode).toBe(200);
    expect(reset.json().mustChangePassword).toBe(true);
    expect(reset.body).not.toContain("password_hash");
    expect((await state.request("GET", "/api/auth/me", oldSession.cookie)).statusCode).toBe(401);
    expect((await state.login("ranger.yala@example.org")).response.statusCode).toBe(401);
    expect((await state.login("ranger.yala@example.org", "replacement-temporary-password")).response.json().user.mustChangePassword).toBe(true);
    expect(state.auth.events.at(-1)?.action).toBe("PASSWORD_RESET");
  });

  it("grants and removes only Researcher access within the manager's park and records both changes", async () => {
    const state = await setup();
    const granted = await state.request(
      "POST",
      "/api/accounts/researcher-access",
      state.managerCookie,
      { email: "new.researcher@example.org", parkId: PARK_YALA, grant: true },
    );
    expect(granted.statusCode).toBe(200);
    expect(granted.json().parkId).toBe(PARK_YALA);
    expect(state.auth.events.at(-1)?.action).toBe("RESEARCHER_ACCESS_GRANTED");

    const crossPark = await state.request(
      "POST",
      "/api/accounts/researcher-access",
      state.managerCookie,
      { email: "new.researcher@example.org", parkId: PARK_WILPATTU, grant: true },
    );
    expect(crossPark.statusCode).toBe(403);

    const removed = await state.request(
      "POST",
      "/api/accounts/researcher-access",
      state.managerCookie,
      { email: "new.researcher@example.org", parkId: PARK_YALA, grant: false },
    );
    expect(removed.statusCode).toBe(200);
    expect(removed.json().parkId).toBeNull();
    expect(state.auth.events.at(-1)?.action).toBe("RESEARCHER_ACCESS_REMOVED");

    const assignedElsewhere = await state.request(
      "POST",
      "/api/accounts/researcher-access",
      state.adminCookie,
      { email: "researcher.yala@example.org", parkId: PARK_WILPATTU, grant: true },
    );
    expect(assignedElsewhere.statusCode).toBe(200);
    expect(assignedElsewhere.json().parkId).toBe(PARK_WILPATTU);
  });

  it("rejects duplicate emails, weak passwords, and malformed strict bodies", async () => {
    const state = await setup();
    const duplicate = await state.request("POST", "/api/accounts", state.adminCookie, {
      name: "Duplicate",
      email: "RANGER.YALA@example.org",
      role: "RANGER",
      parkId: PARK_YALA,
      temporaryPassword: "temporary-password-123",
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().code).toBe("EMAIL_TAKEN");

    const weakPassword = await state.request("POST", "/api/accounts", state.adminCookie, {
      name: "Weak Password",
      email: "weak@example.org",
      role: "RANGER",
      parkId: PARK_YALA,
      temporaryPassword: "short",
    });
    expect(weakPassword.statusCode).toBe(400);
    const extraField = await state.request("POST", "/api/parks", state.adminCookie, {
      code: "STRICT",
      name: "Strict Park",
      password: "must-not-be-accepted",
    });
    expect(extraField.statusCode).toBe(400);
    expect(extraField.json().code).toBe("VALIDATION_FAILED");
  });
});
