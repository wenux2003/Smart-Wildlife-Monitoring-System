import type { AuthRepository, AuthUser } from "./repository.js";
import type { AccountEvent } from "../accounts/types.js";

/** In-memory AuthRepository for tests; no database required. */
export function memoryRepository() {
  const users = new Map<string, AuthUser>();
  const sessions = new Map<string, { id: string; expires: Date }>();
  const events: AccountEvent[] = [];
  const repository: AuthRepository = {
    async findUser(email) {
      return [...users.values()].find((user) => user.email === email);
    },
    async createUser(user) {
      if ([...users.values()].some((existing) => existing.email === user.email))
        return false;
      users.set(user.id, user);
      return true;
    },
    async saveSession(hash, id, expires) {
      sessions.set(hash, { id, expires });
    },
    async sessionUser(hash, now) {
      const session = sessions.get(hash);
      return session && session.expires > now
        ? users.get(session.id)
        : undefined;
    },
    async removeSession(hash) {
      sessions.delete(hash);
    },
    async changePassword(input) {
      const session = sessions.get(input.currentSessionHash);
      const user = users.get(input.userId);
      if (
        !session ||
        session.id !== input.userId ||
        !user ||
        user.disabled_at
      )
        return false;
      user.password_hash = input.passwordHash;
      user.must_change_password = false;
      for (const [hash, existing] of sessions)
        if (existing.id === input.userId) sessions.delete(hash);
      sessions.set(input.replacementSessionHash, {
        id: input.userId,
        expires: input.expiresAt,
      });
      events.push({
        ...input.event,
        action: "PASSWORD_CHANGED",
        createdAt: new Date(),
      });
      return true;
    },
  };
  return { repository, users, sessions, events };
}
