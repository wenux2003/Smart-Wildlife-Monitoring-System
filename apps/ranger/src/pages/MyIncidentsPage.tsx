import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { Incident, IncidentDetail } from "@wr/shared";
import type { LocalIncident, LocalMedia, OutboxItem } from "@wr/offline";
import { useAuth } from "../auth/AuthContext.js";
import {
  incidentDb,
  incidentRequest,
  syncIncidents,
} from "../lib/incidents.js";
export function MyIncidentsPage() {
  const { user, captureOnly, refresh } = useAuth();
  const { id } = useParams();
  const [local, setLocal] = useState<LocalIncident[]>([]);
  const [photos, setPhotos] = useState<LocalMedia[]>([]);
  const [queue, setQueue] = useState<OutboxItem[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"reported" | "assigned">("reported");
  const list = useQuery({
    queryKey: ["m1-incidents", user?.id],
    queryFn: () => incidentRequest<Incident[]>("/api/incidents"),
    enabled: Boolean(user && !captureOnly),
    retry: false,
  });
  const detail = useQuery({
    queryKey: ["m1-incident", user?.id, id],
    queryFn: () => incidentRequest<IncidentDetail>(`/api/incidents/${id}`),
    enabled: Boolean(id && !captureOnly),
    retry: false,
  });
  useEffect(() => {
    if (!user?.parkId) return;
    let disposed = false;
    async function read() {
      try {
        const scope = [user!.id, user!.parkId!] as [string, string];
        const [incidents, media, operations] = await Promise.all([
          incidentDb.incidents.where("[userId+parkId]").equals(scope).toArray(),
          incidentDb.incidentMedia
            .where("[userId+parkId]")
            .equals(scope)
            .toArray(),
          incidentDb.outbox.where("[userId+parkId]").equals(scope).toArray(),
        ]);
        if (!disposed) {
          setLocal(incidents);
          setPhotos(media);
          setQueue(operations);
        }
      } catch (failure) {
        if (!disposed)
          setError(
            `Local storage could not be opened: ${(failure as Error).message}`,
          );
      }
    }
    void read();
    const timer = setInterval(() => void read(), 1000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [user]);
  async function retry() {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      await syncIncidents(user, true);
      await refresh();
      void list.refetch();
      if (id) void detail.refetch();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const rows = new Map<
    string,
    {
      id: string;
      type: string;
      description: string;
      capturedAt: string;
      status: string;
      syncStatus: string;
      assignedTo?: string | null;
      reporterId?: string | null;
    }
  >();
  for (const item of local)
    rows.set(item.id, {
      ...item.payload,
      status: item.serverRecord?.status ?? "NEW",
      syncStatus: item.syncStatus,
    });
  for (const item of list.data ?? [])
    rows.set(item.id, { ...item, syncStatus: "SYNCED" });
  const localSelected = local.find((item) => item.id === id);
  const selected = detail.data?.incident ?? localSelected?.serverRecord;
  const payload = selected ?? localSelected?.payload;
  const visibleRows = [...rows.values()].filter((item) =>
    view === "assigned"
      ? Boolean(user && item.assignedTo === user.id)
      : item.reporterId === undefined || item.reporterId === user?.id,
  );
  return (
    <main id="main-content" className="m1-page">
      <nav className="m1-nav">
        <Link to="/">Patrol home</Link>
        <Link to="/incidents/report">Report incident</Link>
        <Link to="/incidents">My incidents</Link>
      </nav>
      <h1>{id ? "Incident details" : "My incidents"}</h1>
      {!id && (
        <div className="m1-tabs" role="group" aria-label="Incident view">
          <button
            className="m1-secondary"
            aria-pressed={view === "reported"}
            onClick={() => setView("reported")}
          >
            My reports
          </button>
          <button
            className="m1-secondary"
            aria-pressed={view === "assigned"}
            onClick={() => setView("assigned")}
          >
            Assigned to me
          </button>
        </div>
      )}
      <section className="m1-card">
        <p>
          {queue.filter((item) => item.syncStatus !== "SYNCED").length}{" "}
          operations pending ·{" "}
          {queue.filter((item) => item.syncStatus === "FAILED").length} failed
        </p>
        <button type="button" onClick={() => void retry()} disabled={busy}>
          {busy ? "Synchronizing…" : "Retry sync"}
        </button>
        {captureOnly && (
          <p>
            Offline capture mode.{" "}
            <Link to="/login">Sign in as the original ranger</Link> to
            synchronize.
          </p>
        )}
        {error && (
          <p role="alert" className="m1-error">
            {error}
          </p>
        )}
        {queue
          .filter((item) => item.lastError && item.syncStatus !== "SYNCED")
          .map((item) => (
            <p key={item.operationId} role="status">
              {item.kind === "INCIDENT_MEDIA" ? "Photo" : "Report"}:{" "}
              {item.lastError} · attempt {item.attemptCount} · {item.syncStatus}
            </p>
          ))}
      </section>
      {list.isError && (
        <p role="status">
          Server reports unavailable. Saved local reports remain below.
        </p>
      )}
      {!id ? (
        <section className="m1-grid">
          {visibleRows.map((item) => (
            <article className="m1-card" key={item.id}>
              <h2>{item.type.replaceAll("_", " ")}</h2>
              <p>
                {item.status} · {item.syncStatus}
              </p>
              <p>{new Date(item.capturedAt).toLocaleString()}</p>
              <p>{item.description}</p>
              <Link to={`/incidents/${item.id}`}>View report</Link>
            </article>
          ))}
          {!visibleRows.length && (
            <p>{list.isLoading ? "Loading reports…" : "No reports yet."}</p>
          )}
        </section>
      ) : payload ? (
        <section className="m1-card">
          <h2>{payload.type.replaceAll("_", " ")}</h2>
          <p>{payload.description}</p>
          <p>
            {new Date(payload.capturedAt).toLocaleString()} ·{" "}
            {payload.locationStatus}
          </p>
          <p>
            {payload.location
              ? `${payload.location.latitude}, ${payload.location.longitude}`
              : "Unresolved location"}
          </p>
          <p>
            Status: {selected?.status ?? "NEW"} ·{" "}
            {localSelected?.syncStatus ?? "SYNCED"}
          </p>
          {selected?.assignedTo === user?.id && (
            <p className="m1-notice">
              Assigned to you. Coordinate the response with your park operator.
            </p>
          )}
          {selected?.photoUrl &&
            !detail.data?.media.some(
              (media) => media.dataUrl === selected.photoUrl,
            ) && (
              <img
                className="m1-photo"
                src={selected.photoUrl}
                alt="Incident evidence"
              />
            )}
          {[
            ...(detail.data?.media ?? []).map((m) => ({
              ...m,
              syncStatus: "SYNCED",
            })),
            ...photos.filter(
              (m) =>
                m.incidentId === id &&
                !detail.data?.media.some((server) => server.id === m.id),
            ),
          ].map((photo) => (
            <figure key={photo.id}>
              <img
                className="m1-photo"
                src={photo.dataUrl}
                alt="Incident evidence"
              />
              <figcaption>Photo: {photo.syncStatus}</figcaption>
            </figure>
          ))}
          {selected?.outcomeNotes && <p>Outcome: {selected.outcomeNotes}</p>}
          <h3>History</h3>
          {detail.data?.history.map((event) => (
            <p key={event.id}>
              {new Date(event.createdAt).toLocaleString()} ·{" "}
              {event.eventType.replaceAll("_", " ")} {event.notes}
            </p>
          ))}
        </section>
      ) : (
        <p role="status">
          {detail.isLoading
            ? "Loading incident…"
            : "This incident is unavailable."}
        </p>
      )}
    </main>
  );
}
