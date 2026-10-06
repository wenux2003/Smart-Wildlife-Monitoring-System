import postgres from "postgres";
import type { PatrolAssignmentRecord } from "./types.js";

export interface PatrolRepository {
  listForRanger(rangerId: string, parkId: string): Promise<PatrolAssignmentRecord[]>;
  close?(): Promise<void>;
}

export function createPatrolRepository(url: string): PatrolRepository {
  const sql = postgres(url, { max: 5, prepare: false, connect_timeout: 15 });

  return {
    async listForRanger(rangerId, parkId) {
      return sql<PatrolAssignmentRecord[]>`
        SELECT
          a.id,
          a.status,
          a.assigned_at,
          r.id AS route_id,
          r.name AS route_name,
          r.sector,
          r.description,
          r.estimated_distance_m,
          a.route_version,
          (ST_AsGeoJSON(r.route_geometry)::jsonb -> 'coordinates') AS route_path,
          COALESCE(s.coverage_percent, 0)::double precision AS coverage_percentage,
          s.ended_at AS completed_at
        FROM patrol_assignments a
        JOIN patrol_routes r ON r.id = a.route_id
        LEFT JOIN patrol_sessions s ON s.assignment_id = a.id
        WHERE a.ranger_id = ${rangerId}
          AND r.park_id = ${parkId}
          AND a.status <> 'CANCELLED'
          AND r.active = true
        ORDER BY
          CASE a.status
            WHEN 'ACTIVE' THEN 0
            WHEN 'ASSIGNED' THEN 1
            WHEN 'PARTIAL' THEN 2
            WHEN 'COMPLETED' THEN 3
            ELSE 4
          END,
          a.assigned_at DESC`;
    },
    async close() {
      await sql.end();
    },
  };
}
