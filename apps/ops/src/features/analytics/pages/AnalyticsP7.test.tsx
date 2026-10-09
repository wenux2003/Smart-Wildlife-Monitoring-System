// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { AnalyticsOptions, ConservationReport } from "@wr/shared";
import { AnalyticsMapPage } from "./AnalyticsMapPage.js";
import { PatrolGapsPage } from "./PatrolGapsPage.js";
import { ConflictTrendsPage } from "./ConflictTrendsPage.js";
import { ReportHistoryPage } from "./ReportHistoryPage.js";
import { FilterBar } from "../components/FilterBar.js";

const p7 = vi.hoisted(() => ({
  report: null as ConservationReport | null,
  options: null as AnalyticsOptions | null,
  user: null as Record<string, string> | null,
  listReportRuns: vi.fn(),
  exportAnalyticsRun: vi.fn(),
}));

vi.mock("../../../auth/AuthContext.js", () => ({
  useAuth: () => ({ user: p7.user }),
}));
vi.mock("../components/AnalyticsSubpageLayout.js", () => ({
  AnalyticsSubpageLayout: ({
    children,
  }: {
    children: (
      report: ConservationReport,
      options: AnalyticsOptions,
    ) => React.ReactNode;
  }) => (
    <main>
      {p7.report && p7.options ? children(p7.report, p7.options) : null}
    </main>
  ),
}));
vi.mock("../api.js", () => ({
  listReportRuns: p7.listReportRuns,
  exportAnalyticsRun: p7.exportAnalyticsRun,
}));
vi.mock("react-leaflet", () => ({
  MapContainer: ({
    children,
    bounds,
  }: {
    children: React.ReactNode;
    bounds?: unknown;
  }) => (
    <div data-testid="leaflet-map" data-bounds={JSON.stringify(bounds)}>
      {children}
    </div>
  ),
  TileLayer: ({ attribution }: { attribution: string }) => (
    <span>{attribution}</span>
  ),
  Polygon: ({
    children,
    eventHandlers,
  }: {
    children?: React.ReactNode;
    eventHandlers?: { click: () => void };
  }) => (
    <div data-testid="map-polygon" onClick={() => eventHandlers?.click()}>
      {children}
    </div>
  ),
  CircleMarker: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Popup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("recharts", () => ({
  Bar: ({
    isAnimationActive,
    name,
  }: {
    isAnimationActive: boolean;
    name: string;
  }) => (
    <span data-testid="chart-motion" data-animated={String(isAnimationActive)}>
      {name}
    </span>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CartesianGrid: () => null,
  Cell: () => null,
  LabelList: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

const parkId = "11111111-1111-4111-8111-111111111111";
const stretchId = "33333333-3333-4333-8333-333333333333";
const runId = "22222222-2222-4222-8222-222222222222";
const testRing = [
  { latitude: 6.5, longitude: 81.4 },
  { latitude: 6.6, longitude: 81.4 },
  { latitude: 6.6, longitude: 81.5 },
  { latitude: 6.5, longitude: 81.5 },
  { latitude: 6.5, longitude: 81.4 },
];

function reportFixture(): ConservationReport {
  const filters = {
    parkId,
    from: "2026-04-01",
    to: "2026-10-01",
    preset: "CUSTOM" as const,
    categoryGroup: "HUMAN_WILDLIFE_CONFLICT" as const,
    types: [],
    sources: [],
    sectorId: null,
    includeRejected: false,
  };
  const coverageCell = {
    cellId: "1:1",
    polygon: testRing,
    covered: false,
    lastPatrolledAt: null,
    daysSincePatrol: null,
  };
  return {
    schemaVersion: 1,
    park: { id: parkId, code: "YALA", name: "Yala National Park" },
    filters,
    window: {
      fromUtc: "2026-03-31T18:30:00.000Z",
      toUtcExclusive: "2026-10-01T18:30:00.000Z",
      bucket: "MONTH",
      timezone: "Asia/Colombo",
      days: 184,
    },
    generatedAt: "2026-10-07T12:12:00.000Z",
    kpis: {
      totalIncidents: 6,
      previousPeriodIncidents: 4,
      changePercent: 50,
      changeKind: "UP",
      hotspotCells: 1,
      hotspotSectorNames: ["Southern Ridge"],
      patrolGapAreaKm2: 18.4,
      patrolGapSharePercent: 19,
      communityConflictReports: 4,
      collarBreaches: 2,
    },
    dataQuality: {
      excludedNoLocation: 1,
      excludedRejected: 0,
      outsideBoundary: 0,
      sessionsAnalyzed: 3,
      sessionsWithoutTrack: 1,
      droppedGpsPoints: 0,
      alertsWithoutLocation: 0,
    },
    trend: [],
    breakdown: [],
    hotspots: {
      cellSizeMeters: 1000,
      cells: [
        {
          cellId: "1:1",
          polygon: testRing,
          sectorName: "Southern Ridge",
          count: 6,
          riskClass: 4,
          isHotspot: true,
        },
      ],
      classBreaks: [1, 2, 3, 4, 5],
    },
    patrolGaps: {
      configured: true,
      cells: [coverageCell],
      coveredAreaKm2: 75,
      gapAreaKm2: 18.4,
      parkAreaKm2: 100,
      bySector: [
        { sectorName: "Southern Ridge", gapAreaKm2: 18.4, gapSharePercent: 19 },
      ],
    },
    priorityCells: [
      {
        cellId: "1:1",
        centre: { latitude: 6.55, longitude: 81.45 },
        sectorName: "Southern Ridge",
        incidents: 6,
        daysSincePatrol: 23,
        score: 138,
      },
    ],
    conflicts: {
      series: [
        {
          bucketStart: "2026-09-01",
          label: "Sep 2026",
          communityReports: 4,
          collarBreaches: 2,
          rangerReported: 1,
        },
      ],
      byStretch: [
        {
          stretchId,
          stretchName: "Galge Stretch",
          communityReports: 4,
          collarBreaches: 2,
          byMonth: [
            {
              bucketStart: "2026-09-01",
              communityReports: 4,
              collarBreaches: 2,
            },
          ],
        },
      ],
    },
    spatialContext: {
      parkBoundary: [[testRing]],
      sectors: [
        {
          id: stretchId,
          code: "GALGE",
          name: "Galge Stretch",
          kind: "BOUNDARY_STRETCH",
          polygon: [[testRing]],
        },
      ],
      settlements: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          name: "Kumbuk",
          location: { latitude: 6.52, longitude: 81.43 },
          nearestStretchId: stretchId,
          nearestStretchName: "Galge Stretch",
        },
      ],
    },
    summarySentences: [],
  };
}

const optionsFixture: AnalyticsOptions = {
  allowedParks: [{ id: parkId, code: "YALA", name: "Yala National Park" }],
  types: ["HUMAN_WILDLIFE_CONFLICT", "CROP_DAMAGE", "FENCE_DAMAGE"],
  sources: ["COMMUNITY", "RANGER", "CAMERA_TRAP"],
  sectors: [
    {
      id: stretchId,
      code: "GALGE",
      name: "Galge Stretch",
      kind: "BOUNDARY_STRETCH",
    },
  ],
  earliestDataDate: "2026-01-01",
  latestDataDate: "2026-10-01",
  config: {
    gridCellMeters: 1000,
    trackBufferMeters: 75,
    maxPointAccuracyMeters: 100,
    maxSegmentGapSeconds: 600,
    maxSegmentLengthMeters: 1000,
    boundaryStretchBufferMeters: 2000,
    gapNeglectDays: 14,
    hotspotMinCount: 3,
    configured: true,
  },
};

function mountHistory(path = "/reports") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <ReportHistoryPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  p7.report = reportFixture();
  p7.options = optionsFixture;
  p7.user = {
    id: "55555555-5555-4555-8555-555555555555",
    name: "A Park Manager",
    role: "PARK_MANAGER",
    parkId,
    parkName: "Yala National Park",
  };
  p7.listReportRuns.mockReset().mockImplementation(async (query) => ({
    items:
      query.page === 2
        ? []
        : [
            {
              id: runId,
              code: "RPT-YALA-2026-000001",
              parkId,
              requestedBy: {
                id: "55555555-5555-4555-8555-555555555555",
                name: "A Park Manager",
              },
              requesterRole: "PARK_MANAGER",
              filters: reportFixture().filters,
              status: "SUCCEEDED",
              snapshotSha256: "a".repeat(64),
              durationMs: 123,
              createdAt: "2026-10-08T12:00:00.000Z",
              exports: [
                {
                  id: "66666666-6666-4666-8666-666666666666",
                  format: "PDF",
                  status: "SUCCEEDED",
                  byteSize: 1234,
                  fileSha256: "b".repeat(64),
                  errorCode: null,
                  createdAt: "2026-10-08T12:01:00.000Z",
                },
              ],
            },
          ],
    total: 21,
    page: query.page ?? 1,
    pageSize: 20,
  }));
  p7.exportAnalyticsRun.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("M4 P7 analytics views", () => {
  it("renders attributed map layers and an accessible cell-table alternative", () => {
    render(<AnalyticsMapPage />);
    expect(
      screen.getByRole("region", { name: /Conservation map/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/OpenStreetMap/)).toBeInTheDocument();
    expect(screen.getByTestId("leaflet-map")).toHaveAttribute(
      "data-bounds",
      expect.stringContaining("81.4"),
    );
    expect(screen.getByLabelText("Hotspot cells")).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "View as table" }));
    expect(
      screen.getByRole("table", { name: "Hotspot and coverage cell details" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Highlight" }),
    ).toBeInTheDocument();
  });

  it("shows patrol gap KPIs, priority cells and configured method details", () => {
    render(<PatrolGapsPage />);
    expect(screen.getByText("NEGLECTED CELLS")).toBeInTheDocument();
    expect(screen.getByText("SESSIONS ANALYZED")).toBeInTheDocument();
    expect(screen.getByText("Priority score 138")).toBeInTheDocument();
    fireEvent.click(screen.getByText("How is this calculated?"));
    expect(screen.getByText(/75 m track buffer/)).toBeInTheDocument();
  });

  it("keeps conflict sources separate and lists settlements by stretch", () => {
    render(<ConflictTrendsPage />);
    expect(screen.getByText(/Fixed category:/)).toHaveTextContent(
      "Human-wildlife conflict",
    );
    expect(
      screen.getByRole("table", { name: /Monthly boundary stretch conflicts/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Kumbuk")).toBeInTheDocument();
    expect(screen.getByText("4 / 2")).toBeInTheDocument();
  });

  it("locks the shared category filter to HWC for the conflict analysis view", () => {
    render(
      <FilterBar
        filter={reportFixture().filters}
        options={optionsFixture}
        onChange={vi.fn()}
        onGenerate={vi.fn()}
        pending={false}
        error=""
        categoryLocked
      />,
    );
    expect(screen.getByLabelText("Category")).toBeDisabled();
    expect(screen.getByLabelText("Category")).toHaveValue(
      "HUMAN_WILDLIFE_CONFLICT",
    );
  });

  it("filters history, preserves report filters when reopening, and paginates", async () => {
    mountHistory();
    expect(await screen.findByText("RPT-YALA-2026-000001")).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "By" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute(
      "href",
      expect.stringContaining(`run=${runId}`),
    );
    expect(screen.getByText(/PDF\s+✓/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Report status"), {
      target: { value: "SUCCEEDED" },
    });
    expect(await screen.findByRole("button", { name: "Next" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Page 2 of 2")).toBeInTheDocument();
  });

  it("does not disclose the requester column to Researchers", async () => {
    p7.user = { ...p7.user!, role: "RESEARCHER" };
    mountHistory();
    await screen.findByText("RPT-YALA-2026-000001");
    expect(
      screen.queryByRole("columnheader", { name: "By" }),
    ).not.toBeInTheDocument();
  });
  it("turns off conflict and patrol chart motion for reduced-motion users", () => {
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const conflicts = render(<ConflictTrendsPage />);
    expect(
      screen
        .getAllByTestId("chart-motion")
        .every((bar) => bar.dataset.animated === "false"),
    ).toBe(true);
    expect(
      screen.getByRole("table", { name: /Monthly conflicts by source/ }),
    ).toBeInTheDocument();
    conflicts.unmount();
    render(<PatrolGapsPage />);
    expect(
      screen
        .getAllByTestId("chart-motion")
        .every((bar) => bar.dataset.animated === "false"),
    ).toBe(true);
    expect(
      screen.getByRole("table", { name: "Sector patrol gap data" }),
    ).toBeInTheDocument();
  });
});

describe("M4 P9 spatial and history edge cases", () => {
  it("sorts cells in both directions, merges coverage-only cells, highlights and toggles layers", () => {
    const report = reportFixture();
    const hotspot = report.hotspots.cells[0];
    const coverage = report.patrolGaps.cells[0];
    report.hotspots.cells.push(
      { ...hotspot, cellId: "2:1", count: 2, riskClass: 1, sectorName: null },
      { ...hotspot, cellId: "3:1", count: 0, riskClass: 2 },
    );
    report.patrolGaps.cells.push(
      {
        ...coverage,
        cellId: "2:1",
        covered: true,
        lastPatrolledAt: "2026-09-01T00:00:00Z",
        daysSincePatrol: 30,
      },
      { ...coverage, cellId: "4:1" },
    );
    report.spatialContext.sectors.push({
      ...report.spatialContext.sectors[0],
      id: parkId,
      kind: "SECTOR",
    });
    report.priorityCells.push({
      ...report.priorityCells[0],
      cellId: "2:1",
      sectorName: null,
      daysSincePatrol: null,
    });
    p7.report = report;
    render(<AnalyticsMapPage />);
    fireEvent.click(screen.getByRole("button", { name: "View as table" }));
    const table = screen.getByRole("table");
    const firstCell = () =>
      within(table).getAllByRole("row")[1].querySelector("th")?.textContent;
    expect(within(table).getByText("Unknown")).toBeInTheDocument();
    for (const [column, first] of [
      ["Incidents", "1:1"],
      ["Risk class", "1:1"],
      ["Patrol status", "2:1"],
    ]) {
      fireEvent.click(within(table).getByRole("button", { name: column }));
      expect(firstCell()).toBe(first);
      expect(
        within(table).getByRole("columnheader", { name: column }),
      ).toHaveAttribute("aria-sort", "descending");
      fireEvent.click(within(table).getByRole("button", { name: column }));
      expect(
        within(table).getByRole("columnheader", { name: column }),
      ).toHaveAttribute("aria-sort", "ascending");
    }
    fireEvent.click(within(table).getByRole("button", { name: "Cell" }));
    fireEvent.click(within(table).getByRole("button", { name: "Cell" }));
    expect(firstCell()).toBe("4:1");
    fireEvent.click(
      within(table).getAllByRole("button", { name: "Highlight" })[0],
    );
    expect(within(table).getAllByRole("row")[1]).toHaveClass("is-selected");
    fireEvent.click(
      screen.getByRole("button", { name: /Southern Ridge.*rank 1/ }),
    );
    expect(
      within(table).getByRole("rowheader", { name: "1:1" }).closest("tr"),
    ).toHaveClass("is-selected");
    for (const label of [
      "Park boundary",
      "Sector outlines",
      "Priority cells",
      "Hotspot cells",
    ]) {
      fireEvent.click(screen.getByLabelText(label));
      expect(screen.getByLabelText(label)).not.toBeChecked();
    }
    fireEvent.click(screen.getByLabelText("Hotspot cells"));
    fireEvent.click(screen.getAllByTestId("map-polygon")[1]);
    expect(
      within(table).getByRole("rowheader", { name: "2:1" }).closest("tr"),
    ).toHaveClass("is-selected");
    fireEvent.click(screen.getByLabelText("Coverage gaps"));
    fireEvent.click(screen.getByLabelText("Show covered cells"));
    expect(screen.getByLabelText("Show covered cells")).toBeChecked();
    fireEvent.click(screen.getAllByTestId("map-polygon")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Hide data table" }));
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("explains missing spatial configuration and legacy session counts", () => {
    const report = reportFixture();
    report.hotspots.cells = [];
    report.patrolGaps = {
      configured: false,
      cells: [],
      coveredAreaKm2: 0,
      gapAreaKm2: 0,
      parkAreaKm2: 0,
      bySector: [],
    };
    report.priorityCells = [];
    report.spatialContext = {
      parkBoundary: null,
      sectors: [],
      settlements: [],
    };
    report.dataQuality.outsideBoundary = 33; // Legacy snapshot used missing cell membership.
    delete report.dataQuality.sessionsAnalyzed;
    p7.report = report;
    render(<PatrolGapsPage />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Spatial analysis is not configured",
    );
    expect(
      screen.queryByText(/33 located incidents are outside/),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/0 hotspot cells/)).not.toBeInTheDocument();
    for (const label of [
      "Park boundary",
      "Sector outlines",
      "Hotspot cells",
      "Coverage gaps",
      "Priority cells",
      "Show covered cells",
    ])
      expect(screen.getByLabelText(label)).toBeDisabled();
    expect(screen.getByText("No configured analysis area")).toBeInTheDocument();
    expect(
      screen.getByText("Not captured in this saved report"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No sector gap data is available."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View as table" }));
    expect(
      screen.getByText(
        "Spatial cells are unavailable because this report has no configured analysis area.",
      ),
    ).toBeInTheDocument();
  });

  it("renders empty conflict sources and unmatched settlements explicitly", () => {
    const report = reportFixture();
    report.conflicts = { series: [], byStretch: [] };
    report.spatialContext.settlements[0].nearestStretchId = null;
    report.spatialContext.settlements[0].nearestStretchName = null;
    p7.report = report;
    render(<ConflictTrendsPage />);
    expect(
      screen.getByText("No boundary stretch conflict data."),
    ).toBeInTheDocument();
    expect(screen.getByText("No stretch data available.")).toBeInTheDocument();
    expect(
      screen.getByText(/no settlement fell within that buffer/),
    ).toBeInTheDocument();
  });

  it("compares multiple boundary stretches and displays zero-count months without false intensity", () => {
    const report = reportFixture();
    report.conflicts.byStretch.push({
      ...report.conflicts.byStretch[0],
      stretchId: parkId,
      stretchName: "Quiet stretch",
      communityReports: 0,
      collarBreaches: 0,
      byMonth: [
        { bucketStart: "2026-09-01", communityReports: 0, collarBreaches: 0 },
      ],
    });
    p7.report = report;
    render(<ConflictTrendsPage />);
    expect(screen.getByText("0 / 0")).toHaveStyle({
      backgroundColor: "rgba(180, 83, 9, 0)",
    });
    expect(
      screen.getByRole("rowheader", { name: "Quiet stretch" }),
    ).toBeInTheDocument();
  });

  it("does not fetch history before a Researcher receives park access", () => {
    p7.user = { role: "RESEARCHER" };
    mountHistory();
    expect(screen.getByText("Park access pending")).toBeInTheDocument();
    expect(p7.listReportRuns).not.toHaveBeenCalled();
  });

  it("recovers history fetch errors and clears date/status filters", async () => {
    p7.listReportRuns.mockRejectedValueOnce(
      new Error("History connection failed"),
    );
    mountHistory(
      "/reports?status=FAILED&historyFrom=2026-10-01&historyTo=2026-10-08",
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "History connection failed",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("RPT-YALA-2026-000001");
    fireEvent.change(screen.getByLabelText("History from date"), {
      target: { value: "2026-09-01" },
    });
    fireEvent.change(screen.getByLabelText("History to date"), {
      target: { value: "2026-10-09" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() =>
      expect(p7.listReportRuns).toHaveBeenLastCalledWith({
        page: 1,
        pageSize: 20,
        status: undefined,
        from: undefined,
        to: undefined,
      }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "Next" }));
    await screen.findByText("No report runs match these filters.");
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    await screen.findByText("RPT-YALA-2026-000001");
  });

  it("records skipped exports as None and prevents exports from failed or empty runs", async () => {
    const baseline = await p7.listReportRuns({ page: 1 });
    const row = baseline.items[0];
    p7.listReportRuns.mockResolvedValue({
      ...baseline,
      total: 4,
      items: [
        {
          ...row,
          exports: [],
          filters: {
            ...row.filters,
            types: ["CROP_DAMAGE"],
            sources: ["COMMUNITY"],
          },
        },
        ...["EMPTY", "TIMED_OUT", "FAILED"].map((status, index) => ({
          ...row,
          id: `run-${index}`,
          code: `RPT-OTHER-${index}`,
          status,
          exports: [{ ...row.exports[0], status: "FAILED" }],
        })),
      ],
    });
    mountHistory();
    await screen.findByText("RPT-YALA-2026-000001");
    expect(screen.getByText("None")).toBeInTheDocument();
    expect(screen.getAllByText("Empty").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Timed out").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Failed").length).toBeGreaterThan(0);
    expect(
      screen
        .getAllByRole("button", { name: "PDF" })
        .filter((button) => (button as HTMLButtonElement).disabled),
    ).toHaveLength(3);
    p7.exportAnalyticsRun.mockRejectedValueOnce(new Error("PDF failed"));
    fireEvent.click(screen.getAllByRole("button", { name: "PDF" })[0]);
    expect(await screen.findByRole("alert")).toHaveTextContent("PDF failed");
    p7.exportAnalyticsRun.mockRejectedValueOnce("failure");
    fireEvent.click(screen.getAllByRole("button", { name: "CSV" })[0]);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The CSV export failed.",
    );
    fireEvent.click(screen.getAllByRole("button", { name: "CSV" })[0]);
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
  });
});
