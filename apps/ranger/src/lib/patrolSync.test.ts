import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getPendingSyncBundles,
  markPatrolSynced,
  markPatrolSyncFailed,
} from "@wr/offline";
import { syncPendingPatrols } from "./patrolSync.js";

vi.mock("@wr/offline", () => ({
  getPendingSyncBundles: vi.fn(),
  markPatrolSynced: vi.fn(),
  markPatrolSyncFailed: vi.fn(),
}));

const bundle = {
  patrolSession: {
    id: "60000000-0000-4000-8000-000000000002",
    assignmentId: "50000000-0000-4000-8000-000000000001",
    routeId: "40000000-0000-4000-8000-000000000001",
    rangerId: "10000000-0000-4000-8000-000000000001",
    clientRevision: 2,
    status: "ACTIVE" as const,
    startedAt: "2026-10-07T10:00:00.000Z",
    endedAt: null,
    distanceM: 0,
    durationSeconds: 10,
  },
  gpsLogs: [],
  waypoints: [],
};

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("patrol synchronization", () => {
  it("batches pending data and marks it synced only after server confirmation", async () => {
    vi.mocked(getPendingSyncBundles).mockResolvedValue([bundle]);
    const response = {
      sessionId: bundle.patrolSession.id,
      clientRevision: 2,
      syncedGpsRecordIds: [],
      syncedWaypointRecordIds: [],
      status: "ACTIVE",
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => response,
    }));

    await expect(syncPendingPatrols(bundle.patrolSession.rangerId)).resolves.toBe(1);
    expect(getPendingSyncBundles).toHaveBeenCalledWith(bundle.patrolSession.rangerId);
    expect(fetch).toHaveBeenCalledWith(
      "/api/patrol-sessions/sync",
      expect.objectContaining({ method: "POST", body: JSON.stringify(bundle) }),
    );
    expect(markPatrolSynced).toHaveBeenCalledWith(response);
    expect(markPatrolSyncFailed).not.toHaveBeenCalled();
  });

  it("keeps failed data locally for a later retry", async () => {
    vi.mocked(getPendingSyncBundles).mockResolvedValue([bundle]);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    await expect(syncPendingPatrols(bundle.patrolSession.rangerId)).resolves.toBe(0);
    expect(markPatrolSynced).not.toHaveBeenCalled();
    expect(markPatrolSyncFailed).toHaveBeenCalledWith(
      bundle.patrolSession.id,
      "network down",
    );
  });
});
