import { useState } from "react";
import { usePrefersReducedMotion } from "../../../hooks/usePrefersReducedMotion.js";
import { KpiValue } from "./KpiValue.js";
import { ReportInsights } from "./ReportInsights.js";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ConservationReport } from "@wr/shared";

const numberFormat = new Intl.NumberFormat("en-LK");

function changeLabel(
  kind: ConservationReport["kpis"]["changeKind"],
  change: number | null,
) {
  if (kind === "NEW_ACTIVITY") return "New activity in this period";
  if (kind === "NO_CHANGE") return "No change from previous period";
  if (change === null) return "No previous-period comparison";
  return `${change > 0 ? "▲" : "▼"} ${Math.abs(change)}% vs previous period`;
}

export function ReportOverview({ report }: { report: ConservationReport }) {
  const reducedMotion = usePrefersReducedMotion();
  const [showTrendTable, setShowTrendTable] = useState(false);
  const [showBreakdownTable, setShowBreakdownTable] = useState(false);
  const { kpis, dataQuality } = report;
  const hotspots = report.hotspots.cells.filter((cell) => cell.isHotspot);
  const communityCount = report.conflicts.series.reduce(
    (total, point) => total + point.communityReports,
    0,
  );
  const collarCount = report.conflicts.series.reduce(
    (total, point) => total + point.collarBreaches,
    0,
  );
  const qualityIssues =
    dataQuality.excludedNoLocation +
    dataQuality.excludedRejected +
    dataQuality.outsideBoundary +
    dataQuality.sessionsWithoutTrack +
    dataQuality.droppedGpsPoints +
    dataQuality.alertsWithoutLocation;

  return (
    <div className="an-report-content an-view-body">
      <section className="an-kpi-grid" aria-label="Key indicators">
        <article className="an-kpi-card">
          <p className="an-overline">TOTAL INCIDENTS</p>
          <KpiValue value={kpis.totalIncidents} />
          <span>{changeLabel(kpis.changeKind, kpis.changePercent)}</span>
        </article>
        <article className="an-kpi-card">
          <p className="an-overline">HIGH-RISK HOTSPOTS</p>
          <KpiValue value={hotspots.length} suffix=" cells" />
          <span>
            {kpis.hotspotSectorNames.join(" · ") || "No hotspot sectors"}
          </span>
        </article>
        <article className="an-kpi-card">
          <p className="an-overline">PATROL GAP AREA</p>
          <KpiValue value={kpis.patrolGapAreaKm2} decimals={1} suffix=" km²" />
          <span>
            {kpis.patrolGapSharePercent === null
              ? "Park coverage analysis unavailable"
              : `${numberFormat.format(Math.round(kpis.patrolGapSharePercent * 10) / 10)}% of park`}
          </span>
        </article>
        <article className="an-kpi-card">
          <p className="an-overline">CONFLICT SOURCES</p>
          <strong>
            {communityCount} community · {collarCount} collar
          </strong>
          <span>Separate counts; events may appear in both sources</span>
        </article>
      </section>

      <div className="an-visual-grid">
        <figure className="an-panel an-trend-panel">
          <div className="an-panel-heading">
            <div>
              <p className="an-overline">INCIDENT FREQUENCY</p>
              <h2>Trend over time</h2>
            </div>
            <button
              type="button"
              className="an-text-button"
              aria-expanded={showTrendTable}
              onClick={() => setShowTrendTable((value) => !value)}
            >
              {showTrendTable ? "Hide data table" : "View data table"}
            </button>
          </div>
          {report.trend.length ? (
            <div
              className="an-chart"
              role="img"
              aria-label={`Incidents by time period: ${report.trend.map((point) => `${point.label}: ${point.count}`).join("; ")}`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={report.trend}
                  margin={{ top: 8, right: 8, bottom: 4, left: -18 }}
                >
                  <CartesianGrid stroke="#e6ece5" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip />
                  <Bar
                    isAnimationActive={!reducedMotion}
                    animationDuration={700}
                    animationEasing="ease-out"
                    dataKey="count"
                    name="Incidents"
                    fill="#26734d"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="an-chart-empty">
              No trend observations for this period.
            </p>
          )}
          {showTrendTable && (
            <table className="an-data-table">
              <caption>Incident frequency data</caption>
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Incidents</th>
                </tr>
              </thead>
              <tbody>
                {report.trend.map((point) => (
                  <tr key={point.bucketStart}>
                    <th scope="row">{point.label}</th>
                    <td>{point.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <figcaption className="an-chart-caption">
            n = {numberFormat.format(kpis.totalIncidents)} incidents ·{" "}
            {dataQuality.excludedNoLocation} without location
          </figcaption>
        </figure>
        <section className="an-panel an-breakdown-panel">
          <div className="an-panel-heading">
            <div>
              <p className="an-overline">TYPE · SECTOR · RISK</p>
              <h2>Incident breakdown</h2>
            </div>
            <button
              type="button"
              className="an-text-button"
              aria-expanded={showBreakdownTable}
              onClick={() => setShowBreakdownTable((value) => !value)}
            >
              {showBreakdownTable
                ? "Hide rows"
                : `${report.breakdown.length} rows`}
            </button>
          </div>
          <div className="an-table-scroll">
            <table className="an-data-table">
              <caption className="an-sr-only">
                Breakdown by type, sector, count, and risk
              </caption>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Sector</th>
                  <th>Count</th>
                  <th>Risk</th>
                </tr>
              </thead>
              <tbody>
                {(showBreakdownTable
                  ? report.breakdown
                  : report.breakdown.slice(0, 5)
                ).map((row, index) => (
                  <tr key={`${row.type}-${row.sectorId ?? index}`}>
                    <td>{row.type.replaceAll("_", " ")}</td>
                    <td>{row.sectorName}</td>
                    <td>{row.count}</td>
                    <td>
                      <span
                        className={`an-risk-tag is-${row.riskLevel.toLowerCase()}`}
                      >
                        {row.riskLevel}
                      </span>
                    </td>
                  </tr>
                ))}
                {!report.breakdown.length && (
                  <tr>
                    <td colSpan={4}>No incidents in this breakdown.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {!showBreakdownTable && report.breakdown.length > 5 && (
            <p className="an-chart-caption">
              Showing 1–5 of {report.breakdown.length}
            </p>
          )}
        </section>
      </div>

      <div className="an-insights-grid">
        <section className="an-panel">
          <p className="an-overline">WHERE TO PATROL NEXT</p>
          <h2>Priority areas</h2>
          {report.priorityCells.length ? (
            <ol className="an-priority-list">
              {report.priorityCells.map((cell, index) => (
                <li key={cell.cellId}>
                  <span className="an-priority-number">{index + 1}</span>
                  <span>
                    <strong>{cell.sectorName ?? "Unassigned sector"}</strong>
                    <small>
                      {cell.incidents} incidents ·{" "}
                      {cell.daysSincePatrol === null
                        ? "not patrolled"
                        : `${cell.daysSincePatrol} days since patrol`}
                    </small>
                  </span>
                  <span className="an-priority-score">
                    {cell.score.toFixed(1)}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="an-muted-copy">No priority areas were identified.</p>
          )}
        </section>
        <ReportInsights report={report} />
      </div>

      <section className="an-quality-strip" aria-label="Data quality summary">
        <div>
          <p className="an-overline">DATA QUALITY</p>
          <strong>
            {qualityIssues
              ? `${qualityIssues} observations need attention`
              : "No data quality exclusions"}
          </strong>
        </div>
        <span>{dataQuality.excludedNoLocation} without location</span>
        <span>{dataQuality.excludedRejected} rejected excluded</span>
        <span>
          {dataQuality.sessionsWithoutTrack} patrols without usable GPS
        </span>
      </section>
    </div>
  );
}
