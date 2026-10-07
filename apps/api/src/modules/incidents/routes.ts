import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { IncidentListSchema, IncidentSchema, IncidentReviewSchema, IncidentReviewListSchema, Role, IncidentStatus } from "@wr/shared";
import { AppError } from "../../core/errors.js";
import type { IncidentRepository } from "./repository.js";
import { createIncidentService } from "./service.js";

export type IncidentOptions = { repository?: IncidentRepository };

export async function incidentRoutes(
  app: FastifyInstance,
  options: IncidentOptions,
) {
  const service = options.repository
    ? createIncidentService(options.repository)
    : undefined;

  const requireService = () => {
    if (!service)
      throw new AppError(
        "Incident service is not configured.",
        503,
        "INCIDENT_UNAVAILABLE",
      );
    return service;
  };

  app.get(
    "/incidents",
    {
      preHandler: app.authorize({ roles: [Role.PARK_MANAGER, Role.LIAISON_OFFICER, Role.RANGER] }),
      schema: { response: { 200: IncidentListSchema } },
    },
    async (request) => requireService().listIncidents(request.user!),
  );

  app.post(
    "/incidents",
    {
      preHandler: app.authorize({ roles: [Role.RANGER] }),
      schema: {
        body: z.object({
          type: z.string(),
          description: z.string(),
          location: z.tuple([z.number(), z.number()]).optional(),
          photoUrl: z.string().optional(),
        }),
        response: { 200: z.any() }, // should be IncidentSchema ideally but keeping any for now
      },
    },
    async (request) => {
      const body = request.body as any;
      return requireService().reportIncident(request.user!, body);
    },
  );

  // Community intake (no auth required)
  app.post(
    "/incidents/community",
    {
      schema: {
        body: z.object({
          parkId: z.string().uuid(),
          type: z.string(),
          description: z.string(),
          location: z.tuple([z.number(), z.number()]).optional(),
          photoUrl: z.string().optional(),
        }),
        response: { 200: z.any() },
      },
    },
    async (request) => {
      const body = request.body as any;
      return requireService().reportIncident(null, body);
    },
  );

  app.post(
    "/incidents/:id/status",
    {
      preHandler: app.authorize({ roles: [Role.PARK_MANAGER, Role.LIAISON_OFFICER] }),
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: z.object({ status: z.nativeEnum(IncidentStatus) }),
        response: { 200: z.any() },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const { status } = request.body as { status: IncidentStatus };
      return requireService().updateStatus(request.user!, id, status);
    },
  );

  app.post(
    "/incidents/:id/reviews",
    {
      preHandler: app.authorize({ roles: [Role.PARK_MANAGER, Role.LIAISON_OFFICER] }),
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: z.object({ notes: z.string() }),
        response: { 200: IncidentReviewSchema },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const { notes } = request.body as { notes: string };
      return requireService().reviewIncident(request.user!, id, notes);
    },
  );

  app.get(
    "/incidents/:id/reviews",
    {
      preHandler: app.authorize({ roles: [Role.PARK_MANAGER, Role.LIAISON_OFFICER, Role.RANGER] }),
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: { 200: IncidentReviewListSchema },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return requireService().listReviews(request.user!, id);
    },
  );
}
