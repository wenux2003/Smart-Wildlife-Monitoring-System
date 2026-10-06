import type { SessionUser } from "../auth/guard.js";
import type { PatrolRepository } from "./repository.js";
import type { PatrolAssignmentSummary } from "./types.js";

export function createPatrolService(repository: PatrolRepository) {
  return {
    async listMine(user: SessionUser): Promise<PatrolAssignmentSummary[]> {
      if (!user.parkId) return [];
      const assignments = await repository.listForRanger(user.id, user.parkId);
      return assignments.map((assignment) => ({
        id: assignment.id,
        status: assignment.status,
        assignedAt: assignment.assigned_at.toISOString(),
        route: {
          id: assignment.route_id,
          name: assignment.route_name,
          sector: assignment.sector,
          description: assignment.description,
          estimatedDistanceKm: assignment.estimated_distance_m / 1000,
          version: assignment.route_version,
          path: assignment.route_path,
        },
        coveragePercentage: assignment.coverage_percentage,
        completedAt: assignment.completed_at?.toISOString() ?? null,
      }));
    },
  };
}
