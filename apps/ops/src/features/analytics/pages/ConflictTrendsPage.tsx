import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalyticsOptions, ConservationReport } from "@wr/shared";
import { AnalyticsSubpageLayout } from "../components/AnalyticsSubpageLayout.js";

const numberFormat = new Intl.NumberFormat("en-LK");

export function ConflictTrendsPage() {
  return (
    <AnalyticsSubpageLayout section="conflicts">
      {(report: ConservationReport, options: AnalyticsOptions) => {
        const community = report.conflicts.series.reduce(
          (sum, point) => sum + point.communityReports,
          0,
        );
        const breaches = report.conflicts.series.reduce(
          (sum, point) => sum + point.collarBreaches,
          0,
        );
        const rangerReports = report.conflicts.series.reduce(
          (sum, point) => sum + point.rangerReported,
          0,
        );
        const sortedStretches = report.conflicts.byStretch
          .slice()
          .sort(
            (a, b) =>
              b.communityReports +
                b.collarBreaches -
                (a.communityReports + a.collarBreaches) ||
              a.stretchName.localeCompare(b.stretchName),
          );
        const busiest = sortedStretches[0];
        const monthBuckets =
          report.conflicts.byStretch[0]?.byMonth ??
          report.conflicts.series.map((point) => ({
            bucketStart: point.bucketStart,
            communityReports: point.communityReports,
            collarBreaches: point.collarBreaches,
          }));
        const maximum = Math.max(
          1,
          ...sortedStretches.flatMap((stretch) =>
            stretch.byMonth.map(
              (month) => month.communityReports + month.collarBreaches,
            ),
          ),
        );
        const settlementsByStretch = new Map<string, string[]>();
        for (const settlement of report.spatialContext.settlements) {
          if (!settlement.nearestStretchId) continue;
          const names =
            settlementsByStretch.get(settlement.nearestStretchId) ?? [];
          names.push(settlement.name);
          settlementsByStretch.set(settlement.nearestStretchId, names);
        }
        return (
          <div className="an-report-content">
            <div className="an-conflict-fixed-note">
              Fixed category: <strong>Human-wildlife conflict</strong>
            </div>
            <section className="an-kpi-grid" aria-label="Conflict indicators">
              <article className="an-kpi-card">
                <p className="an-overline">COMMUNITY REPORTS</p>
                <strong>{numberFormat.format(community)}</strong>
                <span>Reports in the selected period</span>
              </article>
              <article className="an-kpi-card">
                <p className="an-overline">COLLAR BREACHES</p>
                <strong>{numberFormat.format(breaches)}</strong>
                <span>Geofence breach alerts</span>
              </article>
              <article className="an-kpi-card">
                <p className="an-overline">RANGER-REPORTED</p>
                <strong>{numberFormat.format(rangerReports)}</strong>
                <span>Shown separately from community reports</span>
              </article>
              <article className="an-kpi-card">
                <p className="an-overline">BUSIEST STRETCH</p>
                <strong>{busiest?.stretchName ?? "No boundary data"}</strong>
                <span>
                  {busiest
                    ? `${busiest.communityReports + busiest.collarBreaches} events`
                    : "No located conflicts"}
                </span>
              </article>
            </section>
            <section className="an-panel">
              <div className="an-panel-heading">
                <div>
                  <p className="an-overline">CONFLICT TREND</p>
                  <h2>Monthly events by source</h2>
                </div>
              </div>
              <p className="an-chart-caption">
                Sources are counted separately and are not deduplicated. One
                wildlife crossing can appear in both series.
              </p>
              {report.conflicts.series.length ? (
                <div
                  className="an-chart"
                  role="img"
                  aria-label="Monthly conflict reports by source"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={report.conflicts.series}
                      margin={{ top: 8, right: 8, bottom: 4, left: -18 }}
                    >
                      <CartesianGrid stroke="#e6ece5" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="communityReports"
                        name="Community"
                        fill="#347550"
                      />
                      <Bar
                        dataKey="collarBreaches"
                        name="Collar breaches"
                        fill="#2563eb"
                      />
                      <Bar
                        dataKey="rangerReported"
                        name="Ranger reported"
                        fill="#9333a5"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="an-empty-inline">
                  No conflict events match this report.
                </p>
              )}
              <table className="an-table an-chart-data-table">
                <caption>Monthly conflicts by source</caption>
                <thead>
                  <tr>
                    <th scope="col">Month</th>
                    <th scope="col">Community</th>
                    <th scope="col">Collar breaches</th>
                    <th scope="col">Ranger reported</th>
                  </tr>
                </thead>
                <tbody>
                  {report.conflicts.series.map((point) => (
                    <tr key={point.bucketStart}>
                      <th scope="row">{point.label}</th>
                      <td>{point.communityReports}</td>
                      <td>{point.collarBreaches}</td>
                      <td>{point.rangerReported}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section className="an-panel">
              <div className="an-panel-heading">
                <div>
                  <p className="an-overline">BOUNDARY STRETCHES</p>
                  <h2>Conflict events by stretch</h2>
                </div>
              </div>
              {sortedStretches.length ? (
                <div
                  className="an-chart an-gap-chart"
                  role="img"
                  aria-label="Conflicts per boundary stretch"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={sortedStretches}
                      layout="vertical"
                      margin={{ top: 4, right: 24, bottom: 4, left: 25 }}
                    >
                      <CartesianGrid stroke="#e6ece5" horizontal={false} />
                      <XAxis
                        type="number"
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="stretchName"
                        width={130}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="communityReports"
                        name="Community"
                        stackId="events"
                        fill="#347550"
                      />
                      <Bar
                        dataKey="collarBreaches"
                        name="Collar breaches"
                        stackId="events"
                        fill="#2563eb"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="an-empty-inline">
                  No boundary stretch conflict data.
                </p>
              )}
              <div className="an-matrix-wrap">
                <table className="an-table an-stretch-matrix">
                  <caption>
                    Monthly boundary stretch conflicts: community reports /
                    collar breaches
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Boundary stretch</th>
                      {monthBuckets.map((month) => (
                        <th scope="col" key={month.bucketStart}>
                          {month.bucketStart.slice(0, 7)}
                        </th>
                      ))}
                      <th scope="col">Nearby settlements</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStretches.map((stretch) => {
                      const settlements =
                        settlementsByStretch.get(stretch.stretchId) ?? [];
                      return (
                        <tr key={stretch.stretchId}>
                          <th scope="row">{stretch.stretchName}</th>
                          {stretch.byMonth.map((month) => {
                            const total =
                              month.communityReports + month.collarBreaches;
                            const opacity =
                              total === 0 ? 0 : 0.12 + (total / maximum) * 0.68;
                            return (
                              <td
                                key={month.bucketStart}
                                style={{
                                  backgroundColor: `rgba(180, 83, 9, ${opacity})`,
                                }}
                                aria-label={`${month.communityReports} community reports, ${month.collarBreaches} collar breaches`}
                              >
                                {month.communityReports} /{" "}
                                {month.collarBreaches}
                              </td>
                            );
                          })}
                          <td>
                            {settlements.length ? settlements.join(", ") : "—"}
                          </td>
                        </tr>
                      );
                    })}
                    {!sortedStretches.length && (
                      <tr>
                        <td colSpan={monthBuckets.length + 2}>
                          No stretch data available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="an-map-note">
                Settlement context includes locations within{" "}
                {numberFormat.format(
                  options.config.boundaryStretchBufferMeters,
                )}{" "}
                m of a boundary stretch;{" "}
                {report.spatialContext.settlements.some(
                  (settlement) => settlement.nearestStretchId,
                )
                  ? "unmatched park settlements are omitted from this matrix."
                  : "no settlement fell within that buffer."}
              </p>
            </section>
          </div>
        );
      }}
    </AnalyticsSubpageLayout>
  );
}
