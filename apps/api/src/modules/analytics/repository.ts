import postgres from "postgres";
import {
  ParkAnalyticsConfigSchema,
  IncidentCategorySchema,
  IncidentSourceSchema,
  type ConservationReport,
  type AnalyticsOptions,
} from "@wr/shared";
import type { AnalyticsRepository } from "./types.js";
import { buckets, colomboDate } from "./domain/filter.js";
import {
  classBreaks,
  hotspotThreshold,
  percentChange,
  priorityScore,
  riskClass,
  sharePercent,
} from "./domain/metrics.js";
import { AppError } from "../../core/errors.js";
type Park = {
  id: string;
  code: string;
  name: string;
  config: { analytics?: unknown; analyticsDemo?: unknown };
  configured: boolean;
};
type Row = {
  day: string;
  type: ConservationReport["breakdown"][number]["type"];
  source: string;
  status: string;
  sector_id: string | null;
  sector_name: string;
  cell_id: string | null;
  stretch_id: string | null;
  stretch_name: string | null;
  unlocated: boolean;
  count: number;
};
type Cell = {
  cell_id: string;
  sector_name: string | null;
  polygon: { coordinates: number[][][] };
  centre: { coordinates: number[] };
  area_m2: number;
  covered: boolean;
  last_patrolled_at: Date | null;
};
function dateBucket(day: string, unit: string): string {
  if (unit === "MONTH") return day.slice(0, 7) + "-01";
  if (unit === "WEEK") {
    const d = new Date(day + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  }
  return day;
}
export function createAnalyticsRepository(
  url: string,
  timeoutMs = 8000,
): AnalyticsRepository {
  const sql = postgres(url, { max: 3, prepare: false });
  const park = async (
    tx: postgres.Sql | postgres.TransactionSql,
    id: string,
  ) => {
    const [p] = await tx<
      Park[]
    >`SELECT id,code,name,config,boundary IS NOT NULL AND EXISTS(SELECT 1 FROM analysis_grid_cells g WHERE g.park_id=parks.id) AS configured FROM parks WHERE id=${id}`;
    if (!p) throw new AppError("Park not found.", 404, "PARK_NOT_FOUND");
    return p;
  };
  return {
    async options(parkId) {
      const p = await park(sql, parkId),
        config = ParkAnalyticsConfigSchema.parse(p.config.analytics ?? {});
      const sectors = await sql<
        AnalyticsOptions["sectors"]
      >`SELECT id,code,name,kind FROM analysis_sectors WHERE park_id=${parkId} ORDER BY name`;
      const [range] =
        await sql`SELECT to_char(min(captured_at) AT TIME ZONE 'Asia/Colombo','YYYY-MM-DD') earliest,to_char(max(captured_at) AT TIME ZONE 'Asia/Colombo','YYYY-MM-DD') latest FROM incidents WHERE park_id=${parkId}`;
      return {
        allowedParks: [{ id: p.id, code: p.code, name: p.name }],
        types: IncidentCategorySchema.options,
        sources: IncidentSourceSchema.options,
        sectors,
        earliestDataDate: range.earliest,
        latestDataDate: range.latest,
        config: {
          gridCellMeters: config.gridCellMeters,
          trackBufferMeters: config.trackBufferMeters,
          gapNeglectDays: config.gapNeglectDays,
          hotspotMinCount: config.hotspotMinCount,
          configured: p.configured,
        },
      };
    },
    async load(f, generatedAt) {
      return sql.begin(
        "isolation level repeatable read read only",
        async (tx) => {
          await tx`SELECT set_config('statement_timeout',${String(timeoutMs)},true)`;
          const p = await park(tx, f.filters.parkId),
            config = ParkAnalyticsConfigSchema.parse(p.config.analytics ?? {}),
            id = p.id;
          const sector = f.filters.sectorId;
          // A lateral single-cell lookup makes points on grid edges count exactly once.
          const rows = await tx<Row[]>`
 SELECT to_char(i.captured_at AT TIME ZONE 'Asia/Colombo','YYYY-MM-DD') AS "day",i.type,i.source,i.status,
 s.id sector_id,COALESCE(s.name,'Unknown sector') sector_name,g.cell_id,b.id stretch_id,b.name stretch_name,
 (i.location IS NULL OR i.location_status='UNRESOLVED') unlocated,count(*)::int count
 FROM incidents i
 LEFT JOIN LATERAL(SELECT id,name FROM analysis_sectors WHERE park_id=i.park_id AND kind='SECTOR' AND i.location_status<>'UNRESOLVED' AND ST_Covers(area,i.location) ORDER BY id LIMIT 1)s ON true
 LEFT JOIN LATERAL(SELECT col::text||':'||row::text cell_id FROM analysis_grid_cells WHERE park_id=i.park_id AND cell_size_m=${config.gridCellMeters} AND i.location_status<>'UNRESOLVED' AND ST_Covers(geom,i.location) ORDER BY col,row LIMIT 1)g ON true
 LEFT JOIN LATERAL(SELECT id,name FROM analysis_sectors WHERE park_id=i.park_id AND kind='BOUNDARY_STRETCH' AND i.location_status<>'UNRESOLVED' AND ST_Covers(area,i.location) ORDER BY ST_Distance(ST_Transform(ST_Centroid(area),32644),ST_Transform(i.location,32644)),id LIMIT 1)b ON true
 WHERE i.park_id=${id} AND i.captured_at>=${f.previousFromUtc} AND i.captured_at<${f.window.toUtcExclusive}
 AND i.type=ANY(${f.effectiveTypes}::text[]) AND (${f.filters.sources.length === 0} OR i.source=ANY(${f.filters.sources}::text[]))
 AND (${sector}::uuid IS NULL OR s.id=${sector})
 GROUP BY "day",i.type,i.source,i.status,s.id,s.name,g.cell_id,b.id,b.name,unlocated`;
          const current = rows.filter((r) => r.day >= f.filters.from),
            accepted = current.filter(
              (r) => f.filters.includeRejected || r.status !== "REJECTED",
            );
          const previous = rows
            .filter(
              (r) =>
                r.day < f.filters.from &&
                (f.filters.includeRejected || r.status !== "REJECTED"),
            )
            .reduce((n, r) => n + r.count, 0);
          const total = accepted.reduce((n, r) => n + r.count, 0),
            trend = buckets(f).map((b) => ({ ...b, count: 0 }));
          const breakdownMap = new Map<
              string,
              ConservationReport["breakdown"][number]
            >(),
            counts = new Map<string, number>();
          for (const r of accepted) {
            const b = trend.find(
              (b) => b.bucketStart === dateBucket(r.day, f.window.bucket),
            );
            if (b) b.count += r.count;
            const key = r.type + ":" + r.sector_id;
            const old = breakdownMap.get(key);
            if (old) old.count += r.count;
            else
              breakdownMap.set(key, {
                type: r.type,
                sectorId: r.sector_id,
                sectorName: r.sector_name,
                count: r.count,
                riskLevel: config.typeRiskLevels[r.type] ?? "LOW",
                sharePercent: 0,
              });
            if (r.cell_id)
              counts.set(r.cell_id, (counts.get(r.cell_id) ?? 0) + r.count);
          }
          const breakdown = [...breakdownMap.values()].sort(
            (a, b) => b.count - a.count || a.type.localeCompare(b.type),
          );
          for (const r of breakdown)
            r.sharePercent = sharePercent(r.count, total);
          // Coverage only joins valid consecutive points in the same session. A bounded lookback supports recency.
          const cells = await tx<Cell[]>`
 WITH points AS (SELECT q.session_id,q.position,q.recorded_at,q.client_record_id FROM patrol_gps_points q JOIN patrol_sessions ps ON ps.id=q.session_id JOIN patrol_assignments pa ON pa.id=ps.assignment_id JOIN patrol_routes pr ON pr.id=pa.route_id
 WHERE pr.park_id=${id} AND q.recorded_at>=${new Date(Date.parse(f.window.fromUtc) - 90 * 86400000)} AND q.recorded_at<${f.window.toUtcExclusive} AND (q.accuracy_m IS NULL OR q.accuracy_m<=${config.maxPointAccuracyMeters})),
 pairs AS(SELECT *,lead(position) OVER w next_position,lead(recorded_at) OVER w next_at FROM points WINDOW w AS(PARTITION BY session_id ORDER BY recorded_at,client_record_id)),
 tracks AS(SELECT recorded_at,next_at,ST_Buffer(ST_MakeLine(ST_Transform(position,32644),ST_Transform(next_position,32644)),${config.trackBufferMeters}) geom FROM pairs WHERE next_at>recorded_at AND extract(epoch FROM next_at-recorded_at)<=${config.maxSegmentGapSeconds} AND ST_Distance(ST_Transform(position,32644),ST_Transform(next_position,32644))<=${config.maxSegmentLengthMeters})
 SELECT g.col::text||':'||g.row::text cell_id,s.name sector_name,ST_AsGeoJSON(g.geom)::json polygon,ST_AsGeoJSON(ST_Centroid(g.geom))::json centre,g.area_m2,
 COALESCE(bool_or(t.recorded_at>=${f.window.fromUtc}),false) covered,max(t.next_at) last_patrolled_at
 FROM analysis_grid_cells g LEFT JOIN analysis_sectors s ON s.id=g.sector_id LEFT JOIN tracks t ON ST_Intersects(g.geom_m,t.geom)
 WHERE g.park_id=${id} AND g.cell_size_m=${config.gridCellMeters} AND (${sector}::uuid IS NULL OR g.sector_id=${sector}) GROUP BY g.park_id,g.cell_size_m,g.col,g.row,s.name ORDER BY g.col,g.row`;
          const [quality] = await tx<
            { missing: number; dropped: number; has_points: boolean }[]
          >`WITH sessions AS(
            SELECT ps.id,r.park_id
  FROM patrol_sessions ps
  JOIN patrol_assignments a ON a.id=ps.assignment_id
  JOIN patrol_routes r ON r.id=a.route_id
  WHERE r.park_id=${id}
    AND ps.started_at<${f.window.toUtcExclusive}
    AND COALESCE(ps.ended_at,${f.window.toUtcExclusive}::timestamptz)>=${f.window.fromUtc}
), q AS(
  SELECT s.id,
    count(g.client_record_id) FILTER(WHERE g.accuracy_m IS NULL OR g.accuracy_m<=${config.maxPointAccuracyMeters}) valid,
    count(g.client_record_id) FILTER(WHERE g.accuracy_m>${config.maxPointAccuracyMeters}) dropped,
    count(g.client_record_id) FILTER(WHERE ${sector}::uuid IS NULL OR EXISTS(
      SELECT 1 FROM analysis_sectors area
      WHERE area.id=${sector} AND area.park_id=s.park_id
        AND area.kind='SECTOR' AND ST_Covers(area.area,g.position)
    )) points
  FROM sessions s
  LEFT JOIN patrol_gps_points g ON g.session_id=s.id
    AND g.recorded_at>=${f.window.fromUtc}
    AND g.recorded_at<${f.window.toUtcExclusive}
  GROUP BY s.id,s.park_id
)
SELECT count(*) FILTER(WHERE valid<2)::int missing,
  COALESCE(sum(dropped),0)::int dropped,
  COALESCE(sum(points),0)>0 has_points
FROM q`;
          const area = cells.reduce((n, c) => n + c.area_m2, 0) / 1e6,
            gap =
              cells
                .filter((c) => !c.covered)
                .reduce((n, c) => n + c.area_m2, 0) / 1e6;
          const breaks = classBreaks([...counts.values()]),
            threshold = hotspotThreshold(
              [...counts.values()],
              config.hotspotMinCount,
            );
          const polygon = (c: Cell) =>
            c.polygon.coordinates[0].map(([longitude, latitude]) => ({
              longitude,
              latitude,
            }));
          const days = (c: Cell) =>
            c.last_patrolled_at === null
              ? null
              : Math.max(
                  0,
                  Math.round(
                    (Date.parse(f.filters.to) -
                      Date.parse(colomboDate(c.last_patrolled_at))) /
                      86400000,
                  ),
                );
          const hotspots = cells
            .filter((c) => counts.has(c.cell_id))
            .map((c) => ({
              cellId: c.cell_id,
              polygon: polygon(c),
              sectorName: c.sector_name,
              count: counts.get(c.cell_id) ?? 0,
              riskClass: riskClass(counts.get(c.cell_id) ?? 0, breaks),
              isHotspot: (counts.get(c.cell_id) ?? 0) >= threshold,
            }));
          const bySector = new Map<
            string,
            { sectorName: string; gapAreaKm2: number; area: number }
          >();
          for (const c of cells) {
            const name = c.sector_name ?? "Unknown sector";
            const v = bySector.get(name) ?? {
              sectorName: name,
              gapAreaKm2: 0,
              area: 0,
            };
            v.area += c.area_m2 / 1e6;
            if (!c.covered) v.gapAreaKm2 += c.area_m2 / 1e6;
            bySector.set(name, v);
          }
          const hwc = new Set([
            "HUMAN_WILDLIFE_CONFLICT",
            "CROP_DAMAGE",
            "FENCE_DAMAGE",
          ]);
          const conflictIncidents = accepted.filter((r) => hwc.has(r.type));
          const alerts = await tx<
            {
              day: string;
              stretch_id: string | null;
              stretch_name: string | null;
              unlocated: boolean;
              count: number;
            }[]
          >`
 SELECT to_char(a.created_at AT TIME ZONE 'Asia/Colombo','YYYY-MM-DD') AS "day",b.id stretch_id,b.name stretch_name,a.location IS NULL unlocated,count(*)::int count
 FROM alerts a LEFT JOIN LATERAL(SELECT id,name FROM analysis_sectors WHERE park_id=a.park_id AND kind='BOUNDARY_STRETCH' AND ST_Covers(area,a.location) ORDER BY ST_Distance(ST_Transform(ST_Centroid(area),32644),ST_Transform(a.location,32644)),id LIMIT 1)b ON true
 WHERE a.park_id=${id} AND a.type='GEOFENCE_BREACH' AND ${f.effectiveTypes.some((type) => hwc.has(type))} AND a.created_at>=${f.window.fromUtc} AND a.created_at<${f.window.toUtcExclusive}
 AND (${sector}::uuid IS NULL OR EXISTS(SELECT 1 FROM analysis_sectors s WHERE s.id=${sector} AND s.park_id=a.park_id AND ST_Covers(s.area,a.location))) GROUP BY "day",b.id,b.name,unlocated`;
          const series = buckets({
            ...f,
            window: { ...f.window, bucket: "MONTH" },
          }).map((b) => ({
            ...b,
            communityReports: 0,
            collarBreaches: 0,
            rangerReported: 0,
          }));
          const stretches = new Map<
            string,
            ConservationReport["conflicts"]["byStretch"][number]
          >();
          const addStretch = (
            r: {
              day: string;
              stretch_id: string | null;
              stretch_name: string | null;
              count: number;
            },
            source: "communityReports" | "collarBreaches",
          ) => {
            if (!r.stretch_id) return;
            const item = stretches.get(r.stretch_id) ?? {
              stretchId: r.stretch_id,
              stretchName: r.stretch_name ?? "Boundary stretch",
              communityReports: 0,
              collarBreaches: 0,
              byMonth: series.map((b) => ({
                bucketStart: b.bucketStart,
                communityReports: 0,
                collarBreaches: 0,
              })),
            };
            item[source] += r.count;
            const month = item.byMonth.find(
              (b) => b.bucketStart === dateBucket(r.day, "MONTH"),
            );
            if (month) month[source] += r.count;
            stretches.set(r.stretch_id, item);
          };
          for (const r of conflictIncidents) {
            const month = series.find(
              (b) => b.bucketStart === dateBucket(r.day, "MONTH"),
            );
            if (month && r.source === "COMMUNITY") {
              month.communityReports += r.count;
              addStretch(r, "communityReports");
            }
            if (month && r.source === "RANGER") month.rangerReported += r.count;
          }
          for (const r of alerts) {
            const month = series.find(
              (b) => b.bucketStart === dateBucket(r.day, "MONTH"),
            );
            if (month) month.collarBreaches += r.count;
            addStretch(r, "collarBreaches");
          }
          return {
            hasPatrolPoints: quality.has_points,
            sections: {
              syntheticDemo: p.config.analyticsDemo != null,
              park: { id, code: p.code, name: p.name },
              filters: f.filters,
              window: f.window,
              generatedAt: generatedAt.toISOString(),
              kpis: {
                totalIncidents: total,
                previousPeriodIncidents: previous,
                ...percentChange(total, previous),
                hotspotCells: hotspots.filter((c) => c.isHotspot).length,
                hotspotSectorNames: [
                  ...new Set(
                    hotspots
                      .filter((c) => c.isHotspot && c.sectorName)
                      .map((c) => String(c.sectorName)),
                  ),
                ].slice(0, 3),
                patrolGapAreaKm2: p.configured ? gap : null,
                patrolGapSharePercent: p.configured
                  ? sharePercent(gap, area)
                  : null,
                communityConflictReports: series.reduce(
                  (n, r) => n + r.communityReports,
                  0,
                ),
                collarBreaches: series.reduce(
                  (n, r) => n + r.collarBreaches,
                  0,
                ),
              },
              dataQuality: {
                excludedNoLocation: accepted
                  .filter((r) => r.unlocated)
                  .reduce((n, r) => n + r.count, 0),
                excludedRejected: current
                  .filter((r) => r.status === "REJECTED")
                  .reduce((n, r) => n + r.count, 0),
                outsideBoundary: accepted
                  .filter((r) => !r.unlocated && !r.cell_id)
                  .reduce((n, r) => n + r.count, 0),
                sessionsWithoutTrack: quality.missing,
                droppedGpsPoints: quality.dropped,
                alertsWithoutLocation: alerts
                  .filter((r) => r.unlocated)
                  .reduce((n, r) => n + r.count, 0),
              },
              trend,
              breakdown,
              hotspots: {
                cellSizeMeters: config.gridCellMeters,
                cells: hotspots,
                classBreaks: breaks,
              },
              patrolGaps: {
                configured: p.configured,
                cells: cells.map((c) => ({
                  cellId: c.cell_id,
                  polygon: polygon(c),
                  covered: c.covered,
                  lastPatrolledAt: c.last_patrolled_at?.toISOString() ?? null,
                  daysSincePatrol: days(c),
                })),
                coveredAreaKm2: Math.max(0, area - gap),
                gapAreaKm2: gap,
                parkAreaKm2: area,
                bySector: [...bySector.values()].map((v) => ({
                  sectorName: v.sectorName,
                  gapAreaKm2: v.gapAreaKm2,
                  gapSharePercent: sharePercent(v.gapAreaKm2, v.area),
                })),
              },
              priorityCells: cells
                .filter(
                  (c) =>
                    (counts.get(c.cell_id) ?? 0) >= config.hotspotMinCount &&
                    (days(c) === null ||
                      Number(days(c)) >= config.gapNeglectDays),
                )
                .map((c) => ({
                  cellId: c.cell_id,
                  centre: {
                    longitude:
                      Math.round(c.centre.coordinates[0] * 1000) / 1000,
                    latitude: Math.round(c.centre.coordinates[1] * 1000) / 1000,
                  },
                  sectorName: c.sector_name,
                  incidents: counts.get(c.cell_id) ?? 0,
                  daysSincePatrol: days(c),
                  score: priorityScore(counts.get(c.cell_id) ?? 0, days(c)),
                }))
                .sort(
                  (a, b) =>
                    b.score - a.score || a.cellId.localeCompare(b.cellId),
                )
                .slice(0, 5),
              conflicts: { series, byStretch: [...stretches.values()] },
            },
          };
        },
      );
    },
    async close() {
      await sql.end();
    },
  };
}
