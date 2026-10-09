// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import type {
  AnalyticsOptions,
  ConservationReport,
  ReportRunResponse,
} from "@wr/shared";
import { AnalyticsSubpageLayout } from "../components/AnalyticsSubpageLayout.js";
import { ReportOverview } from "../components/ReportOverview.js";
import { AnalyticsOverviewPage } from "./AnalyticsOverviewPage.js";

const { mockAuth } = vi.hoisted(() => ({
  mockAuth: { user: null as null | Record<string, string | boolean | null> },
}));

// These cases exercise the explicit refresh and failure controls. Automatic loading
// is exercised with the real scheduler in AutomaticAnalytics.test.tsx.
vi.mock("../hooks/useAutomaticAnalytics.js", () => ({
  useAutomaticAnalytics: () => ({ waiting: false, markRequested: () => {} }),
}));

vi.mock("../../../auth/AuthContext.js", () => ({
  useAuth: () => ({ user: mockAuth.user }),
}));
vi.mock("../../../components/AccountHeader.js", () => ({
  AccountHeader: () => <header>Account controls</header>,
}));
vi.mock("recharts", () => ({
  Bar: () => null,
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CartesianGrid: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

const parkId = "11111111-1111-4111-8111-111111111111";
const runId = "22222222-2222-4222-8222-222222222222";
const sectorId = "33333333-3333-4333-8333-333333333333";

const options: AnalyticsOptions = {
  allowedParks: [{ id: parkId, code: "YALA", name: "Yala National Park" }],
  types: [
    "POACHING",
    "INJURED_ANIMAL",
    "SNARE_FOUND",
    "FENCE_DAMAGE",
    "HUMAN_WILDLIFE_CONFLICT",
    "CROP_DAMAGE",
    "OTHER",
  ],
  sources: ["RANGER", "COMMUNITY", "CAMERA_TRAP"],
  sectors: [
    { id: sectorId, code: "SOUTH", name: "Southern Ridge", kind: "SECTOR" },
  ],
  earliestDataDate: "2026-01-01",
  latestDataDate: "2026-10-01",
  config: {
    gridCellMeters: 1000,
    trackBufferMeters: 50,
    maxPointAccuracyMeters: 100,
    maxSegmentGapSeconds: 600,
    maxSegmentLengthMeters: 1000,
    boundaryStretchBufferMeters: 2000,
    gapNeglectDays: 14,
    hotspotMinCount: 3,
    configured: true,
  },
};

const report: ConservationReport = {
  schemaVersion: 1,
  park: { id: parkId, code: "YALA", name: "Yala National Park" },
  filters: {
    parkId,
    from: "2026-04-01",
    to: "2026-10-01",
    preset: "CUSTOM",
    categoryGroup: "ALL",
    types: [],
    sources: [],
    sectorId: null,
    includeRejected: false,
  },
  window: {
    fromUtc: "2026-03-31T18:30:00.000Z",
    toUtcExclusive: "2026-10-01T18:30:00.000Z",
    bucket: "MONTH",
    timezone: "Asia/Colombo",
    days: 184,
  },
  generatedAt: "2026-10-07T12:12:00.000Z",
  kpis: {
    totalIncidents: 42,
    previousPeriodIncidents: 38,
    changePercent: 10.5,
    changeKind: "UP",
    hotspotCells: 1,
    hotspotSectorNames: ["Southern Ridge"],
    patrolGapAreaKm2: 18.4,
    patrolGapSharePercent: 19,
    communityConflictReports: 2,
    collarBreaches: 1,
  },
  dataQuality: {
    excludedNoLocation: 3,
    excludedRejected: 2,
    outsideBoundary: 0,
    sessionsAnalyzed: 4,
    sessionsWithoutTrack: 1,
    droppedGpsPoints: 0,
    alertsWithoutLocation: 0,
  },
  trend: [{ bucketStart: "2026-09-01", label: "Sep 2026", count: 42 }],
  breakdown: [
    {
      type: "POACHING",
      sectorId,
      sectorName: "Southern Ridge",
      count: 42,
      riskLevel: "CRITICAL",
      sharePercent: 100,
    },
  ],
  hotspots: {
    cellSizeMeters: 1000,
    cells: [
      {
        cellId: "1:1",
        polygon: [{ latitude: 6.5, longitude: 81.4 }],
        sectorName: "Southern Ridge",
        count: 3,
        riskClass: 5,
        isHotspot: true,
      },
    ],
    classBreaks: [1, 2, 3, 4, 5],
  },
  patrolGaps: {
    configured: true,
    cells: [],
    coveredAreaKm2: 75,
    gapAreaKm2: 18.4,
    parkAreaKm2: 100,
    bySector: [],
  },
  priorityCells: [
    {
      cellId: "1:1",
      centre: { latitude: 6.5, longitude: 81.4 },
      sectorName: "Southern Ridge",
      incidents: 6,
      daysSincePatrol: 23,
      score: 12.4,
    },
  ],
  conflicts: {
    series: [
      {
        bucketStart: "2026-09-01",
        label: "Sep 2026",
        communityReports: 2,
        collarBreaches: 1,
        rangerReported: 0,
      },
    ],
    byStretch: [],
  },
  spatialContext: { parkBoundary: null, sectors: [], settlements: [] },
  summarySentences: ["Incidents increased by 11% from the previous period."],
};

const successfulRun: ReportRunResponse = {
  runId,
  code: "RPT-YALA-2026-000042",
  status: "SUCCEEDED",
  snapshotSha256: "a".repeat(64),
  report,
  suggestions: [],
};

function LocationText() {
  const location = useLocation();
  return <output aria-label="Current filters">{location.search}</output>;
}

function show(initialEntry = "/analytics", page = <AnalyticsOverviewPage />) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <LocationText />
        {page}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  mockAuth.user = {
    id: "operator-1",
    role: "PARK_MANAGER",
    parkId,
    parkName: "Yala National Park",
  };
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/api/analytics/options"))
      return new Response(JSON.stringify(options), { status: 200 });
    if (url === "/api/reports/runs" && init?.method === "POST")
      return new Response(JSON.stringify(successfulRun), { status: 201 });
    if (url.includes("/exports"))
      return new Response(new Blob(["csv content"]), {
        status: 200,
        headers: {
          "Content-Disposition": 'attachment; filename="report.csv"',
          "X-Report-Sha256": "b".repeat(64),
        },
      });
    if (url.includes(`/api/reports/runs/${runId}`))
      return new Response(JSON.stringify(successfulRun), { status: 200 });
    return new Response(JSON.stringify({ message: "Not found" }), {
      status: 404,
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => "blob:test"),
    revokeObjectURL: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("analytics overview", () => {
  it("shows access pending without requesting filters when a researcher has no park", () => {
    mockAuth.user = {
      id: "researcher-1",
      role: "RESEARCHER",
      parkId: null,
      parkName: null,
    };
    show();
    expect(
      screen.getByRole("heading", { name: "Park access pending" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Report filters" }),
    ).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps filter state in the URL and generates a report with the selected filters", async () => {
    show();
    await screen.findByLabelText("Park");
    expect(screen.getByLabelText("Date range")).toHaveValue("TODAY");
    expect(screen.getByLabelText("Category")).toHaveValue("ALL");
    fireEvent.click(screen.getByRole("button", { name: "More filters" }));
    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "HUMAN_WILDLIFE_CONFLICT" },
    });
    fireEvent.change(screen.getByLabelText("Sector"), {
      target: { value: sectorId },
    });
    fireEvent.click(screen.getByLabelText("Include rejected incidents"));
    expect(screen.getByLabelText("Current filters").textContent).toContain(
      "group=HUMAN_WILDLIFE_CONFLICT",
    );
    expect(screen.getByLabelText("Current filters").textContent).toContain(
      `sector=${sectorId}`,
    );
    expect(screen.getByLabelText("Current filters").textContent).toContain(
      "rejected=true",
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Refresh analytics" }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Refresh analytics" }));
    expect(await screen.findByText(/n = 42 incidents/)).toBeInTheDocument();
    expect(await screen.findAllByText("RPT-YALA-2026-000042")).toHaveLength(2);
    expect(
      screen.getByRole("heading", { name: "Priority areas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/6 incidents · 23 days since patrol/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Data quality summary" }),
    ).toHaveTextContent("3 without location");
    const request = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url) === "/api/reports/runs" && init?.method === "POST",
    );
    expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({
      parkId,
      categoryGroup: "HUMAN_WILDLIFE_CONFLICT",
      sectorId,
      includeRejected: true,
    });
    const urlFilters =
      screen.getByLabelText("Current filters").textContent ?? "";
    expect(urlFilters).toContain(`park=${parkId}`);
    expect(urlFilters).toContain("from=");
    expect(urlFilters).toContain("to=");
    expect(urlFilters).toContain(`run=${runId}`);
  });

  it("exports the preserved report and keeps CSV available while PDF work is pending", async () => {
    show(`/analytics?run=${runId}`);
    await screen.findByText(/n = 42 incidents/);
    const csv = screen.getByRole("button", { name: "Export data (CSV)" });
    const pdf = screen.getByRole("button", { name: "Export official PDF" });
    expect(csv).toBeEnabled();
    expect(pdf).toBeEnabled();
    const normalFetch = fetchMock.getMockImplementation()!;
    let finishPdf!: (response: Response) => void;
    fetchMock.mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).includes("/exports") && init?.body) {
          const { format } = JSON.parse(String(init.body)) as {
            format: string;
          };
          if (format === "PDF")
            return new Promise<Response>((resolve) => {
              finishPdf = resolve;
            });
        }
        return normalFetch(input, init);
      },
    );
    fireEvent.click(pdf);
    expect(
      await screen.findByRole("button", { name: "Preparing PDF…" }),
    ).toBeDisabled();
    expect(csv).toBeEnabled();
    fireEvent.click(csv);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/reports/runs/${runId}/exports`,
        expect.objectContaining({ method: "POST" }),
      ),
    );
    finishPdf(new Response(new Blob(["pdf content"]), { status: 200 }));
    await screen.findByRole("button", { name: "PDF downloaded" });
    await waitFor(() =>
      expect(
        vi.mocked(HTMLAnchorElement.prototype.click),
      ).toHaveBeenCalledTimes(2),
    );
    expect(
      screen.getByText("Snapshot preserved for reproducible downloads"),
    ).toBeInTheDocument();
  });

  it("keeps the previous report dimmed while a revised filter set is compiling", async () => {
    show(`/analytics?run=${runId}`);
    await screen.findByText(/n = 42 incidents/);
    fireEvent.click(screen.getByRole("button", { name: "More filters" }));
    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "HUMAN_WILDLIFE_CONFLICT" },
    });
    const normalFetch = fetchMock.getMockImplementation()!;
    let finishGeneration!: (response: Response) => void;
    fetchMock.mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) =>
        String(input) === "/api/reports/runs" && init?.method === "POST"
          ? new Promise<Response>((resolve) => {
              finishGeneration = resolve;
            })
          : normalFetch(input, init),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Refresh analytics" }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Refresh analytics" }));
    expect(
      await screen.findByRole("button", { name: "Updating…" }),
    ).toBeDisabled();
    expect(screen.getByText(/n = 42 incidents/)).toBeInTheDocument();
    expect(screen.getByText(/Showing the previous report/)).toBeInTheDocument();
    finishGeneration(
      new Response(JSON.stringify(successfulRun), { status: 201 }),
    );
    await screen.findByRole("button", { name: "Refresh analytics" });
  });

  it("shows a retryable failure without dropping the prior report", async () => {
    show(`/analytics?run=${runId}`);
    await screen.findByText(/n = 42 incidents/);
    fetchMock.mockImplementationOnce(async () => {
      throw new Error("offline");
    });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Refresh analytics" }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Refresh analytics" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "couldn’t reach the server",
    );
    expect(screen.getByText(/n = 42 incidents/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("shows EMPTY suggestions and applies the widened period without changing other filters", async () => {
    show();
    await screen.findByLabelText("Park");
    const emptyRun: ReportRunResponse = {
      ...successfulRun,
      runId: "44444444-4444-4444-8444-444444444444",
      status: "EMPTY",
      snapshotSha256: null,
      report: null,
      suggestions: ["Widen to 12 months", "All categories"],
    };
    const normalFetch = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementationOnce(
      (input: RequestInfo | URL, init?: RequestInit) =>
        String(input) === "/api/reports/runs" && init?.method === "POST"
          ? Promise.resolve(
              new Response(JSON.stringify(emptyRun), { status: 201 }),
            )
          : normalFetch(input, init),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Refresh analytics" }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Refresh analytics" }));
    expect(
      await screen.findByRole("heading", {
        name: "No records match these filters",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Nothing to export")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Widen to 12 months" }));
    expect(screen.getByLabelText("Date range")).toHaveValue("LAST_12_MONTHS");
    expect(
      screen.queryByRole("heading", { name: "No records match these filters" }),
    ).not.toBeInTheDocument();
  });

  it("applies a server suggestion to clear a sector filter", async () => {
    const emptyRun: ReportRunResponse = {
      ...successfulRun,
      runId: "66666666-6666-4666-8666-666666666666",
      status: "EMPTY",
      snapshotSha256: null,
      report: null,
      suggestions: ["Clear the sector filter", "Clear the source filter"],
    };
    const normalFetch = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) =>
        String(input).includes(emptyRun.runId)
          ? Promise.resolve(
              new Response(JSON.stringify(emptyRun), { status: 200 }),
            )
          : normalFetch(input, init),
    );
    show(`/analytics?run=${emptyRun.runId}&sector=${sectorId}&sources=RANGER`);
    await screen.findByRole("heading", {
      name: "No records match these filters",
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Clear the sector filter" }),
    );
    const currentFilters =
      screen.getByLabelText("Current filters").textContent ?? "";
    expect(currentFilters).not.toContain("sector=");
    expect(currentFilters).toContain("sources=RANGER");
  });

  it("shows a timeout with a retry while preserving the URL filters", async () => {
    show(`/analytics?run=${runId}`);
    await screen.findByText(/n = 42 incidents/);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Refresh analytics" }),
      ).toBeEnabled(),
    );
    const timedOut: ReportRunResponse = {
      ...successfulRun,
      runId: "55555555-5555-4555-8555-555555555555",
      status: "TIMED_OUT",
      snapshotSha256: null,
      report: null,
    };
    const normalFetch = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementationOnce(
      (input: RequestInfo | URL, init?: RequestInit) =>
        String(input) === "/api/reports/runs" && init?.method === "POST"
          ? Promise.resolve(
              new Response(JSON.stringify(timedOut), { status: 201 }),
            )
          : normalFetch(input, init),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Refresh analytics" }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Refresh analytics" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "report took too long",
    );
    expect(screen.getByLabelText("Current filters").textContent).toContain(
      `run=${timedOut.runId}`,
    );
    expect(screen.getByText(/n = 42 incidents/)).toBeInTheDocument();
    expect(screen.getByText(/Showing the previous report/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText(/n = 42 incidents/)).toBeInTheDocument();
  });

  it("shows an export failure and leaves the report available", async () => {
    show(`/analytics?run=${runId}`);
    await screen.findByText(/n = 42 incidents/);
    fetchMock.mockImplementationOnce(async (input: RequestInfo | URL) =>
      String(input).includes("/exports")
        ? new Response(
            JSON.stringify({ message: "PDF renderer unavailable" }),
            { status: 503 },
          )
        : new Response(JSON.stringify(successfulRun), { status: 200 }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Export official PDF" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "PDF could not be generated",
    );
    expect(screen.getByText(/n = 42 incidents/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Retry PDF" }),
    ).toBeInTheDocument();
  });
  it("focuses the report result after generating and announces its final count", async () => {
    show();
    await screen.findByLabelText("Park");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Refresh analytics" }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Refresh analytics" }));
    const heading = await screen.findByRole("heading", {
      name: "Report results",
    });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(
      screen
        .getAllByRole("status")
        .some((region) => region.textContent?.includes("42 incidents")),
    ).toBe(true);
  });

  it("preserves invalid dates, describes the error and focuses the field to correct", async () => {
    show("/analytics?preset=CUSTOM&from=2026-10-08&to=2026-10-01");
    await screen.findByRole("button", { name: "Refresh analytics" });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Refresh analytics" }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Refresh analytics" }));
    const end = screen.getByLabelText("To date");
    expect(end).toHaveValue("2026-10-01");
    expect(end).toHaveFocus();
    expect(end).toHaveAttribute("aria-invalid", "true");
    expect(end).toHaveAccessibleDescription(
      "End date must be on or after start date.",
    );
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          String(url) === "/api/reports/runs" && init?.method === "POST",
      ),
    ).toBe(false);
    fireEvent.change(end, { target: { value: "2026-10-09" } });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Refresh analytics" }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Refresh analytics" }));
    await screen.findByRole("heading", { name: "Report results" });
    expect(
      screen.queryByText("End date must be on or after start date."),
    ).not.toBeInTheDocument();
  });
  it("announces and focuses generated spatial reports and retains the compiled snapshot", async () => {
    show(
      `/analytics/map?run=${runId}`,
      <AnalyticsSubpageLayout section="map">
        {(saved) => <p>Spatial incidents: {saved.kpis.totalIncidents}</p>}
      </AnalyticsSubpageLayout>,
    );
    await screen.findByText("Spatial incidents: 42");
    expect(screen.getByRole("link", { name: "Spatial view" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Refresh analytics" }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Refresh analytics" }));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Report results" }),
      ).toHaveFocus(),
    );
    expect(screen.getByText("Spatial incidents: 42")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Key insights" }),
    ).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("status")
        .some((region) => region.textContent?.includes("42 incidents")),
    ).toBe(true);
  });
});

describe("M4 P9 filter, summary and subpage failures", () => {
  it("applies custom dates and advanced filters to the report request", async () => {
    show();
    await screen.findByLabelText("Park");
    fireEvent.change(screen.getByLabelText("Date range"), {
      target: { value: "CUSTOM" },
    });
    fireEvent.change(screen.getByLabelText("From date"), {
      target: { value: "2026-09-01" },
    });
    fireEvent.change(screen.getByLabelText("To date"), {
      target: { value: "2026-10-01" },
    });
    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "OTHER" },
    });
    fireEvent.click(screen.getByRole("button", { name: /More filters/ }));
    const types = screen.getByLabelText("Incident types") as HTMLSelectElement;
    types.options[0].selected = true;
    fireEvent.change(types);
    const sources = screen.getByLabelText(
      "Incident sources",
    ) as HTMLSelectElement;
    sources.options[0].selected = true;
    fireEvent.change(sources);
    fireEvent.change(screen.getByLabelText("Sector"), {
      target: { value: sectorId },
    });
    fireEvent.click(screen.getByLabelText("Include rejected incidents"));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Refresh analytics" }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Refresh analytics" }));
    await screen.findByRole("heading", { name: "Report results" });
    const post = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url) === "/api/reports/runs" && init?.method === "POST",
    );
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({
      from: "2026-09-01",
      to: "2026-10-01",
      categoryGroup: "OTHER",
      sources: ["RANGER"],
      types: ["POACHING"],
      sectorId,
      includeRejected: true,
    });
  });

  it.each(["NEW_ACTIVITY", "NO_CHANGE", "DOWN"] as const)(
    "describes %s and unavailable spatial data without misleading totals",
    (kind) => {
      render(
        <ReportOverview
          report={{
            ...report,
            kpis: {
              ...report.kpis,
              changeKind: kind,
              changePercent: kind === "DOWN" ? -50 : null,
              patrolGapAreaKm2: null,
              patrolGapSharePercent: null,
              hotspotSectorNames: [],
            },
            trend: [],
            breakdown: [],
            priorityCells: [],
            summarySentences: [],
          }}
        />,
      );
      expect(
        screen.getByText("Park coverage analysis unavailable"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          kind === "NEW_ACTIVITY"
            ? "New activity in this period"
            : kind === "NO_CHANGE"
              ? "No change from previous period"
              : /50% vs previous period/,
        ),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "View data table" }));
      expect(
        screen.getByRole("button", { name: "Hide data table" }),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "0 rows" }));
    },
  );

  it("keeps a subpage pending until park access is granted", () => {
    mockAuth.user = { role: "RESEARCHER", parkId: null };
    show(
      "/analytics/map",
      <AnalyticsSubpageLayout section="map">
        {() => <p>Spatial result</p>}
      </AnalyticsSubpageLayout>,
    );
    expect(screen.getByText("Park access pending")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retries failed subpage options and saved-run requests", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Options unavailable" }), {
        status: 503,
      }),
    );
    show(
      "/analytics/map",
      <AnalyticsSubpageLayout section="map">
        {() => <p>Spatial result</p>}
      </AnalyticsSubpageLayout>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please try again",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByLabelText("Park");
    fireEvent.change(screen.getByLabelText("Date range"), {
      target: { value: "LAST_30_DAYS" },
    });
    expect(screen.getByLabelText("Date range")).toHaveValue("LAST_30_DAYS");
  });

  it.each(["TIMED_OUT", "FAILED"] as const)(
    "retries a saved %s subpage run",
    async (status) => {
      const original = fetchMock.getMockImplementation()!;
      fetchMock.mockImplementation(async (input, init) =>
        String(input).includes(`/runs/${runId}`) &&
        !String(input).includes("exports")
          ? new Response(
              JSON.stringify({
                ...successfulRun,
                status,
                report: null,
                snapshotSha256: null,
              }),
              { status: 200 },
            )
          : original(input, init),
      );
      show(
        `/analytics/map?run=${runId}`,
        <AnalyticsSubpageLayout section="map">
          {() => <p>Spatial result</p>}
        </AnalyticsSubpageLayout>,
      );
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Your filters are kept.",
      );
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
      expect(await screen.findByText("Spatial result")).toBeInTheDocument();
    },
  );

  it("retains a successful subpage report after generation failure", async () => {
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input, init) =>
      init?.method === "POST"
        ? new Response(JSON.stringify({ message: "Query failed" }), {
            status: 503,
          })
        : original(input, init),
    );
    show(
      `/analytics/map?run=${runId}`,
      <AnalyticsSubpageLayout section="map">
        {() => <p>Spatial result</p>}
      </AnalyticsSubpageLayout>,
    );
    await screen.findByText("Spatial result");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Refresh analytics" }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Refresh analytics" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please try again",
    );
    expect(screen.getByText("Spatial result")).toBeInTheDocument();
  });

  it("applies EMPTY subpage suggestions without discarding unrelated filters", async () => {
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input, init) =>
      String(input).includes(`/runs/${runId}`)
        ? new Response(
            JSON.stringify({
              ...successfulRun,
              status: "EMPTY",
              report: null,
              snapshotSha256: null,
              suggestions: [
                "Choose All categories",
                "Clear the sector filter",
                "Clear sources",
                "Widen the date range",
              ],
            }),
          )
        : original(input, init),
    );
    show(
      `/analytics/map?run=${runId}&group=OTHER&sector=${sectorId}&sources=COMMUNITY`,
      <AnalyticsSubpageLayout section="map">
        {() => <p>Spatial result</p>}
      </AnalyticsSubpageLayout>,
    );
    await screen.findByText("No records match these filters");
    fireEvent.click(
      screen.getByRole("button", { name: "Widen the date range" }),
    );
    expect(screen.getByLabelText("Category")).toHaveValue("OTHER");
    expect(screen.getByLabelText("Date range")).toHaveValue("LAST_12_MONTHS");
    expect(screen.getByLabelText("Current filters")).toHaveTextContent(
      "sources=COMMUNITY",
    );
  });
});
