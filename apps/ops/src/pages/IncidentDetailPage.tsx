import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { IncidentDetail } from "@wr/shared";
import { CoordinateFields, parseCoordinates } from "@wr/ui";
import { useAuth } from "../auth/AuthContext.js";
import { apiRequest } from "../api.js";
import { IncidentLayout } from "../components/IncidentLayout.js";
export function IncidentDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ["m1-detail", user?.id, id],
    queryFn: () => apiRequest<IncidentDetail>(`/api/incidents/${id}`),
  });
  const responders = useQuery({
    queryKey: ["m1-responders", user?.id],
    queryFn: () =>
      apiRequest<{ id: string; name: string }[]>("/api/incidents/responders"),
  });
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [notes, setNotes] = useState("");
  const [responderId, setResponderId] = useState("");
  const [outcome, setOutcome] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const record = query.data?.incident;
  async function action(
    path: string,
    method: string,
    body: object,
    success: string,
  ) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(path, { method, body });
      setNotice(success);
      await query.refetch();
      await cache.invalidateQueries({ queryKey: ["m1-incidents"] });
    } catch (failure) {
      setError((failure as Error).message);
      if ((failure as { status?: number }).status === 409) void query.refetch();
    } finally {
      setBusy(false);
    }
  }
  const revision = { expectedRevision: record?.revision };
  const terminal =
    record?.status === "RESOLVED" || record?.status === "REJECTED";
  return (
    <IncidentLayout title="Incident details">
      {query.isLoading ? (
        <p role="status">Loading incident…</p>
      ) : query.isError ? (
        <p role="alert">{(query.error as Error).message}</p>
      ) : (
        record && (
          <>
            <section className="m1-card">
              <h2>{record.type.replaceAll("_", " ")}</h2>
              <span
                className={`m1-badge m1-status-${record.status.toLowerCase()}`}
              >
                {record.status}
              </span>
              <p>{record.description}</p>
              <dl className="m1-details">
                <dt>Source</dt>
                <dd>{record.source}</dd>
                <dt>Captured</dt>
                <dd>{new Date(record.capturedAt).toLocaleString()}</dd>
                <dt>Received</dt>
                <dd>{new Date(record.receivedAt).toLocaleString()}</dd>
                <dt>Location</dt>
                <dd>
                  {record.locationStatus} ·{" "}
                  {record.location
                    ? `${record.location.latitude}, ${record.location.longitude}`
                    : "Coordinates unresolved"}
                  {record.locationAccuracy !== null &&
                    ` · ±${record.locationAccuracy} m`}
                </dd>
                <dt>Original landmark</dt>
                <dd>{record.locationText ?? "—"}</dd>
                <dt>Reporter</dt>
                <dd>
                  {record.reporterPhone ?? record.reporterId ?? "Camera intake"}
                </dd>
                <dt>Responder</dt>
                <dd>
                  {responders.data?.find((r) => r.id === record.assignedTo)
                    ?.name ??
                    record.assignedTo ??
                    "Unassigned"}
                </dd>
                <dt>Assigned at</dt>
                <dd>
                  {record.assignedAt
                    ? new Date(record.assignedAt).toLocaleString()
                    : "—"}
                </dd>
                <dt>Response started</dt>
                <dd>
                  {record.firstResponseAt
                    ? new Date(record.firstResponseAt).toLocaleString()
                    : "—"}
                </dd>
                <dt>Resolved at</dt>
                <dd>
                  {record.resolvedAt
                    ? new Date(record.resolvedAt).toLocaleString()
                    : "—"}
                </dd>
              </dl>
              {record.outcomeNotes && <p>Outcome: {record.outcomeNotes}</p>}
              {query.data!.media.map((media) => (
                <img
                  key={media.id}
                  className="m1-photo"
                  src={media.dataUrl}
                  alt="Incident evidence"
                />
              ))}
              {record.source === "CAMERA_TRAP" && (
                <Link to="/camera-traps">View source camera image</Link>
              )}
            </section>
            {error && (
              <p role="alert" className="m1-error">
                {error}
              </p>
            )}
            {notice && (
              <p role="status" className="m1-notice">
                {notice}
              </p>
            )}
            {!terminal && (
              <section className="m1-grid">
                <form
                  className="m1-card m1-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    try {
                      const location = parseCoordinates(latitude, longitude);
                      void action(
                        `/api/incidents/${id}/location`,
                        "PATCH",
                        { ...revision, location, notes },
                        "Location clarified; original landmark retained.",
                      );
                    } catch (failure) {
                      setError((failure as Error).message);
                    }
                  }}
                >
                  <h2>Clarify location</h2>
                  <CoordinateFields
                    latitude={latitude}
                    longitude={longitude}
                    onChange={(lat, lng) => {
                      setLatitude(lat);
                      setLongitude(lng);
                    }}
                  />
                  <label>
                    Confirmation notes
                    <textarea
                      required
                      maxLength={4000}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </label>
                  <button disabled={busy}>Save confirmed location</button>
                </form>
                {record.status === "NEW" && (
                  <section className="m1-card">
                    <h2>Review incident</h2>
                    <p>
                      Verification confirms the report. Location can be
                      clarified before response.
                    </p>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void action(
                          `/api/incidents/${id}/status`,
                          "PATCH",
                          { ...revision, status: "VERIFIED" },
                          "Incident verified.",
                        )
                      }
                    >
                      Verify
                    </button>
                  </section>
                )}
                {["NEW", "VERIFIED"].includes(record.status) && (
                  <form
                    className="m1-card m1-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void action(
                        `/api/incidents/${id}/status`,
                        "PATCH",
                        { ...revision, status: "REJECTED", notes },
                        "Incident rejected.",
                      );
                    }}
                  >
                    <h2>Reject report</h2>
                    <label>
                      Reason
                      <textarea
                        required
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        maxLength={4000}
                      />
                    </label>
                    <button disabled={busy}>Reject incident</button>
                  </form>
                )}
                {record.status === "VERIFIED" && (
                  <section className="m1-card m1-form">
                    <h2>Assign responder</h2>
                    {responders.isError && (
                      <p role="alert">Responders could not be loaded.</p>
                    )}
                    <label>
                      Ranger
                      <select
                        value={responderId}
                        onChange={(e) => setResponderId(e.target.value)}
                      >
                        <option value="">Select a ranger</option>
                        {responders.data?.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      disabled={busy || !responderId}
                      onClick={() =>
                        void action(
                          `/api/incidents/${id}/assign`,
                          "POST",
                          { ...revision, responderId },
                          "Responder assigned.",
                        )
                      }
                    >
                      Assign ranger
                    </button>
                    <button
                      disabled={busy || !record.assignedTo || !record.location}
                      onClick={() =>
                        void action(
                          `/api/incidents/${id}/response`,
                          "POST",
                          { ...revision, action: "START" },
                          "Response started.",
                        )
                      }
                    >
                      Start response
                    </button>
                    {!record.location && (
                      <p>Confirm coordinates before starting response.</p>
                    )}
                  </section>
                )}
                {record.status === "IN_PROGRESS" && (
                  <form
                    className="m1-card m1-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void action(
                        `/api/incidents/${id}/response`,
                        "POST",
                        {
                          ...revision,
                          action: "RESOLVE",
                          outcomeNotes: outcome,
                        },
                        "Incident resolved.",
                      );
                    }}
                  >
                    <h2>Resolve incident</h2>
                    <label>
                      Outcome notes
                      <textarea
                        value={outcome}
                        onChange={(e) => setOutcome(e.target.value)}
                        required
                        maxLength={4000}
                        rows={4}
                      />
                    </label>
                    <button disabled={busy || !outcome.trim()}>
                      Record outcome and resolve
                    </button>
                  </form>
                )}
              </section>
            )}
            {record.source === "COMMUNITY" && (
              <section className="m1-card m1-form">
                <h2>Community messages</h2>
                {query.data!.messages.map((message) => (
                  <article key={message.id}>
                    <p>
                      Phone: {message.phone} · {message.state}
                    </p>
                    <p>Raw message: {message.rawText}</p>
                    <p>
                      Original landmark: {message.locationText || "Missing"}
                    </p>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void action(
                          `/api/community/messages/${message.id}/follow-up`,
                          "POST",
                          { id: crypto.randomUUID(), text: followUp },
                          "Mock follow-up stored. No real SMS was sent.",
                        );
                      }}
                    >
                      <label>
                        Follow-up text
                        <textarea
                          required
                          value={followUp}
                          onChange={(e) => setFollowUp(e.target.value)}
                          maxLength={4000}
                        />
                      </label>
                      <button disabled={busy || !followUp.trim()}>
                        Send mock follow-up
                      </button>
                    </form>
                  </article>
                ))}
                {query.data!.followUps.map((f) => (
                  <p key={f.id}>
                    {new Date(f.sentAt).toLocaleString()} · {f.state} · {f.text}
                  </p>
                ))}
              </section>
            )}
            <section className="m1-card">
              <h2>Incident history</h2>
              <ol className="m1-history">
                {query.data!.history.map((event) => (
                  <li key={event.id}>
                    <strong>{event.eventType.replaceAll("_", " ")}</strong>
                    <p>
                      {new Date(event.createdAt).toLocaleString()} ·{" "}
                      {event.actorId ?? "Public intake"}
                    </p>
                    <p>
                      {event.oldStatus &&
                        `${event.oldStatus} → ${event.newStatus}`}{" "}
                      {event.notes}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          </>
        )
      )}
    </IncidentLayout>
  );
}
