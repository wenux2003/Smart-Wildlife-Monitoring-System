// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
vi.mock("../../../components/AccountHeader.js", () => ({
  AccountHeader: () => <header>Account controls</header>,
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
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="leaflet-map">{children}</div>
  ),
  TileLayer: ({ attribution }: { attribution: string }) => (
    <span>{attribution}</span>
  ),
  Polygon: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
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
});

describe("M4 P7 analytics views", () => {
  it("renders attributed map layers and an accessible cell-table alternative", () => {
    render(<AnalyticsMapPage />);
    expect(
      screen.getByRole("region", { name: /Conservation map/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/OpenStreetMap/)).toBeInTheDocument();
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
