import type {
  FastifyReply,
  FastifyRequest,
  preHandlerAsyncHookHandler,
} from "fastify";
import { Role } from "@wr/shared";
import { AppError } from "../../core/errors.js";
import type { Clock } from "../../core/clock.js";
import type { AuthRepository, AuthUser } from "./repository.js";
import { tokenHash } from "./security.js";

/** The signed-in account attached to `request.user` by `app.authorize()`. */
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  parkId: string | null;
  parkName: string | null;
};
/** Omit `roles` to allow any signed-in, active account. */
export type AccessRule = { roles?: readonly Role[] };

declare module "fastify" {
  interface FastifyInstance {
    authorize(rule?: AccessRule): preHandlerAsyncHookHandler;
  }
  interface FastifyRequest {
    user: SessionUser | null;
  }
}

export function readSessionToken(request: FastifyRequest) {
  const value = request.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("wr_session="))
    ?.slice(11);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : undefined;
}

export function toSessionUser(user: AuthUser): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    parkId: user.park_id,
    parkName: user.park_name ?? null,
  };
}

const deny = (
  reply: FastifyReply,
  status: number,
  code: string,
  message: string,
) => reply.code(status).send({ code, message });

/**
 * Route guard used by every module, e.g.
 * `{ preHandler: app.authorize({ roles: [Role.PARK_MANAGER] }) }`.
 * It checks the session server-side; hiding a menu item is never enough.
 */
export function createAuthorize(
  repository: AuthRepository | undefined,
  clock: Clock,
) {
  return (rule: AccessRule = {}): preHandlerAsyncHookHandler =>
    async (request, reply) => {
      if (!repository)
        return deny(
          reply,
          503,
          "AUTH_UNAVAILABLE",
          "Account service is not configured.",
        );
      const token = readSessionToken(request);
      let user: AuthUser | undefined;
      try {
        user = token
          ? await repository.sessionUser(tokenHash(token), clock.now())
          : undefined;
      } catch {
        return deny(
          reply,
          503,
          "AUTH_UNAVAILABLE",
          "Account service is temporarily unavailable. Please try again.",
        );
      }
      if (!user || user.disabled_at)
        return deny(
          reply,
          401,
          "UNAUTHENTICATED",
          "Please sign in to continue.",
        );
      if (user.must_change_password)
        return deny(
          reply,
          403,
          "PASSWORD_CHANGE_REQUIRED",
          "Change your temporary password before continuing.",
        );
      if (rule.roles && !rule.roles.includes(user.role))
        return deny(
          reply,
          403,
          "FORBIDDEN",
          "Your role does not allow this action.",
        );
      request.user = toSessionUser(user);
    };
}

/**
 * Park scoping for records and queries. The Super Admin may act on every park,
 * but only on routes whose `authorize({ roles })` includes SUPER_ADMIN.
 * Everyone else is limited to their assigned park; no park means no access.
 */
export function canAccessPark(user: SessionUser, parkId: string) {
  return (
    user.role === Role.SUPER_ADMIN ||
    (user.parkId !== null && user.parkId === parkId)
  );
}

export function assertParkAccess(user: SessionUser | null, parkId: string) {
  if (!user || !canAccessPark(user, parkId))
    throw new AppError(
      "You do not have access to this park.",
      403,
      "PARK_FORBIDDEN",
    );
}
