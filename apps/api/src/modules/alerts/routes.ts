import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AlertListSchema, AlertSchema, AlertDispatchSchema, AlertDispatchListSchema, CollarListSchema, CollarPingListSchema, Role, AlertContextSchema, RangerDistanceSchema } from "@wr/shared";
import { AppError } from "../../core/errors.js";
import type { AlertRepository } from "./repository.js";
import { createAlertService } from "./service.js";
import { PingProcessor } from "./processor.js";

export type AlertOptions = { repository?: AlertRepository };

export async function alertRoutes(
  app: FastifyInstance,
  options: AlertOptions,
) {
  const service = options.repository
    ? createAlertService(options.repository)
    : undefined;

  const requireService = () => {
    if (!service)
      throw new AppError(
        "Alert service is not configured.",
        503,
        "ALERT_UNAVAILABLE",
      );
    return service;
  };

  if (service) {
    // Isolate each job so one failure does not prevent the other from running (M3-5)
    const interval = setInterval(() => {
      service.checkLostSignals().catch((e: unknown) =>
        app.log.error(e, "checkLostSignals failed:")
      );
      service.checkTimeouts().catch((e: unknown) =>
        app.log.error(e, "checkTimeouts failed:")
      );
    }, 60_000); // every minute

    app.addHook("onClose", (instance, done) => {
      clearInterval(interval);
      done();
    });
  }

  // ── Ops: alert management ────────────────────────────────────────────────

  app.get(
    "/alerts",
    {
      preHandler: app.authorize({ roles: [Role.PARK_MANAGER] }),
      schema: { response: { 200: AlertListSchema } },
    },
    async (request) => requireService().listAlerts(request.user!),
  );

  app.post(
    "/alerts/:id/acknowledge",
    {
      preHandler: app.authorize({ roles: [Role.PARK_MANAGER] }),
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: { 200: AlertSchema },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return requireService().acknowledgeAlert(request.user!, id);
    },
  );

  app.post(
    "/alerts/:id/dispatch",
    {
      preHandler: app.authorize({ roles: [Role.PARK_MANAGER] }),
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: z.object({ rangerId: z.string().uuid() }),
        response: { 200: AlertDispatchSchema },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const { rangerId } = request.body as { rangerId: string };
      return requireService().dispatchRanger(request.user!, id, rangerId);
    },
  );
  app.get(
    "/alerts/config",
    {
      preHandler: app.authorize({ roles: [Role.PARK_MANAGER] }),
    },
    async (request) => requireService().getParkAlertConfig(request.user!),
  );

  app.patch(
    "/alerts/config",
    {
      preHandler: app.authorize({ roles: [Role.PARK_MANAGER] }),
      schema: {
        body: z.object({
          geofenceCenter: z.array(z.number()).length(2).optional(),
          geofenceRadiusKm: z.number().optional(),
          immobilitySpeedThreshold: z.number().optional(),
          lowBatteryThreshold: z.number().optional(),
        }),
      },
    },
    async (request) => requireService().updateParkAlertConfig(request.user!, request.body),
  );

  app.get(
    "/alerts/:id/context",
    {
      preHandler: app.authorize({ roles: [Role.PARK_MANAGER] }),
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: { 200: AlertContextSchema },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return requireService().getAlertContext(id, request.user!.parkId!);
    },
  );

  app.get(
    "/alerts/:id/rangers",
    {
      preHandler: app.authorize({ roles: [Role.PARK_MANAGER] }),
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: { 200: z.array(RangerDistanceSchema) },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return requireService().getAvailableRangers(id, request.user!.parkId!);
    },
  );

  app.post(
    "/alerts/:id/broadcast",
    {
      preHandler: app.authorize({ roles: [Role.PARK_MANAGER] }),
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: { 200: z.object({ success: z.boolean() }) },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      await requireService().broadcastAlert(id, request.user!.parkId!);
      return { success: true };
    },
  );

  // ── Collar telemetry ─────────────────────────────────────────────────────

  app.get(
    "/collars",
    {
      preHandler: app.authorize({ roles: [Role.PARK_MANAGER, Role.RANGER] }),
      schema: { response: { 200: CollarListSchema } },
    },
    async (request) => requireService().listCollars(request.user!),
  );

  app.get(
    "/collars/:id/pings",
    {
      preHandler: app.authorize({ roles: [Role.PARK_MANAGER, Role.RANGER] }),
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: { 200: CollarPingListSchema },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return requireService().getCollarPings(request.user!, id);
    },
  );

  // ── Ranger dispatches ────────────────────────────────────────────────────
  // Routes are registered under /api prefix in server.ts, so the full URLs are:
  //   GET  /api/alerts/dispatches/mine
  //   POST /api/alerts/dispatches/:id/status
  // The ranger app calls /api/alerts/dispatches/... to match these routes.

  app.get(
    "/alerts/dispatches/mine",
    {
      preHandler: app.authorize({ roles: [Role.RANGER] }),
      schema: { response: { 200: AlertDispatchListSchema } },
    },
    async (request) => requireService().getMyDispatches(request.user!),
  );

  app.post(
    "/alerts/dispatches/:id/status",
    {
      preHandler: app.authorize({ roles: [Role.RANGER] }),
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: z.object({
          status: z.enum(["ACCEPTED", "REJECTED", "ARRIVED", "DONE", "CANCELLED"]),
          notes: z.string().optional(),
        }),
        response: { 200: AlertDispatchSchema },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { status, notes } = request.body as { status: any; notes?: string };
      return requireService().updateDispatchStatus(request.user!, id, status, notes);
    },
  );

  // ── Telemetry ping intake ─────────────────────────────────────────────────
  // This endpoint should only be reachable in development; in production it must
  // be protected by a device secret checked via the PING_SECRET env variable.

  app.post(
    "/pings",
    {
      schema: {
        body: z.object({
          collarId: z.string().uuid(),
          location: z.tuple([z.number(), z.number()]),
          speed: z.number().nullable().optional(),
          battery: z.number().nullable().optional(),
          recordedAt: z.string().datetime(),
        }),
        response: { 200: z.object({ success: z.boolean() }) },
      },
    },
    async (request, reply) => {
      // Require a shared secret in non-development environments (M3-9)
      const pingSecret = process.env.PING_SECRET;
      if (pingSecret) {
        const provided = request.headers["x-ping-secret"];
        if (provided !== pingSecret) {
          throw new AppError("Invalid device secret.", 401, "UNAUTHORIZED");
        }
      }

      const repo = options.repository;
      if (!repo) throw new AppError("Repository unavailable", 503, "UNAVAILABLE");

      const processor = new PingProcessor(repo);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body = request.body as any;
      await processor.processPing({
        collarId: body.collarId,
        location: body.location,
        speed: body.speed ?? null,
        battery: body.battery ?? null,
        recordedAt: new Date(body.recordedAt),
      });
      return { success: true };
    },
  );
}
