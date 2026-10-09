import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { CheckCircle2, CircleDashed, CircleX, Clock3 } from "lucide-react";
import { useAuth } from "../../../auth/AuthContext.js";
import { exportAnalyticsRun, listReportRuns } from "../api.js";
import { patchFilterSearch } from "../lib/filters.js";
import { AccessPending } from "../components/AccessPending.js";
import "../analytics.css";

const statuses = ["SUCCEEDED", "EMPTY", "TIMED_OUT", "FAILED"] as const;
type RunStatus = (typeof statuses)[number];

function statusLabel(status: RunStatus): string {
  return {
    SUCCEEDED: "Succeeded",
    EMPTY: "Empty",
    TIMED_OUT: "Timed out",
    FAILED: "Failed",
  }[status];
}

function StatusIcon({ status }: { status: RunStatus }) {
  const Icon =
    status === "SUCCEEDED"
      ? CheckCircle2
      : status === "EMPTY"
        ? CircleDashed
        : status === "TIMED_OUT"
          ? Clock3
          : CircleX;
  return <Icon aria-hidden="true" size={13} />;
}

function createdLabel(value: string): string {
  return new Intl.DateTimeFormat("en-LK", {
    timeZone: "Asia/Colombo",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ReportHistoryPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [exportError, setExportError] = useState("");
  const [pendingExport, setPendingExport] = useState<string | null>(null);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const status = searchParams.get("status") ?? "";
  const from = searchParams.get("historyFrom") ?? "";
  const to = searchParams.get("historyTo") ?? "";
  const validStatus = statuses.includes(status as RunStatus)
    ? (status as RunStatus)
    : undefined;
  const historyQuery = useQuery({
    queryKey: ["analytics", "runs", page, validStatus, from, to],
    queryFn: () =>
      listReportRuns({
        page,
        pageSize: 20,
        status: validStatus,
        from: from || undefined,
        to: to || undefined,
      }),
    enabled: Boolean(user?.parkId),
  });

  if (!user?.parkId) {
    return (
      <div className="an-page">
        <main id="main-content" className="an-main content-width">
          <AccessPending />
        </main>
      </div>
    );
  }

  function updateParams(values: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (
      values.status !== undefined ||
      values.historyFrom !== undefined ||
      values.historyTo !== undefined
    )
      next.set("page", "1");
    setSearchParams(next, { replace: true });
  }

  async function exportRun(runId: string, format: "PDF" | "CSV") {
    setExportError("");
    setPendingExport(`${runId}:${format}`);
    try {
      await exportAnalyticsRun(runId, format);
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : `The ${format} export failed.`,
      );
    } finally {
      setPendingExport(null);
    }
  }

  const history = historyQuery.data;
  const pageCount = history
    ? Math.max(1, Math.ceil(history.total / history.pageSize))
    : 1;

  return (
    <div className="an-page">
      <main id="main-content" className="an-main content-width">
        <header className="an-page-header">
          <div>
            <p className="an-overline">ANALYTICS &amp; REPORTS</p>
            <h1>Report history</h1>
            <p className="an-subtitle">
              Report runs and export audit for your assigned park
            </p>
          </div>
          <Link
            className="an-history-link"
            to={{ pathname: "/analytics", search: searchParams.toString() }}
          >
            ← Conservation analytics
          </Link>
        </header>
        <nav className="an-tabs" aria-label="Analytics sections">
          {[
            ["Overview", "/analytics"],
            ["Hotspot map", "/analytics/map"],
            ["Patrol gaps", "/analytics/patrol-gaps"],
            ["Conflict trends", "/analytics/conflicts"],
            ["Report history", "/reports"],
          ].map(([label, path]) => (
            <Link
              key={path}
              to={{ pathname: path, search: searchParams.toString() }}
              aria-current={path === "/reports" ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <section
          className="an-panel an-history-filters"
          aria-label="Report history filters"
        >
          <label>
            Status
            <select
              aria-label="Report status"
              value={validStatus ?? ""}
              onChange={(event) =>
                updateParams({ status: event.target.value || null })
              }
            >
              <option value="">All statuses</option>
              {statuses.map((value) => (
                <option key={value} value={value}>
                  {statusLabel(value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            From
            <input
              aria-label="History from date"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) =>
                updateParams({ historyFrom: event.target.value || null })
              }
            />
          </label>
          <label>
            To
            <input
              aria-label="History to date"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) =>
                updateParams({ historyTo: event.target.value || null })
              }
            />
          </label>
          {(from || to || validStatus) && (
            <button
              type="button"
              className="an-button an-button-outline"
              onClick={() =>
                updateParams({
                  status: null,
                  historyFrom: null,
                  historyTo: null,
                })
              }
            >
              Clear filters
            </button>
          )}
        </section>
        {exportError && (
          <p className="an-export-error" role="alert">
            {exportError}
          </p>
        )}
        {historyQuery.isLoading && (
          <div className="an-page-loading" role="status">
            Loading report history…
          </div>
        )}
        {historyQuery.isError && (
          <section className="an-load-error" role="alert">
            <h2>Report history is unavailable.</h2>
            <p>{historyQuery.error.message}</p>
            <button
              type="button"
              className="an-button an-button-primary"
              onClick={() => void historyQuery.refetch()}
            >
              Try again
            </button>
          </section>
        )}
        {history && (
          <>
            <div className="an-history-summary" role="status">
              {history.total} report{history.total === 1 ? "" : "s"} · Page{" "}
              {history.page} of {pageCount}
            </div>
            <div className="an-history-table-wrap">
              <table className="an-table an-history-table">
                <thead>
                  <tr>
                    <th scope="col">Code</th>
                    <th scope="col">Generated</th>
                    {user?.role === "PARK_MANAGER" && <th scope="col">By</th>}
                    <th scope="col">Period</th>
                    <th scope="col">Filters</th>
                    <th scope="col">Status</th>
                    <th scope="col">Exports</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.items.map((item) => {
                    const openSearch = patchFilterSearch(
                      new URLSearchParams(),
                      item.filters,
                    );
                    openSearch.set("run", item.id);
                    const canExport = item.status === "SUCCEEDED";
                    return (
                      <tr key={item.id}>
                        <th scope="row" data-label="Code">
                          {item.code}
                        </th>
                        <td data-label="Generated">
                          {createdLabel(item.createdAt)}
                        </td>
                        {user?.role === "PARK_MANAGER" && (
                          <td data-label="By">
                            {item.requestedBy.name}
                            <small>
                              {item.requesterRole.replaceAll("_", " ")}
                            </small>
                          </td>
                        )}
                        <td data-label="Period">
                          {item.filters.from} – {item.filters.to}
                        </td>
                        <td data-label="Filters">
                          {item.filters.categoryGroup.replaceAll("_", " ")}
                          {item.filters.sectorId ? " · sector selected" : ""}
                          {item.filters.types.length
                            ? ` · ${item.filters.types.join(", ")}`
                            : ""}
                          {item.filters.sources.length
                            ? ` · ${item.filters.sources.join(", ")}`
                            : ""}
                        </td>
                        <td data-label="Status">
                          <span
                            className={`an-run-status is-${item.status.toLowerCase()}`}
                          >
                            <StatusIcon status={item.status} />{" "}
                            {statusLabel(item.status)}
                          </span>
                        </td>
                        <td data-label="Exports">
                          {item.exports.length ? (
                            item.exports.map((exportItem) => (
                              <span
                                key={exportItem.id}
                                className={`an-export-chip is-${exportItem.status.toLowerCase()}`}
                                title={`${exportItem.format} · ${createdLabel(exportItem.createdAt)}`}
                              >
                                {exportItem.format}{" "}
                                {exportItem.status === "SUCCEEDED" ? "✓" : "✗"}{" "}
                                <small>
                                  {new Intl.DateTimeFormat("en-LK", {
                                    timeZone: "Asia/Colombo",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }).format(new Date(exportItem.createdAt))}
                                </small>
                              </span>
                            ))
                          ) : (
                            <span>None</span>
                          )}
                        </td>
                        <td data-label="Actions" className="an-history-actions">
                          <Link
                            className="an-button an-button-quiet"
                            to={{
                              pathname: "/analytics",
                              search: openSearch.toString(),
                            }}
                          >
                            Open
                          </Link>
                          <button
                            type="button"
                            className="an-text-button"
                            disabled={
                              !canExport || pendingExport === `${item.id}:PDF`
                            }
                            onClick={() => void exportRun(item.id, "PDF")}
                          >
                            {pendingExport === `${item.id}:PDF`
                              ? "Preparing…"
                              : "PDF"}
                          </button>
                          <button
                            type="button"
                            className="an-text-button"
                            disabled={
                              !canExport || pendingExport === `${item.id}:CSV`
                            }
                            onClick={() => void exportRun(item.id, "CSV")}
                          >
                            {pendingExport === `${item.id}:CSV`
                              ? "Preparing…"
                              : "CSV"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {history.items.length === 0 && (
                    <tr>
                      <td colSpan={user?.role === "PARK_MANAGER" ? 8 : 7}>
                        No report runs match these filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div
              className="an-history-pagination"
              aria-label="History pagination"
            >
              <button
                type="button"
                className="an-button an-button-outline"
                disabled={history.page <= 1}
                onClick={() => updateParams({ page: String(history.page - 1) })}
              >
                Previous
              </button>
              <span>
                Page {history.page} of {pageCount}
              </span>
              <button
                type="button"
                className="an-button an-button-outline"
                disabled={history.page >= pageCount}
                onClick={() => updateParams({ page: String(history.page + 1) })}
              >
                Next
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
