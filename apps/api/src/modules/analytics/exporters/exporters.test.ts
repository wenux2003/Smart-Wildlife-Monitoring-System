import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it } from "vitest";
import { ConservationReportSchema } from "@wr/shared";
import { reportFixture, TEST_PARK } from "../testing.js";
import type { StoredRun } from "../types.js";
import { csvExporter } from "./csv-exporter.js";
import { pdfExporter } from "./pdf-exporter.js";
import { ExporterRegistry } from "./registry.js";

const run: StoredRun & { report: NonNullable<StoredRun["report"]> } = {
  runId: "33333333-3333-4333-8333-333333333333",
  code: "RPT-YALA-2026-000042",
  status: "SUCCEEDED",
  suggestions: [],
  parkId: TEST_PARK,
  requestedBy: "44444444-4444-4444-8444-444444444444",
  requesterName: "Field Manager",
  requesterRole: "PARK_MANAGER",
  filters: {
    parkId: TEST_PARK,
    from: "2026-01-01",
    to: "2026-01-31",
    preset: "CUSTOM",
    categoryGroup: "ALL",
    types: [],
    sources: [],
    sectorId: null,
    includeRejected: false,
  },
  durationMs: 12,
  createdAt: "2026-02-01T00:00:00.000Z",
  snapshotSha256: "a".repeat(64),
  report: {
    ...reportFixture(),
    syntheticDemo: true,
    kpis: {
      ...reportFixture().kpis,
      totalIncidents: 42,
      previousPeriodIncidents: 21,
      changePercent: 100,
      changeKind: "UP",
    },
    trend: [{ bucketStart: "2026-01-01", label: "Jan 2026", count: 42 }],
    breakdown: [
      {
        type: "SNARE_FOUND",
        sectorId: null,
        sectorName: "Southern Ridge",
        count: 42,
        riskLevel: "HIGH",
        sharePercent: 100,
      },
    ],
    summarySentences: ["42 incidents were recorded in the selected period."],
  },
};

async function extractPdfText(bytes: Buffer): Promise<{
  pageCount: number;
  text: string;
}> {
  const document = await getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
    standardFontDataUrl: new URL(
      "../../../../../../node_modules/pdfjs-dist/standard_fonts/",
      import.meta.url,
    ).href,
  }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(
      content.items.map((item) => ("str" in item ? item.str : "")).join(" "),
    );
  }
  await document.destroy();
  return {
    pageCount: pages.length,
    text: pages.join(" ").replace(/\s+/g, " ").replace(/-\s+/g, "-"),
  };
}

