import postgres from "postgres";
import type { PatrolSyncRequest, PatrolSyncResponse } from "@wr/shared";
import type { PatrolAssignmentRecord } from "./types.js";

export interface PatrolRepository {
  listForRanger(rangerId: string, parkId: string): Promise<PatrolAssignmentRecord[]>;
  syncPatrol(
    rangerId: string,
    parkId: string,
    payload: PatrolSyncRequest,
  ): Promise<PatrolSyncResponse | null>;
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
    async syncPatrol(rangerId, parkId, payload) {
      return sql.begin(async (tx) => {
        const [assignment] = await tx`
          SELECT a.id
          FROM patrol_assignments a
          JOIN patrol_routes r ON r.id = a.route_id
          WHERE a.id = ${payload.patrolSession.assignmentId}
            AND a.ranger_id = ${rangerId}
            AND r.park_id = ${parkId}
            AND r.id = ${payload.patrolSession.routeId}
            AND a.status <> 'CANCELLED'
          FOR UPDATE`;
        if (!assignment) return null;

        const session = payload.patrolSession;
        const [existingSession] = await tx`
          SELECT assignment_id
          FROM patrol_sessions
          WHERE id = ${session.id}`;
        if (existingSession && existingSession.assignment_id !== session.assignmentId)
          return null;
        await tx`
          INSERT INTO patrol_sessions
            (id, assignment_id, status, started_at, ended_at, distance_m)
          VALUES
            (${session.id}, ${session.assignmentId}, ${session.status},
             ${session.startedAt}, ${session.endedAt}, ${session.distanceM})
          ON CONFLICT (id) DO UPDATE SET
            status = EXCLUDED.status,
            ended_at = EXCLUDED.ended_at,
            distance_m = GREATEST(patrol_sessions.distance_m, EXCLUDED.distance_m),
            revision = patrol_sessions.revision + 1
          WHERE patrol_sessions.assignment_id = EXCLUDED.assignment_id`;

        for (const point of payload.gpsLogs) {
          await tx`
            INSERT INTO patrol_gps_points
              (client_record_id, session_id, position, accuracy_m, recorded_at)
            VALUES
              (${point.clientRecordId}, ${session.id},
               ST_SetSRID(ST_MakePoint(${point.longitude}, ${point.latitude}), 4326),
               ${point.accuracyM}, ${point.recordedAt})
            ON CONFLICT (client_record_id) DO NOTHING`;
        }

        for (const waypoint of payload.waypoints) {
          await tx`
            INSERT INTO patrol_waypoints
              (client_record_id, session_id, category, note, photo_name,
               position, accuracy_m, observed_at)
            VALUES
              (${waypoint.clientRecordId}, ${session.id}, ${waypoint.category},
               ${waypoint.note}, ${waypoint.photoName},
               ST_SetSRID(ST_MakePoint(${waypoint.longitude}, ${waypoint.latitude}), 4326),
               ${waypoint.accuracyM}, ${waypoint.observedAt})
            ON CONFLICT (client_record_id) DO NOTHING`;
        }

        await tx`
          UPDATE patrol_assignments
          SET status = ${session.status}, revision = revision + 1
          WHERE id = ${session.assignmentId}`;

        return {
          sessionId: session.id,
          clientRevision: session.clientRevision,
          syncedGpsRecordIds: payload.gpsLogs.map((point) => point.clientRecordId),
          syncedWaypointRecordIds: payload.waypoints.map((waypoint) => waypoint.clientRecordId),
          status: session.status,
        };
      });
    },
    async close() {
      await sql.end();
    },
  };
}
