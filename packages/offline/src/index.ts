import Dexie, { type Table } from "dexie";
import {
  SessionStatus,
  SyncStatus,
  type PatrolSyncRequest,
  type PatrolSyncResponse,
  type SyncStatus as SyncStatusValue,
  type WaypointCategory,
} from "@wr/shared";

export type Coordinate = readonly [longitude: number, latitude: number];

export type OfflineRouteSnapshot = {
  id: string;
  name: string;
  sector: string;
  estimatedDistanceKm: number;
  path: [number, number][] | null;
};

export type OfflinePatrolSession = {
  id: string;
  assignmentId: string;
  rangerId: string;
  route: OfflineRouteSnapshot;
  revision: number;
  status: "ACTIVE" | "COMPLETED" | "PARTIAL";
  startedAt: string;
  endedAt: string | null;
  distanceM: number;
  durationSeconds: number;
  syncStatus: SyncStatusValue;
  lastSyncError: string | null;
};

export type OfflineGpsLog = {
  clientRecordId: string;
  sessionId: string;
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  recordedAt: string;
  syncStatus: SyncStatusValue;
};

export type OfflineWaypoint = {
  clientRecordId: string;
  sessionId: string;
  category: WaypointCategory;
  note: string;
  photoName: string | null;
  photo?: Blob;
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  observedAt: string;
  syncStatus: SyncStatusValue;
};

class PatrolOfflineDatabase extends Dexie {
  sessions!: Table<OfflinePatrolSession, string>;
  gpsLogs!: Table<OfflineGpsLog, string>;
  waypoints!: Table<OfflineWaypoint, string>;

  constructor() {
    super("wildlife-guardian-patrols");
    this.version(1).stores({
      sessions: "id, assignmentId, rangerId, status, syncStatus",
      gpsLogs: "clientRecordId, sessionId, recordedAt, syncStatus",
      waypoints: "clientRecordId, sessionId, observedAt, syncStatus",
    });
  }
}

