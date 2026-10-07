import postgres from "postgres";
import crypto from "node:crypto";
import type { IncidentStatus } from "@wr/shared";
import type { IncidentRecord, IncidentReviewRecord } from "./types.js";

export interface IncidentRepository {
  createIncident(params: {
    parkId: string;
    reporterId?: string;
    type: string;
    status: IncidentStatus;
    description: string;
    location?: [number, number];
    photoUrl?: string;
  }): Promise<IncidentRecord>;
  
  listIncidents(parkId: string): Promise<IncidentRecord[]>;
  getIncident(id: string): Promise<IncidentRecord | null>;
  updateIncidentStatus(id: string, status: IncidentStatus): Promise<IncidentRecord | null>;
  
  addReview(params: {
    incidentId: string;
    reviewerId: string;
    notes: string;
  }): Promise<IncidentReviewRecord>;
  
  listReviews(incidentId: string): Promise<IncidentReviewRecord[]>;
  
  close?(): Promise<void>;
}

export function createIncidentRepository(url: string): IncidentRepository {
  const sql = postgres(url, { max: 5, prepare: false, connect_timeout: 15 });

  return {
    async createIncident(params) {
      const id = crypto.randomUUID();
      const result = await sql<IncidentRecord[]>`
        INSERT INTO incidents (
          id, park_id, reporter_id, type, status, description, location, photo_url
        ) VALUES (
          ${id},
          ${params.parkId},
          ${params.reporterId || null},
          ${params.type},
          ${params.status},
          ${params.description},
          ${params.location ? sql`ST_SetSRID(ST_MakePoint(${params.location[0]}, ${params.location[1]}), 4326)` : null},
          ${params.photoUrl || null}
        )
        RETURNING 
          id, park_id, reporter_id, type, status, description, 
          (ST_AsGeoJSON(location)::jsonb -> 'coordinates') AS location,
          photo_url, reported_at, created_at, updated_at
      `;
      return result[0];
    },

    async listIncidents(parkId) {
      return sql<IncidentRecord[]>`
        SELECT 
          id, park_id, reporter_id, type, status, description, 
          (ST_AsGeoJSON(location)::jsonb -> 'coordinates') AS location,
          photo_url, reported_at, created_at, updated_at
        FROM incidents
        WHERE park_id = ${parkId}
        ORDER BY reported_at DESC
      `;
    },
    
    async getIncident(id) {
      const result = await sql<IncidentRecord[]>`
        SELECT 
          id, park_id, reporter_id, type, status, description, 
          (ST_AsGeoJSON(location)::jsonb -> 'coordinates') AS location,
          photo_url, reported_at, created_at, updated_at
        FROM incidents
        WHERE id = ${id}
      `;
      return result.length > 0 ? result[0] : null;
    },

    async updateIncidentStatus(id, status) {
      const result = await sql<IncidentRecord[]>`
        UPDATE incidents
        SET status = ${status as string}, updated_at = NOW()
        WHERE id = ${id}
        RETURNING 
          id, park_id, reporter_id, type, status, description, 
          (ST_AsGeoJSON(location)::jsonb -> 'coordinates') AS location,
          photo_url, reported_at, created_at, updated_at
      `;
      return result.length > 0 ? result[0] : null;
    },

    async addReview(params) {
      const id = crypto.randomUUID();
      const result = await sql<IncidentReviewRecord[]>`
        INSERT INTO incident_reviews (
          id, incident_id, reviewer_id, notes
        ) VALUES (
          ${id},
          ${params.incidentId},
          ${params.reviewerId},
          ${params.notes}
        )
        RETURNING id, incident_id, reviewer_id, notes, created_at
      `;
      return result[0];
    },

    async listReviews(incidentId) {
      return sql<IncidentReviewRecord[]>`
        SELECT id, incident_id, reviewer_id, notes, created_at
        FROM incident_reviews
        WHERE incident_id = ${incidentId}
        ORDER BY created_at DESC
      `;
    },

    async close() {
      await sql.end();
    }
  };
}
