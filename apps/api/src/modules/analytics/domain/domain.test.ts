import { describe, it, expect } from "vitest";
import {
  buckets,
  colomboDate,
  normalizeFilter,
  presetRange,
  shiftDate,
} from "./filter.js";
import {
  classBreaks,
  hotspotThreshold,
  percentChange,
  priorityScore,
  riskClass,
  sharePercent,
} from "./metrics.js";
import { reportCode } from "./report-code.js";
import { narrative } from "./narrative.js";
import { assembleReport } from "./report-assembler.js";
import { reportFixture, TEST_PARK } from "../testing.js";
const clock = { now: () => new Date("2028-03-01T00:00:00Z") };
const input = { parkId: TEST_PARK, from: "2026-01-01", to: "2026-01-31" };
describe("M4 domain", () => {
  it("uses Colombo midnight, leap days and equal previous windows", () => {
    expect(colomboDate(new Date("2026-01-01T18:29:59.999Z"))).toBe(
      "2026-01-01",
    );
    expect(colomboDate(new Date("2026-01-01T18:30:00Z"))).toBe("2026-01-02");
    expect(shiftDate("2028-03-01", -1)).toBe("2028-02-29");
    const f = normalizeFilter(input, clock);
    expect(f.window).toMatchObject({
      fromUtc: "2025-12-31T18:30:00.000Z",
      toUtcExclusive: "2026-01-31T18:30:00.000Z",
      days: 31,
    });
    expect(f.previousFromUtc).toBe("2025-11-30T18:30:00.000Z");
    expect(f.previousToUtcExclusive).toBe(f.window.fromUtc);
    expect(() =>
      normalizeFilter(
        { ...input, from: "2028-01-01", to: "2029-01-01" },
        clock,
      ),
    ).toThrow("future");
    expect(() => normalizeFilter({ ...input, from: "bad" }, clock)).toThrow();
  });
  it.each([
    [31, "DAY"],
    [32, "WEEK"],
    [120, "WEEK"],
    [121, "MONTH"],
  ])("selects bucket at %i days", (days, bucket) => {
    expect(
      normalizeFilter(
        { ...input, to: shiftDate(input.from, Number(days) - 1) },
        clock,
      ).window.bucket,
    ).toBe(bucket);
  });
  it("resolves presets and intersects category/type selections", () => {
    expect(presetRange("CUSTOM", clock)).toBeNull();
    expect(presetRange("TODAY", clock)).toEqual({
      from: "2028-03-01",
      to: "2028-03-01",
    });
    const today = normalizeFilter(
      { ...input, ...presetRange("TODAY", clock), preset: "TODAY" },
      clock,
    );
    expect(today.window).toMatchObject({
      days: 1,
      bucket: "DAY",
      fromUtc: "2028-02-29T18:30:00.000Z",
      toUtcExclusive: "2028-03-01T18:30:00.000Z",
    });
    expect(buckets(today)).toEqual([
      { bucketStart: "2028-03-01", label: "2028-03-01" },
    ]);
    for (const preset of [
      "LAST_7_DAYS",
      "LAST_30_DAYS",
      "LAST_90_DAYS",
      "LAST_6_MONTHS",
      "LAST_12_MONTHS",
    ] as const)
      expect(presetRange(preset, clock)?.to).toBe("2028-03-01");
    expect(presetRange("LAST_7_DAYS", clock)?.from).toBe("2028-02-24");
    expect(
      normalizeFilter(
        {
          ...input,
          categoryGroup: "POACHING_AND_SNARES",
          types: ["SNARE_FOUND", "OTHER"],
        },
        clock,
      ).effectiveTypes,
    ).toEqual(["SNARE_FOUND"]);
    expect(normalizeFilter(input, clock).effectiveTypes).toHaveLength(7);
  });
  it("enumerates empty daily, ISO-week and monthly buckets across year boundaries", () => {
    expect(buckets(normalizeFilter(input, clock))).toHaveLength(31);
    expect(
      buckets(
        normalizeFilter(
          { ...input, from: "2025-12-31", to: "2026-02-01" },
          clock,
        ),
      )[0].bucketStart,
    ).toBe("2025-12-29");
    expect(
      buckets(
        normalizeFilter(
          { ...input, from: "2025-11-15", to: "2026-03-31" },
          clock,
        ),
      ).map((b) => b.bucketStart),
    ).toEqual([
      "2025-11-01",
      "2025-12-01",
      "2026-01-01",
      "2026-02-01",
      "2026-03-01",
    ]);
  });
  it("calculates change without infinity or misleading rounded zero", () => {
    expect(percentChange(12, 10)).toEqual({
      changePercent: 20,
      changeKind: "UP",
    });
    expect(percentChange(8, 10)).toEqual({
      changePercent: -20,
      changeKind: "DOWN",
    });
    expect(percentChange(0, 0)).toEqual({
      changePercent: 0,
      changeKind: "NO_CHANGE",
    });
    expect(percentChange(1, 0)).toEqual({
      changePercent: null,
      changeKind: "NEW_ACTIVITY",
    });
    expect(percentChange(1001, 1000).changeKind).toBe("NO_CHANGE");
  });
  it("classifies hotspots, ties and priority scores", () => {
    expect(classBreaks([])).toEqual([]);
    expect(classBreaks([1])).toEqual([1]);
    expect(classBreaks([5])).toEqual([1, 2, 3, 4]);
    expect(classBreaks([100])).toEqual([20, 40, 60, 80]);
    expect(riskClass(1, [1, 2, 3, 4])).toBe(1);
    expect(riskClass(5, [1, 2, 3, 4])).toBe(5);
    expect(hotspotThreshold([1, 2, 3], 3)).toBe(3);
    expect(hotspotThreshold([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3)).toBe(10);
    expect(priorityScore(3, null)).toBe(270);
    expect(priorityScore(3, 100)).toBe(270);
    expect(priorityScore(3, 2)).toBe(6);
    expect(sharePercent(1, 0)).toBe(0);
    expect(sharePercent(1, 4)).toBe(25);
  });
  it("creates sequence-backed codes and rejects unsafe components", () => {
    expect(reportCode("YALA", 2026, 42)).toBe("RPT-YALA-2026-000042");
    expect(reportCode("YALA", 2026, "1000000")).toBe("RPT-YALA-2026-1000000");
    for (const [park, year, seq] of [
      ["../bad", 2026, 1],
      ["YALA", 1.5, 1],
      ["YALA", 1999, 1],
      ["YALA", 10000, 1],
      ["YALA", 2026, 0],
    ] as const)
      expect(() => reportCode(park, year, seq)).toThrow();
  });
  it("writes cautious narrative and keeps sources separate", () => {
    const r = reportFixture();
    expect(narrative(r)).toEqual([
      "Patrol gap analysis is not configured for this park.",
    ]);
    r.patrolGaps.configured = true;
    r.kpis.totalIncidents = 10;
    r.kpis.previousPeriodIncidents = 5;
    r.kpis.changePercent = 100;
    expect(narrative(r)[0]).toContain("rose 100%");
    r.kpis.changePercent = -50;
    expect(narrative(r)[0]).toContain("fell 50%");
    r.kpis.changePercent = 0;
    expect(narrative(r)).toEqual([]);
    r.kpis.changePercent = null;
    expect(narrative(r)).toEqual([]);
    r.kpis.totalIncidents = 4;
    r.kpis.changePercent = 20;
    expect(narrative(r)).toEqual([]);
    r.kpis.totalIncidents = 10;
    r.kpis.previousPeriodIncidents = 4;
    expect(narrative(r)).toEqual([]);
    r.breakdown = [
      {
        type: "OTHER",
        sectorId: null,
        sectorName: "Unknown sector",
        count: 4,
        riskLevel: "LOW",
        sharePercent: 100,
      },
    ];
    expect(narrative(r)).toEqual([]);
    r.breakdown[0].count = 5;
    r.kpis.communityConflictReports = 1;
    expect(narrative(r)).toHaveLength(2);
    r.kpis.communityConflictReports = 0;
    r.kpis.collarBreaches = 1;
    expect(narrative(r).at(-1)).toContain("not deduplicated");
  });
  it("validates snapshots, strips unknown fields and hashes deterministic content", () => {
    const r = reportFixture();
    const first = assembleReport({ ...r, ...{ reporter_phone: "private" } });
    expect(JSON.stringify(first.report)).not.toContain("private");
    expect(first.snapshotSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(assembleReport(r)).toEqual(first);
    r.kpis.totalIncidents = 1;
    expect(assembleReport(r).snapshotSha256).not.toBe(first.snapshotSha256);
    r.kpis.totalIncidents = -1;
    expect(() => assembleReport(r)).toThrow();
  });
});