const db = new PatrolOfflineDatabase();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export function subscribeToPatrolChanges(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function startOfflinePatrol(input: {
  assignmentId: string;
  rangerId: string;
  route: OfflineRouteSnapshot;
}): Promise<OfflinePatrolSession> {
  const existing = await db.sessions.where("assignmentId").equals(input.assignmentId).first();
  if (existing) {
    if (existing.status === SessionStatus.ACTIVE) return existing;
    throw new Error("This patrol is already complete and waiting to synchronize.");
  }
  const active = await db.sessions
    .where("rangerId").equals(input.rangerId)
    .and((session) => session.status === SessionStatus.ACTIVE)
    .first();
  if (active) throw new Error("Finish the active patrol before starting another route.");

  const session: OfflinePatrolSession = {
    id: crypto.randomUUID(),
    assignmentId: input.assignmentId,
    rangerId: input.rangerId,
    route: input.route,
    revision: 1,
    status: SessionStatus.ACTIVE,
    startedAt: new Date().toISOString(),
    endedAt: null,
    distanceM: 0,
    durationSeconds: 0,
    syncStatus: SyncStatus.PENDING_SYNC,
    lastSyncError: null,
  };
  await db.sessions.add(session);
  notify();
  return session;
}

export const getPatrolByAssignment = (assignmentId: string) =>
  db.sessions.where("assignmentId").equals(assignmentId).first();

export const getGpsLogs = (sessionId: string) =>
  db.gpsLogs.where("sessionId").equals(sessionId).sortBy("recordedAt");

export const getWaypoints = (sessionId: string) =>
  db.waypoints.where("sessionId").equals(sessionId).sortBy("observedAt");

export async function addGpsLog(input: Omit<OfflineGpsLog, "clientRecordId" | "syncStatus">) {
  const point: OfflineGpsLog = {
    ...input,
    clientRecordId: crypto.randomUUID(),
    syncStatus: SyncStatus.PENDING_SYNC,
  };
  await db.transaction("rw", db.gpsLogs, db.sessions, async () => {
    await db.gpsLogs.add(point);
    const session = await db.sessions.get(input.sessionId);
    await db.sessions.update(input.sessionId, {
      revision: (session?.revision ?? 0) + 1,
      syncStatus: SyncStatus.PENDING_SYNC,
      lastSyncError: null,
    });
  });
  notify();
  return point;
}

export async function addWaypoint(input: Omit<OfflineWaypoint, "clientRecordId" | "syncStatus">) {
  const waypoint: OfflineWaypoint = {
    ...input,
    clientRecordId: crypto.randomUUID(),
    syncStatus: SyncStatus.PENDING_SYNC,
  };
  await db.transaction("rw", db.waypoints, db.sessions, async () => {
    await db.waypoints.add(waypoint);
    const session = await db.sessions.get(input.sessionId);
    await db.sessions.update(input.sessionId, {
      revision: (session?.revision ?? 0) + 1,
      syncStatus: SyncStatus.PENDING_SYNC,
      lastSyncError: null,
    });
  });
  notify();
  return waypoint;
}

const toRadians = (degrees: number) => degrees * Math.PI / 180;

export function calculateTrackDistanceM(points: readonly Pick<OfflineGpsLog, "latitude" | "longitude">[]) {
  let distance = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    const deltaLatitude = toRadians(current.latitude - previous.latitude);
    const deltaLongitude = toRadians(current.longitude - previous.longitude);
    const a = Math.sin(deltaLatitude / 2) ** 2
      + Math.cos(toRadians(previous.latitude)) * Math.cos(toRadians(current.latitude))
      * Math.sin(deltaLongitude / 2) ** 2;
    distance += 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return distance;
}

export async function endOfflinePatrol(sessionId: string) {
  const session = await db.sessions.get(sessionId);
  if (!session) throw new Error("The active patrol could not be restored.");
  if (session.status !== SessionStatus.ACTIVE) return session;
  const endedAt = new Date();
  const points = await getGpsLogs(sessionId);
  const completed: Partial<OfflinePatrolSession> = {
    revision: session.revision + 1,
    status: SessionStatus.COMPLETED,
    endedAt: endedAt.toISOString(),
    distanceM: calculateTrackDistanceM(points),
    durationSeconds: Math.max(0, Math.round(
      (endedAt.getTime() - new Date(session.startedAt).getTime()) / 1000,
    )),
    syncStatus: SyncStatus.PENDING_SYNC,
    lastSyncError: null,
  };
  await db.sessions.update(sessionId, completed);
  notify();
  return { ...session, ...completed } as OfflinePatrolSession;
}

export async function getPendingSyncBundles(rangerId?: string): Promise<PatrolSyncRequest[]> {
  const sessions = await db.sessions
    .filter((session) =>
      session.syncStatus !== SyncStatus.SYNCED
      && (!rangerId || session.rangerId === rangerId),
    )
    .toArray();
  const bundles = await Promise.all(sessions.map(async (session) => {
    const [gpsLogs, waypoints] = await Promise.all([
      getGpsLogs(session.id),
      getWaypoints(session.id),
    ]);
    const pendingGps = gpsLogs.filter((point) => point.syncStatus !== SyncStatus.SYNCED);
    const pendingWaypoints = waypoints.filter(
      (waypoint) => waypoint.syncStatus !== SyncStatus.SYNCED,
    );
    const batchCount = Math.max(
      1,
      Math.ceil(pendingGps.length / 500),
      Math.ceil(pendingWaypoints.length / 100),
    );
    const patrolSession = {
      id: session.id,
      assignmentId: session.assignmentId,
      routeId: session.route.id,
      rangerId: session.rangerId,
      clientRevision: session.revision,
      status: session.status,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      distanceM: session.distanceM,
      durationSeconds: session.durationSeconds,
    };
    // The session accompanies every child batch so a retry remains standalone.
    return Array.from({ length: batchCount }, (_, batchIndex) => ({
      patrolSession,
      gpsLogs: pendingGps
        .slice(batchIndex * 500, (batchIndex + 1) * 500)
        .map(({ clientRecordId, latitude, longitude, accuracyM, recordedAt }) => ({
          clientRecordId, latitude, longitude, accuracyM, recordedAt,
        })),
      waypoints: pendingWaypoints
        .slice(batchIndex * 100, (batchIndex + 1) * 100)
        .map(({ clientRecordId, category, note, photoName, latitude, longitude, accuracyM, observedAt }) => ({
          clientRecordId, category, note, photoName, latitude, longitude, accuracyM, observedAt,
        })),
    } satisfies PatrolSyncRequest));
  }));
  return bundles.flat();
}

export async function markPatrolSynced(result: PatrolSyncResponse) {
  await db.transaction("rw", db.sessions, db.gpsLogs, db.waypoints, async () => {
    await db.gpsLogs.bulkUpdate(result.syncedGpsRecordIds.map((clientRecordId) => ({
      key: clientRecordId,
      changes: { syncStatus: SyncStatus.SYNCED },
    })));
    await db.waypoints.bulkUpdate(result.syncedWaypointRecordIds.map((clientRecordId) => ({
      key: clientRecordId,
      changes: { syncStatus: SyncStatus.SYNCED },
    })));
    const session = await db.sessions.get(result.sessionId);
    if (session) {
      const pendingChildren = await db.gpsLogs
        .where("sessionId").equals(result.sessionId)
        .and((item) => item.syncStatus !== SyncStatus.SYNCED)
        .count()
        + await db.waypoints
          .where("sessionId").equals(result.sessionId)
          .and((item) => item.syncStatus !== SyncStatus.SYNCED)
          .count();
      await db.sessions.update(result.sessionId, {
        syncStatus:
          session.revision === result.clientRevision && pendingChildren === 0
            ? SyncStatus.SYNCED
            : SyncStatus.PENDING_SYNC,
        lastSyncError: null,
      });
    }
  });
  notify();
}

export async function markPatrolSyncFailed(sessionId: string, message: string) {
  await db.sessions.update(sessionId, {
    syncStatus: SyncStatus.FAILED,
    lastSyncError: message,
  });
  notify();
}

export async function countPendingPatrolRecords(rangerId?: string) {
  const sessionIds = new Set(
    (await db.sessions
      .filter((item) => !rangerId || item.rangerId === rangerId)
      .primaryKeys()) as string[],
  );
  const [sessions, gpsLogs, waypoints] = await Promise.all([
    db.sessions.filter((item) =>
      item.syncStatus !== SyncStatus.SYNCED && sessionIds.has(item.id),
    ).count(),
    db.gpsLogs.filter((item) =>
      item.syncStatus !== SyncStatus.SYNCED && sessionIds.has(item.sessionId),
    ).count(),
    db.waypoints.filter((item) =>
      item.syncStatus !== SyncStatus.SYNCED && sessionIds.has(item.sessionId),
    ).count(),
  ]);
  return sessions + gpsLogs + waypoints;
}
