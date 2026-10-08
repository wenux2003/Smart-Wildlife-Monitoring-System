import postgres from "postgres";
import {
  ReportExportSchema,
  ReportRunResponseSchema,
  AnalyticsFilterSchema,
} from "@wr/shared";
import type {
  ReportAuditRepository,
  ReportHistoryRecord,
  StoredRun,
} from "./types.js";
import { reportCode } from "./domain/report-code.js";
import { colomboDate } from "./domain/filter.js";
import { emptyReportSuggestions } from "./domain/suggestions.js";
type Row = {
  id: string;
  code: string;
  park_id: string;
  requested_by: string;
  requester_name: string;
  requester_role: string;
  filters: unknown;
  status: string;
  snapshot: unknown;
  snapshot_sha256: string | null;
  duration_ms: number;
  created_at: Date;
  exports?: unknown;
};
function map(r: Row): StoredRun {
  return {
    ...ReportRunResponseSchema.parse({
      runId: r.id,
      code: r.code,
      status: r.status,
      snapshotSha256: r.snapshot_sha256,
      report: r.snapshot,
      suggestions:
        r.status === "EMPTY"
          ? emptyReportSuggestions(AnalyticsFilterSchema.parse(r.filters))
          : [],
    }),
    parkId: r.park_id,
    requestedBy: r.requested_by,
    requesterName: r.requester_name,
    requesterRole: r.requester_role,
    filters: AnalyticsFilterSchema.parse(r.filters),
    durationMs: r.duration_ms,
    createdAt: r.created_at.toISOString(),
  };
}
export function createReportAuditRepository(
  url: string,
): ReportAuditRepository {
  const sql = postgres(url, { max: 2, prepare: false });
  return {
    async insertRun(input) {
      return sql.begin(async (tx) => {
        const [number] =
          await tx`SELECT nextval('report_run_number_seq')::text n`;
        const code = reportCode(
          input.parkCode,
          Number(colomboDate(new Date(input.createdAt)).slice(0, 4)),
          number.n,
        );
        const [row] = await tx<
          Row[]
        >`INSERT INTO report_runs(code,park_id,requested_by,requester_role,filters,status,snapshot,snapshot_sha256,duration_ms,error_code,created_at)
 VALUES(${code},${input.parkId},${input.requestedBy},${input.requesterRole},${JSON.stringify(input.filters)}::text::jsonb,${input.status},${input.report === null ? null : JSON.stringify(input.report)}::text::jsonb,${input.snapshotSha256},${input.durationMs},${input.errorCode},${input.createdAt}) RETURNING *,${input.requesterName}::text requester_name`;
        return map(row);
      });
    },
    async getRun(id, parkId, userId) {
      const [row] = await sql<
        Row[]
      >`SELECT r.*,u.name requester_name FROM report_runs r JOIN auth_users u ON u.id=r.requested_by WHERE r.id=${id} AND r.park_id=${parkId} AND (${userId}::uuid IS NULL OR r.requested_by=${userId})`;
      return row ? map(row) : null;
    },
    async history(parkId, userId, page, pageSize, status) {
      return sql.begin(
        "isolation level repeatable read read only",
        async (tx) => {
          const condition = tx`r.park_id=${parkId} AND (${userId}::uuid IS NULL OR r.requested_by=${userId}) AND (${status ?? null}::text IS NULL OR r.status=${status ?? null})`;
          const [count] =
            await tx`SELECT count(*)::int total FROM report_runs r WHERE ${condition}`;
          const rows = await tx<
            Row[]
          >`SELECT r.*,u.name requester_name,
  COALESCE((SELECT json_agg(json_build_object(
    'id',e.id,'format',e.format,'status',e.status,'byteSize',e.byte_size,
    'fileSha256',e.file_sha256,'errorCode',e.error_code,
    'createdAt',to_char(e.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  ) ORDER BY e.created_at DESC,e.id) FROM report_exports e WHERE e.run_id=r.id),'[]'::json) exports
  FROM report_runs r JOIN auth_users u ON u.id=r.requested_by
  WHERE ${condition} ORDER BY r.created_at DESC,r.id
  LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`;
              return {
                items: rows.map((row): ReportHistoryRecord => ({
                  run: map(row),
                  exports: ReportExportSchema.array().parse(row.exports),
                })),
                total: count.total,
              };
        },
      );
    },
    async insertExport(i) {
      await sql`INSERT INTO report_exports(run_id,requested_by,format,status,byte_size,file_sha256,error_code) VALUES(${i.runId},${i.requestedBy},${i.format},${i.status},${i.byteSize},${i.fileSha256},${i.errorCode})`;
    },
    async close() {
      await sql.end();
    },
  };
}
