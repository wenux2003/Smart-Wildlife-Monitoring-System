// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { StrictMode } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AnalyticsFilterSchema,
  type AnalyticsFilter,
  type AnalyticsOptions,
  type ConservationReport,
  type ReportRunResponse,
} from "@wr/shared";

import { AnalyticsOverviewPage } from "./AnalyticsOverviewPage.js";
import { AnalyticsSubpageLayout } from "../components/AnalyticsSubpageLayout.js";
import { colomboToday } from "../lib/filters.js";
import {
  generateAnalyticsReport,
  getAnalyticsOptions,
  getAnalyticsRun,
} from "../api.js";

const auth = vi.hoisted(() => ({
  user: {
    id: "manager",
    role: "PARK_MANAGER",
    parkId: "11111111-1111-4111-8111-111111111111",
    parkName: "Yala",
  } as Record<string, string | null>,
}));
vi.mock("../../../auth/AuthContext.js", () => ({ useAuth: () => auth }));
vi.mock("../../../components/AccountHeader.js", () => ({
  AccountHeader: () => <header>Account</header>,
}));
vi.mock("../api.js", () => ({
  generateAnalyticsReport: vi.fn(),
  getAnalyticsOptions: vi.fn(),
  getAnalyticsRun: vi.fn(),
  exportAnalyticsRun: vi.fn(),
}));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Bar: () => null,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  ReferenceLine: () => null,
  LabelList: () => null,
}));

const TEST_PARK = "11111111-1111-4111-8111-111111111111";
function reportFixture(): ConservationReport {
  return {
    schemaVersion: 1,
    syntheticDemo: false,
    park: { id: TEST_PARK, code: "YALA", name: "Yala" },
    filters: AnalyticsFilterSchema.parse({
      parkId: TEST_PARK,
      from: "2026-01-01",
      to: "2026-01-31",
    }),
    window: {
      fromUtc: "2025-12-31T18:30:00.000Z",
      toUtcExclusive: "2026-01-31T18:30:00.000Z",
      bucket: "DAY",
      timezone: "Asia/Colombo",
      days: 31,
    },
    generatedAt: "2026-02-01T00:00:00.000Z",
    kpis: {
      totalIncidents: 0,
      previousPeriodIncidents: 0,
      changePercent: 0,
      changeKind: "NO_CHANGE",
      hotspotCells: 0,
      hotspotSectorNames: [],
      patrolGapAreaKm2: null,
      patrolGapSharePercent: null,
      communityConflictReports: 0,
      collarBreaches: 0,
    },
    dataQuality: {
      excludedNoLocation: 0,
      excludedRejected: 0,
      outsideBoundary: 0,
      sessionsAnalyzed: 0,
      sessionsWithoutTrack: 0,
      droppedGpsPoints: 0,
      alertsWithoutLocation: 0,
    },
    trend: [],
    breakdown: [],
    hotspots: { cellSizeMeters: 1000, cells: [], classBreaks: [] },
    patrolGaps: {
      configured: false,
      cells: [],
      coveredAreaKm2: 0,
      gapAreaKm2: 0,
      parkAreaKm2: 0,
      bySector: [],
    },
    priorityCells: [],
    conflicts: { series: [], byStretch: [] },
    spatialContext: { parkBoundary: null, sectors: [], settlements: [] },
    summarySentences: [],
  };
}

