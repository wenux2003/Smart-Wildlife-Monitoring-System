import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalyticsOptions, ConservationReport } from "@wr/shared";
import { AnalyticsMap } from "../components/AnalyticsMap.js";
import { AnalyticsSubpageLayout } from "../components/AnalyticsSubpageLayout.js";

const numberFormat = new Intl.NumberFormat("en-LK", {
  maximumFractionDigits: 1,
});

export function PatrolGapsPage() {
  return (
    <AnalyticsSubpageLayout section="patrol-gaps">
      {(report: ConservationReport, options: AnalyticsOptions) => {
        const neglectDays = options.config.gapNeglectDays;
        const neglected = report.patrolGaps.cells.filter(
          (cell) =>
            !cell.covered &&
            (cell.daysSincePatrol === null ||
              cell.daysSincePatrol >= neglectDays),
        ).length;
        const gapPercentBySector = report.patrolGaps.bySector
          .slice()
          .sort((a, b) => b.gapSharePercent - a.gapSharePercent);
        return (
          <div className="an-report-content">
            <section
              className="an-kpi-grid"
              aria-label="Patrol coverage indicators"
            >
              <article className="an-kpi-card">
                <p className="an-overline">GAP AREA</p>
                <strong>
                  {numberFormat.format(report.patrolGaps.gapAreaKm2)} km²
                </strong>
                <span>
                  {report.patrolGaps.parkAreaKm2 > 0
                    ? `${numberFormat.format(
                        (report.patrolGaps.gapAreaKm2 /
                          report.patrolGaps.parkAreaKm2) *
                          100,
                      )}% of analyzed area`
                    : "No configured analysis area"}
                </span>
              </article>
              <article className="an-kpi-card">
                <p className="an-overline">COVERED AREA</p>
                <strong>
                  {numberFormat.format(report.patrolGaps.coveredAreaKm2)} km²
                </strong>
                <span>Valid patrol tracks within the report period</span>
              </article>
              <article className="an-kpi-card">
                <p className="an-overline">NEGLECTED CELLS</p>
                <strong>{numberFormat.format(neglected)}</strong>
                <span>Not patrolled for at least {neglectDays} days</span>
              </article>
              <article className="an-kpi-card">
                <p className="an-overline">SESSIONS ANALYZED</p>
                <strong>
                  {report.dataQuality.sessionsAnalyzed === undefined
                    ? "—"
                    : numberFormat.format(report.dataQuality.sessionsAnalyzed)}
                </strong>
                <span>
                  {report.dataQuality.sessionsAnalyzed === undefined
                    ? "Not captured in this saved report"
                    : `${report.dataQuality.sessionsWithoutTrack} without usable GPS`}
                </span>
              </article>
            </section>

            <section className="an-panel an-gap-chart-panel">
              <div className="an-panel-heading">
                <div>
                  <p className="an-overline">SECTOR PATROL GAPS</p>
                  <h2>Share of sector area not covered</h2>
                </div>
              </div>
              {gapPercentBySector.length ? (
                <div
                  className="an-chart an-gap-chart"
                  role="img"
                  aria-label="Patrol gap share by sector"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={gapPercentBySector}
                      layout="vertical"
                      margin={{ top: 4, right: 44, bottom: 4, left: 20 }}
                    >
                      <CartesianGrid stroke="#e6ece5" horizontal={false} />
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        unit="%"
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="sectorName"
                        width={130}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        formatter={(value) => [`${value}%`, "Gap share"]}
                      />
                      <Bar
                        dataKey="gapSharePercent"
                        name="Gap share"
                        fill="#d97706"
                      >
                        <LabelList
                          dataKey="gapSharePercent"
                          position="right"
                          formatter={(value: number | string | undefined) =>
                            `${value ?? 0}%`
                          }
                        />
                        {gapPercentBySector.map((sector) => (
                          <Cell
                            key={sector.sectorName}
                            fill={
                              sector.gapSharePercent >= 50
                                ? "#b45309"
                                : "#347550"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="an-empty-inline">
                  No sector gap data is available.
                </p>
              )}
            </section>

            <AnalyticsMap report={report} initialMode="coverage" />

            <section className="an-panel an-priority-panel">
              <div className="an-panel-heading">
                <div>
                  <p className="an-overline">FIELD PRIORITIES</p>
                  <h2>Where to patrol next</h2>
                </div>
              </div>
              {report.priorityCells.length ? (
                <ol className="an-priority-list an-priority-list-large">
                  {report.priorityCells.map((cell) => (
                    <li key={cell.cellId}>
                      <strong>{cell.sectorName ?? cell.cellId}</strong>
                      <span>{cell.incidents} incidents</span>
                      <span>
                        {cell.daysSincePatrol === null
                          ? "Never patrolled"
                          : `${cell.daysSincePatrol} days since patrol`}
                      </span>
                      <span>
                        Priority score {numberFormat.format(cell.score)}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="an-empty-inline">
                  No cells currently meet the hotspot and neglect rules.
                </p>
              )}
              <details className="an-method-note">
                <summary>How is this calculated?</summary>
                <p>
                  Priority score = incident count × min(days since patrol, 90).
                  Never-patrolled cells use 90 days. Patrol coverage uses the
                  configured {options.config.trackBufferMeters} m track buffer.
                  GPS points with accuracy worse than{" "}
                  {options.config.maxPointAccuracyMeters} m and segments longer
                  than {options.config.maxSegmentGapSeconds} seconds or{" "}
                  {options.config.maxSegmentLengthMeters} m are ignored.
                </p>
              </details>
              <p className="an-method-note">
                Cells are covered when a valid patrol track intersects them.
              </p>
            </section>
          </div>
        );
      }}
    </AnalyticsSubpageLayout>
  );
}
