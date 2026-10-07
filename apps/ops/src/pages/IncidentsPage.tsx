import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { IncidentCategorySchema, IncidentStatus } from "@wr/shared";
import type { Incident } from "@wr/shared";
import { useAuth } from "../auth/AuthContext.js";
import { apiRequest } from "../api.js";
import { IncidentLayout } from "../components/IncidentLayout.js";
export function IncidentsPage({
  communityOnly = false,
}: {
  communityOnly?: boolean;
}) {
  const { user } = useAuth();
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [type, setType] = useState("");
  const query = useQuery({
    queryKey: ["m1-incidents", user?.id, user?.parkId],
    queryFn: () => apiRequest<Incident[]>("/api/incidents"),
    enabled: Boolean(user),
  });
  const incidents = (query.data ?? []).filter(
    (i) =>
      (!communityOnly || i.source === "COMMUNITY") &&
      (!status || i.status === status) &&
      (!source || i.source === source) &&
      (!type || i.type === type),
  );
  return (
    <IncidentLayout
      title={communityOnly ? "Community conflict inbox" : "Wildlife incidents"}
    >
      <section className="m1-card m1-filters">
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {Object.values(IncidentStatus).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        {!communityOnly && (
          <label>
            Source
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">All sources</option>
              {["RANGER", "COMMUNITY", "CAMERA_TRAP"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        )}
        <label>
          Category
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All categories</option>
            {IncidentCategorySchema.options.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => void query.refetch()}>
          Refresh
        </button>
      </section>
      {query.isLoading ? (
        <p role="status">Loading incidents…</p>
      ) : query.isError ? (
        <p role="alert" className="m1-error">
          {(query.error as Error).message}
        </p>
      ) : !incidents.length ? (
        <section className="m1-card">
          <p>No incidents match these filters.</p>
        </section>
      ) : (
        <div className="m1-table-wrap">
          <table className="m1-table">
            <thead>
              <tr>
                <th>Category / source</th>
                <th>Status</th>
                <th>Captured time</th>
                <th>Location</th>
                <th>Responder</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((i) => (
                <tr key={i.id}>
                  <td>
                    {i.type.replaceAll("_", " ")}
                    <small>{i.source.replaceAll("_", " ")}</small>
                  </td>
                  <td>
                    <span
                      className={`m1-badge m1-status-${i.status.toLowerCase()}`}
                    >
                      {i.status}
                    </span>
                  </td>
                  <td>{new Date(i.capturedAt).toLocaleString()}</td>
                  <td>
                    {i.locationStatus}
                    <small>{i.locationText}</small>
                  </td>
                  <td>{i.assignedTo ? "Assigned" : "Unassigned"}</td>
                  <td>
                    <Link to={`/incidents/${i.id}`}>Open incident</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </IncidentLayout>
  );
}
