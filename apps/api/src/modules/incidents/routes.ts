import type { FastifyInstance } from "fastify";
import { z } from "zod";
import * as S from "@wr/shared";
import { AppError } from "../../core/errors.js";
import type { Clock } from "../../core/clock.js";
import type { IncidentRepository } from "./repository.js";
import { createIncidentService } from "./service.js";
export type IncidentOptions = {
  repository?: IncidentRepository;
  clock?: Clock;
};
const params = z.object({ id: z.string().uuid() });
export async function incidentRoutes(
  app: FastifyInstance,
  options: IncidentOptions,
) {
  const service = options.repository
    ? createIncidentService(options.repository, options.clock)
    : undefined;
  const use = () => {
    if (!service)
      throw new AppError(
        "Incident service is not configured.",
        503,
        "INCIDENT_UNAVAILABLE",
      );
    return service;
  };
  const readers = app.authorize({
    roles: [S.Role.RANGER, S.Role.PARK_MANAGER, S.Role.LIAISON_OFFICER],
  });
  const operators = app.authorize({
    roles: [S.Role.PARK_MANAGER, S.Role.LIAISON_OFFICER],
  });
  // Session mutations are same-origin. Public community endpoints are deliberately unauthenticated.
  app.addHook("onRequest", async (req, reply) => {
    reply.header("Cache-Control", "no-store");
    if (req.method === "GET" || !req.headers.origin) return;
    const allowed = (
      process.env.APP_ORIGINS ?? "http://localhost:5173,http://localhost:5174"
    )
      .split(",")
      .map((s) => s.trim());
    if (!allowed.includes(req.headers.origin))
      throw new AppError(
        "This origin is not allowed.",
        403,
        "ORIGIN_FORBIDDEN",
      );
  });
  app.get(
    "/incidents",
    {
      preHandler: readers,
      schema: { response: { 200: S.IncidentListSchema } },
    },
    (req) => use().listIncidents(req.user!),
  );
  app.post<{ Body: S.IncidentCreate }>(
    "/incidents",
    {
      preHandler: app.authorize({ roles: [S.Role.RANGER] }),
      schema: {
        body: S.IncidentCreateSchema,
        response: { 200: S.IncidentSchema },
      },
    },
    (req) => use().reportIncident(req.user!, req.body),
  );
  app.get<{ Params: { id: string } }>(
    "/incidents/:id",
    {
      preHandler: readers,
      schema: { params, response: { 200: S.IncidentDetailSchema } },
    },
    (req) => use().detail(req.user!, req.params.id),
  );
  app.get<{ Params: { id: string } }>(
    "/incidents/:id/history",
    {
      preHandler: readers,
      schema: { params, response: { 200: z.array(S.IncidentEventSchema) } },
    },
    async (req) => (await use().detail(req.user!, req.params.id)).history,
  );
  app.post<{
    Params: { id: string };
    Body: z.infer<typeof S.IncidentMediaCreateSchema>;
  }>(
    "/incidents/:id/media",
    {
      preHandler: readers,
      schema: {
        params,
        body: S.IncidentMediaCreateSchema,
        response: { 200: S.IncidentMediaSchema },
      },
    },
    (req) => use().media(req.user!, req.params.id, req.body),
  );
  for (const method of ["POST", "PATCH"] as const)
    app.route<{
      Params: { id: string };
      Body: z.infer<typeof S.IncidentStatusUpdateSchema>;
    }>({
      method,
      url: "/incidents/:id/status",
      preHandler: operators,
      schema: {
        params,
        body: S.IncidentStatusUpdateSchema,
        response: { 200: S.IncidentSchema },
      },
      handler: (req) => use().updateStatus(req.user!, req.params.id, req.body),
    });
  app.patch<{
    Params: { id: string };
    Body: z.infer<typeof S.IncidentLocationUpdateSchema>;
  }>(
    "/incidents/:id/location",
    {
      preHandler: operators,
      schema: {
        params,
        body: S.IncidentLocationUpdateSchema,
        response: { 200: S.IncidentSchema },
      },
    },
    (req) => use().location(req.user!, req.params.id, req.body),
  );
  app.post<{
    Params: { id: string };
    Body: z.infer<typeof S.IncidentAssignSchema>;
  }>(
    "/incidents/:id/assign",
    {
      preHandler: operators,
      schema: {
        params,
        body: S.IncidentAssignSchema,
        response: { 200: S.IncidentSchema },
      },
    },
    (req) => use().assign(req.user!, req.params.id, req.body),
  );
  app.post<{
    Params: { id: string };
    Body: z.infer<typeof S.IncidentResponseSchema>;
  }>(
    "/incidents/:id/response",
    {
      preHandler: operators,
      schema: {
        params,
        body: S.IncidentResponseSchema,
        response: { 200: S.IncidentSchema },
      },
    },
    (req) => use().response(req.user!, req.params.id, req.body),
  );
  app.get(
    "/incidents/responders",
    {
      preHandler: operators,
      schema: { response: { 200: z.array(S.ResponderSchema) } },
    },
    (req) => use().responders(req.user!),
  );
  app.post<{ Params: { id: string }; Body: { notes: string } }>(
    "/incidents/:id/reviews",
    {
      preHandler: operators,
      schema: {
        params,
        body: z.object({ notes: z.string().trim().min(1).max(4000) }).strict(),
        response: { 200: z.object({ ok: z.boolean() }) },
      },
    },
    (req) => use().reviewIncident(req.user!, req.params.id, req.body.notes),
  );
  app.get<{ Params: { id: string } }>(
    "/incidents/:id/reviews",
    {
      preHandler: readers,
      schema: { params, response: { 200: z.array(S.IncidentEventSchema) } },
    },
    async (req) => (await use().detail(req.user!, req.params.id)).history,
  );
  app.get(
    "/community/parks",
    { schema: { response: { 200: z.array(S.PublicParkSchema) } } },
    () => use().parks(),
  );
  // Intake replies contain no reporter contact details or staff-only history.
  const receipt = z.object({
    id: z.string().uuid(),
    status: S.IncidentSchema.shape.status,
    locationStatus: S.LocationStatusSchema,
  });
  for (const url of ["/community/reports", "/incidents/community"])
    app.post<{ Body: z.infer<typeof S.CommunityReportSchema> }>(
      url,
      { schema: { body: S.CommunityReportSchema, response: { 200: receipt } } },
      async (req) => {
        const r = await use().community(req.body);
        return { id: r.id, status: r.status, locationStatus: r.locationStatus };
      },
    );
  app.post<{ Body: z.infer<typeof S.CommunitySmsSchema> }>(
    "/community/sms",
    { schema: { body: S.CommunitySmsSchema, response: { 200: receipt } } },
    async (req) => {
      const r = await use().community(req.body);
      return { id: r.id, status: r.status, locationStatus: r.locationStatus };
    },
  );
  app.post<{
    Params: { id: string };
    Body: z.infer<typeof S.CommunityFollowUpSchema>;
  }>(
    "/community/messages/:id/follow-up",
    {
      preHandler: operators,
      schema: {
        params,
        body: S.CommunityFollowUpSchema,
        response: { 200: S.CommunityFollowUpRecordSchema },
      },
    },
    (req) => use().followUp(req.user!, req.params.id, req.body),
  );
  app.get(
    "/camera-images",
    {
      preHandler: operators,
      schema: { response: { 200: z.array(S.CameraImageSchema) } },
    },
    (req) => use().cameras(req.user!),
  );
  app.post<{ Body: z.infer<typeof S.CameraCreateSchema> }>(
    "/camera-images",
    {
      preHandler: operators,
      schema: {
        body: S.CameraCreateSchema,
        response: { 200: S.CameraImageSchema },
      },
    },
    (req) => use().createCamera(req.user!, req.body),
  );
  app.patch<{
    Params: { id: string };
    Body: z.infer<typeof S.CameraReviewUpdateSchema>;
  }>(
    "/camera-images/:id/review",
    {
      preHandler: operators,
      schema: {
        params,
        body: S.CameraReviewUpdateSchema,
        response: { 200: S.CameraImageSchema },
      },
    },
    (req) => use().reviewCamera(req.user!, req.params.id, req.body),
  );
}
