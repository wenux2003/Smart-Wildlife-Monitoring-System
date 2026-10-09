import "../analytics.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import type { ReactNode } from "react";
import { AnalyticsFilterSchema } from "@wr/shared";
import type {
  AnalyticsFilter,
  AnalyticsOptions,
  ConservationReport,
  ReportRunResponse,
} from "@wr/shared";
import { useAuth } from "../../../auth/AuthContext.js";
import {
  generateAnalyticsReport,
  getAnalyticsOptions,
  getAnalyticsRun,
} from "../api.js";
import { AccessPending } from "./AccessPending.js";
import { ReportViewToggle } from "./ReportViewToggle.js";
import { ReportStamp } from "./ReportStamp.js";
import { ReportInsights } from "./ReportInsights.js";
import { ExportBar } from "./ExportBar.js";
import { FilterBar } from "./FilterBar.js";
import {
  EmptyReport,
  EmptyResult,
  SkeletonReport,
  TimeoutBanner,
} from "./ReportStates.js";
import {
  filterFromSearch,
  patchFilterSearch,
  presetDateRange,
} from "../lib/filters.js";

import { useAutomaticAnalytics } from "../hooks/useAutomaticAnalytics.js";

type Section = "map" | "patrol-gaps" | "conflicts";

const navigation: { section: Section; label: string; path: string }[] = [
  { section: "map", label: "Hotspot map", path: "/analytics/map" },
  {
    section: "patrol-gaps",
    label: "Patrol gaps",
    path: "/analytics/patrol-gaps",
  },
  {
    section: "conflicts",
    label: "Conflict trends",
    path: "/analytics/conflicts",
  },
];

