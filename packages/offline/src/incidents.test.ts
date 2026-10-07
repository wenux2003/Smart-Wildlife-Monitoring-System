import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  IncidentOfflineDatabase,
  saveOfflineIncident,
  saveOfflineMedia,
  flushIncidentOutbox,
  retryIncidentSync,
} from "./incidents.js";
import type { SyncTransport } from "./incidents.js";
import type { Incident, IncidentCreate } from "@wr/shared";
const userId = "33333333-3333-4333-8333-333333333333";
const parkId = "11111111-1111-4111-8111-111111111111";
const image =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7N8AAAAASUVORK5CYII=";
const databases: IncidentOfflineDatabase[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const db of databases.splice(0)) await db.delete();
});
function setup() {
  const db = new IncidentOfflineDatabase(`m1-test-${crypto.randomUUID()}`);
  databases.push(db);
  const payload: IncidentCreate = {
    id: crypto.randomUUID(),
    parkId,
    type: "POACHING",
    description: "Snare found",
    capturedAt: "2026-10-07T10:00:00.000Z",
    location: { latitude: 6.52, longitude: 81.42 },
    locationStatus: "MANUAL",
    locationAccuracy: null,
  };
  const owner = { userId, parkId };
  const received = new Map<string, Incident>();
  const transport: SyncTransport = {
    reachable: vi.fn(async () => true),
    create: vi.fn(async (input) => {
      if (!received.has(input.id))
        received.set(input.id, {
          ...input,
          reporterId: userId,
          source: "RANGER",
          status: "NEW",
          photoUrl: null,
          locationText: null,
          reporterPhone: null,
          revision: 1,
          assignedTo: null,
          assignedAt: null,
          firstResponseAt: null,
          resolvedAt: null,
          outcomeNotes: null,
          reportedAt: input.capturedAt,
          receivedAt: input.capturedAt,
          createdAt: input.capturedAt,
          updatedAt: input.capturedAt,
        });
      return received.get(input.id)!;
    }),
    media: vi.fn(async () => ({ ok: true })),
  };
  return { db, payload, owner, transport, received };
}
describe("M1 durable outbox", () => {
  it("commits incident and outbox together, deduplicates local saves and survives reopening", async () => {
    const s = setup();
    await saveOfflineIncident(s.db, userId, s.payload);
    await saveOfflineIncident(s.db, userId, s.payload);
    expect(await s.db.incidents.count()).toBe(1);
    expect(await s.db.outbox.count()).toBe(1);
    s.db.close();
    await s.db.open();
    expect((await s.db.incidents.get(s.payload.id))?.syncStatus).toBe(
      "PENDING",
    );
    await expect(
      saveOfflineIncident(s.db, "other-owner", s.payload),
    ).rejects.toThrow("another report");
  });
  it("rolls back the incident if outbox storage fails, preserving form recovery semantics", async () => {
    const s = setup();
    vi.spyOn(s.db.outbox, "add").mockRejectedValueOnce(
      new Error("Storage quota exceeded"),
    );
    await expect(saveOfflineIncident(s.db, userId, s.payload)).rejects.toThrow(
      "quota",
    );
    expect(await s.db.incidents.count()).toBe(0);
    expect(await s.db.outbox.count()).toBe(0);
    await saveOfflineIncident(s.db, userId, s.payload);
    expect(await s.db.incidents.count()).toBe(1);
  });
  it("uploads metadata then photo, using stable media IDs and one active flusher", async () => {
    const s = setup();
    await saveOfflineIncident(s.db, userId, s.payload);
    const media = { id: crypto.randomUUID(), dataUrl: image };
    await saveOfflineMedia(s.db, userId, s.payload.id, media);
    await saveOfflineMedia(s.db, userId, s.payload.id, media);
    await Promise.all([
      flushIncidentOutbox(s.db, s.owner, s.transport),
      flushIncidentOutbox(s.db, s.owner, s.transport),
    ]);
    expect(s.transport.create).toHaveBeenCalledTimes(1);
    expect(s.transport.media).toHaveBeenCalledTimes(1);
    expect(await s.db.incidentMedia.count()).toBe(1);
    expect(
      (await s.db.outbox.toArray()).every((i) => i.syncStatus === "SYNCED"),
    ).toBe(true);
    await flushIncidentOutbox(s.db, s.owner, s.transport);
    expect(s.transport.create).toHaveBeenCalledTimes(1);
  });
  it("never marks synchronized before the server acknowledges", async () => {
    const s = setup();
    await saveOfflineIncident(s.db, userId, s.payload);
    let resolve: (value: Incident) => void = () => {};
    const create = s.transport.create;
    const acknowledgment = new Promise<Incident>((done) => {
      resolve = done;
    });
    s.transport.create = async () => acknowledgment;
    const pending = flushIncidentOutbox(s.db, s.owner, s.transport);
    await vi.waitFor(async () =>
      expect((await s.db.incidents.get(s.payload.id))?.syncStatus).toBe(
        "SYNCING",
      ),
    );
    resolve(await create(s.payload));
    await pending;
    expect((await s.db.incidents.get(s.payload.id))?.syncStatus).toBe("SYNCED");
  });
  it("recovers interrupted syncing and a lost acknowledgment without a second server incident", async () => {
    const s = setup();
    await saveOfflineIncident(s.db, userId, s.payload);
    const original = s.transport.create;
    let lost = true;
    s.transport.create = async (input) => {
      const record = await original(input);
      if (lost) {
        lost = false;
        throw new Error("Connection lost before acknowledgment");
      }
      return record;
    };
    await flushIncidentOutbox(s.db, s.owner, s.transport, 10000);
    expect(s.received.size).toBe(1);
    expect((await s.db.incidents.get(s.payload.id))?.syncStatus).toBe(
      "PENDING",
    );
    await s.db.outbox.update(`INCIDENT_CREATE:${s.payload.id}`, {
      syncStatus: "SYNCING",
    });
    s.db.close();
    await s.db.open();
    await flushIncidentOutbox(s.db, s.owner, s.transport, 13000);
    expect(s.received.size).toBe(1);
    expect((await s.db.incidents.get(s.payload.id))?.syncStatus).toBe("SYNCED");
  });
  it("retains work when API is unreachable, scopes by original user and honors backoff", async () => {
    const s = setup();
    await saveOfflineIncident(s.db, userId, s.payload);
    s.transport.reachable = async () => false;
    await flushIncidentOutbox(s.db, s.owner, s.transport);
    expect(s.transport.create).not.toHaveBeenCalled();
    s.transport.reachable = async () => true;
    await flushIncidentOutbox(s.db, { userId: "other", parkId }, s.transport);
    expect(s.transport.create).not.toHaveBeenCalled();
    s.transport.create = vi.fn(async () => {
      throw new Error("Temporary failure");
    });
    await flushIncidentOutbox(s.db, s.owner, s.transport, 10000);
    await flushIncidentOutbox(s.db, s.owner, s.transport, 11000);
    expect(s.transport.create).toHaveBeenCalledTimes(1);
    expect((await s.db.outbox.toArray())[0].lastError).toBe(
      "Temporary failure",
    );
  });
  it.each([400, 409, 403])(
    "stops automatic retries for HTTP %i and permits manual recovery",
    async (status) => {
      const s = setup();
      await saveOfflineIncident(s.db, userId, s.payload);
      const original = s.transport.create;
      s.transport.create = vi.fn(async () => {
        throw Object.assign(new Error("Needs user action"), { status });
      });
      await flushIncidentOutbox(s.db, s.owner, s.transport);
      expect((await s.db.incidents.get(s.payload.id))?.syncStatus).toBe(
        "FAILED",
      );
      await flushIncidentOutbox(s.db, s.owner, s.transport);
      expect(s.transport.create).toHaveBeenCalledTimes(1);
      await retryIncidentSync(s.db, s.owner);
      s.transport.create = original;
      await flushIncidentOutbox(s.db, s.owner, s.transport);
      expect((await s.db.incidents.get(s.payload.id))?.syncStatus).toBe(
        "SYNCED",
      );
    },
  );
  it("exhausts eight transient retries without discarding local data", async () => {
    const s = setup();
    await saveOfflineIncident(s.db, userId, s.payload);
    s.transport.create = async () => {
      throw new Error("Network down");
    };
    for (let i = 0; i < 8; i++)
      await flushIncidentOutbox(s.db, s.owner, s.transport, i * 1000000);
    expect((await s.db.incidents.get(s.payload.id))?.syncStatus).toBe("FAILED");
    expect((await s.db.outbox.toArray())[0].attemptCount).toBe(8);
  });
  it("does not send child photos until the parent is acknowledged and retries photos separately", async () => {
    const s = setup();
    await saveOfflineIncident(s.db, userId, s.payload);
    await saveOfflineMedia(s.db, userId, s.payload.id, {
      id: crypto.randomUUID(),
      dataUrl: image,
    });
    const original = s.transport.create;
    s.transport.create = async () => {
      throw new Error("Offline");
    };
    await flushIncidentOutbox(s.db, s.owner, s.transport, 0);
    expect(s.transport.media).not.toHaveBeenCalled();
    s.transport.create = original;
    s.transport.media = vi.fn(async () => {
      throw new Error("Photo upload interrupted");
    });
    await flushIncidentOutbox(s.db, s.owner, s.transport, 3000);
    expect((await s.db.incidents.get(s.payload.id))?.syncStatus).toBe("SYNCED");
    expect((await s.db.incidentMedia.toArray())[0].syncStatus).toBe("PENDING");
    s.transport.media = vi.fn(async () => ({ ok: true }));
    await retryIncidentSync(s.db, s.owner);
    await flushIncidentOutbox(s.db, s.owner, s.transport);
    expect(s.transport.media).toHaveBeenCalledTimes(1);
    expect(s.received.size).toBe(1);
  });
  it("validates media owner and ID reuse without damaging the report", async () => {
    const s = setup();
    const input = { id: crypto.randomUUID(), dataUrl: image };
    await expect(
      saveOfflineMedia(s.db, userId, s.payload.id, input),
    ).rejects.toThrow("Save your report");
    await saveOfflineIncident(s.db, userId, s.payload);
    await expect(
      saveOfflineMedia(s.db, "other", s.payload.id, input),
    ).rejects.toThrow();
    await saveOfflineMedia(s.db, userId, s.payload.id, input);
    const second = { ...s.payload, id: crypto.randomUUID() };
    await saveOfflineIncident(s.db, userId, second);
    await expect(
      saveOfflineMedia(s.db, userId, second.id, input),
    ).rejects.toThrow("another photo");
  });
  it("rejects mismatched server acknowledgments and stops on expired sessions", async () => {
    const s = setup();
    await saveOfflineIncident(s.db, userId, s.payload);
    const original = s.transport.create;
    s.transport.create = async (input) => ({
      ...(await original(input)),
      reporterId: "other",
    });
    await flushIncidentOutbox(s.db, s.owner, s.transport);
    expect((await s.db.incidents.get(s.payload.id))?.syncStatus).toBe("FAILED");
    await retryIncidentSync(s.db, s.owner);
    s.transport.create = async () => {
      throw Object.assign(new Error("Sign in"), { status: 401 });
    };
    await flushIncidentOutbox(s.db, s.owner, s.transport);
    expect((await s.db.outbox.toArray())[0].lastError).toBe("Sign in");
    expect((await s.db.incidents.get(s.payload.id))?.syncStatus).toBe(
      "PENDING",
    );
  });
});
