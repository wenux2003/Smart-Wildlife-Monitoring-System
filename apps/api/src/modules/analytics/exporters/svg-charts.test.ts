import { describe, expect, it } from "vitest";
import type { ConservationReport } from "@wr/shared";
import { reportFixture } from "../testing.js";
import {
  conflictChartSvg,
  horizontalBarSvg,
  niceTicks,
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

describe("analytics PDF chart helpers", () => {
  it("chooses readable axis ticks that cover the maximum", () => {
    expect(niceTicks(0)).toEqual([0, 1]);
    expect(niceTicks(36)).toEqual([0, 10, 20, 30, 40]);
    expect(niceTicks(4)).toEqual([0, 1, 2, 3, 4]);
    expect(niceTicks(7).at(-1)).toBeGreaterThanOrEqual(7);
  });

  it("draws labelled sector gap bars and an explicit empty state", () => {
    const bars = horizontalBarSvg([{ label: "<Ridge>", value: 150, display: "100%" }]);
    expect(bars).toContain("&lt;Ridge&gt;");
    expect(bars).toContain("100%");
    expect(horizontalBarSvg([])).toContain("No sectors are configured.");
  });

  it("labels conflict series and shows values for short periods", () => {
    const svg = conflictChartSvg([{ bucketStart: "2026-01-01", label: "2026-01", communityReports: 4, collarBreaches: 2, rangerReported: 1 }]);
    for (const label of ["Community reports", "Collar breaches", "Ranger-reported"]) expect(svg).toContain(label);
    expect(svg).toContain(">4</text>");
  });
});
