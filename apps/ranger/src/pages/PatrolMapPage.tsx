import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  addGpsLog,
  countPendingPatrolRecords,
  endOfflinePatrol,
  getGpsLogs,
  getPatrolByAssignment,
  getWaypoints,
  subscribeToPatrolChanges,
  type OfflineGpsLog,
  type OfflinePatrolSession,
  type OfflineWaypoint,
} from "@wr/offline";
import { PatrolMap } from "@wr/ui";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { fetchMyPatrolAssignments } from "../lib/patrols.js";
import { useGpsPosition } from "../lib/useGpsPosition.js";
import { useNetworkStatus } from "../lib/useNetworkStatus.js";

function formatElapsed(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return [hours, minutes, remainingSeconds]
    .map((part) => part.toString().padStart(2, "0"))
    .join(":");
}

export function PatrolMapPage() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const gps = useGpsPosition();
  const network = useNetworkStatus();
  const lastRecordedTimestamp = useRef<number>();
  const [session, setSession] = useState<OfflinePatrolSession>();
  const [gpsLogs, setGpsLogs] = useState<OfflineGpsLog[]>([]);
  const [waypoints, setWaypoints] = useState<OfflineWaypoint[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [storageReady, setStorageReady] = useState(false);
  const [error, setError] = useState("");

  const patrolQuery = useQuery({
    queryKey: ["patrol-assignments", "mine", user?.id],
    queryFn: fetchMyPatrolAssignments,
    staleTime: 30_000,
    enabled: network === "ONLINE",
  });
  const patrol = patrolQuery.data?.find((assignment) => assignment.id === assignmentId);

  const loadOfflineState = useCallback(async () => {
    if (!assignmentId) return;
    const storedSession = await getPatrolByAssignment(assignmentId);
    setSession(storedSession);
    if (storedSession) {
      const [points, storedWaypoints, pending] = await Promise.all([
        getGpsLogs(storedSession.id),
        getWaypoints(storedSession.id),
        countPendingPatrolRecords(user?.id),
      ]);
      setGpsLogs(points);
      setWaypoints(storedWaypoints);
      setPendingCount(pending);
    }
    setStorageReady(true);
  }, [assignmentId, user?.id]);

  useEffect(() => {
    void loadOfflineState();
    return subscribeToPatrolChanges(() => void loadOfflineState());
  }, [loadOfflineState]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!session || session.status !== "ACTIVE" || gps.status !== "ready") return;
    if (lastRecordedTimestamp.current === gps.timestamp) return;
    lastRecordedTimestamp.current = gps.timestamp;
    void addGpsLog({
      sessionId: session.id,
      longitude: gps.position[0],
      latitude: gps.position[1],
      accuracyM: gps.accuracy,
      recordedAt: new Date(gps.timestamp).toISOString(),
    }).catch(() => setError("This GPS point could not be saved. Keep the patrol open and try again."));
  }, [gps, session]);

  const route = patrol?.route ?? session?.route;
  const routePath = useMemo(() => route?.path ?? [], [route?.path]);
  const elapsedSeconds = session
    ? Math.max(0, Math.floor((now - new Date(session.startedAt).getTime()) / 1000))
    : 0;

  if (!storageReady && patrolQuery.isLoading) {
    return <main className="center-state" id="main-content" role="status">Restoring patrol…</main>;
  }
  if (!session || !route) {
    return (
      <main className="center-state" id="main-content">
        <section className="patrol-query-state" role="alert">
          <strong>Patrol map unavailable</strong>
          <p>The offline patrol session could not be restored. Return to your patrol list and start it again.</p>
          <button type="button" onClick={() => navigate("/")}>Back to patrols</button>
        </section>
      </main>
    );
  }
  if (session.status !== "ACTIVE")
    return <Navigate to={`/patrol/${session.assignmentId}/summary`} replace />;

  const currentPosition = gps.status === "ready" ? gps.position : undefined;
  const gpsLabel = gps.status === "ready"
    ? `GPS ±${Math.round(gps.accuracy)} m`
    : gps.status === "locating" ? "Locating GPS" : "GPS unavailable";

  async function finishPatrol() {
    if (!session) return;
    setError("");
    try {
      await endOfflinePatrol(session.id);
      navigate(`/patrol/${session.assignmentId}/summary`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The patrol could not be completed.");
    }
  }

  return (
    <main className="active-patrol-screen" id="main-content">
      <header className="active-patrol-header">
        <button type="button" onClick={() => navigate("/")} aria-label="Back to patrols">←</button>
        <span>{route.name} · {route.estimatedDistanceKm.toFixed(1)} km</span>
        <span className={gps.status === "ready" ? "has-signal" : "no-signal"}>{gpsLabel}</span>
      </header>

      {network === "OFFLINE" && (
        <aside className="offline-patrol-warning" role="status">
          <strong>No Internet Connection</strong>
          <span>Patrol data is safely stored on this device and will synchronize automatically.</span>
        </aside>
      )}
      {session.lastSyncError && network === "ONLINE" && (
        <aside className="offline-patrol-warning is-error" role="status">
          <strong>Some patrol data could not be synchronized</strong>
          <span>Your data is safe and synchronization will be retried.</span>
        </aside>
      )}

      <section className="active-map-shell" aria-label={`${route.name} patrol map`}>
        {routePath.length >= 2 ? (
          <PatrolMap
            className="active-patrol-map"
            routePath={routePath}
            trackedPositions={gpsLogs.map((point) => [point.longitude, point.latitude])}
            currentPosition={currentPosition}
            waypointPositions={waypoints.map((waypoint) => [waypoint.longitude, waypoint.latitude])}
          />
        ) : (
          <div className="map-unavailable" role="status">Route geometry is unavailable.</div>
        )}
        <div className="patrol-sync-status" aria-live="polite">
          <span>Network: <strong>{network === "ONLINE" ? "Online" : "Offline"}</strong></span>
          <span>Sync: <strong>{pendingCount ? `${pendingCount} pending` : "Complete"}</strong></span>
        </div>
        <div className="patrol-map-stats" aria-live="polite">
          <span><small>Elapsed</small>{formatElapsed(elapsedSeconds)}</span>
          <span><small>Waypoints</small>{waypoints.length}</span>
        </div>
      </section>

      {error && <p className="active-patrol-error" role="alert">{error}</p>}
      <footer className="active-patrol-actions">
        <button className="end-patrol-button" type="button" onClick={() => void finishPatrol()}>
          End patrol
        </button>
        <button
          className="mark-waypoint-button"
          type="button"
          disabled={!currentPosition}
          onClick={() => navigate(`/patrol/${assignmentId}/waypoints/new`)}
        >
          <span aria-hidden="true">+</span> Mark waypoint
        </button>
      </footer>
    </main>
  );
}
