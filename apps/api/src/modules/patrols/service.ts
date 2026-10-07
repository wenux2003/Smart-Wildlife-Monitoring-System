import type { SessionUser } from "../auth/guard.js";
import type { PatrolSyncRequest, PatrolSyncResponse } from "@wr/shared";
import { SessionStatus } from "@wr/shared";
import { AppError } from "../../core/errors.js";
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
    async sync(
      user: SessionUser,
      payload: PatrolSyncRequest,
    ): Promise<PatrolSyncResponse> {
      if (!user.parkId || payload.patrolSession.rangerId !== user.id)
        throw new AppError("This patrol does not belong to your account.", 403, "FORBIDDEN");
      const completed = payload.patrolSession.status !== SessionStatus.ACTIVE;
      if (completed !== Boolean(payload.patrolSession.endedAt))
        throw new AppError("Patrol completion time does not match its status.", 400, "INVALID_PATROL_STATE");
      const result = await repository.syncPatrol(user.id, user.parkId, payload);
      if (!result)
        throw new AppError("Patrol assignment was not found.", 404, "PATROL_NOT_FOUND");
      return result;
    },
  };
}
