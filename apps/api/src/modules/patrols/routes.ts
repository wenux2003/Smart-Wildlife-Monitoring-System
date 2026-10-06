import type { FastifyInstance } from "fastify";
import { PatrolAssignmentSummaryListSchema, Role } from "@wr/shared";
import { AppError } from "../../core/errors.js";
import type { PatrolRepository } from "./repository.js";
import { createPatrolService } from "./service.js";

export type PatrolOptions = { repository?: PatrolRepository };

export async function patrolRoutes(
  app: FastifyInstance,
  options: PatrolOptions,
) {
  const service = options.repository
    ? createPatrolService(options.repository)
    : undefined;
  const requireService = () => {
    if (!service)
      throw new AppError(
        "Patrol service is not configured.",
        503,
        "PATROL_UNAVAILABLE",
      );
    return service;
  };

  app.get(
    "/patrol-assignments/mine",
    {
      preHandler: app.authorize({ roles: [Role.RANGER] }),
      schema: { response: { 200: PatrolAssignmentSummaryListSchema } },
    },
    async (request) => requireService().listMine(request.user!),
  );
}
