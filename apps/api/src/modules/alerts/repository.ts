import postgres from "postgres";
import { randomUUID } from "node:crypto";
import type { AlertRecord, CollarRecord, CollarPingRecord, AlertDispatchRecord } from "./types.js";
import { AlertStatus, DispatchStatus } from "@wr/shared";

// Valid state transitions for dispatches (current → allowed next states)
const DISPATCH_TRANSITIONS: Record<DispatchStatus, DispatchStatus[]> = {
  [DispatchStatus.PENDING]:   [DispatchStatus.ACCEPTED, DispatchStatus.REJECTED, DispatchStatus.TIMED_OUT, DispatchStatus.CANCELLED],
  [DispatchStatus.ACCEPTED]:  [DispatchStatus.ARRIVED,  DispatchStatus.TIMED_OUT, DispatchStatus.CANCELLED],
  [DispatchStatus.ARRIVED]:   [DispatchStatus.DONE,     DispatchStatus.CANCELLED],
  [DispatchStatus.REJECTED]:  [],
  [DispatchStatus.TIMED_OUT]: [],
  [DispatchStatus.DONE]:      [],
  [DispatchStatus.CANCELLED]: [],
};

export interface CollarRepository {
  createPing(ping: Partial<CollarPingRecord>): Promise<CollarPingRecord>;
  getCollarById(collarId: string): Promise<CollarRecord | null>;
  getCollarByIdForPark(collarId: string, parkId: string): Promise<CollarRecord | null>;
  listCollarsForPark(parkId: string): Promise<(CollarRecord & { location: [number, number] | null })[]>;
  getCollarPings(collarId: string, limit?: number): Promise<CollarPingRecord[]>;
  getCollarsWithLostSignal(thresholdMinutes: number): Promise<CollarRecord[]>;
}

export interface DispatchRepository {
  createDispatch(dispatch: Partial<AlertDispatchRecord>): Promise<AlertDispatchRecord>;
  getDispatchById(dispatchId: string): Promise<AlertDispatchRecord | null>;
  updateDispatchStatus(dispatchId: string, status: DispatchStatus, rangerId: string, notes?: string): Promise<AlertDispatchRecord | null>;
  listDispatchesForRanger(rangerId: string): Promise<any[]>;
  getTimedOutDispatches(timeoutMinutes: number): Promise<AlertDispatchRecord[]>;
  markDispatchTimedOut(dispatchId: string): Promise<void>;
  getRangerForPark(rangerId: string, parkId: string): Promise<{ id: string } | null>;
  getAvailableRangers(alertId: string, parkId: string): Promise<{ rangerId: string, name: string, distanceM: number | null }[]>;
  cancelOtherPendingDispatches(alertId: string, acceptedDispatchId: string): Promise<void>;
  hasActiveDispatches(alertId: string): Promise<boolean>;
}

export interface ParkRepository {
  getParkConfig(parkId: string): Promise<any>;
  updateParkAlertConfig(parkId: string, alertConfig: any): Promise<any>;
}

export interface AlertRepository extends CollarRepository, DispatchRepository, ParkRepository {
  listAlertsForPark(parkId: string): Promise<AlertRecord[]>;
  getAlertById(alertId: string): Promise<AlertRecord | null>;
  getAlertByIdForPark(alertId: string, parkId: string): Promise<AlertRecord | null>;
  createAlert(alert: Partial<AlertRecord>): Promise<AlertRecord>;
  updateAlertStatus(alertId: string, status: AlertStatus, resolvedAt?: Date): Promise<AlertRecord | null>;
  getActiveAlertForCollar(collarId: string, type: string): Promise<AlertRecord | null>;
  getAlertContext(alertId: string, parkId: string): Promise<{ settlements: any[], cameras: any[], history: any[] }>;
  broadcastAlert(alertId: string, parkId: string): Promise<void>;
  close?(): Promise<void>;
}

