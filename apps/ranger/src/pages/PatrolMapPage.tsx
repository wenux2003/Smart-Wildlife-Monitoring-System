import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PatrolMap } from "@wr/ui";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";
import { fetchMyPatrolAssignments } from "../lib/patrols.js";
import { loadPatrolWaypoints } from "../lib/patrolWaypoints.js";
import { useGpsPosition } from "../lib/useGpsPosition.js";

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
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const gps = useGpsPosition();
  const waypoints = useMemo(() => loadPatrolWaypoints(assignmentId), [assignmentId]);

  const patrolQuery = useQuery({
    queryKey: ["patrol-assignments", "mine", user?.id],
    queryFn: fetchMyPatrolAssignments,
    staleTime: 30_000,
  });
  const patrol = patrolQuery.data?.find((assignment) => assignment.id === assignmentId);
  const routePath = useMemo(() => patrol?.route.path ?? [], [patrol?.route.path]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsedSeconds((seconds) => seconds + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (patrolQuery.isLoading) {
    return <main className="center-state" id="main-content" role="status">Loading patrol map…</main>;
  }
  if (patrolQuery.isError || !patrol) {
    return (
      <main className="center-state" id="main-content">
        <section className="patrol-query-state" role="alert">
          <strong>Patrol map unavailable</strong>
          <p>This assignment could not be loaded. Return to your patrol list and try again.</p>
          <button type="button" onClick={() => navigate("/")}>Back to patrols</button>
        </section>
      </main>
    );
  }

  const currentPosition = gps.status === "ready" ? gps.position : undefined;
  const gpsLabel = gps.status === "ready"
    ? `GPS ±${Math.round(gps.accuracy)} m`
    : gps.status === "locating" ? "Locating GPS" : "No signal";

  return (
    <main className="active-patrol-screen" id="main-content">
      <header className="active-patrol-header">
        <button type="button" onClick={() => navigate("/")} aria-label="Back to patrols">←</button>
        <span>{patrol.route.name} · {patrol.route.estimatedDistanceKm.toFixed(1)} km</span>
        <span className={gps.status === "ready" ? "has-signal" : "no-signal"}>{gpsLabel}</span>
      </header>

      <section className="active-map-shell" aria-label={`${patrol.route.name} patrol map`}>
        {routePath.length >= 2 ? (
          <PatrolMap
            className="active-patrol-map"
            routePath={routePath}
            currentPosition={currentPosition}
            waypointPositions={waypoints.map((waypoint) => waypoint.position)}
          />
        ) : (
          <div className="map-unavailable" role="status">
            Route geometry is not available for this assignment.
          </div>
        )}
        <div className="patrol-map-stats" aria-live="polite">
          <span><small>Elapsed</small>{formatElapsed(elapsedSeconds)}</span>
          <span><small>Waypoints</small>{waypoints.length}</span>
        </div>
      </section>

      <footer className="active-patrol-actions">
        <button className="end-patrol-button" type="button" onClick={() => navigate("/")}>
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
