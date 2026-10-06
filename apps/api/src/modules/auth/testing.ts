import type { AuthRepository, AuthUser } from "./repository.js";

/** In-memory AuthRepository for tests; no database required. */
export function memoryRepository() {
  const users = new Map<string, AuthUser>();
  const sessions = new Map<string, { id: string; expires: Date }>();
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
  };
  return { repository, users, sessions };
}
