import { describe, expect, it } from "vitest";
import type { ConservationReport } from "@wr/shared";
import { reportFixture } from "../testing.js";
import {
  conflictChartSvg,
  spatialMapSvg,
  trendChartSvg,
} from "./svg-charts.js";

describe("analytics PDF SVG charts", () => {
  it("returns accessible empty-state chart SVGs", () => {
    const report = reportFixture();
    expect(trendChartSvg(report.trend)).toContain("<svg");
    expect(conflictChartSvg(report.conflicts.series)).toContain("<svg");
    expect(spatialMapSvg(report)).toContain("No spatial cells");
  });

  it("escapes labels and draws aggregated cells without incident coordinates", () => {
    const trend: ConservationReport["trend"] = [
      { bucketStart: "2026-01-01", label: "<script>", count: 2 },
    ];
    expect(trendChartSvg(trend)).toContain("&lt;script&gt;");
    expect(trendChartSvg(trend)).not.toContain("<script>");

    const report = reportFixture();
    report.hotspots.cells = [
      {
        cellId: "cell",
        polygon: [
          { longitude: 80, latitude: 6 },
          { longitude: 80.01, latitude: 6 },
          { longitude: 80.01, latitude: 6.01 },
          { longitude: 80, latitude: 6.01 },
        ],
        sectorName: "North",
        count: 3,
        riskClass: 4,
        isHotspot: true,
      },
    ];
    const svg = spatialMapSvg(report);
    expect(svg).toContain("<polygon");
    expect(svg).toContain("cell-level aggregates only");
    expect(svg).toContain("Grid-derived boundary");
    expect(svg).not.toContain("80,6");
  });
});