describe("analytics exporters", () => {
  it("keeps legacy report snapshots hash-stable when demo provenance is absent", () => {
    const legacyReport = { ...run.report };
    delete legacyReport.syntheticDemo;
    const parsed = ConservationReportSchema.parse(legacyReport);
    expect(Object.hasOwn(parsed, "syntheticDemo")).toBe(false);
  });

  it("exports tidy CSV rows with filters, aggregates, quality and safe text", async () => {
    const csv = (await csvExporter.render(run)).toString("utf8");
    expect(csv.startsWith("\uFEFFreport_code,section,dimension")).toBe(true);
    expect(csv).toContain(
      "RPT-YALA-2026-000042,trend,,,2026-01-01,2026-01-01,incidents,42,count",
    );
    expect(csv).toContain("breakdown,SNARE_FOUND,Southern Ridge");
    expect(csv).toContain(
      "data_quality,,,2026-01-01,2026-01-31,excludedNoLocation,0,count",
    );
    expect(csv).not.toContain("manager@example.org");
  });

  it("guards formula-leading sector names in the rendered CSV", async () => {
    const csvRun = {
      ...run,
      report: {
        ...run.report,
        breakdown: run.report.breakdown.map((row) => ({
          ...row,
          sectorName: '=cmd,"north"',
        })),
      },
    };
    const csv = (await csvExporter.render(csvRun)).toString("utf8");
    expect(csv).toContain(`breakdown,SNARE_FOUND,"'=cmd,""north""",2026-01-01`);
  });

  it("renders a real PDF with the required text and bounded page count", async () => {
    const first = await pdfExporter.render(run);
    const second = await pdfExporter.render(run);
    const { pageCount, text } = await extractPdfText(first);
    expect(first.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pageCount).toBeGreaterThanOrEqual(4);
    expect(pageCount).toBeLessThanOrEqual(12);
    expect(text).toContain("Conservation Outcome Report");
    expect(text).toContain("RPT-YALA-2026-000042");
    expect(text).toContain("Period: 01 Jan 2026");
    expect(text).toContain("Category group: ALL");
    expect(text).toContain("Southern Ridge");
    expect(text).toContain("42");
    expect(text).toContain(`Snapshot SHA-256: ${"a".repeat(64)}`);
    expect(text).toContain("Synthetic demo data");
    expect(text).toContain("not an official government document");
    expect(text).not.toContain("manager@example.org");
    expect(first.equals(second)).toBe(true);
  });

  it("indexes formats and rejects duplicate exporters", () => {
    const registry = new ExporterRegistry([csvExporter, pdfExporter]);
    expect(registry.get("CSV")).toBe(csvExporter);
    expect(registry.get("PDF")).toBe(pdfExporter);
    expect(() => new ExporterRegistry([csvExporter, csvExporter])).toThrow(
      "Each report format must have exactly one exporter.",
    );
  });

  it("rejects CSV snapshots that exceed the row limit without truncation", async () => {
    const oversized = {
      ...run,
      report: {
        ...run.report,
        hotspots: {
          ...run.report.hotspots,
          cells: Array.from({ length: 5000 }, (_, index) => ({
            cellId: `cell-${index}`,
            polygon: [],
            sectorName: null,
            count: 1,
            riskClass: 1 as const,
            isHotspot: false,
          })),
        },
      },
    };
    await expect(csvExporter.render(oversized)).rejects.toMatchObject({
      code: "EXPORT_TOO_LARGE",
      statusCode: 413,
    });
  });

  it("rejects PDF snapshots that exceed the page limit without truncation", async () => {
    const oversized = {
      ...run,
      report: {
        ...run.report,
        conflicts: {
          ...run.report.conflicts,
          byStretch: Array.from({ length: 600 }, (_, index) => ({
            stretchId: `stretch-${index}`,
            stretchName: `Boundary stretch ${index}`,
            communityReports: 1,
            collarBreaches: 1,
            byMonth: [],
          })),
        },
      },
    };
    await expect(pdfExporter.render(oversized)).rejects.toMatchObject({
      code: "EXPORT_TOO_LARGE",
      statusCode: 413,
    });
  });
});

