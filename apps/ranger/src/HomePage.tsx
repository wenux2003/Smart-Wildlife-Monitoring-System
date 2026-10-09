import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { PatrolAssignmentSummary } from "@wr/shared";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./auth/AuthContext.js";
import { fetchMyPatrolAssignments } from "./lib/patrols.js";
import { startOfflinePatrol } from "@wr/offline";
import { RangerPageHeader } from "./components/RangerPageHeader.js";

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
  const active = patrol.status === "ACTIVE";
  const selectable = patrol.status === "ASSIGNED" || active;
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
        ) : active ? (
          <span className="patrol-status-label">Active</span>
        ) : null}
        {selectable && (
          <button
            className={`patrol-select-control ${active ? "is-active-patrol" : ""}`}
            type="button"
            aria-pressed={selected}
            aria-label={
              active
                ? `Resume ${routeLabel}`
                : `${selected ? "Selected" : "Select"} ${routeLabel}`
            }
            onClick={() => onSelect(patrol.id)}
          >
            {!active && <span aria-hidden="true">{selected ? "✓" : ""}</span>}
          </button>
        )}
        {!complete && !selectable && (
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
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedPatrolId, setSelectedPatrolId] = useState<string>();
  const [error, setError] = useState("");
  const [startingPatrol, setStartingPatrol] = useState(false);

  const patrolQuery = useQuery({
    queryKey: ["patrol-assignments", "mine", user?.id],
    queryFn: fetchMyPatrolAssignments,
    staleTime: 30_000,
  });
  const patrolAssignments = patrolQuery.data ?? [];
  const currentPatrols = patrolAssignments.filter(
    (patrol) =>
      patrol.status !== "COMPLETED" &&
      patrol.status !== "PARTIAL" &&
      patrol.status !== "CANCELLED",
  );
  const pastPatrols = patrolAssignments.filter(
    (patrol) =>
      patrol.status === "COMPLETED" ||
      patrol.status === "PARTIAL" ||
      patrol.status === "CANCELLED",
  );
  const selectedPatrol =
    patrolAssignments.find(
      (patrol) =>
        patrol.id === selectedPatrolId &&
        (patrol.status === "ASSIGNED" || patrol.status === "ACTIVE"),
    ) ??
    patrolAssignments.find((patrol) => patrol.status === "ACTIVE") ??
    patrolAssignments.find((patrol) => patrol.status === "ASSIGNED");

  const resumingPatrol = selectedPatrol?.status === "ACTIVE";

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
    <main className="patrol-screen has-patrol-action" id="main-content">
      <RangerPageHeader title="Patrol" eyebrow="FIELD OPERATIONS" />

      <section className="patrol-content" aria-labelledby="today-patrols">
        <div className="patrol-section-heading">
          <div>
            <p className="section-date">Today</p>
            <h2 id="today-patrols">{user?.parkName ?? "Yala West"}</h2>
          </div>
          <span className="patrol-route-count">
            {patrolQuery.isLoading
              ? "Loading routes"
              : `${currentPatrols.length} ${currentPatrols.length === 1 ? "current route" : "current routes"}`}
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
          <>
            {currentPatrols.length > 0 ? (
              <div className="patrol-list">
                {currentPatrols.map((patrol) => (
                  <PatrolCard
                    key={patrol.id}
                    patrol={patrol}
                    selected={patrol.id === selectedPatrol?.id}
                    onSelect={setSelectedPatrolId}
                  />
                ))}
              </div>
            ) : (
              <div className="patrol-query-state">
                <strong>No current patrols</strong>
                <p>
                  Your completed patrols are available in the history below.
                </p>
              </div>
            )}

            {pastPatrols.length > 0 && (
              <details className="patrol-history">
                <summary>
                  <span>
                    <strong>Past patrols</strong>
                    <small>Completed and closed routes</small>
                  </span>
                  <span>{pastPatrols.length}</span>
                </summary>
                <div className="patrol-list">
                  {pastPatrols.map((patrol) => (
                    <PatrolCard
                      key={patrol.id}
                      patrol={patrol}
                      selected={false}
                      onSelect={setSelectedPatrolId}
                    />
                  ))}
                </div>
              </details>
            )}
          </>
        )}

        {!patrolQuery.isLoading &&
          !patrolQuery.isError &&
          patrolAssignments.length > 0 && (
            <section
              className="patrol-action-dock"
              aria-label="Start selected patrol"
            >
              {error && (
                <p className="alert" role="alert">
                  {error}
                </p>
              )}
              <button
                className="start-patrol-button"
                type="button"
                aria-label={
                  selectedPatrol
                    ? `${resumingPatrol ? "Resume" : "Start"} patrol: ${selectedPatrol.route.name}, ${selectedPatrol.route.sector}, ${selectedPatrol.route.estimatedDistanceKm.toFixed(1)} kilometres`
                    : "Start patrol unavailable"
                }
                disabled={!selectedPatrol || startingPatrol}
                onClick={() => void startSelectedPatrol()}
              >
                <span className="start-patrol-icon">
                  <StartIcon />
                </span>
                <span className="start-patrol-copy" aria-live="polite">
                  <strong>
                    {startingPatrol
                      ? resumingPatrol
                        ? "Opening patrol…"
                        : "Preparing patrol…"
                      : selectedPatrol
                        ? `${resumingPatrol ? "Resume" : "Start"} ${selectedPatrol.route.name}`
                        : "Select a patrol"}
                  </strong>
                  <small>
                    {selectedPatrol
                      ? `${selectedPatrol.route.sector} · ${selectedPatrol.route.estimatedDistanceKm.toFixed(1)} km`
                      : "Choose an assigned route above"}
                  </small>
                </span>
                <span className="start-patrol-arrow" aria-hidden="true">
                  →
                </span>
              </button>
              <p className="patrol-footnote">
                {resumingPatrol
                  ? "GPS tracking continues when you return to the patrol."
                  : "GPS tracking begins only after you start the patrol."}
              </p>
            </section>
          )}

        {error && patrolAssignments.length === 0 && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
