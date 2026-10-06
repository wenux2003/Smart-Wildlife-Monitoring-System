import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { systemClock } from "../../core/clock.js";
import type { Clock } from "../../core/clock.js";
import type { AuthRepository, AuthUser } from "./repository.js";
import { createAuthRepository } from "./repository.js";
import {
  hashPassword,
  sessionToken,
  tokenHash,
  verifyPassword,
} from "./security.js";

const credentials = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});
const registration = credentials
  .extend({
    name: z.string().trim().min(2).max(100),
    password: z.string().min(12).max(128),
  })
  .strict();
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const publicUser = (user: AuthUser) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  parkId: user.park_id,
});
const cookieToken = (request: FastifyRequest) => {
  const value = request.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("wr_session="))
    ?.slice(11);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : undefined;
};

export type AuthOptions = {
  repository?: AuthRepository;
  clock?: Clock;
  origins?: string[];
  secure?: boolean;
};
export async function authRoutes(app: FastifyInstance, options: AuthOptions) {
  const repository =
    options.repository ??
    (process.env.DATABASE_URL
      ? createAuthRepository(process.env.DATABASE_URL)
      : undefined);
  const clock = options.clock ?? systemClock;
  const secure = options.secure ?? process.env.NODE_ENV === "production";
  const origins =
    options.origins ??
    (process.env.APP_ORIGINS ?? "http://localhost:5174,http://localhost:5173")
      .split(",")
      .map((value) => value.trim());
  const attempts = new Map<string, { count: number; until: number }>();
  const dummyHash = await hashPassword(sessionToken());
  const cookie = (value: string, age: number) =>
    `wr_session=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure ? "; Secure" : ""}`;
  if (repository?.close) app.addHook("onClose", () => repository.close!());
  app.addHook("onRequest", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    if (!repository)
      return reply
        .code(503)
        .send({
          message:
            "Account service is not configured. Please contact the project administrator.",
        });
    if (request.method !== "GET") {
      if (!request.headers.origin || !origins.includes(request.headers.origin))
        return reply
          .code(403)
          .send({ message: "This request origin is not allowed." });
      const now = clock.now().getTime();
      for (const [key, value] of attempts)
        if (value.until <= now) attempts.delete(key);
      const key = request.ip;
      const entry = attempts.get(key) ?? {
        count: 0,
        until: now + 15 * 60 * 1000,
      };
      if (entry.count >= 30 || (!attempts.has(key) && attempts.size >= 10000))
        return reply
          .header("Retry-After", "900")
          .code(429)
          .send({
            message: "Too many attempts. Please try again in 15 minutes.",
          });
      entry.count += 1;
      attempts.set(key, entry);
    }
  });
  app.setErrorHandler((_error, _request, reply) => {
    // Never return or log passwords, connection strings, or database query values.
    reply
      .code(503)
      .send({
        message:
          "Account service is temporarily unavailable. Please try again.",
      });
  });
  async function startSession(
    user: AuthUser,
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const token = sessionToken();
    await repository!.saveSession(
      tokenHash(token),
      user.id,
      new Date(clock.now().getTime() + SESSION_SECONDS * 1000),
    );
    const previous = cookieToken(request);
    if (previous) await repository!.removeSession(tokenHash(previous));
    reply.header("Set-Cookie", cookie(token, SESSION_SECONDS));
    return { user: publicUser(user) };
  }
  app.post("/register", async (request, reply) => {
    const parsed = registration.safeParse(request.body);
    if (!parsed.success)
      return reply
        .code(400)
        .send({
          message:
            "Enter a name, valid email, and a password of 12–128 characters. Do not include a role or park assignment.",
        });
    const user: AuthUser = {
      id: randomUUID(),
      name: parsed.data.name,
      email: parsed.data.email,
      password_hash: await hashPassword(parsed.data.password),
      role: "RESEARCHER",
      park_id: null,
    };
    if (!(await repository!.createUser(user)))
      return reply
        .code(409)
        .send({
          message:
            "Unable to create this account. If you already have an account, sign in.",
        });
    reply.code(201);
    return startSession(user, request, reply);
  });
  app.post("/login", async (request, reply) => {
    const parsed = credentials.safeParse(request.body);
    if (!parsed.success)
      return reply
        .code(400)
        .send({ message: "Enter a valid email and password." });
    const user = await repository!.findUser(parsed.data.email);
    const valid = await verifyPassword(
      parsed.data.password,
      user?.password_hash ?? dummyHash,
    );
    if (!user || !valid)
      return reply
        .code(401)
        .send({ message: "Email or password is incorrect." });
    return startSession(user, request, reply);
  });
  app.get("/me", async (request, reply) => {
    const token = cookieToken(request);
    const user = token
      ? await repository!.sessionUser(tokenHash(token), clock.now())
      : undefined;
    if (!user)
      return reply
        .header("Set-Cookie", cookie("", 0))
        .code(401)
        .send({ message: "Please sign in to continue." });
    return { user: publicUser(user) };
  });
  app.post("/logout", async (request, reply) => {
    const token = cookieToken(request);
    if (token) await repository!.removeSession(tokenHash(token));
    return reply.header("Set-Cookie", cookie("", 0)).code(204).send();
  });
}