export function AnalyticsSubpageLayout({
  section,
  children,
}: {
  section: Section;
  children: (
    report: ConservationReport,
    options: AnalyticsOptions,
  ) => ReactNode;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const resultRef = useRef<HTMLHeadingElement>(null);
  const [focusRunId, setFocusRunId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [requestError, setRequestError] = useState("");
  const [lastGoodRun, setLastGoodRun] = useState<ReportRunResponse | null>(
    null,
  );
  const parkId = user?.parkId ?? "";
  const filter = useMemo(() => {
    if (!parkId) return null;
    const value = filterFromSearch(searchParams, parkId);
    return section === "conflicts"
      ? {
          ...value,
          categoryGroup: "HUMAN_WILDLIFE_CONFLICT" as const,
          types: [],
        }
      : value;
  }, [parkId, searchParams, section]);
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
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    const savedFilter = savedRunQuery.data?.report?.filters;
    if (
      runId &&
      savedFilter &&
      !searchParams.has("from") &&
      !searchParams.has("to") &&
      !searchParams.has("preset")
    ) {
      setSearchParams(patchFilterSearch(searchParams, savedFilter), {
        replace: true,
      });
    }
  }, [runId, savedRunQuery.data, searchParams, setSearchParams]);
  const generation = useMutation({
    mutationKey: filter
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
      : ["analytics", "generate", "no-filter"],
    mutationFn: (value: AnalyticsFilter) => generateAnalyticsReport(value),
  });

  const currentFilter = useRef(JSON.stringify(filter));
  currentFilter.current = JSON.stringify(filter);
  const automatic = useAutomaticAnalytics({
    filter,
    enabled: optionsQuery.isSuccess && !runId,
    pending: generation.isPending,
    onGenerate: () => void generate(true),
  });
  const restoringFilters = Boolean(
    runId &&
    savedRunQuery.data?.report &&
    !searchParams.has("from") &&
    !searchParams.has("to") &&
    !searchParams.has("preset"),
  );
  const updating =
    generation.isPending || automatic.waiting || restoringFilters;
  useEffect(() => {
    if (savedRunQuery.data?.status === "SUCCEEDED")
      setLastGoodRun(savedRunQuery.data);
  }, [savedRunQuery.data]);
  useEffect(() => {
    if (
      section === "conflicts" &&
      runId &&
      savedRunQuery.data?.report &&
      savedRunQuery.data.report.filters.categoryGroup !==
        "HUMAN_WILDLIFE_CONFLICT"
    ) {
      const next = new URLSearchParams(searchParams);
      next.delete("run");
      setSearchParams(next, { replace: true });
    }
  }, [section, runId, savedRunQuery.data, searchParams, setSearchParams]);

  useEffect(() => {
    if (section !== "conflicts" || !filter) return;
    if (searchParams.get("group") === filter.categoryGroup) return;
    setSearchParams(
      patchFilterSearch(searchParams, {
        categoryGroup: filter.categoryGroup,
        types: [],
      }),
      { replace: true },
    );
  }, [filter, searchParams, section, setSearchParams]);

  useEffect(() => {
    const completed = savedRunQuery.data;
    if (!focusRunId || completed?.runId !== focusRunId || !resultRef.current)
      return;
    resultRef.current.focus();
    setAnnouncement(
      completed.status === "EMPTY"
        ? "No records match these filters. Try a wider date range."
        : `Report ${completed.code} compiled: ${completed.report?.kpis.totalIncidents ?? 0} incidents`,
    );
    setFocusRunId(null);
  }, [focusRunId, savedRunQuery.data]);

  if (!user?.parkId) {
    return (
      <div className="an-page">
        <main id="main-content" className="an-main content-width">
          <AccessPending />
        </main>
      </div>
    );
  }
  if (optionsQuery.isLoading || !optionsQuery.data) {
    return (
      <div className="an-page">
        <main id="main-content" className="an-main content-width">
          {optionsQuery.isError ? (
            <section className="an-load-error" role="alert">
              <h1>Analytics are temporarily unavailable.</h1>
              <p>{optionsQuery.error.message}</p>
              <button
                type="button"
                className="an-button an-button-primary"
                onClick={() => void optionsQuery.refetch()}
              >
                Try again
              </button>
            </section>
          ) : (
            <div className="an-page-loading" role="status">
              Loading analytics filters…
            </div>
          )}
        </main>
      </div>
    );
  }
  if (!filter) return null;
  const run = savedRunQuery.data;
  const displayedRun =
    run?.status === "EMPTY"
      ? null
      : run?.status === "SUCCEEDED"
        ? run
        : lastGoodRun;
  const loadedReport = displayedRun?.report ?? null;
  const report =
    section === "conflicts" &&
    loadedReport?.filters.categoryGroup !== "HUMAN_WILDLIFE_CONFLICT"
      ? null
      : loadedReport;
  const historySearch = searchParams.toString();

  async function generate(automatically = false) {
    const parsed = AnalyticsFilterSchema.safeParse(filter);
    if (!parsed.success) return;
    automatic.markRequested();
    const requestedFilter = JSON.stringify(filter);
    setRequestError("");
    setAnnouncement("Updating analytics…");
    try {
      const result = await generation.mutateAsync(parsed.data);
      if (currentFilter.current !== requestedFilter) return;
      if (result.status === "SUCCEEDED") setLastGoodRun(result);
      setAnnouncement(
        result.status === "EMPTY"
          ? "No records match these filters. Try a wider date range."
          : `Report ${result.code} compiled: ${result.report?.kpis.totalIncidents ?? 0} incidents`,
      );
      queryClient.setQueryData(
        ["analytics", "saved-run", result.runId],
        result,
      );
      const next = patchFilterSearch(searchParams, parsed.data);
      next.set("run", result.runId);
      if (
        !automatically &&
        (result.status === "SUCCEEDED" || result.status === "EMPTY")
      )
        setFocusRunId(result.runId);
      setSearchParams(next, { replace: true });
    } catch (error) {
      if (currentFilter.current !== requestedFilter) return;
      setRequestError(
        error instanceof Error
          ? error.message
          : "The report could not be generated. Please try again.",
      );
    }
  }

  function updateFilter(patch: Partial<AnalyticsFilter>) {
    const next = patchFilterSearch(searchParams, patch);
    next.delete("run");
    setRequestError("");
    setSearchParams(next, { replace: true });
  }

  function applySuggestion(suggestion: string) {
    if (/categor/i.test(suggestion) && section !== "conflicts")
      updateFilter({ categoryGroup: "ALL", types: [] });
    else if (/sector/i.test(suggestion)) updateFilter({ sectorId: null });
    else if (/source/i.test(suggestion)) updateFilter({ sources: [] });
    else if (
      suggestion === "LAST_12_MONTHS" ||
      /12 months|widen|longer/i.test(suggestion)
    )
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
    else void generate();
  }

  return (
    <div className="an-page">
      <main id="main-content" className="an-main content-width">
        <header className="an-page-header">
          <div>
            <p className="an-overline">ANALYTICS &amp; REPORTS</p>
            <h1>
              {navigation.find((item) => item.section === section)?.label}
            </h1>
            <p className="an-subtitle">
              {optionsQuery.data.allowedParks.find(
                (park) => park.id === filter.parkId,
              )?.name ??
                user.parkName ??
                "Assigned park"}
              <span aria-hidden="true"> · </span>
              {user.role === "RESEARCHER"
                ? "Read-only for Researchers"
                : "Park operations analysis"}
            </p>
          </div>
          <Link
            className="an-history-link"
            to={{ pathname: "/reports", search: historySearch }}
          >
            Report history →
          </Link>
        </header>
        <nav className="an-tabs" aria-label="Analytics sections">
          <Link to={{ pathname: "/analytics", search: historySearch }}>
            Overview
          </Link>
          {navigation.map((item) => (
            <Link
              key={item.section}
              to={{ pathname: item.path, search: historySearch }}
              aria-current={item.section === section ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <FilterBar
          filter={filter}
          options={optionsQuery.data}
          onChange={updateFilter}
          onGenerate={() => void generate()}
          pending={updating}
          error=""
          categoryLocked={section === "conflicts"}
        />
        {section === "conflicts" && (
          <p className="an-filter-note">
            Conflict analysis is fixed to Human-wildlife conflict events; other
            report filters remain in effect.
          </p>
        )}
        {requestError && !updating && (
          <TimeoutBanner
            message={requestError}
            onRetry={() => void generate()}
          />
        )}
        {savedRunQuery.isError && (
          <TimeoutBanner
            message={savedRunQuery.error.message}
            onRetry={() => void savedRunQuery.refetch()}
          />
        )}
        <p className="an-sr-only" role="status" aria-atomic="true">
          {announcement}
        </p>
        {/* A saved report keeps the data it was created with. When the park's map data was set up
            afterwards, offer a fresh report instead of leaving an empty map. */}
        {runId &&
          report &&
          !report.patrolGaps.configured &&
          optionsQuery.data.config.configured && (
            <section
              className="an-spatial-notice an-refresh-notice"
              aria-labelledby="an-refresh-title"
            >
              <strong id="an-refresh-title">
                This saved report was created before the park&apos;s map data
                was set up.
              </strong>
              <p>
                Rebuild it to include hotspots, patrol gaps and
                priority cells. The saved report stays in Report history.
              </p>
              <button
                type="button"
                className="an-button an-button-primary"
                disabled={updating}
                onClick={() => void generate()}
              >
                {updating ? "Updating…" : "Rebuild with map data"}
              </button>
            </section>
          )}
        {(section === "map" || (run?.status === "SUCCEEDED" && report)) && (
          <div className="an-report-toolbar">
            {section === "map" && (
              <ReportViewToggle spatial search={historySearch} />
            )}
            {run?.status === "SUCCEEDED" && report && <ReportStamp run={run} />}
          </div>
        )}
        <div
          aria-busy={updating || savedRunQuery.isLoading}
          className={updating && report ? "an-report-busy" : undefined}
        >
          {(savedRunQuery.isLoading || updating) && !report && (
            <SkeletonReport />
          )}
          {(report || run?.status === "EMPTY") && (
            <h2 ref={resultRef} tabIndex={-1} className="an-results-heading">
              Report results
            </h2>
          )}
          {(run?.status === "TIMED_OUT" || run?.status === "FAILED") && (
            <TimeoutBanner
              message={
                run.status === "TIMED_OUT"
                  ? "The report took too long. Your filters are kept."
                  : "The report could not be completed. Your filters are kept."
              }
              onRetry={() => void generate()}
            />
          )}
          {run?.status === "EMPTY" ? (
            <EmptyResult run={run} onSuggestion={applySuggestion} />
          ) : report ? (
            children(report, optionsQuery.data)
          ) : savedRunQuery.isLoading ||
            updating ||
            run?.status === "TIMED_OUT" ||
            run?.status === "FAILED" ? null : (
            <EmptyReport onSuggestion={applySuggestion} />
          )}
          {report && (
            <div className="an-report-insights">
              <ReportInsights report={report} />
            </div>
          )}
        </div>
        <ExportBar
          run={run?.status === "EMPTY" ? run : displayedRun}
          updating={updating}
        />
      </main>
    </div>
  );
}
