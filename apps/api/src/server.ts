import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { HealthResponseSchema } from "@wr/shared";
import { authRoutes } from "./modules/auth/routes.js";
import type { AuthOptions } from "./modules/auth/routes.js";

export function createServer(authOptions: AuthOptions = {}) {
  const server = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>();

  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);
  server.register(authRoutes, { prefix: "/api/auth", ...authOptions });

  server.get(
    "/health",
    {
      schema: {
        response: {
          200: HealthResponseSchema,
        },
      },
    },
    async () => ({ status: "ok" as const }),
  );

  return server;
}
