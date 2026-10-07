import postgres from "postgres";
import type { AlertRecord, CollarRecord, CollarPingRecord, AlertDispatchRecord } from "./types.js";
import { AlertStatus, DispatchStatus } from "@wr/shared";

export interface AlertRepository {
  listAlertsForPark(parkId: string): Promise<AlertRecord[]>;
  getAlertById(alertId: string): Promise<AlertRecord | null>;
  createAlert(alert: Partial<AlertRecord>): Promise<AlertRecord>;
  updateAlertStatus(alertId: string, status: AlertStatus, resolvedAt?: Date): Promise<AlertRecord | null>;
  
  createPing(ping: Partial<CollarPingRecord>): Promise<CollarPingRecord>;
  getCollarById(collarId: string): Promise<CollarRecord | null>;
  
  createDispatch(dispatch: Partial<AlertDispatchRecord>): Promise<AlertDispatchRecord>;
  updateDispatchStatus(dispatchId: string, status: DispatchStatus, notes?: string): Promise<AlertDispatchRecord | null>;
  
  listCollarsForPark(parkId: string): Promise<(CollarRecord & { location: [number, number] | null })[]>;
  getCollarPings(collarId: string, limit?: number): Promise<CollarPingRecord[]>;

  listDispatchesForRanger(rangerId: string): Promise<AlertDispatchRecord[]>;
  getParkConfig(parkId: string): Promise<any>;
  getActiveAlertForCollar(collarId: string, type: string): Promise<AlertRecord | null>;
  getCollarsWithLostSignal(thresholdMinutes: number): Promise<CollarRecord[]>;
  getTimedOutDispatches(timeoutMinutes: number): Promise<AlertDispatchRecord[]>;

  close?(): Promise<void>;
}

export function createAlertRepository(url: string): AlertRepository {
  const sql = postgres(url, { max: 5, prepare: false, connect_timeout: 15 });

  return {
    async listAlertsForPark(parkId) {
      return sql<AlertRecord[]>`
        SELECT 
          id, park_id, collar_id, type, severity, status, 
          (ST_AsGeoJSON(location)::jsonb -> 'coordinates') AS location,
          created_at, resolved_at
        FROM alerts 
        WHERE park_id = ${parkId}
        ORDER BY created_at DESC
      `;
    },
    async getAlertById(alertId) {
      const result = await sql<AlertRecord[]>`
        SELECT 
          id, park_id, collar_id, type, severity, status, 
          (ST_AsGeoJSON(location)::jsonb -> 'coordinates') AS location,
          created_at, resolved_at
        FROM alerts 
        WHERE id = ${alertId}
      `;
      return result.length > 0 ? result[0] : null;
    },
    async createAlert(alert) {
      const result = await sql<AlertRecord[]>`
        INSERT INTO alerts (
          park_id, collar_id, type, severity, status, location
        ) VALUES (
          ${alert.park_id as string},
          ${alert.collar_id || null},
          ${alert.type as string},
          ${alert.severity as string},
          ${alert.status as string},
          ST_SetSRID(ST_MakePoint(${alert.location![0]}, ${alert.location![1]}), 4326)
        )
        RETURNING 
          id, park_id, collar_id, type, severity, status, 
          (ST_AsGeoJSON(location)::jsonb -> 'coordinates') AS location,
          created_at, resolved_at
      `;
      return result[0];
    },
    async updateAlertStatus(alertId, status, resolvedAt) {
      const result = await sql<AlertRecord[]>`
        UPDATE alerts 
        SET status = ${status as string},
            resolved_at = COALESCE(${resolvedAt || null}, resolved_at)
        WHERE id = ${alertId}
        RETURNING 
          id, park_id, collar_id, type, severity, status, 
          (ST_AsGeoJSON(location)::jsonb -> 'coordinates') AS location,
          created_at, resolved_at
      `;
      return result.length > 0 ? result[0] : null;
    },
    async createPing(ping) {
      const result = await sql<CollarPingRecord[]>`
        INSERT INTO collar_pings (
          collar_id, location, speed, battery
        ) VALUES (
          ${ping.collar_id as string},
          ST_SetSRID(ST_MakePoint(${ping.location![0]}, ${ping.location![1]}), 4326),
          ${ping.speed || null},
          ${ping.battery || null}
        )
        RETURNING 
          id, collar_id, speed, battery, recorded_at,
          (ST_AsGeoJSON(location)::jsonb -> 'coordinates') AS location
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
    async createDispatch(dispatch) {
      const result = await sql<AlertDispatchRecord[]>`
        INSERT INTO alert_dispatches (
          alert_id, ranger_id, status, notes
        ) VALUES (
          ${dispatch.alert_id as string},
          ${dispatch.ranger_id as string},
          ${dispatch.status as string},
          ${dispatch.notes || null}
        )
        RETURNING 
          id, alert_id, ranger_id, status, notes, sent_at, responded_at, arrived_at, completed_at
      `;
      return result[0];
    },
    async updateDispatchStatus(dispatchId, status, notes) {
      const result = await sql<AlertDispatchRecord[]>`
        UPDATE alert_dispatches 
        SET status = ${status as string},
            notes = COALESCE(${notes || null}, notes),
            responded_at = CASE WHEN ${status as string} IN ('ACCEPTED', 'REJECTED') AND responded_at IS NULL THEN NOW() ELSE responded_at END,
            arrived_at = CASE WHEN ${status as string} = 'ARRIVED' AND arrived_at IS NULL THEN NOW() ELSE arrived_at END,
            completed_at = CASE WHEN ${status as string} = 'COMPLETED' AND completed_at IS NULL THEN NOW() ELSE completed_at END
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
      return sql<AlertDispatchRecord[]>`
        SELECT 
          id, alert_id, ranger_id, status, notes, sent_at, responded_at, arrived_at, completed_at
        FROM alert_dispatches 
        WHERE ranger_id = ${rangerId}
        ORDER BY sent_at DESC
      `;
    },
    async getParkConfig(parkId: string) {
      const result = await sql<{ config: any }[]>`
        SELECT config
        FROM parks 
        WHERE id = ${parkId}
      `;
      return result.length > 0 ? result[0].config : {};
    },
    async getActiveAlertForCollar(collarId: string, type: string) {
      const result = await sql<AlertRecord[]>`
        SELECT 
          id, park_id, collar_id, type, severity, status, 
          (ST_AsGeoJSON(location)::jsonb -> 'coordinates') AS location,
          created_at, resolved_at
        FROM alerts 
        WHERE collar_id = ${collarId} 
          AND type = ${type} 
          AND status NOT IN ('RESOLVED', 'FALSE_ALARM')
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
    async close() {
      await sql.end();
    }
  };
}
