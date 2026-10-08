import type { ConservationReport } from "@wr/shared";
import { AppError } from "../../../core/errors.js";
import type { ReportExporter, StoredRun } from "../types.js";
import { writeCsv, type CsvValue } from "./csv-writer.js";

const MAX_CSV_ROWS = 5000;
const header = [
  "report_code",
  "section",
  "dimension",
  "dimension_2",
  "period_start",
  "period_end",
  "metric",
  "value",
  "unit",
] as const;

function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function addMonths(date: string, amount: number): string {
  const [year, month] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1 + amount, 1));
  return value.toISOString().slice(0, 10);
}

function endOfPeriod(
  start: string,
  bucket: "DAY" | "WEEK" | "MONTH",
  finalDate: string,
): string {
  const next =
    bucket === "MONTH"
      ? addDays(addMonths(start, 1), -1)
      : addDays(start, bucket === "WEEK" ? 6 : 0);
  return next < finalDate ? next : finalDate;
}

function csvRows(report: ConservationReport, code: string): CsvValue[][] {
  const { from, to } = report.filters;
  const rows: CsvValue[][] = [];
  const add = (
    section: string,
    dimension: string | null,
    dimension2: string | null,
    periodStart: string,
    periodEnd: string,
    metric: string,
    value: CsvValue,
    unit: string,
  ) => {
    if (rows.length >= MAX_CSV_ROWS)
      throw new AppError(
        "This report is too large to export as CSV.",
        413,
        "EXPORT_TOO_LARGE",
      );
    rows.push([
      code,
      section,
      dimension,
      dimension2,
      periodStart,
      periodEnd,
      metric,
      value,
      unit,
    ]);
  };
  const count = (metric: string, value: number) =>
    add("kpi", null, null, from, to, metric, value, "count");

  count("total_incidents", report.kpis.totalIncidents);
  count("previous_period_incidents", report.kpis.previousPeriodIncidents);
  if (report.kpis.changePercent !== null)
    add(
      "kpi",
      null,
      null,
      from,
      to,
      "change_percent",
      Number(report.kpis.changePercent.toFixed(2)),
      "percent",
    );
  count("hotspot_cells", report.kpis.hotspotCells);
  count("community_conflict_reports", report.kpis.communityConflictReports);
  count("collar_breaches", report.kpis.collarBreaches);
  if (report.kpis.patrolGapAreaKm2 !== null)
    add(
      "kpi",
      null,
      null,
      from,
      to,
      "patrol_gap_area",
      Number(report.kpis.patrolGapAreaKm2.toFixed(2)),
      "km2",
    );
  if (report.kpis.patrolGapSharePercent !== null)
    add(
      "kpi",
      null,
      null,
      from,
      to,
      "patrol_gap_share",
      Number(report.kpis.patrolGapSharePercent.toFixed(2)),
      "percent",
    );

  for (const point of report.trend)
    add(
      "trend",
      null,
      null,
      point.bucketStart,
      endOfPeriod(point.bucketStart, report.window.bucket, to),
      "incidents",
      point.count,
      "count",
    );

  for (const item of report.breakdown)
    add(
      "breakdown",
      item.type,
      item.sectorName,
      from,
      to,
      "incidents",
      item.count,
      "count",
    );

  for (const item of report.hotspots.cells)
    add(
      "hotspot",
      item.cellId,
      item.sectorName,
      from,
      to,
      "incidents",
      item.count,
      "count",
    );

  for (const item of report.patrolGaps.bySector)
    add(
      "patrol_gap",
      item.sectorName,
      null,
      from,
      to,
      "gap_area",
      Number(item.gapAreaKm2.toFixed(2)),
      "km2",
    );

  for (const item of report.priorityCells)
    add(
      "priority_cell",
      item.cellId,
      item.sectorName,
      from,
      to,
      "priority_score",
      Number(item.score.toFixed(2)),
      "score",
    );

  for (const point of report.conflicts.series) {
    const periodEnd = endOfPeriod(point.bucketStart, "MONTH", to);
    add(
      "conflict",
      null,
      "community_report",
      point.bucketStart,
      periodEnd,
      "events",
      point.communityReports,
      "count",
    );
    add(
      "conflict",
      null,
      "collar_breach",
      point.bucketStart,
      periodEnd,
      "events",
      point.collarBreaches,
      "count",
    );
    add(
      "conflict",
      null,
      "ranger_reported",
      point.bucketStart,
      periodEnd,
      "events",
      point.rangerReported,
      "count",
    );
  }

  for (const stretch of report.conflicts.byStretch)
    for (const month of stretch.byMonth) {
      const periodEnd = endOfPeriod(month.bucketStart, "MONTH", to);
      add(
        "conflict",
        stretch.stretchName,
        "community_report",
        month.bucketStart,
        periodEnd,
        "events",
        month.communityReports,
        "count",
      );
      add(
        "conflict",
        stretch.stretchName,
        "collar_breach",
        month.bucketStart,
        periodEnd,
        "events",
        month.collarBreaches,
        "count",
      );
    }

  for (const [metric, value] of Object.entries(report.dataQuality))
    add("data_quality", null, null, from, to, metric, value, "count");

  return rows;
}

export const csvExporter: ReportExporter = {
  format: "CSV",
  mimeType: "text/csv; charset=utf-8",
  extension: "csv",
  async render(run: StoredRun & { report: ConservationReport }) {
    const rows = csvRows(run.report, run.code);
    return writeCsv([header, ...rows]);
  },
};