export function createAlertRepository(url: string): AlertRepository {
  const sql = postgres(url, { max: 5, prepare: false, connect_timeout: 15 });

  const ALERT_SELECT_COLUMNS = sql`
    id, park_id, collar_id, type, severity, status, 
    (ST_AsGeoJSON(location)::jsonb -> 'coordinates') AS location,
    created_at, resolved_at, resolution_reason, is_broadcast,
    EXISTS (
      SELECT 1 FROM alert_dispatches 
      WHERE alert_id = alerts.id AND status IN ('ACCEPTED', 'ARRIVED')
    ) AS has_active_dispatch
  `;

  return {
    async listAlertsForPark(parkId) {
      return sql<AlertRecord[]>`
        SELECT ${ALERT_SELECT_COLUMNS}
        FROM alerts 
        WHERE park_id = ${parkId}
        ORDER BY created_at DESC
      `;
    },
    async getAlertById(alertId) {
      const result = await sql<AlertRecord[]>`
        SELECT ${ALERT_SELECT_COLUMNS}
        FROM alerts 
        WHERE id = ${alertId}
      `;
      return result.length > 0 ? result[0] : null;
    },
    async getAlertByIdForPark(alertId, parkId) {
      const result = await sql<AlertRecord[]>`
        SELECT ${ALERT_SELECT_COLUMNS}
        FROM alerts 
        WHERE id = ${alertId} AND park_id = ${parkId}
      `;
      return result.length > 0 ? result[0] : null;
    },
    async createAlert(alert) {
      // Support nullable location for SIGNAL_LOST alerts
      const result = await sql<AlertRecord[]>`
        INSERT INTO alerts (
          id, park_id, collar_id, type, severity, status, location
        ) VALUES (
          ${randomUUID()},
          ${alert.park_id as string},
          ${alert.collar_id ?? null},
          ${alert.type as string},
          ${alert.severity as string},
          ${alert.status as string},
          ${alert.location != null
            ? sql`ST_SetSRID(ST_MakePoint(${alert.location[0]}, ${alert.location[1]}), 4326)`
            : sql`NULL`
          }
        )
        RETURNING ${ALERT_SELECT_COLUMNS}
      `;
      return result[0];
    },
    async updateAlertStatus(alertId, status, resolvedAt) {
      const result = await sql<AlertRecord[]>`
        UPDATE alerts 
        SET status = ${status as string},
            resolved_at = COALESCE(${resolvedAt ?? null}, resolved_at)
        WHERE id = ${alertId}
        RETURNING ${ALERT_SELECT_COLUMNS}
      `;
      return result.length > 0 ? result[0] : null;
    },
    async createPing(ping) {
      // Preserve exact values — use null only when the field itself is null/undefined,
      // NOT when it's zero (0 speed/0 battery are valid observations).
      const speed   = ping.speed   ?? null;
      const battery = ping.battery ?? null;
      const recordedAt = ping.recorded_at ?? new Date();

      const result = await sql<CollarPingRecord[]>`
        INSERT INTO collar_pings (
          id, collar_id, location, speed, battery, recorded_at
        ) VALUES (
          ${randomUUID()},
          ${ping.collar_id as string},
          ST_SetSRID(ST_MakePoint(${ping.location![0]}, ${ping.location![1]}), 4326),
          ${speed},
          ${battery},
          ${recordedAt}
        )
        RETURNING 
          id, collar_id, speed, battery, recorded_at,
          (ST_AsGeoJSON(location)::jsonb -> 'coordinates') AS location
      `;

      // Update collar's freshness metadata atomically.
      // Use a CTE to snapshot the OLD last_ping_at BEFORE the update, so both SET clauses
      // (last_ping_at and latest_battery) compare against the same pre-update value.
      // This prevents the bug where last_ping_at is already updated when latest_battery is evaluated.
      await sql`
        WITH old AS (SELECT last_ping_at FROM collars WHERE id = ${ping.collar_id as string})
        UPDATE collars
        SET
          last_ping_at   = CASE WHEN (SELECT last_ping_at FROM old) IS NULL OR ${recordedAt} > (SELECT last_ping_at FROM old) THEN ${recordedAt}  ELSE last_ping_at   END,
          latest_battery = CASE WHEN (SELECT last_ping_at FROM old) IS NULL OR ${recordedAt} > (SELECT last_ping_at FROM old) THEN ${battery}      ELSE latest_battery END
        WHERE id = ${ping.collar_id as string}
      `;

      return result[0];
    },
    async getCollarById(collarId) {
      const result = await sql<CollarRecord[]>`
        SELECT id, park_id, animal_name, species, latest_battery, status, last_ping_at
        FROM collars 
        WHERE id = ${collarId}
      `;
      return result.length > 0 ? result[0] : null;
    },
    async getCollarByIdForPark(collarId, parkId) {
      const result = await sql<CollarRecord[]>`
        SELECT id, park_id, animal_name, species, latest_battery, status, last_ping_at
        FROM collars 
        WHERE id = ${collarId} AND park_id = ${parkId}
      `;
      return result.length > 0 ? result[0] : null;
    },
    async createDispatch(dispatch) {
      const result = await sql<AlertDispatchRecord[]>`
        INSERT INTO alert_dispatches (
          id, alert_id, ranger_id, status, notes
        ) VALUES (
          ${randomUUID()},
          ${dispatch.alert_id as string},
          ${dispatch.ranger_id as string},
          ${dispatch.status as string},
          ${dispatch.notes ?? null}
        )
        RETURNING 
          id, alert_id, ranger_id, status, notes, sent_at, responded_at, arrived_at, completed_at
      `;
      return result[0];
    },
    async getDispatchById(dispatchId) {
      const result = await sql<AlertDispatchRecord[]>`
        SELECT id, alert_id, ranger_id, status, notes, sent_at, responded_at, arrived_at, completed_at
        FROM alert_dispatches
        WHERE id = ${dispatchId}
      `;
      return result.length > 0 ? result[0] : null;
    },
    async updateDispatchStatus(dispatchId, status, rangerId, notes) {
      // Load current dispatch to validate ownership and transition
      const current = await sql<AlertDispatchRecord[]>`
        SELECT id, alert_id, ranger_id, status, notes, sent_at, responded_at, arrived_at, completed_at
        FROM alert_dispatches
        WHERE id = ${dispatchId}
      `;
      if (current.length === 0) return null;
      const dispatch = current[0];

      // Ownership: ranger can only update their own dispatch
      if (dispatch.ranger_id !== rangerId) return null;

      // Validate state transition
      const allowed = DISPATCH_TRANSITIONS[dispatch.status as DispatchStatus] ?? [];
      if (!allowed.includes(status)) {
        throw new Error(
          `Invalid status transition from ${dispatch.status} to ${status}`
        );
      }

      const result = await sql<AlertDispatchRecord[]>`
        UPDATE alert_dispatches 
        SET status      = ${status as string},
            notes       = COALESCE(${notes ?? null}, notes),
            responded_at = CASE WHEN ${status as string} IN ('ACCEPTED', 'REJECTED') AND responded_at IS NULL THEN NOW() ELSE responded_at END,
            arrived_at   = CASE WHEN ${status as string} = 'ARRIVED'  AND arrived_at  IS NULL THEN NOW() ELSE arrived_at   END,
            completed_at = CASE WHEN ${status as string} = 'DONE'     AND completed_at IS NULL THEN NOW() ELSE completed_at END
        WHERE id = ${dispatchId}
        RETURNING 
          id, alert_id, ranger_id, status, notes, sent_at, responded_at, arrived_at, completed_at
      `;
      return result.length > 0 ? result[0] : null;
    },
    async listCollarsForPark(parkId) {
      return sql<(CollarRecord & { location: [number, number] | null })[]>`
        SELECT 
          c.id, c.park_id, c.animal_name, c.species, c.latest_battery, c.status, c.last_ping_at,
          (
            SELECT ST_AsGeoJSON(cp.location)::jsonb -> 'coordinates'
            FROM collar_pings cp
            WHERE cp.collar_id = c.id
            ORDER BY cp.recorded_at DESC
            LIMIT 1
          ) AS location
        FROM collars c
        WHERE c.park_id = ${parkId}
        ORDER BY c.animal_name ASC
      `;
    },
    async getCollarPings(collarId, limit = 50) {
      return sql<CollarPingRecord[]>`
        SELECT 
          id, collar_id, speed, battery, recorded_at,
          (ST_AsGeoJSON(location)::jsonb -> 'coordinates') AS location
        FROM collar_pings 
        WHERE collar_id = ${collarId}
        ORDER BY recorded_at DESC
        LIMIT ${limit}
      `;
    },
    async listDispatchesForRanger(rangerId: string) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return sql<any[]>`
        SELECT 
          d.id, d.alert_id, d.ranger_id, d.status, d.notes, d.sent_at, d.responded_at, d.arrived_at, d.completed_at,
          a.type as alert_type, a.severity as alert_severity, 
          (ST_AsGeoJSON(a.location)::jsonb -> 'coordinates') AS alert_location,
          c.animal_name
        FROM alert_dispatches d
        JOIN alerts a ON a.id = d.alert_id
        LEFT JOIN collars c ON c.id = a.collar_id
        WHERE d.ranger_id = ${rangerId}
        ORDER BY d.sent_at DESC
      `;
    },
    async getParkConfig(parkId: string) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await sql<{ config: any }[]>`
        SELECT config
        FROM parks 
        WHERE id = ${parkId}
      `;
      return result.length > 0 ? result[0].config : {};
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async updateParkAlertConfig(parkId: string, alertConfig: any) {
      // Use a single atomic JSONB merge to avoid the read-modify-write race condition.
      // jsonb_set merges into the existing config column without overwriting sibling keys.
      await sql`
        UPDATE parks 
        SET config = COALESCE(config, '{}'::jsonb) || jsonb_build_object('alerts', ${JSON.stringify(alertConfig)}::jsonb)
        WHERE id = ${parkId}
      `;
      return alertConfig;
    },
    async getActiveAlertForCollar(collarId: string, type: string) {
      const result = await sql<AlertRecord[]>`
        SELECT ${ALERT_SELECT_COLUMNS}
        FROM alerts 
        WHERE collar_id = ${collarId} 
          AND type = ${type} 
          AND status NOT IN ('RESOLVED', 'CANCELLED', 'AUTO_RESOLVED')
        ORDER BY created_at DESC
        LIMIT 1
      `;
      return result.length > 0 ? result[0] : null;
    },
    async getCollarsWithLostSignal(thresholdMinutes: number) {
      return sql<CollarRecord[]>`
        SELECT id, park_id, animal_name, species, latest_battery, status, last_ping_at
        FROM collars 
        WHERE last_ping_at < NOW() - interval '1 minute' * ${thresholdMinutes}
           AND status != 'INACTIVE'
      `;
    },
    async getTimedOutDispatches(timeoutMinutes: number) {
      return sql<AlertDispatchRecord[]>`
        SELECT id, alert_id, ranger_id, status, notes, sent_at, responded_at, arrived_at, completed_at
        FROM alert_dispatches
        WHERE status IN ('PENDING', 'ACCEPTED')
          AND COALESCE(responded_at, sent_at) < NOW() - interval '1 minute' * ${timeoutMinutes}
      `;
    },
    async markDispatchTimedOut(dispatchId: string) {
      // System-level operation — no ranger ownership check, sets TIMED_OUT status
      await sql`
        UPDATE alert_dispatches
        SET status = 'TIMED_OUT',
            responded_at = COALESCE(responded_at, NOW())
        WHERE id = ${dispatchId}
          AND status IN ('PENDING', 'ACCEPTED')
      `;
    },
    async getRangerForPark(rangerId: string, parkId: string) {
      // Validate the target account is an active RANGER in the same park
      const result = await sql<{ id: string }[]>`
        SELECT id
        FROM auth_users
        WHERE id = ${rangerId}
          AND role = 'RANGER'
          AND park_id = ${parkId}
          AND disabled_at IS NULL
        LIMIT 1
      `;
      return result.length > 0 ? result[0] : null;
    },
    async getAlertContext(alertId, parkId) {
      const alert = await this.getAlertByIdForPark(alertId, parkId);
      if (!alert || !alert.location) return { settlements: [], cameras: [], history: [] };
      
      const pt = sql`ST_SetSRID(ST_MakePoint(${alert.location[0]}, ${alert.location[1]}), 4326)`;

      const settlements = await sql<{ name: string, distancem: number }[]>`
        SELECT name, ST_DistanceSphere(location, ${pt}) AS distancem
        FROM settlements
        WHERE park_id = ${parkId} AND ST_DistanceSphere(location, ${pt}) < 25000
        ORDER BY distancem ASC
      `;

      const cameras = await sql<{ name: string, distancem: number }[]>`
        SELECT name, ST_DistanceSphere(location, ${pt}) AS distancem
        FROM camera_traps
        WHERE park_id = ${parkId} AND ST_DistanceSphere(location, ${pt}) < 15000
        ORDER BY distancem ASC
      `;

      const history = await sql<{ timestamp: Date, event: string }[]>`
        SELECT created_at AS timestamp, 'Alert Created' AS event FROM alerts WHERE id = ${alertId}
        UNION ALL
        SELECT sent_at AS timestamp, 'Dispatched to Ranger' AS event FROM alert_dispatches WHERE alert_id = ${alertId}
        UNION ALL
        SELECT responded_at AS timestamp, 'Ranger ' || status AS event FROM alert_dispatches WHERE alert_id = ${alertId} AND responded_at IS NOT NULL
        UNION ALL
        SELECT arrived_at AS timestamp, 'Ranger Arrived' AS event FROM alert_dispatches WHERE alert_id = ${alertId} AND arrived_at IS NOT NULL
        UNION ALL
        SELECT completed_at AS timestamp, 'Ranger ' || status AS event FROM alert_dispatches WHERE alert_id = ${alertId} AND completed_at IS NOT NULL
        ORDER BY timestamp ASC
      `;

      return {
        settlements: settlements.map(s => ({ name: s.name, distanceM: s.distancem })),
        cameras: cameras.map(c => ({ name: c.name, distanceM: c.distancem })),
        history: history.map(h => ({ timestamp: h.timestamp.toISOString(), event: h.event }))
      };
    },
    async getAvailableRangers(alertId, parkId) {
      const alert = await this.getAlertByIdForPark(alertId, parkId);
      const pt = alert?.location ? sql`ST_SetSRID(ST_MakePoint(${alert.location[0]}, ${alert.location[1]}), 4326)` : null;

      if (pt) {
        return sql<{ rangerId: string, name: string, distanceM: number | null }[]>`
          SELECT u.id AS "rangerId", u.name, ST_DistanceSphere(rl.location, ${pt}) AS "distanceM"
          FROM auth_users u
          LEFT JOIN ranger_locations rl ON u.id = rl.ranger_id
          WHERE u.park_id = ${parkId} AND u.role = 'RANGER' AND u.disabled_at IS NULL
          ORDER BY "distanceM" ASC NULLS LAST
        `;
      } else {
        return sql<{ rangerId: string, name: string, distanceM: null }[]>`
          SELECT u.id AS "rangerId", u.name, NULL AS "distanceM"
          FROM auth_users u
          WHERE u.park_id = ${parkId} AND u.role = 'RANGER' AND u.disabled_at IS NULL
          ORDER BY u.name ASC
        `;
      }
    },
    async broadcastAlert(alertId, parkId) {
      // Mark as broadcast and set status to DISPATCHED (since dispatches are being created)
      await sql`
        UPDATE alerts
        SET is_broadcast = true, status = 'DISPATCHED'
        WHERE id = ${alertId} AND park_id = ${parkId}
      `;
      // Create pending dispatches for all active rangers in the park
      await sql`
        INSERT INTO alert_dispatches (id, alert_id, ranger_id, status)
        SELECT gen_random_uuid(), ${alertId}, id, 'PENDING'
        FROM auth_users
        WHERE park_id = ${parkId} AND role = 'RANGER' AND disabled_at IS NULL
      `;
    },
    async cancelOtherPendingDispatches(alertId, acceptedDispatchId) {
      // When one ranger accepts a broadcast, cancel the other pending ones
      await sql`
        UPDATE alert_dispatches
        SET status = 'CANCELLED', responded_at = NOW()
        WHERE alert_id = ${alertId} 
          AND id != ${acceptedDispatchId}
          AND status = 'PENDING'
      `;
    },
    async hasActiveDispatches(alertId) {
      const res = await sql`
        SELECT 1 FROM alert_dispatches 
        WHERE alert_id = ${alertId} 
          AND status IN ('PENDING', 'ACCEPTED', 'ARRIVED') 
        LIMIT 1
      `;
      return res.length > 0;
    },
    async close() {
      await sql.end();
    }
  };
}
