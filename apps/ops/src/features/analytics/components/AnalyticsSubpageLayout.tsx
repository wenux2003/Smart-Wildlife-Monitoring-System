import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import type { ReactNode } from "react";
import { AnalyticsFilterSchema } from "@wr/shared";
import type {
  AnalyticsFilter,
  AnalyticsOptions,
  ConservationReport,
} from "@wr/shared";
import { useAuth } from "../../../auth/AuthContext.js";
import { AccountHeader } from "../../../components/AccountHeader.js";
import {
  generateAnalyticsReport,
  getAnalyticsOptions,
  getAnalyticsRun,
} from "../api.js";
import { AccessPending } from "./AccessPending.js";
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [requestError, setRequestError] = useState("");
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
  });
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
    mutationFn: generateAnalyticsReport,
  });

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

  if (!user?.parkId) {
    return (
      <div className="an-page">
        <AccountHeader />
        <main className="an-main content-width">
          <AccessPending />
        </main>
      </div>
    );
  }
  if (optionsQuery.isLoading || !optionsQuery.data) {
    return (
      <div className="an-page">
        <AccountHeader />
        <main className="an-main content-width">
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
  const loadedReport = run?.status === "SUCCEEDED" ? run.report : null;
  const report =
    section === "conflicts" &&
    loadedReport?.filters.categoryGroup !== "HUMAN_WILDLIFE_CONFLICT"
      ? null
      : loadedReport;
  const historySearch = searchParams.toString();

  async function generate() {
    const parsed = AnalyticsFilterSchema.safeParse(filter);
    if (!parsed.success) return;
    setRequestError("");
    try {
      const result = await generation.mutateAsync(parsed.data);
      const next = patchFilterSearch(searchParams, parsed.data);
      next.set("run", result.runId);
      setSearchParams(next, { replace: true });
    } catch (error) {
      setRequestError(
        error instanceof Error
          ? error.message
          : "The report could not be generated. Please try again.",
      );
    }
  }

  function updateFilter(patch: Partial<AnalyticsFilter>) {
    const next = patchFilterSearch(searchParams, patch);
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
      <AccountHeader />
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
          pending={generation.isPending}
          error={requestError}
          categoryLocked={section === "conflicts"}
        />
        {section === "conflicts" && (
          <p className="an-filter-note">
            Conflict analysis is fixed to Human-wildlife conflict events; other
            report filters remain in effect.
          </p>
        )}
        {savedRunQuery.isError && (
          <TimeoutBanner
            message={savedRunQuery.error.message}
            onRetry={() => void savedRunQuery.refetch()}
          />
        )}
        {savedRunQuery.isLoading && <SkeletonReport />}
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
          run?.status === "TIMED_OUT" ||
          run?.status === "FAILED" ? null : (
          <EmptyReport onSuggestion={applySuggestion} />
        )}
        <ExportBar run={run ?? null} />
      </main>
    </div>
  );
}
