import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  addGpsLog,
  addWaypoint,
  calculateTrackDistanceM,
  countPendingPatrolRecords,
  endOfflinePatrol,
  getPendingSyncBundles,
  getPatrolByAssignment,
  markPatrolSynced,
  startOfflinePatrol,
} from "./index.js";

describe("patrol track distance", () => {
  it("returns zero without a valid track segment", () => {
    expect(calculateTrackDistanceM([])).toBe(0);
    expect(calculateTrackDistanceM([{ latitude: 6.365, longitude: 81.523 }])).toBe(0);
  });

  it("calculates metric distance between recorded GPS points", () => {
    const distance = calculateTrackDistanceM([
      { latitude: 6.365, longitude: 81.523 },
      { latitude: 6.366, longitude: 81.523 },
    ]);
    expect(distance).toBeGreaterThan(110);
    expect(distance).toBeLessThan(112);
  });

  it("retains a full offline patrol until the server confirms every record", async () => {
    const assignmentId = "50000000-0000-4000-8000-000000000099";
    const session = await startOfflinePatrol({
      assignmentId,
      rangerId: "10000000-0000-4000-8000-000000000099",
      route: {
        id: "40000000-0000-4000-8000-000000000099",
        name: "Offline test route",
        sector: "Test sector",
        estimatedDistanceKm: 1,
        path: [[81.523, 6.365], [81.523, 6.366]],
      },
    });
    const firstPoint = await addGpsLog({
      sessionId: session.id,
      latitude: 6.365,
      longitude: 81.523,
      accuracyM: 8,
      recordedAt: "2026-10-07T10:00:00.000Z",
    });
    const secondPoint = await addGpsLog({
      sessionId: session.id,
      latitude: 6.366,
      longitude: 81.523,
      accuracyM: 7,
      recordedAt: "2026-10-07T10:01:00.000Z",
    });
    const waypoint = await addWaypoint({
      sessionId: session.id,
      category: "HAZARD_SNARE",
      note: "Damaged boundary fence",
      photoName: null,
      latitude: 6.366,
      longitude: 81.523,
      accuracyM: 7,
      observedAt: "2026-10-07T10:01:00.000Z",
    });
    const completed = await endOfflinePatrol(session.id);

    expect(completed.status).toBe("COMPLETED");
    expect(completed.distanceM).toBeGreaterThan(110);
    expect(await countPendingPatrolRecords()).toBe(4);
    const [bundle] = await getPendingSyncBundles();
    expect(bundle?.gpsLogs).toHaveLength(2);
    expect(bundle?.waypoints[0]?.note).toBe("Damaged boundary fence");

    await markPatrolSynced({
      sessionId: session.id,
      clientRevision: bundle!.patrolSession.clientRevision,
      syncedGpsRecordIds: [firstPoint.clientRecordId, secondPoint.clientRecordId],
      syncedWaypointRecordIds: [waypoint.clientRecordId],
      status: "COMPLETED",
    });
    expect(await countPendingPatrolRecords()).toBe(0);
    expect((await getPatrolByAssignment(assignmentId))?.syncStatus).toBe("SYNCED");

    const thirdPoint = await addGpsLog({
      sessionId: session.id,
      latitude: 6.367,
      longitude: 81.523,
      accuracyM: 9,
      recordedAt: "2026-10-07T10:02:00.000Z",
    });
    const [inFlightBundle] = await getPendingSyncBundles();
    const fourthPoint = await addGpsLog({
      sessionId: session.id,
      latitude: 6.368,
      longitude: 81.523,
      accuracyM: 9,
      recordedAt: "2026-10-07T10:03:00.000Z",
    });
    await markPatrolSynced({
      sessionId: session.id,
      clientRevision: inFlightBundle!.patrolSession.clientRevision,
      syncedGpsRecordIds: [thirdPoint.clientRecordId],
      syncedWaypointRecordIds: [],
      status: "COMPLETED",
    });
    const retryBundles = await getPendingSyncBundles();
    expect(retryBundles[0]?.gpsLogs.map((point) => point.clientRecordId))
      .toEqual([fourthPoint.clientRecordId]);
  });
});
