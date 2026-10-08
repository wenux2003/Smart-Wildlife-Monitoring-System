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
    expect(csv).toContain(
      `breakdown,SNARE_FOUND,"'=cmd,""north""",2026-01-01`,
    );
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
    expect(text).toContain("Snapshot SHA-256: aaaaaaaaaaaaaaaa");
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
