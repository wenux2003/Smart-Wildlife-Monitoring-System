import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AlertListSchema, AlertSchema, AlertDispatchSchema, AlertDispatchListSchema, CollarListSchema, CollarPingListSchema, Role } from "@wr/shared";
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
    const interval = setInterval(async () => {
      try {
        await service.checkLostSignals();
        await service.checkTimeouts();
      } catch (e) {
        app.log.error("Error in background alert jobs:", e);
      }
    }, 60000); // every minute

    app.addHook("onClose", (instance, done) => {
      clearInterval(interval);
      done();
    });
  }

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
    "/collars",
    {
      preHandler: app.authorize({ roles: [Role.PARK_MANAGER, Role.RANGER] }),
      schema: { response: { 200: z.array(z.any()) } }, // FIXME use proper schema CollarListSchema
    },
    async (request) => requireService().listCollars(request.user!),
  );

  app.get(
    "/collars/:id/pings",
    {
      preHandler: app.authorize({ roles: [Role.PARK_MANAGER, Role.RANGER] }),
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: { 200: z.array(z.any()) },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      return requireService().getCollarPings(request.user!, id);
    },
  );

  app.get(
    "/dispatches/mine",
    {
      preHandler: app.authorize({ roles: [Role.RANGER] }),
      schema: { response: { 200: AlertDispatchListSchema } },
    },
    async (request) => requireService().getMyDispatches(request.user!),
  );

  app.post(
    "/dispatches/:id/status",
    {
      preHandler: app.authorize({ roles: [Role.RANGER] }),
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: z.object({ 
          status: z.enum(['PENDING', 'ACCEPTED', 'REJECTED', 'TIMED_OUT', 'ARRIVED', 'DONE', 'CANCELLED']), 
          notes: z.string().optional() 
        }),
        response: { 200: AlertDispatchSchema },
      },
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const { status, notes } = request.body as { status: any, notes?: string };
      return requireService().updateDispatchStatus(request.user!, id, status, notes);
    },
  );

  app.post(
    "/pings",
    {
      // No auth required for the simulator (or we could require a specific API key)
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
    async (request) => {
      const repo = options.repository;
      if (!repo) throw new AppError("Repository unavailable", 503, "UNAVAILABLE");
      
      const processor = new PingProcessor(repo);
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
