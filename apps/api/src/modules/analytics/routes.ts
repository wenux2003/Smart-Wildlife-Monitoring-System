import { z } from "zod";
import {
  AnalyticsFilterSchema,
  AnalyticsOptionsSchema,
  ReportExportRequestSchema,
  ReportHistoryResponseSchema,
  ReportHistoryQuerySchema,
  ReportRunResponseSchema,
  Role,
} from "@wr/shared";
import type { FastifyInstance } from "fastify";
import { AppError } from "../../core/errors.js";
import type { Clock } from "../../core/clock.js";
import type {
  AnalyticsRepository,
  ReportAuditRepository,
  ReportExporter,
} from "./types.js";
import { createAnalyticsService } from "./service.js";

export type AnalyticsRouteOptions = {
  repository?: AnalyticsRepository;
  auditRepository?: ReportAuditRepository;
  exporters?: readonly ReportExporter[];
  clock?: Clock;
};

const runParams = z.object({ runId: z.string().uuid() }).strict();
const optionsQuery = z
  .object({ parkId: z.string().uuid().optional() })
  .strict();

export async function analyticsRoutes(
  app: FastifyInstance,
  options: AnalyticsRouteOptions,
) {
  const service =
    options.repository && options.auditRepository
      ? createAnalyticsService(
          options.repository,
          options.auditRepository,
          options.exporters,
          options.clock,
        )
      : undefined;
  const use = () => {
    if (!service)
      throw new AppError(
        "Analytics service is not configured.",
        503,
        "ANALYTICS_UNAVAILABLE",
      );
    return service;
  };
  const authorized = app.authorize({
    roles: [Role.PARK_MANAGER, Role.RESEARCHER],
  });

  app.addHook("onRequest", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    if (request.method === "GET" || !request.headers.origin) return;
    const allowed = (
      process.env.APP_ORIGINS ?? "http://localhost:5173,http://localhost:5174"
    )
      .split(",")
      .map((origin) => origin.trim());
    if (!allowed.includes(request.headers.origin))
      throw new AppError(
        "This origin is not allowed.",
        403,
        "ORIGIN_FORBIDDEN",
      );
  });

  app.get<{ Querystring: z.infer<typeof optionsQuery> }>(
    "/analytics/options",
    {
      preHandler: authorized,
      schema: {
        querystring: optionsQuery,
        response: { 200: AnalyticsOptionsSchema },
      },
    },
    (request) => use().options(request.user!, request.query.parkId),
  );

  app.post<{ Body: z.infer<typeof AnalyticsFilterSchema> }>(
    "/reports/runs",
    {
      preHandler: authorized,
      schema: {
        body: AnalyticsFilterSchema,
        response: { 201: ReportRunResponseSchema },
      },
    },
    async (request, reply) =>
      reply.code(201).send(await use().generate(request.user!, request.body)),
  );

  app.get<{ Params: z.infer<typeof runParams> }>(
    "/reports/runs/:runId",
    {
      preHandler: authorized,
      schema: {
        params: runParams,
        response: { 200: ReportRunResponseSchema },
      },
    },
    (request) => use().getRun(request.user!, request.params.runId),
  );

  app.post<{
    Params: z.infer<typeof runParams>;
    Body: z.infer<typeof ReportExportRequestSchema>;
  }>(
    "/reports/runs/:runId/exports",
    {
      preHandler: authorized,
      schema: {
        params: runParams,
        body: ReportExportRequestSchema,
      },
    },
    async (request, reply) => {
      const file = await use().exportRun(
        request.user!,
        request.params.runId,
        request.body.format,
      );
      return reply
        .code(200)
        .type(file.mimeType)
        .header(
          "Content-Disposition",
          `attachment; filename="${file.filename}"`,
        )
        .header("X-Report-Sha256", file.fileSha256)
        .send(file.bytes);
    },
  );

  app.get<{ Querystring: z.infer<typeof ReportHistoryQuerySchema> }>(
    "/reports/runs",
    {
      preHandler: authorized,
      schema: {
        querystring: ReportHistoryQuerySchema,
        response: { 200: ReportHistoryResponseSchema },
      },
    },
    (request) => use().history(request.user!, request.query),
  );
}
