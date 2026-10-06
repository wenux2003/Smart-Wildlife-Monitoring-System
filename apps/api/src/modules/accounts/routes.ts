import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { Role } from "@wr/shared";
import { z } from "zod";
import { AppError } from "../../core/errors.js";
import type { AccountRepository } from "./repository.js";
import { createAccountService } from "./service.js";

const parkId = z.string().uuid();
const role = z.enum([
  Role.SUPER_ADMIN,
  Role.PARK_MANAGER,
  Role.RANGER,
  Role.LIAISON_OFFICER,
  Role.RESEARCHER,
]);
const createPark = z
  .object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9_]{0,31}$/),
    name: z.string().trim().min(2).max(120),
    terrain: z.string().trim().max(3000).default(""),
  })
  .strict();
const createAccount = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
    role: z.enum([Role.PARK_MANAGER, Role.RANGER, Role.LIAISON_OFFICER]),
    parkId,
    temporaryPassword: z.string().min(12).max(128),
  })
  .strict();
const resetPassword = z
  .object({ temporaryPassword: z.string().min(12).max(128) })
  .strict();
const updateAccount = z
  .object({
    role: role.optional(),
    parkId: parkId.nullable().optional(),
  })
  .strict()
  .refine((input) => input.role !== undefined || input.parkId !== undefined);
const researcherAccess = z
  .object({
    email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
    parkId,
    grant: z.boolean(),
  })
  .strict();
const accountQuery = z.object({ parkId: parkId.optional() }).strict();
const params = z.object({ id: parkId }).strict();

export type AccountOptions = { repository?: AccountRepository };

export async function accountRoutes(
  app: FastifyInstance,
  options: AccountOptions,
) {
  const repository = options.repository;
  const service = repository ? createAccountService(repository) : undefined;
  const origins = (
    process.env.APP_ORIGINS ?? "http://localhost:5174,http://localhost:5173"
  )
    .split(",")
    .map((origin) => origin.trim());
  const attempts = new Map<string, { count: number; until: number }>();

  app.addHook("onRequest", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    if (request.method === "GET") return;
    if (!request.headers.origin || !origins.includes(request.headers.origin))
      return reply.code(403).send({
        code: "ORIGIN_FORBIDDEN",
        message: "This request origin is not allowed.",
      });
    const now = Date.now();
    for (const [key, value] of attempts)
      if (value.until <= now) attempts.delete(key);
    const current = attempts.get(request.ip) ?? {
      count: 0,
      until: now + 15 * 60 * 1000,
    };
    if (current.count >= 30 || (!attempts.has(request.ip) && attempts.size >= 10000))
      return reply
        .header("Retry-After", "900")
        .code(429)
        .send({ code: "RATE_LIMITED", message: "Too many changes. Try again later." });
    current.count++;
    attempts.set(request.ip, current);
  });

  const requireService = () => {
    if (!service)
      throw new AppError(
        "Account service is not configured.",
        503,
        "AUTH_UNAVAILABLE",
      );
    return service;
  };
  const sa = [Role.SUPER_ADMIN] as const;
  const admins = [Role.SUPER_ADMIN, Role.PARK_MANAGER] as const;

  app.get(
    "/parks",
    { preHandler: app.authorize({ roles: admins }) },
    async (request) => requireService().listParks(request.user!),
  );
  app.post(
    "/parks",
    { preHandler: app.authorize({ roles: sa }) },
    async (request, reply) => {
      const parsed = createPark.safeParse(request.body);
      if (!parsed.success)
        throw new AppError("Enter a valid park code, name and terrain.", 400, "VALIDATION_FAILED");
      const park = await requireService().createPark(request.user!, {
        id: randomUUID(),
        ...parsed.data,
      });
      return reply.code(201).send(park);
    },
  );
  app.get(
    "/accounts",
    {
      preHandler: app.authorize({ roles: admins }),
      schema: { querystring: accountQuery },
    },
    async (request) => {
      const parsed = accountQuery.safeParse(request.query);
      if (!parsed.success)
        throw new AppError("Enter a valid park filter.", 400, "VALIDATION_FAILED");
      return requireService().listAccounts(request.user!, parsed.data.parkId);
    },
  );
  app.post(
    "/accounts",
    { preHandler: app.authorize({ roles: admins }) },
    async (request, reply) => {
      const parsed = createAccount.safeParse(request.body);
      if (!parsed.success)
        throw new AppError(
          "Enter a name, valid email, permitted role, park and temporary password of 12–128 characters.",
          400,
          "VALIDATION_FAILED",
        );
      const account = await requireService().createAccount(request.user!, {
        id: randomUUID(),
        ...parsed.data,
      });
      return reply.code(201).send(account);
    },
  );
  app.post(
    "/accounts/:id/deactivate",
    { preHandler: app.authorize({ roles: admins }), schema: { params } },
    async (request) => {
      const parsed = params.safeParse(request.params);
      if (!parsed.success)
        throw new AppError("Enter a valid account id.", 400, "VALIDATION_FAILED");
      return requireService().setAccountStatus(request.user!, parsed.data.id, false);
    },
  );
  app.post(
    "/accounts/:id/reactivate",
    { preHandler: app.authorize({ roles: admins }), schema: { params } },
    async (request) => {
      const parsed = params.safeParse(request.params);
      if (!parsed.success)
        throw new AppError("Enter a valid account id.", 400, "VALIDATION_FAILED");
      return requireService().setAccountStatus(request.user!, parsed.data.id, true);
    },
  );
  app.post(
    "/accounts/:id/reset-password",
    { preHandler: app.authorize({ roles: admins }), schema: { params } },
    async (request) => {
      const path = params.safeParse(request.params);
      const body = resetPassword.safeParse(request.body);
      if (!path.success || !body.success)
        throw new AppError(
          "Enter an account and a temporary password of 12–128 characters.",
          400,
          "VALIDATION_FAILED",
        );
      return requireService().resetPassword(
        request.user!,
        path.data.id,
        body.data.temporaryPassword,
      );
    },
  );
  app.patch(
    "/accounts/:id",
    { preHandler: app.authorize({ roles: sa }), schema: { params } },
    async (request) => {
      const path = params.safeParse(request.params);
      const body = updateAccount.safeParse(request.body);
      if (!path.success || !body.success)
        throw new AppError("Enter a valid role or park change.", 400, "VALIDATION_FAILED");
      return requireService().updateAccount(request.user!, path.data.id, body.data);
    },
  );
  app.post(
    "/accounts/researcher-access",
    { preHandler: app.authorize({ roles: admins }) },
    async (request) => {
      const parsed = researcherAccess.safeParse(request.body);
      if (!parsed.success)
        throw new AppError("Enter a valid researcher email and park.", 400, "VALIDATION_FAILED");
      return requireService().researcherAccess(
        request.user!,
        parsed.data.email,
        parsed.data.parkId,
        parsed.data.grant,
      );
    },
  );
  app.get(
    "/accounts/:id/events",
    { preHandler: app.authorize({ roles: admins }), schema: { params } },
    async (request) => {
      const parsed = params.safeParse(request.params);
      if (!parsed.success)
        throw new AppError("Enter a valid account id.", 400, "VALIDATION_FAILED");
      return requireService().accountEvents(request.user!, parsed.data.id);
    },
  );
}
