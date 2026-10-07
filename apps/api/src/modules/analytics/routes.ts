import type { FastifyPluginAsync } from "fastify";
import type { AnalyticsService } from "./service.js";

export const analyticsRoutes =
  (service: AnalyticsService): FastifyPluginAsync =>
  async (fastify) => {
    // Get Hotspots
    fastify.get<{
      Querystring: { parkId: string; type?: string; sinceDays?: string };
    }>(
      "/hotspots",
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        preHandler: fastify.authorize({ roles: ["PARK_MANAGER", "LIAISON_OFFICER", "SUPER_ADMIN", "RESEARCHER" as any] })
      },
      async (request, reply) => {
      const { parkId, type, sinceDays } = request.query;
      if (!parkId) {
        return reply.status(400).send({ error: "parkId is required" });
      }
      const days = sinceDays ? parseInt(sinceDays, 10) : undefined;
      const hotspots = await service.getHotspots(parkId, type, days);
      return { data: hotspots };
    });

    // Record an export audit
    fastify.post<{
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Body: { exportType: string; queryParams: any };
    }>(
      "/exports",
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        preHandler: fastify.authorize({ roles: ["PARK_MANAGER", "LIAISON_OFFICER", "SUPER_ADMIN", "RESEARCHER" as any] })
      },
      async (request, reply) => {
      const user = request.user!;
      const { exportType, queryParams } = request.body;
      
      if (!exportType) {
        return reply.status(400).send({ error: "exportType is required" });
      }

      const audit = await service.recordExport(user.id, exportType, queryParams || {});
      return reply.status(201).send({ data: audit });
    });
  };
