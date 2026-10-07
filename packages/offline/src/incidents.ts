import Dexie from "dexie";
import type { Table } from "dexie";
import { IncidentCreateSchema, IncidentMediaCreateSchema } from "@wr/shared";
import type { Incident, IncidentCreate } from "@wr/shared";

export type SyncStatus = "PENDING" | "SYNCING" | "SYNCED" | "FAILED";
export type LocalIncident = {
  id: string;
  userId: string;
  parkId: string;
  payload: IncidentCreate;
  syncStatus: SyncStatus;
  serverRecord?: Incident;
  createdAt: number;
};
export type LocalMedia = {
  id: string;
  incidentId: string;
  userId: string;
  parkId: string;
  dataUrl: string;
  syncStatus: SyncStatus;
};
export type OutboxItem = {
  operationId: string;
  kind: "INCIDENT_CREATE" | "INCIDENT_MEDIA";
  entityId: string;
  incidentId: string;
  userId: string;
  parkId: string;
  dependencies: string[];
  attemptCount: number;
  nextAttemptAt: number;
  lastError: string | null;
  syncStatus: SyncStatus;
  createdAt: number;
};
export class IncidentOfflineDatabase extends Dexie {
  incidents!: Table<LocalIncident, string>;
  incidentMedia!: Table<LocalMedia, string>;
  outbox!: Table<OutboxItem, string>;
  constructor(name = "wr-m1-incidents") {
    super(name);
    this.version(1).stores({
      incidents: "id, [userId+parkId], syncStatus",
      incidentMedia: "id, incidentId, [userId+parkId]",
      outbox: "operationId, [userId+parkId], syncStatus, incidentId",
    });
  }
}
function operation(
  kind: OutboxItem["kind"],
  id: string,
  incidentId: string,
  userId: string,
  parkId: string,
  dependencies: string[],
): OutboxItem {
  return {
    operationId: `${kind}:${id}`,
    kind,
    entityId: id,
    incidentId,
    userId,
    parkId,
    dependencies,
    attemptCount: 0,
    nextAttemptAt: 0,
    lastError: null,
    syncStatus: "PENDING",
    createdAt: Date.now(),
  };
}
export async function saveOfflineIncident(
  db: IncidentOfflineDatabase,
  userId: string,
  input: IncidentCreate,
) {
  const payload = IncidentCreateSchema.parse(input);
  await db.transaction("rw", db.incidents, db.outbox, async () => {
    const existing = await db.incidents.get(payload.id);
    if (existing) {
      if (
        existing.userId !== userId ||
        JSON.stringify(existing.payload) !== JSON.stringify(payload)
      )
        throw new Error("This local ID belongs to another report.");
      return;
    }
    await db.incidents.add({
      id: payload.id,
      userId,
      parkId: payload.parkId,
      payload,
      syncStatus: "PENDING",
      createdAt: Date.now(),
    });
    await db.outbox.add(
      operation(
        "INCIDENT_CREATE",
        payload.id,
        payload.id,
        userId,
        payload.parkId,
        [],
      ),
    );
  });
}
export async function saveOfflineMedia(
  db: IncidentOfflineDatabase,
  userId: string,
  incidentId: string,
  input: { id: string; dataUrl: string },
) {
  IncidentMediaCreateSchema.parse(input);
  await db.transaction(
    "rw",
    db.incidents,
    db.incidentMedia,
    db.outbox,
    async () => {
      const incident = await db.incidents.get(incidentId);
      if (!incident || incident.userId !== userId)
        throw new Error("Save your report before attaching a photo.");
      const existing = await db.incidentMedia.get(input.id);
      if (existing) {
        if (
          existing.incidentId !== incidentId ||
          existing.dataUrl !== input.dataUrl
        )
          throw new Error("This photo ID belongs to another photo.");
        return;
      }
      await db.incidentMedia.add({
        ...input,
        incidentId,
        userId,
        parkId: incident.parkId,
        syncStatus: "PENDING",
      });
      await db.outbox.add(
        operation(
          "INCIDENT_MEDIA",
          input.id,
          incidentId,
          userId,
          incident.parkId,
          [`INCIDENT_CREATE:${incidentId}`],
        ),
      );
    },
  );
}
export type SyncTransport = {
  reachable: () => Promise<boolean>;
  create: (input: IncidentCreate) => Promise<Incident>;
  media: (
    incidentId: string,
    input: { id: string; dataUrl: string },
  ) => Promise<unknown>;
};
const flushes = new Map<string, Promise<void>>();
export function flushIncidentOutbox(
  db: IncidentOfflineDatabase,
  owner: { userId: string; parkId: string },
  transport: SyncTransport,
  now = Date.now(),
): Promise<void> {
  const key = db.name;
  const running = flushes.get(key);
  if (running) return running;
  const promise = flush().finally(() => flushes.delete(key));
  flushes.set(key, promise);
  return promise;
  async function flush() {
    if (!(await transport.reachable())) return;
    // A resumed app retries interrupted requests using their original IDs.
    const items = await db.outbox
      .where("[userId+parkId]")
      .equals([owner.userId, owner.parkId])
      .sortBy("createdAt");
    for (const item of items) {
      if (
        item.syncStatus === "SYNCED" ||
        item.syncStatus === "FAILED" ||
        item.nextAttemptAt > now
      )
        continue;
      const dependencies = await db.outbox.bulkGet(item.dependencies);
      if (dependencies.some((dep) => !dep || dep.syncStatus !== "SYNCED"))
        continue;
      await setState(item, "SYNCING");
      try {
        let serverRecord: Incident | undefined;
        if (item.kind === "INCIDENT_CREATE") {
          const local = await db.incidents.get(item.entityId);
          if (!local)
            throw Object.assign(new Error("Local incident is missing."), {
              status: 400,
            });
          serverRecord = await transport.create(local.payload);
          if (
            serverRecord.id !== item.incidentId ||
            serverRecord.parkId !== owner.parkId ||
            serverRecord.reporterId !== owner.userId
          )
            throw Object.assign(
              new Error(
                "The server acknowledgment does not match this report.",
              ),
              { status: 409 },
            );
        } else {
          const media = await db.incidentMedia.get(item.entityId);
          if (!media)
            throw Object.assign(new Error("Local photo is missing."), {
              status: 400,
            });
          await transport.media(item.incidentId, {
            id: media.id,
            dataUrl: media.dataUrl,
          });
        }
        await db.transaction(
          "rw",
          db.incidents,
          db.incidentMedia,
          db.outbox,
          async () => {
            await db.outbox.update(item.operationId, {
              syncStatus: "SYNCED",
              lastError: null,
              nextAttemptAt: 0,
            });
            if (item.kind === "INCIDENT_CREATE")
              await db.incidents.update(item.entityId, {
                syncStatus: "SYNCED",
                serverRecord,
              });
            else
              await db.incidentMedia.update(item.entityId, {
                syncStatus: "SYNCED",
              });
          },
        );
      } catch (failure) {
        const status = (failure as { status?: number }).status;
        const attemptCount = item.attemptCount + 1;
        const fatal =
          status !== undefined &&
          status >= 400 &&
          status < 500 &&
          ![401, 408, 429].includes(status);
        await setState(
          item,
          fatal || attemptCount >= 8 ? "FAILED" : "PENDING",
          {
            attemptCount,
            nextAttemptAt:
              now + Math.min(300000, 2000 * 2 ** (attemptCount - 1)),
            lastError:
              failure instanceof Error
                ? failure.message
                : "Synchronization failed.",
          },
        );
        if (status === 401) break;
      }
    }
  }
  async function setState(
    item: OutboxItem,
    syncStatus: SyncStatus,
    extra: Partial<OutboxItem> = {},
  ) {
    await db.transaction(
      "rw",
      db.incidents,
      db.incidentMedia,
      db.outbox,
      async () => {
        await db.outbox.update(item.operationId, { syncStatus, ...extra });
        if (item.kind === "INCIDENT_CREATE")
          await db.incidents.update(item.entityId, { syncStatus });
        else await db.incidentMedia.update(item.entityId, { syncStatus });
      },
    );
  }
}
export async function retryIncidentSync(
  db: IncidentOfflineDatabase,
  owner: { userId: string; parkId: string },
) {
  await db.transaction(
    "rw",
    db.outbox,
    db.incidents,
    db.incidentMedia,
    async () => {
      const items = await db.outbox
        .where("[userId+parkId]")
        .equals([owner.userId, owner.parkId])
        .toArray();
      for (const item of items)
        if (item.syncStatus !== "SYNCED") {
          await db.outbox.update(item.operationId, {
            syncStatus: "PENDING",
            attemptCount: 0,
            nextAttemptAt: 0,
            lastError: null,
          });
          if (item.kind === "INCIDENT_CREATE")
            await db.incidents.update(item.entityId, { syncStatus: "PENDING" });
          else
            await db.incidentMedia.update(item.entityId, {
              syncStatus: "PENDING",
            });
        }
    },
  );
}