describe("M4 P9 export completeness and privacy", () => {
  const ring = [
    { latitude: 6.5, longitude: 81.4 },
    { latitude: 6.6, longitude: 81.4 },
    { latitude: 6.6, longitude: 81.5 },
    { latitude: 6.5, longitude: 81.4 },
  ];
  const rich = {
    ...run,
    report: {
      ...run.report,
      reporterPhone: "PRIVATE_PHONE_SENTINEL",
      description: "PRIVATE_DESCRIPTION_SENTINEL",
      reporterId: "PRIVATE_REPORTER_SENTINEL",
      filters: {
        ...run.report.filters,
        types: ["SNARE_FOUND" as const],
        sources: ["RANGER" as const],
        sectorId: TEST_PARK,
        includeRejected: true,
      },
      kpis: {
        ...run.report.kpis,
        changePercent: null,
        changeKind: "NEW_ACTIVITY" as const,
        patrolGapAreaKm2: null,
        patrolGapSharePercent: null,
      },
      hotspots: {
        ...run.report.hotspots,
        cells: [
          {
            cellId: "1:1",
            polygon: ring,
            sectorName: null,
            count: 42,
            riskClass: 5 as const,
            isHotspot: true,
          },
        ],
      },
      patrolGaps: {
        ...run.report.patrolGaps,
        cells: [
          {
            cellId: "1:1",
            polygon: ring,
            covered: false,
            lastPatrolledAt: null,
            daysSincePatrol: null,
          },
        ],
        bySector: [
          {
            sectorName: "Southern Ridge",
            gapAreaKm2: 1.25,
            gapSharePercent: 25,
          },
        ],
      },
      priorityCells: [
        {
          cellId: "1:1",
          centre: ring[0],
          sectorName: null,
          incidents: 42,
          daysSincePatrol: null,
          score: 3780,
        },
      ],
      conflicts: {
        series: [
          {
            bucketStart: "2026-01-01",
            label: "Jan 2026",
            communityReports: 4,
            collarBreaches: 2,
            rangerReported: 1,
          },
        ],
        byStretch: [
          {
            stretchId: TEST_PARK,
            stretchName: "Galge Stretch",
            communityReports: 4,
            collarBreaches: 2,
            byMonth: [
              {
                bucketStart: "2026-01-01",
                communityReports: 4,
                collarBreaches: 2,
              },
            ],
          },
        ],
      },
    },
  };

  it("exports all spatial, priority and source-separated conflict rows without private input fields", async () => {
    const csv = (await csvExporter.render(rich)).toString("utf8");
    expect(csv).toContain(
      "hotspot,1:1,,2026-01-01,2026-01-31,incidents,42,count",
    );
    expect(csv).toContain(
      "patrol_gap,Southern Ridge,,2026-01-01,2026-01-31,gap_area,1.25,km2",
    );
    expect(csv).toContain(
      "priority_cell,1:1,,2026-01-01,2026-01-31,priority_score,3780,score",
    );
    expect(csv).toContain(
      "conflict,Galge Stretch,community_report,2026-01-01,2026-01-31,events,4,count",
    );
    expect(csv).toContain(
      "conflict,Galge Stretch,collar_breach,2026-01-01,2026-01-31,events,2,count",
    );
    expect(csv).toContain(
      "conflict,,ranger_reported,2026-01-01,2026-01-31,events,1,count",
    );
    expect(csv).not.toContain("change_percent");
    expect(csv).not.toContain("patrol_gap_area");
    expect(csv).not.toMatch(/PRIVATE_|reporterPhone|reporterId|description/);
    const { text } = await extractPdfText(await pdfExporter.render(rich));
    expect(text).toContain("NEW_ACTIVITY");
    expect(text).toContain("Not configured");
    expect(text).toContain("Galge Stretch");
    expect(text).toContain("Sources: RANGER");
    expect(text).toContain("Types: SNARE_FOUND");
    expect(text).not.toMatch(/PRIVATE_|reporterPhone|reporterId|description/);
  });

  it.each([
    ["DAY", "2026-01-10", "2026-01-10"],
    ["WEEK", "2026-01-01", "2026-01-07"],
    ["WEEK", "2026-01-29", "2026-01-31"],
    ["MONTH", "2026-01-01", "2026-01-31"],
  ] as const)("uses exact %s CSV period bounds", async (bucket, start, end) => {
    const snapshot = {
      ...run.report,
      window: { ...run.report.window, bucket },
      trend: [{ bucketStart: start, label: start, count: 42 }],
    };
    const csv = (
      await csvExporter.render({ ...run, report: snapshot })
    ).toString("utf8");
    expect(csv).toContain(`trend,,,${start},${end},incidents,42,count`);
  });

  it("renders empty non-demo sections and rejects a missing snapshot hash", async () => {
    const snapshot = { ...reportFixture(), syntheticDemo: false };
    const { text } = await extractPdfText(
      await pdfExporter.render({ ...run, report: snapshot }),
    );
    expect(text).toContain("No incidents were recorded in this period.");
    expect(text).toContain("No conflict activity was recorded in this period.");
    expect(text).not.toContain("Synthetic demo data");
    await expect(
      pdfExporter.render({ ...run, snapshotSha256: null }),
    ).rejects.toMatchObject({ code: "REPORT_NOT_EXPORTABLE" });
  });
});

it("keeps the longest incident type inside the PDF page margins across table breaks", async () => {
  const report = {
    ...run.report,
    breakdown: Array.from({ length: 21 }, (_, index) => ({
      ...run.report.breakdown[0],
      type: "HUMAN_WILDLIFE_CONFLICT" as const,
      sectorName: `Patanangala Coast ${index + 1}`,
    })),
  };
  const document = await getDocument({
    data: new Uint8Array(await pdfExporter.render({ ...run, report })),
    useSystemFonts: true,
  }).promise;
  try {
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number);
      const width = page.getViewport({ scale: 1 }).width;
      for (const item of (await page.getTextContent()).items) {
        if (!("str" in item) || !item.str.trim()) continue;
        expect(item.transform[4]).toBeGreaterThanOrEqual(41);
        expect(item.transform[4] + item.width).toBeLessThanOrEqual(width - 41);
      }
    }
  } finally {
    await document.destroy();
  }
});