const options: AnalyticsOptions = {
  allowedParks: [{ id: TEST_PARK, code: "YALA", name: "Yala" }],
  types: [
    "POACHING",
    "SNARE_FOUND",
    "HUMAN_WILDLIFE_CONFLICT",
    "CROP_DAMAGE",
    "FENCE_DAMAGE",
    "INJURED_ANIMAL",
    "OTHER",
  ],
  sources: ["RANGER", "COMMUNITY", "CAMERA_TRAP"],
  sectors: [],
  earliestDataDate: "2026-01-01",
  latestDataDate: "2026-10-08",
  config: {
    gridCellMeters: 1000,
    trackBufferMeters: 50,
    maxPointAccuracyMeters: 100,
    maxSegmentGapSeconds: 600,
    maxSegmentLengthMeters: 1000,
    boundaryStretchBufferMeters: 2000,
    gapNeglectDays: 14,
    hotspotMinCount: 3,
    configured: false,
  },
};
let sequence = 0;
function result(filter?: AnalyticsFilter, count = 42): ReportRunResponse {
  const report = reportFixture();
  const id = String(++sequence).padStart(12, "0");
  return {
    runId: `55555555-5555-4555-8555-${id}`,
    code: `RPT-YALA-2026-${id}`,
    status: "SUCCEEDED",
    snapshotSha256: "a".repeat(64),
    suggestions: [],
    report: {
      ...report,
      filters: filter ?? report.filters,
      kpis: { ...report.kpis, totalIncidents: count },
    },
  };
}
function Location() {
  return <output aria-label="Current filters">{useLocation().search}</output>;
}
function show(
  path = "/analytics",
  section?: "map" | "patrol-gaps" | "conflicts",
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <StrictMode>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <Location />
          {section ? (
            <AnalyticsSubpageLayout section={section}>
              {(report) => <p>Spatial total: {report.kpis.totalIncidents}</p>}
            </AnalyticsSubpageLayout>
          ) : (
            <AnalyticsOverviewPage />
          )}
        </MemoryRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
}
beforeEach(async () => {
  vi.resetAllMocks();
  sequence = 0;
  auth.user = {
    id: "manager",
    role: "PARK_MANAGER",
    parkId: TEST_PARK,
    parkName: "Yala",
  };
  vi.mocked(getAnalyticsOptions).mockResolvedValue(options);
  vi.mocked(generateAnalyticsReport).mockImplementation(async (filter) =>
    result(filter),
  );
  vi.mocked(getAnalyticsRun).mockResolvedValue(result());
});
afterEach(() => {
  cleanup();
});

