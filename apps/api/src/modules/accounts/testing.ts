import type { AuthUser } from "../auth/repository.js";
import type { AccountRepository } from "./repository.js";
import type { AccountEvent, AccountRecord, Park } from "./types.js";

type MemorySession = { id: string; expires: Date };
type Options = {
  users?: Map<string, AuthUser>;
  sessions?: Map<string, MemorySession>;
  parks?: Park[];
  events?: AccountEvent[];
};

export function memoryAccountRepository(options: Options = {}) {
  const users = options.users ?? new Map<string, AuthUser>();
  const sessions = options.sessions ?? new Map<string, MemorySession>();
  const parks = new Map((options.parks ?? []).map((park) => [park.id, park]));
  const events = options.events ?? [];
  function account(user: AuthUser): AccountRecord {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      password_hash: user.password_hash,
      role: user.role,
      park_id: user.park_id,
      park_name: user.park_id ? (parks.get(user.park_id)?.name ?? null) : null,
      disabled_at: user.disabled_at,
      must_change_password: user.must_change_password,
      created_by: user.created_by ?? null,
      created_at: user.created_at ?? new Date("2026-10-06T00:00:00Z"),
    };
  }
  const repository: AccountRepository = {
    async listParks(parkId) {
      const results = [...parks.values()];
      return parkId ? results.filter((park) => park.id === parkId) : results;
    },
    async findPark(id) {
      return parks.get(id);
    },
    async createPark(park, event) {
      if ([...parks.values()].some((existing) => existing.code === park.code))
        return false;
      parks.set(park.id, park);
      events.push(event);
      return true;
    },
    async listAccounts(parkId) {
      return [...users.values()]
        .filter((user) => !parkId || user.park_id === parkId)
        .map(account);
    },
    async findAccount(id) {
      const user = users.get(id);
      return user ? account(user) : undefined;
    },
    async findAccountByEmail(email) {
      const user = [...users.values()].find((item) => item.email === email);
      return user ? account(user) : undefined;
    },
    async createAccount(user, event) {
      if ([...users.values()].some((existing) => existing.email === user.email))
        return false;
      users.set(user.id, {
        ...user,
        created_by: event.actorId,
        created_at: event.createdAt ?? new Date(),
      });
      events.push(event);
      return true;
    },
    async setDisabled(id, disabledAt, event) {
      const user = users.get(id);
      if (!user) return undefined;
      user.disabled_at = disabledAt;
      if (disabledAt)
        for (const [hash, session] of sessions)
          if (session.id === id) sessions.delete(hash);
      events.push(event);
      return account(user);
    },
    async resetPassword(id, passwordHash, event) {
      const user = users.get(id);
      if (!user) return undefined;
      user.password_hash = passwordHash;
      user.must_change_password = true;
      for (const [hash, session] of sessions)
        if (session.id === id) sessions.delete(hash);
      events.push(event);
      return account(user);
    },
    async updateAccount(id, role, parkId, accountEvents) {
      const user = users.get(id);
      if (!user) return undefined;
      user.role = role;
      user.park_id = parkId;
      events.push(...accountEvents);
      return account(user);
    },
    async setResearcherPark(id, parkId, event) {
      const user = users.get(id);
      if (!user) return undefined;
      user.park_id = parkId;
      events.push(event);
      return account(user);
    },
    async listEvents(targetUserId) {
      return events
        .filter((event) => event.targetUserId === targetUserId)
        .sort((left, right) =>
          (right.createdAt?.getTime() ?? 0) - (left.createdAt?.getTime() ?? 0),
        );
    },
  };
  return { repository, users, sessions, parks, events };
}
