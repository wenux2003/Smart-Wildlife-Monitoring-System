import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { systemClock } from "../../core/clock.js";
import type { Clock } from "../../core/clock.js";
import type { AuthRepository, AuthUser } from "./repository.js";
import { readSessionToken, toSessionUser } from "./guard.js";
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
const passwordChange = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(12).max(128),
  })
  .strict();
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const publicUser = (user: AuthUser) => ({
  ...toSessionUser(user),
  mustChangePassword: user.must_change_password,
});

export type AuthOptions = {
  repository?: AuthRepository;
  clock?: Clock;
  origins?: string[];
  secure?: boolean;
};
export async function authRoutes(app: FastifyInstance, options: AuthOptions) {
  // createServer() resolves the repository so these routes and app.authorize() share it.
  const { repository } = options;
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
    const previous = readSessionToken(request);
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
      disabled_at: null,
      must_change_password: false,
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
    // Checked only after the password matches, so it reveals nothing to guessers.
    if (user.disabled_at)
      return reply.code(403).send({
        message:
          "This account has been deactivated. Contact your park manager.",
      });
    return startSession(user, request, reply);
  });
  app.post("/change-password", async (request, reply) => {
    const parsed = passwordChange.safeParse(request.body);
    if (!parsed.success)
      return reply.code(400).send({
        code: "VALIDATION_FAILED",
        message: "Enter your current password and a new password of 12–128 characters.",
      });
    if (parsed.data.currentPassword === parsed.data.newPassword)
      return reply.code(400).send({
        code: "VALIDATION_FAILED",
        message: "Choose a new password different from your current password.",
      });

    const currentToken = readSessionToken(request);
    const user = currentToken
      ? await repository!.sessionUser(tokenHash(currentToken), clock.now())
      : undefined;
    if (!user || user.disabled_at)
      return reply
        .header("Set-Cookie", cookie("", 0))
        .code(401)
        .send({ code: "UNAUTHENTICATED", message: "Please sign in to continue." });
    if (!(await verifyPassword(parsed.data.currentPassword, user.password_hash)))
      return reply.code(400).send({
        code: "INVALID_CURRENT_PASSWORD",
        message: "The current password is incorrect.",
      });

    const token = sessionToken();
    const now = clock.now();
    const changed = await repository!.changePassword({
      userId: user.id,
      passwordHash: await hashPassword(parsed.data.newPassword),
      currentSessionHash: tokenHash(currentToken!),
      replacementSessionHash: tokenHash(token),
      expiresAt: new Date(now.getTime() + SESSION_SECONDS * 1000),
      event: {
        id: randomUUID(),
        actorId: user.id,
        targetUserId: user.id,
        action: "PASSWORD_CHANGED",
        oldValue: { mustChangePassword: user.must_change_password },
        newValue: { mustChangePassword: false },
      },
    });
    if (!changed)
      return reply
        .header("Set-Cookie", cookie("", 0))
        .code(401)
        .send({ code: "UNAUTHENTICATED", message: "Please sign in to continue." });
    reply.header("Set-Cookie", cookie(token, SESSION_SECONDS));
    return {
      user: publicUser({
        ...user,
        password_hash: "",
        must_change_password: false,
      }),
    };
  });
  app.get("/me", async (request, reply) => {
    const token = readSessionToken(request);
    const user = token
      ? await repository!.sessionUser(tokenHash(token), clock.now())
      : undefined;
    if (!user || user.disabled_at)
      return reply
        .header("Set-Cookie", cookie("", 0))
        .code(401)
        .send({ message: "Please sign in to continue." });
    return { user: publicUser(user) };
  });
  app.post("/logout", async (request, reply) => {
    const token = readSessionToken(request);
    if (token) await repository!.removeSession(tokenHash(token));
    return reply.header("Set-Cookie", cookie("", 0)).code(204).send();
  });
}
