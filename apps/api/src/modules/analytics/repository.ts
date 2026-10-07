import postgres from "postgres";
import crypto from "node:crypto";
import type { HotspotRecord, ExportAuditRecord } from "./types.js";

export interface AnalyticsRepository {
  getHotspots(parkId: string, type?: string, since?: Date): Promise<HotspotRecord[]>;
  logExport(params: {
    userId: string;
    exportType: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryParams: any;
  }): Promise<ExportAuditRecord>;
  close?(): Promise<void>;
}

export function createAnalyticsRepository(url: string): AnalyticsRepository {
  const sql = postgres(url, { max: 5, prepare: false, connect_timeout: 15 });

  return {
    async getHotspots(parkId, type, since) {
      // Group incidents by rounded coordinates to create hotspots
      return sql<HotspotRecord[]>`
        SELECT 
          type,
          COUNT(*) as count,
          (ST_AsGeoJSON(ST_Centroid(ST_Collect(location)))::jsonb -> 'coordinates') AS location
        FROM incidents
        WHERE park_id = ${parkId}
          AND location IS NOT NULL
          ${type ? sql`AND type = ${type}` : sql``}
          ${since ? sql`AND reported_at >= ${since}` : sql``}
        GROUP BY type, ST_SnapToGrid(location, 0.01)
      `;
    },

    async logExport(params) {
      const id = crypto.randomUUID();
      const result = await sql<ExportAuditRecord[]>`
        INSERT INTO export_audits (
          id, user_id, export_type, query_params
        ) VALUES (
          ${id},
          ${params.userId},
          ${params.exportType},
          ${params.queryParams}
        )
        RETURNING id, user_id, export_type, query_params, created_at
      `;
      return result[0];
    },

    async close() {
      await sql.end();
    }
  };
}
