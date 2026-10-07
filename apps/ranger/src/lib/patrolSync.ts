import {
  PatrolSyncResponseSchema,
  type PatrolSyncRequest,
  type PatrolSyncResponse,
} from "@wr/shared";
import {
  getPendingSyncBundles,
  markPatrolSynced,
  markPatrolSyncFailed,
} from "@wr/offline";

const activeSyncs = new Map<string, Promise<number>>();

async function sendBundle(bundle: PatrolSyncRequest): Promise<PatrolSyncResponse> {
  const response = await fetch("/api/patrol-sessions/sync", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bundle),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(data?.message ?? "Patrol synchronization failed.");
  return PatrolSyncResponseSchema.parse(data);
}

/** Serializes sync attempts so online events and timers cannot duplicate requests. */
export function syncPendingPatrols(rangerId: string) {
  const existing = activeSyncs.get(rangerId);
  if (existing) return existing;
  const activeSync = (async () => {
    const bundles = await getPendingSyncBundles(rangerId);
    let synchronized = 0;
    for (const bundle of bundles) {
      try {
        const result = await sendBundle(bundle);
        await markPatrolSynced(result);
        synchronized += 1;
      } catch (error) {
        await markPatrolSyncFailed(
          bundle.patrolSession.id,
          error instanceof Error ? error.message : "Patrol synchronization failed.",
        );
      }
    }
    return synchronized;
  })().finally(() => {
    activeSyncs.delete(rangerId);
  });
  activeSyncs.set(rangerId, activeSync);
  return activeSync;
}
