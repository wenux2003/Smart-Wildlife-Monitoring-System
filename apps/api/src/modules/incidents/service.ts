import type { SessionUser } from "../auth/guard.js";
import type { IncidentRepository } from "./repository.js";
import { IncidentStatus } from "@wr/shared";

export function createIncidentService(repository: IncidentRepository) {
  return {
    async listIncidents(user: SessionUser) {
      if (!user.parkId) return [];
      const records = await repository.listIncidents(user.parkId);
      return records.map(r => ({
        id: r.id,
        parkId: r.park_id,
        reporterId: r.reporter_id,
        type: r.type,
        status: r.status as IncidentStatus,
        description: r.description,
        location: r.location ? undefined : null, // Need proper parsing for geometry in a real scenario
        photoUrl: r.photo_url,
        reportedAt: r.reported_at.toISOString(),
        createdAt: r.created_at.toISOString(),
        updatedAt: r.updated_at.toISOString(),
      }));
    },
    
    async reportIncident(user: SessionUser | null, params: {
      parkId: string;
      type: string;
      description: string;
      location?: [number, number];
      photoUrl?: string;
    }) {
      // If user is null, this is a community/SMS report. We assume parkId is provided.
      // If user is present, they are a Ranger, and we use their parkId.
      const parkId = user?.parkId ?? params.parkId;
      if (!parkId) throw new Error("Park ID is required");

      const incident = await repository.createIncident({
        parkId,
        reporterId: user?.id,
        type: params.type,
        status: IncidentStatus.NEW,
        description: params.description,
        location: params.location,
        photoUrl: params.photoUrl,
      });

      return incident; // Map properly if needed
    },

    async updateStatus(user: SessionUser, incidentId: string, status: IncidentStatus) {
      if (!user.parkId) throw new Error("Unauthorized");
      const incident = await repository.updateIncidentStatus(incidentId, status);
      if (!incident) throw new Error("Incident not found");
      return incident;
    },

    async reviewIncident(user: SessionUser, incidentId: string, notes: string) {
      if (!user.parkId || !user.id) throw new Error("Unauthorized");
      const review = await repository.addReview({
        incidentId,
        reviewerId: user.id,
        notes,
      });
      return review;
    },
    
    async listReviews(user: SessionUser, incidentId: string) {
      if (!user.parkId) return [];
      const reviews = await repository.listReviews(incidentId);
      return reviews.map(r => ({
        id: r.id,
        incidentId: r.incident_id,
        reviewerId: r.reviewer_id,
        notes: r.notes,
        createdAt: r.created_at.toISOString(),
      }));
    }
  };
}