describe("automatic M4 analytics", () => {
  it("loads today's Colombo data once in StrictMode without clicking or stealing filter focus", async () => {
    show();
    const category = await screen.findByLabelText("Category");
    category.focus();
    expect(screen.getByLabelText("Date range")).toHaveValue("TODAY");
    await screen.findByRole("heading", { name: "Report results" });
    expect(generateAnalyticsReport).toHaveBeenCalledTimes(1);
    expect(generateAnalyticsReport).toHaveBeenCalledWith(
      expect.objectContaining({
        from: colomboToday(),
        to: colomboToday(),
        preset: "TODAY",
      }),
    );
    expect(category).toHaveFocus();
    expect(screen.getByLabelText("Current filters")).toHaveTextContent("run=");
    expect(getAnalyticsRun).not.toHaveBeenCalled();
  });

  it("coalesces quick edits, preserves old results, and enables exports only after the matching update", async () => {
    show();
    await screen.findByRole("heading", { name: "Report results" });
    let finish!: (run: ReportRunResponse) => void;
    vi.mocked(generateAnalyticsReport).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const category = screen.getByLabelText("Category");
    category.focus();
    fireEvent.change(category, { target: { value: "OTHER" } });
    fireEvent.change(screen.getByLabelText("Date range"), {
      target: { value: "LAST_30_DAYS" },
    });
    fireEvent.change(category, { target: { value: "ANIMAL_WELFARE" } });
    expect(
      screen.getByRole("button", { name: "Export data (CSV)" }),
    ).toBeDisabled();
    expect(screen.getByText(/Showing the previous report/)).toBeInTheDocument();
    await waitFor(() =>
      expect(generateAnalyticsReport).toHaveBeenCalledTimes(2),
    );
    const filter = vi.mocked(generateAnalyticsReport).mock.calls[1][0];
    expect(filter).toMatchObject({
      preset: "LAST_30_DAYS",
      categoryGroup: "ANIMAL_WELFARE",
    });
    finish(result(filter, 9));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Export data (CSV)" }),
      ).toBeEnabled(),
    );
    expect(
      screen.getByRole("region", { name: "Key indicators" }),
    ).toHaveTextContent("9");
    expect(category).toHaveFocus();
    expect(generateAnalyticsReport).toHaveBeenCalledTimes(2);
  });

  it("keeps invalid typed dates without a request and automatically updates when corrected", async () => {
    show("/analytics?preset=CUSTOM&from=2026-10-08&to=2026-10-01");
    const end = await screen.findByLabelText("To date");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "End date must be on or after start date",
    );
    expect(generateAnalyticsReport).not.toHaveBeenCalled();
    fireEvent.change(end, { target: { value: "2026-10-09" } });
    await screen.findByRole("heading", { name: "Report results" });
    expect(generateAnalyticsReport).toHaveBeenCalledTimes(1);
    expect(generateAnalyticsReport).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "2026-10-08",
        to: "2026-10-09",
        preset: "CUSTOM",
      }),
    );
  });

  it("opens the original history snapshot without regenerating and refreshes after a filter edit", async () => {
    const saved = result();
    vi.mocked(getAnalyticsRun).mockResolvedValue(saved);
    show(`/analytics?run=${saved.runId}`);
    await screen.findByRole("heading", { name: "Report results" });
    expect(generateAnalyticsReport).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByLabelText("Date range")).toHaveValue("CUSTOM"),
    );
    expect(screen.getByLabelText("From date")).toHaveValue("2026-01-01");
    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "OTHER" },
    });
    await waitFor(() =>
      expect(generateAnalyticsReport).toHaveBeenCalledTimes(1),
    );
    expect(generateAnalyticsReport).toHaveBeenCalledWith(
      expect.objectContaining({ categoryGroup: "OTHER" }),
    );
  });

  it.each(["map", "patrol-gaps", "conflicts"] as const)(
    "automatically loads %s with its appropriate category",
    async (section) => {
      show(`/analytics/${section}`, section);
      expect(await screen.findByText("Spatial total: 42")).toBeInTheDocument();
      expect(generateAnalyticsReport).toHaveBeenCalledTimes(1);
      expect(generateAnalyticsReport).toHaveBeenCalledWith(
        expect.objectContaining({
          preset: "TODAY",
          categoryGroup:
            section === "conflicts" ? "HUMAN_WILDLIFE_CONFLICT" : "ALL",
        }),
      );
    },
  );

  it("ignores a late response for superseded filters", async () => {
    let finishOld!: (run: ReportRunResponse) => void;
    vi.mocked(generateAnalyticsReport).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOld = resolve;
        }),
    );
    show();
    await waitFor(() =>
      expect(generateAnalyticsReport).toHaveBeenCalledTimes(1),
    );
    const oldFilter = vi.mocked(generateAnalyticsReport).mock.calls[0][0];
    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "OTHER" },
    });
    await screen.findByRole("heading", { name: "Report results" });
    const currentUrl = screen.getByLabelText("Current filters").textContent;
    finishOld(result(oldFilter, 999));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByLabelText("Category")).toHaveValue("OTHER");
    expect(screen.getByLabelText("Current filters").textContent).toBe(
      currentUrl,
    );
    expect(screen.queryByText("999")).not.toBeInTheDocument();
  });

  it("does not repeatedly retry automatic failures and preserves results for manual retry", async () => {
    show();
    await screen.findByRole("heading", { name: "Report results" });
    vi.mocked(generateAnalyticsReport).mockRejectedValueOnce(
      new Error("Query timed out"),
    );
    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "OTHER" },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Query timed out",
    );
    expect(
      screen.getByRole("heading", { name: "Report results" }),
    ).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 450));
    expect(generateAnalyticsReport).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() =>
      expect(generateAnalyticsReport).toHaveBeenCalledTimes(3),
    );
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
  });

  it("does not request analytics before Researcher park access exists", () => {
    auth.user = {
      id: "researcher",
      role: "RESEARCHER",
      parkId: null,
      parkName: null,
    };
    show();
    expect(screen.getByText("Park access pending")).toBeInTheDocument();
    expect(getAnalyticsOptions).not.toHaveBeenCalled();
    expect(generateAnalyticsReport).not.toHaveBeenCalled();
  });
});

it.each([undefined, "map"] as const)(
  "automatically recovers from today's empty results after widening filters (%s)",
  async (section) => {
    vi.mocked(generateAnalyticsReport).mockImplementationOnce(
      async (filter) => ({
        ...result(filter),
        status: "EMPTY",
        report: null,
        snapshotSha256: null,
        suggestions: ["Widen to 12 months"],
      }),
    );
    show(section ? "/analytics/map" : "/analytics", section);
    await screen.findByRole("heading", {
      name: "No records match these filters",
    });
    expect(
      screen.getByRole("button", { name: "Export data (CSV)" }),
    ).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Date range"), {
      target: { value: "LAST_30_DAYS" },
    });
    await screen.findByRole("heading", { name: "Report results" });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Export data (CSV)" }),
      ).toBeEnabled(),
    );
    expect(generateAnalyticsReport).toHaveBeenCalledTimes(2);
  },
);

it("blocks automatic queries for future dates with a visible correction message", async () => {
  show("/analytics?preset=CUSTOM&from=2099-01-01&to=2099-01-02");
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "End date cannot be in the future.",
  );
  expect(generateAnalyticsReport).not.toHaveBeenCalled();
});
