import { useCallback, useEffect, useState } from "react";
import {
  getPatrolByAssignment,
  getWaypoints,
  subscribeToPatrolChanges,
  type OfflinePatrolSession,
} from "@wr/offline";
import { SyncStatus } from "@wr/shared";
import { useNavigate, useParams } from "react-router-dom";
import { useNetworkStatus } from "../lib/useNetworkStatus.js";

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes} min`;
}

export function PatrolSummaryPage() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const network = useNetworkStatus();
  const [session, setSession] = useState<OfflinePatrolSession>();
  const [waypointCount, setWaypointCount] = useState(0);

  const loadSummary = useCallback(async () => {
    if (!assignmentId) return;
    const stored = await getPatrolByAssignment(assignmentId);
    setSession(stored);
    if (stored) setWaypointCount((await getWaypoints(stored.id)).length);
  }, [assignmentId]);

  useEffect(() => {
    void loadSummary();
    return subscribeToPatrolChanges(() => void loadSummary());
  }, [loadSummary]);

  if (!session) {
    return <main className="center-state" id="main-content" role="status">Restoring patrol summary…</main>;
  }

  return (
    <main className="patrol-summary-screen" id="main-content">
      <section className="patrol-summary-card" aria-labelledby="patrol-complete-title">
        <span className="patrol-summary-check" aria-hidden="true">✓</span>
        <p className="patrol-kicker">PATROL SAVED</p>
        <h1 id="patrol-complete-title">Patrol Completed</h1>
        <p className="patrol-summary-route">{session.route.name} · {session.route.sector}</p>

        <div className="patrol-summary-metrics">
          <span><small>Distance</small>{(session.distanceM / 1000).toFixed(2)} km</span>
          <span><small>Duration</small>{formatDuration(session.durationSeconds)}</span>
          <span><small>Waypoints</small>{waypointCount}</span>
        </div>

        <div className="patrol-summary-sync" role="status">
          <span>Network <strong>{network === "ONLINE" ? "Online" : "Offline"}</strong></span>
          <span>Sync status <strong>{session.syncStatus === SyncStatus.SYNCED ? "Synced" : "Pending"}</strong></span>
        </div>

        {session.syncStatus !== SyncStatus.SYNCED && (
          <p className="patrol-summary-note">
            Your completed patrol is safely stored on this device and will synchronize automatically when a connection is available.
          </p>
        )}

        <button className="primary-button" type="button" onClick={() => navigate("/")}>
          Return to patrols
        </button>
      </section>
    </main>
  );
}
