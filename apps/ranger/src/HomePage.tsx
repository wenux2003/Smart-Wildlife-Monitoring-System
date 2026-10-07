import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { PatrolAssignmentSummary } from "@wr/shared";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "./auth/AuthContext.js";
import { fetchMyPatrolAssignments } from "./lib/patrols.js";
import { startOfflinePatrol } from "@wr/offline";

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function SyncIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 7h-5V2M4 17h5v5M18.5 11a7 7 0 0 0-11.9-4.9L4 8M5.5 13a7 7 0 0 0 11.9 4.9L20 16" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function StartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 7 8 5-8 5V7Z" />
    </svg>
  );
}

function PatrolCard({
  patrol,
  selected,
  onSelect,
}: {
  patrol: PatrolAssignmentSummary;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const complete = patrol.status === "COMPLETED" || patrol.status === "PARTIAL";
  const selectable = patrol.status === "ASSIGNED";
  const routeLabel = `${patrol.route.name} · ${patrol.route.sector}`;
  const assignedAt = new Date(patrol.assignedAt);
  const elapsedMinutes = Math.max(
    0,
    Math.floor((Date.now() - assignedAt.getTime()) / 60_000),
  );
  const timing = complete
    ? patrol.completedAt
      ? `completed ${new Date(patrol.completedAt).toLocaleDateString(
          undefined,
          {
            month: "short",
            day: "numeric",
          },
        )}`
      : "completed"
    : elapsedMinutes < 60
      ? `assigned ${elapsedMinutes} min ago`
      : `assigned ${assignedAt.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        })}`;

  return (
    <article
      className={`patrol-card ${complete ? "is-complete" : ""} ${selected ? "is-selected" : ""}`}
    >
      <div className="patrol-card-heading">
        <div>
          <h3>{routeLabel}</h3>
          <p>
            {patrol.route.estimatedDistanceKm.toFixed(1)} km path
            <span aria-hidden="true"> · </span>
            {timing}
          </p>
        </div>
        {complete ? (
          <span
            className="patrol-status-dot is-complete"
            aria-label="Completed"
            title="Completed"
          />
        ) : selectable ? (
          <button
            className="patrol-select-control"
            type="button"
            aria-pressed={selected}
            aria-label={`${selected ? "Selected" : "Select"} ${routeLabel}`}
            onClick={() => onSelect(patrol.id)}
          >
            <span aria-hidden="true">{selected ? "✓" : ""}</span>
          </button>
        ) : (
          <span className="patrol-status-label">
            {patrol.status.toLowerCase()}
          </span>
        )}
      </div>

      <div className="coverage-block">
        <div className="coverage-track" aria-hidden="true">
          <span style={{ width: `${patrol.coveragePercentage}%` }} />
        </div>
        <p>{patrol.coveragePercentage}% covered</p>
      </div>

      <div className="patrol-card-meta">
        <span>
          <MapPinIcon /> {patrol.route.sector}
        </span>
        <span>{patrol.coveragePercentage}% coverage</span>
      </div>
    </article>
  );
}

export function RangerHomePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [online, setOnline] = useState(() => navigator.onLine);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedPatrolId, setSelectedPatrolId] = useState<string>();
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [startingPatrol, setStartingPatrol] = useState(false);

  useEffect(() => {
    const updateConnection = () => setOnline(navigator.onLine);
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, []);

  async function leaveAccount() {
    setError("");
    setSigningOut(true);
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setSigningOut(false);
    }
  }

  const patrolQuery = useQuery({
    queryKey: ["patrol-assignments", "mine", user?.id],
    queryFn: fetchMyPatrolAssignments,
    staleTime: 30_000,
  });
  const patrolAssignments = patrolQuery.data ?? [];
  const selectedPatrol =
    patrolAssignments.find(
      (patrol) =>
        patrol.id === selectedPatrolId && patrol.status === "ASSIGNED",
    ) ?? patrolAssignments.find((patrol) => patrol.status === "ASSIGNED");

  async function startSelectedPatrol() {
    if (!selectedPatrol || !user) return;
    setError("");
    setStartingPatrol(true);
    try {
      await startOfflinePatrol({
        assignmentId: selectedPatrol.id,
        rangerId: user.id,
        route: {
          id: selectedPatrol.route.id,
          name: selectedPatrol.route.name,
          sector: selectedPatrol.route.sector,
          estimatedDistanceKm: selectedPatrol.route.estimatedDistanceKm,
          path: selectedPatrol.route.path,
        },
      });
      navigate(`/patrol/${selectedPatrol.id}/active`);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "The patrol could not be started.",
      );
    } finally {
      setStartingPatrol(false);
    }
  }

  return (
    <main className="patrol-screen" id="main-content">
      <header className="patrol-header">
        <div className="patrol-nav-row">
          <button
            className="back-button"
            type="button"
            aria-label="Back to home"
            onClick={() => navigate("/")}
          >
            <BackIcon />
            <span>Home</span>
          </button>
          <button
            className="menu-button"
            type="button"
            aria-label="Open account menu"
            aria-expanded={menuOpen}
            aria-controls="ranger-account-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <MenuIcon />
          </button>
        </div>

        <div className="patrol-title-row">
          <div>
            <p className="patrol-kicker">FIELD OPERATIONS</p>
            <h1>Patrol</h1>
          </div>
          <span
            className={`sync-pill ${online ? "is-online" : "is-offline"}`}
            role="status"
          >
            <SyncIcon />
            {online ? "Synced just now" : "Saving offline"}
          </span>
        </div>

        {menuOpen && (
          <section
            className="ranger-menu"
            id="ranger-account-menu"
            aria-label="Ranger account"
          >
            <div>
              <strong>{user?.name}</strong>
              <span>{user?.parkName ?? "No park assigned"}</span>
            </div>
            <nav className="patrol-menu-links" aria-label="Ranger tools">
              <Link to="/incidents/report">Report incident</Link>
              <Link to="/dispatches">View dispatches</Link>
            </nav>
            <button
              type="button"
              onClick={() => void leaveAccount()}
              disabled={signingOut}
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </section>
        )}
      </header>

      <section className="patrol-content" aria-labelledby="today-patrols">
        <div className="patrol-section-heading">
          <div>
            <p className="section-date">Today</p>
            <h2 id="today-patrols">{user?.parkName ?? "Yala West"}</h2>
          </div>
          <span className="patrol-route-count">
            {patrolQuery.isLoading
              ? "Loading routes"
              : `${patrolAssignments.length} ${patrolAssignments.length === 1 ? "route" : "routes"}`}
          </span>
        </div>

        {patrolQuery.isLoading ? (
          <div
            className="patrol-loading"
            role="status"
            aria-label="Loading patrol assignments"
          >
            <span />
            <span />
            <span />
          </div>
        ) : patrolQuery.isError ? (
          <div className="patrol-query-state" role="alert">
            <strong>Patrols couldn’t be loaded</strong>
            <p>{(patrolQuery.error as Error).message}</p>
            <button type="button" onClick={() => void patrolQuery.refetch()}>
              Try again
            </button>
          </div>
        ) : patrolAssignments.length === 0 ? (
          <div className="patrol-query-state">
            <strong>No patrols assigned</strong>
            <p>
              Your next route will appear here after your park manager assigns
              it.
            </p>
          </div>
        ) : (
          <div className="patrol-list">
            {patrolAssignments.map((patrol) => (
              <PatrolCard
                key={patrol.id}
                patrol={patrol}
                selected={patrol.id === selectedPatrol?.id}
                onSelect={setSelectedPatrolId}
              />
            ))}
          </div>
        )}

        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}

        {!patrolQuery.isLoading &&
          !patrolQuery.isError &&
          patrolAssignments.length > 0 && (
            <button
              className="start-patrol-button"
              type="button"
              disabled={!selectedPatrol || startingPatrol}
              onClick={() => void startSelectedPatrol()}
            >
              <span className="start-patrol-icon">
                <StartIcon />
              </span>
              <span className="start-patrol-copy">
                <strong>
                  {startingPatrol ? "Preparing patrol…" : "Start patrol"}
                </strong>
                <small>
                  {selectedPatrol
                    ? `${selectedPatrol.route.name} · ${selectedPatrol.route.estimatedDistanceKm.toFixed(1)} km`
                    : "No assigned trail available"}
                </small>
              </span>
              <span className="start-patrol-arrow" aria-hidden="true">
                →
              </span>
            </button>
          )}

        <p className="patrol-footnote">
          GPS tracking begins only after you start the patrol.
        </p>
      </section>
    </main>
  );
}
