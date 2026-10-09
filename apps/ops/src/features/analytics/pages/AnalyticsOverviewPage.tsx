import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { AnalyticsFilterSchema } from "@wr/shared";
import type { AnalyticsFilter, ReportRunResponse } from "@wr/shared";
import { useAuth } from "../../../auth/AuthContext.js";
import { AccountHeader } from "../../../components/AccountHeader.js";
import {
  generateAnalyticsReport,
  getAnalyticsOptions,
  getAnalyticsRun,
} from "../api.js";
import { AccessPending } from "../components/AccessPending.js";
import { ReportViewToggle } from "../components/ReportViewToggle.js";
import { ReportStamp } from "../components/ReportStamp.js";
import { ExportBar } from "../components/ExportBar.js";
import { FilterBar } from "../components/FilterBar.js";
import {
  EmptyReport,
  EmptyResult,
  SkeletonReport,
  TimeoutBanner,
} from "../components/ReportStates.js";
import { ReportOverview } from "../components/ReportOverview.js";
import {
  filterFromSearch,
  patchFilterSearch,
  presetDateRange,
} from "../lib/filters.js";
import "../analytics.css";

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The report could not be generated. Please try again.";
}

function friendlyDate(value: string): string {
  return new Intl.DateTimeFormat("en-LK", {
    timeZone: "Asia/Colombo",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00.000Z`));
}

function filtersMatch(
  reportFilter: AnalyticsFilter,
  filter: AnalyticsFilter,
): boolean {
  return (
    reportFilter.parkId === filter.parkId &&
    reportFilter.preset === filter.preset &&
    reportFilter.categoryGroup === filter.categoryGroup &&
    reportFilter.sectorId === filter.sectorId &&
    reportFilter.includeRejected === filter.includeRejected &&
    reportFilter.types.join(",") === filter.types.join(",") &&
    reportFilter.sources.join(",") === filter.sources.join(",") &&
    (filter.preset !== "CUSTOM" ||
      (reportFilter.from === filter.from && reportFilter.to === filter.to))
  );
}

export function AnalyticsOverviewPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [localRun, setLocalRun] = useState<ReportRunResponse | null>(null);
  const [lastGoodRun, setLastGoodRun] = useState<ReportRunResponse | null>(
    null,
  );
  const [focusRunId, setFocusRunId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const parkId = user?.parkId ?? "";
  const filter = useMemo(
    () => (parkId ? filterFromSearch(searchParams, parkId) : null),
    [parkId, searchParams],
  );
  const optionsQuery = useQuery({
    queryKey: ["analytics", "options", filter?.parkId ?? parkId],
    queryFn: () => getAnalyticsOptions(filter?.parkId ?? parkId),
    enabled: Boolean(filter?.parkId),
  });
  const runId = searchParams.get("run");
  const savedRunQuery = useQuery({
    queryKey: ["analytics", "saved-run", runId],
    queryFn: () => getAnalyticsRun(runId!),
    enabled: Boolean(runId),
  });
  const generationKey = filter
    ? [
        "analytics",
        "generate",
        filter.parkId,
        filter.from,
        filter.to,
        filter.preset,
        filter.categoryGroup,
        filter.types,
        filter.sources,
        filter.sectorId,
        filter.includeRejected,
      ]
    : ["analytics", "generate", "no-filter"];
  const generationQuery = useQuery({
    queryKey: generationKey,
    queryFn: () => generateAnalyticsReport(filter!),
    enabled: false,
    retry: false,
  });

  useEffect(() => {
    if (!runId || localRun?.runId !== runId) setLocalRun(null);
  }, [runId, localRun?.runId]);
  useEffect(() => {
    if (savedRunQuery.data?.status === "SUCCEEDED")
      setLastGoodRun(savedRunQuery.data);
  }, [savedRunQuery.data]);

  const run = localRun ?? savedRunQuery.data ?? null;
  const displayedRun =
    run?.status === "EMPTY"
      ? null
      : run?.status === "SUCCEEDED"
        ? run
        : lastGoodRun;
  useEffect(() => {
    if (focusRunId && run?.runId === focusRunId && headingRef.current) {
      headingRef.current.focus();
      setFocusRunId(null);
    }
  }, [focusRunId, run]);
  const generating = generationQuery.isFetching;
  const generateError = generationQuery.error
    ? errorMessage(generationQuery.error)
    : "";

  function updateFilter(patch: Partial<AnalyticsFilter>) {
    if (!filter) return;
    const next = patchFilterSearch(searchParams, patch);
    if (run?.status !== "SUCCEEDED") {
      setLocalRun(null);
      next.delete("run");
    }
    setSearchParams(next, { replace: true });
  }

  async function generate() {
    if (!filter) return;
    const parsed = AnalyticsFilterSchema.safeParse(filter);
    if (!parsed.success) return;
    setAnnouncement("Compiling report…");
    const result = await generationQuery.refetch();
    if (result.data) {
      const nextRun = result.data;
      setLocalRun(nextRun);
      if (nextRun.status === "SUCCEEDED") setLastGoodRun(nextRun);
      const next = patchFilterSearch(searchParams, filter);
      next.set("run", nextRun.runId);
      setSearchParams(next, { replace: true });
      await queryClient.invalidateQueries({
        queryKey: ["analytics", "saved-run", nextRun.runId],
      });
      if (nextRun.status === "SUCCEEDED" && nextRun.report) {
        const report = nextRun.report;
        setAnnouncement(
          `Report ${nextRun.code} compiled: ${report.kpis.totalIncidents} incidents`,
        );
      } else if (nextRun.status === "EMPTY") {
        setAnnouncement(
          "No records match these filters. Try a wider date range.",
        );
      }
      if (nextRun.status === "SUCCEEDED" || nextRun.status === "EMPTY") {
        setFocusRunId(nextRun.runId);
      }
    }
  }

  function applySuggestion(suggestion: string) {
    if (!filter) return;
    if (/categor/i.test(suggestion))
      updateFilter({ categoryGroup: "ALL", types: [] });
    else if (/sector/i.test(suggestion)) updateFilter({ sectorId: null });
    else if (/source/i.test(suggestion)) updateFilter({ sources: [] });
    else if (suggestion === "LAST_12_MONTHS" || /12 months/i.test(suggestion))
      updateFilter({
        preset: "LAST_12_MONTHS",
        ...presetDateRange("LAST_12_MONTHS"),
      });
    else if (
      suggestion === "LAST_30_DAYS" ||
      suggestion === "LAST_90_DAYS" ||
      suggestion === "LAST_6_MONTHS"
    )
      updateFilter({
        preset: suggestion,
        ...presetDateRange(suggestion),
      });
    else if (/widen|months|longer/i.test(suggestion))
      updateFilter({
        preset: "LAST_12_MONTHS",
        ...presetDateRange("LAST_12_MONTHS"),
      });
  }

  if (!user?.parkId) {
    return (
      <div className="an-page">
        <AccountHeader />
        <main id="main-content" className="an-main content-width">
          <AccessPending />
        </main>
      </div>
    );
  }

  if (optionsQuery.isLoading) {
    return (
      <div className="an-page">
        <AccountHeader />
        <main id="main-content" className="an-main content-width">
          <div className="an-page-loading" role="status">
            Loading analytics filters…
          </div>
        </main>
      </div>
    );
  }

  if (optionsQuery.isError || !optionsQuery.data) {
    return (
      <div className="an-page">
        <AccountHeader />
        <main id="main-content" className="an-main content-width">
          <section className="an-load-error" role="alert">
            <h1>Analytics are temporarily unavailable.</h1>
            <p>{errorMessage(optionsQuery.error)}</p>
            <button
              type="button"
              className="an-button an-button-primary"
              onClick={() => void optionsQuery.refetch()}
            >
              Try again
            </button>
          </section>
        </main>
      </div>
    );
  }

  if (!filter) return null;
  const report = displayedRun?.report ?? null;
  const showingPreviousRun = Boolean(
    displayedRun &&
    report &&
    (run?.status === "TIMED_OUT" ||
      run?.status === "FAILED" ||
      (run?.status !== "EMPTY" && !filtersMatch(report.filters, filter))),
  );
  const fromText = friendlyDate(filter.from);
  const toText = friendlyDate(filter.to);
  const runError =
    savedRunQuery.isError && !localRun
      ? errorMessage(savedRunQuery.error)
      : generateError;

  return (
    <div className="an-page">
      <AccountHeader />
      <main id="main-content" className="an-main content-width">
        <header className="an-page-header">
          <div>
            <p className="an-overline">ANALYTICS &amp; REPORTS</p>
            <h1>Conservation analytics</h1>
            <p className="an-subtitle">
              {optionsQuery.data.allowedParks.find(
                (park) => park.id === filter.parkId,
              )?.name ??
                user.parkName ??
                "Assigned park"}
              <span aria-hidden="true"> · </span>
              {user.role === "RESEARCHER"
                ? "Read-only for Researchers"
                : "Park operations overview"}
            </p>
          </div>
          <Link
            className="an-history-link"
            to={{ pathname: "/reports", search: searchParams.toString() }}
          >
            Report history <ArrowRight size={16} />
          </Link>
        </header>

        <nav className="an-tabs" aria-label="Analytics sections">
          <Link to="/analytics" aria-current="page">
            Overview
          </Link>
          <Link
            to={{ pathname: "/analytics/map", search: searchParams.toString() }}
          >
            Hotspot map
          </Link>
          <Link
            to={{
              pathname: "/analytics/patrol-gaps",
              search: searchParams.toString(),
            }}
          >
            Patrol gaps
          </Link>
          <Link
            to={{
              pathname: "/analytics/conflicts",
              search: searchParams.toString(),
            }}
          >
            Conflict trends
          </Link>
        </nav>

        <FilterBar
          filter={filter}
          options={optionsQuery.data}
          onChange={updateFilter}
          onGenerate={() => void generate()}
          pending={generating}
          error=""
        />

        <div className="an-report-toolbar">
          <ReportViewToggle search={searchParams.toString()} />
          {displayedRun?.status === "SUCCEEDED" && displayedRun.report ? (
            <ReportStamp run={displayedRun} />
          ) : (
            <div className="an-report-stamp">
              <span>
                {fromText} – {toText} · Report preview
              </span>
            </div>
          )}
        </div>

        {run?.status === "TIMED_OUT" && (
          <TimeoutBanner
            message="The report took too long and was stopped. Your filters are kept."
            onRetry={() => void generate()}
          />
        )}
        {run?.status === "FAILED" && (
          <TimeoutBanner
            message="The report could not be completed. Your filters are kept."
            onRetry={() => void generate()}
          />
        )}
        {runError && !generating && (
          <TimeoutBanner message={runError} onRetry={() => void generate()} />
        )}
        {showingPreviousRun && (
          <p className="an-previous-report-note" role="status">
            Showing the previous report while these filter changes are pending.
          </p>
        )}

        <div role="status" aria-atomic="true" className="an-sr-only">
          {announcement}
        </div>
        <div
          className={generating && displayedRun ? "an-report-busy" : undefined}
          aria-busy={generating}
        >
          {(generating || savedRunQuery.isLoading) && !displayedRun && (
            <SkeletonReport />
          )}
          {!displayedRun &&
            !generating &&
            !savedRunQuery.isLoading &&
            !runError &&
            (run === null ||
              run.status === "TIMED_OUT" ||
              run.status === "FAILED") && (
              <EmptyReport
                onSuggestion={(suggestion) => applySuggestion(suggestion)}
              />
            )}
          {(report || run?.status === "EMPTY") && (
            <h2 ref={headingRef} tabIndex={-1} className="an-results-heading">
              Report results
            </h2>
          )}
          {run?.status === "EMPTY" && (
            <EmptyResult run={run} onSuggestion={applySuggestion} />
          )}
          {report && <ReportOverview report={report} />}
        </div>
        <ExportBar run={run?.status === "EMPTY" ? run : displayedRun} />
      </main>
    </div>
  );
}
