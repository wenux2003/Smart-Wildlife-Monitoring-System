// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveOfflineIncident, saveOfflineMedia } from "@wr/offline";
import { incidentDb, incidentRequest, syncIncidents } from "./incidents.js";
const user = {
  id: "33333333-3333-4333-8333-333333333333",
  parkId: "11111111-1111-4111-8111-111111111111",
  role: "RANGER",
  name: "Test ranger",
  email: "test@example.org",
  parkName: "Yala",
  mustChangePassword: false,
};
const payload = {
  id: "44444444-4444-4444-8444-444444444444",
  parkId: user.parkId,
  type: "POACHING" as const,
  description: "Snare found",
  capturedAt: "2026-10-07T10:00:00.000Z",
  location: { latitude: 6.52, longitude: 81.42 },
  locationStatus: "MANUAL" as const,
  locationAccuracy: null,
};
const fetchMock = vi.fn();
beforeEach(async () => {
  await incidentDb.delete();
  await incidentDb.open();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await incidentDb.delete();
});
const response = (data: object, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => data,
});
describe("Ranger sync transport", () => {
  it("only sends original user/park work after live authentication and health checks", async () => {
    await saveOfflineIncident(incidentDb, user.id, payload);
    await saveOfflineMedia(incidentDb, user.id, payload.id, {
      id: crypto.randomUUID(),
      dataUrl: "data:image/jpeg;base64,/9j/AAAA",
    });
    fetchMock.mockImplementation(async (path: string) =>
      response(
        path.endsWith("me")
          ? { user }
          : path === "/health"
            ? { status: "ok" }
            : path.endsWith("media")
              ? { ok: true }
              : {
                  ...payload,
                  reporterId: user.id,
                  source: "RANGER",
                  status: "NEW",
                  locationText: null,
                  reporterPhone: null,
                  photoUrl: null,
                  revision: 1,
                  assignedTo: null,
                  assignedAt: null,
                  firstResponseAt: null,
                  resolvedAt: null,
                  outcomeNotes: null,
                  receivedAt: payload.capturedAt,
                  reportedAt: payload.capturedAt,
                  createdAt: payload.capturedAt,
                  updatedAt: payload.capturedAt,
                },
      ),
    );
    await syncIncidents(user, true);
    expect((await incidentDb.incidents.get(payload.id))?.syncStatus).toBe(
      "SYNCED",
    );
    expect((await incidentDb.incidentMedia.toArray())[0].syncStatus).toBe(
      "SYNCED",
    );
    expect(
      fetchMock.mock.calls.find((call) => call[0] === "/api/incidents")?.[1]
        .credentials,
    ).toBe("same-origin");
  });
  it("rejects identity switches and expired sessions without reassignment", async () => {
    await saveOfflineIncident(incidentDb, user.id, payload);
    fetchMock.mockResolvedValue(response({ user: { ...user, id: "another" } }));
    await expect(syncIncidents(user)).rejects.toThrow(
      "original report account",
    );
    expect(await incidentDb.outbox.count()).toBe(1);
    fetchMock.mockResolvedValue(response({ message: "Please sign in" }, 401));
    await expect(syncIncidents(user)).rejects.toMatchObject({ status: 401 });
  });
  it("does not run for staff, missing parks or temporary-password accounts", async () => {
    for (const change of [
      { role: "RESEARCHER" },
      { parkId: null },
      { mustChangePassword: true },
    ])
      await syncIncidents({ ...user, ...change });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("leaves reports pending if health fails despite network connectivity", async () => {
    await saveOfflineIncident(incidentDb, user.id, payload);
    fetchMock.mockImplementation(async (path: string) => {
      if (path === "/health") throw new Error("API down");
      return response({ user });
    });
    await syncIncidents(user);
    expect((await incidentDb.incidents.get(payload.id))?.syncStatus).toBe(
      "PENDING",
    );
  });
  it("propagates typed HTTP errors and malformed response failures", async () => {
    fetchMock.mockResolvedValue(response({ message: "Conflict" }, 409));
    await expect(incidentRequest("/api/incidents", {})).rejects.toMatchObject({
      status: 409,
      message: "Conflict",
    });
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => {
        throw new Error("Malformed");
      },
    });
    await expect(incidentRequest("/api/incidents")).rejects.toThrow(
      "unavailable",
    );
  });
});
