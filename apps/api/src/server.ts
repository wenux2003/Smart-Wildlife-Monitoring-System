import Fastify from "fastify";
import type { FastifyError } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { HealthResponseSchema } from "@wr/shared";
import { systemClock } from "./core/clock.js";
import { AppError } from "./core/errors.js";
import { authRoutes } from "./modules/auth/routes.js";
import type { AuthOptions } from "./modules/auth/routes.js";
import { createAuthRepository } from "./modules/auth/repository.js";
import { createAuthorize } from "./modules/auth/guard.js";
import { accountRoutes } from "./modules/accounts/routes.js";
import type { AccountRepository } from "./modules/accounts/repository.js";
import { createAccountRepository } from "./modules/accounts/repository.js";
import { patrolRoutes } from "./modules/patrols/routes.js";
import type { PatrolRepository } from "./modules/patrols/repository.js";
import { createPatrolRepository } from "./modules/patrols/repository.js";

export type ServerOptions = AuthOptions & {
  accountsRepository?: AccountRepository;
  patrolRepository?: PatrolRepository;
};

export function createServer(authOptions: ServerOptions = {}) {
  const server = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>();

  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);

  // Module errors become { code, message }; unexpected failures stay private.
  server.setErrorHandler<FastifyError>((error, request, reply) => {
    if (error instanceof AppError)
      return reply
        .code(error.statusCode)
        .send({ code: error.code, message: error.message });
    if (error.validation)
      return reply.code(400).send({
        code: "VALIDATION_FAILED",
        message: "The request is not valid.",
      });
    // Fastify's own client errors (malformed JSON, body too large) keep their status.
    if (error.statusCode && error.statusCode < 500)
      return reply
        .code(error.statusCode)
        .send({ code: error.code ?? "BAD_REQUEST", message: error.message });
    request.log.error(error);
    return reply.code(500).send({
      code: "INTERNAL_ERROR",
      message: "Something went wrong. Please try again.",
    });
  });

  const repository =
    authOptions.repository ??
    (process.env.DATABASE_URL
      ? createAuthRepository(process.env.DATABASE_URL)
      : undefined);
  const accountsRepository =
    authOptions.accountsRepository ??
    (process.env.DATABASE_URL
      ? createAccountRepository(process.env.DATABASE_URL)
      : undefined);
  const patrolRepository =
    authOptions.patrolRepository ??
    (process.env.DATABASE_URL
      ? createPatrolRepository(process.env.DATABASE_URL)
      : undefined);
  if (repository?.close) server.addHook("onClose", () => repository.close!());
  if (accountsRepository?.close)
    server.addHook("onClose", () => accountsRepository.close!());
  if (patrolRepository?.close)
    server.addHook("onClose", () => patrolRepository.close!());
  // Available to every module: { preHandler: app.authorize({ roles: [...] }) }.
  server.decorateRequest("user", null);
  server.decorate(
    "authorize",
    createAuthorize(repository, authOptions.clock ?? systemClock),
  );

  server.register(authRoutes, {
    prefix: "/api/auth",
    ...authOptions,
    repository,
  });
  server.register(accountRoutes, {
    prefix: "/api",
    repository: accountsRepository,
  });
  server.register(patrolRoutes, {
    prefix: "/api",
    repository: patrolRepository,
  });

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
