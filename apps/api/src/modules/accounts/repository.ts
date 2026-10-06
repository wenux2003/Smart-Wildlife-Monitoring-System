import postgres from "postgres";
import type { AuthUser } from "../auth/repository.js";
import type { AccountEvent, AccountRecord, Park } from "./types.js";

export interface AccountRepository {
  listParks(parkId?: string): Promise<Park[]>;
  findPark(id: string): Promise<Park | undefined>;
  createPark(park: Park, event: AccountEvent): Promise<boolean>;
  listAccounts(parkId?: string): Promise<AccountRecord[]>;
  findAccount(id: string): Promise<AccountRecord | undefined>;
  findAccountByEmail(email: string): Promise<AccountRecord | undefined>;
  createAccount(user: AuthUser, event: AccountEvent): Promise<boolean>;
  setDisabled(
    id: string,
    disabledAt: Date | null,
    event: AccountEvent,
  ): Promise<AccountRecord | undefined>;
  resetPassword(
    id: string,
    passwordHash: string,
    event: AccountEvent,
  ): Promise<AccountRecord | undefined>;
  updateAccount(
    id: string,
    role: AccountRecord["role"],
    parkId: string | null,
    events: AccountEvent[],
  ): Promise<AccountRecord | undefined>;
  setResearcherPark(
    id: string,
    parkId: string | null,
    event: AccountEvent,
  ): Promise<AccountRecord | undefined>;
  listEvents(targetUserId: string): Promise<AccountEvent[]>;
  close?(): Promise<void>;
}

type Tx = postgres.TransactionSql;

function insertEvent(tx: Tx, event: AccountEvent) {
  return tx`
    INSERT INTO account_events (id, actor_id, target_user_id, action, old_value, new_value, created_at)
    VALUES (${event.id}, ${event.actorId}, ${event.targetUserId}, ${event.action},
      ${JSON.stringify(event.oldValue)}::jsonb, ${JSON.stringify(event.newValue)}::jsonb,
      ${event.createdAt ?? new Date()})`;
}

const accountSelect = `
  SELECT u.id, u.name, u.email, u.password_hash, u.role, u.park_id,
    p.name AS park_name, u.disabled_at, u.must_change_password, u.created_by, u.created_at
  FROM auth_users u LEFT JOIN parks p ON p.id = u.park_id`;

export function createAccountRepository(url: string): AccountRepository {
  const sql = postgres(url, { max: 5, prepare: false, connect_timeout: 15 });
  return {
    async listParks(parkId) {
      return parkId
        ? sql<Park[]>`SELECT id, code, name, terrain FROM parks WHERE id = ${parkId} ORDER BY name`
        : sql<Park[]>`SELECT id, code, name, terrain FROM parks ORDER BY name`;
    },
    async findPark(id) {
      const rows = await sql<Park[]>`SELECT id, code, name, terrain FROM parks WHERE id = ${id}`;
      return rows[0];
    },
    async createPark(park, event) {
      return sql.begin(async (tx) => {
        const inserted = await tx`
          INSERT INTO parks (id, code, name, terrain)
          VALUES (${park.id}, ${park.code}, ${park.name}, ${park.terrain})
          ON CONFLICT (code) DO NOTHING RETURNING id`;
        if (!inserted.length) return false;
        await insertEvent(tx, event);
        return true;
      });
    },
    async listAccounts(parkId) {
      return parkId
        ? sql.unsafe<AccountRecord[]>(
            `${accountSelect} WHERE u.park_id = $1 ORDER BY u.name`,
            [parkId],
          )
        : sql.unsafe<AccountRecord[]>(`${accountSelect} ORDER BY u.name`);
    },
    async findAccount(id) {
      const rows = await sql.unsafe<AccountRecord[]>(
        `${accountSelect} WHERE u.id = $1`,
        [id],
      );
      return rows[0];
    },
    async findAccountByEmail(email) {
      const rows = await sql.unsafe<AccountRecord[]>(
        `${accountSelect} WHERE u.email = $1`,
        [email],
      );
      return rows[0];
    },
    async createAccount(user, event) {
      return sql.begin(async (tx) => {
        const inserted = await tx`
          INSERT INTO auth_users
            (id, name, email, password_hash, role, park_id, disabled_at, must_change_password, created_by)
          VALUES (${user.id}, ${user.name}, ${user.email}, ${user.password_hash}, ${user.role},
            ${user.park_id}, NULL, true, ${event.actorId})
          ON CONFLICT (email) DO NOTHING RETURNING id`;
        if (!inserted.length) return false;
        await insertEvent(tx, event);
        return true;
      });
    },
    async setDisabled(id, disabledAt, event) {
      return sql.begin(async (tx) => {
        const rows = await tx.unsafe<AccountRecord[]>(
          `${accountSelect} WHERE u.id = $1 FOR UPDATE OF u`,
          [id],
        );
        const account = rows[0];
        if (!account) return undefined;
        if (account.disabled_at === null && disabledAt !== null) {
          await tx`UPDATE auth_users SET disabled_at = ${disabledAt} WHERE id = ${id}`;
          await tx`DELETE FROM auth_sessions WHERE user_id = ${id}`;
        } else if (account.disabled_at !== null && disabledAt === null) {
          await tx`UPDATE auth_users SET disabled_at = NULL WHERE id = ${id}`;
        } else {
          return account;
        }
        await insertEvent(tx, event);
        return {
          ...account,
          disabled_at: disabledAt,
        };
      });
    },
    async resetPassword(id, passwordHash, event) {
      return sql.begin(async (tx) => {
        const rows = await tx.unsafe<AccountRecord[]>(
          `${accountSelect} WHERE u.id = $1 FOR UPDATE OF u`,
          [id],
        );
        const account = rows[0];
        if (!account) return undefined;
        await tx`
          UPDATE auth_users
          SET password_hash = ${passwordHash}, must_change_password = true
          WHERE id = ${id}`;
        await tx`DELETE FROM auth_sessions WHERE user_id = ${id}`;
        await insertEvent(tx, event);
        return { ...account, password_hash: passwordHash, must_change_password: true };
      });
    },
    async updateAccount(id, role, parkId, events) {
      return sql.begin(async (tx) => {
        const rows = await tx.unsafe<AccountRecord[]>(
          `${accountSelect} WHERE u.id = $1 FOR UPDATE OF u`,
          [id],
        );
        const account = rows[0];
        if (!account) return undefined;
        await tx`
          UPDATE auth_users SET role = ${role}, park_id = ${parkId} WHERE id = ${id}`;
        for (const event of events) await insertEvent(tx, event);
        return { ...account, role, park_id: parkId };
      });
    },
    async setResearcherPark(id, parkId, event) {
      return sql.begin(async (tx) => {
        const rows = await tx.unsafe<AccountRecord[]>(
          `${accountSelect} WHERE u.id = $1 FOR UPDATE OF u`,
          [id],
        );
        const account = rows[0];
        if (!account) return undefined;
        await tx`UPDATE auth_users SET park_id = ${parkId} WHERE id = ${id}`;
        await insertEvent(tx, event);
        return { ...account, park_id: parkId };
      });
    },
    async listEvents(targetUserId) {
      return sql<AccountEvent[]>`
        SELECT id, actor_id AS "actorId", target_user_id AS "targetUserId",
          action, old_value AS "oldValue", new_value AS "newValue",
          created_at AS "createdAt"
        FROM account_events WHERE target_user_id = ${targetUserId}
        ORDER BY created_at DESC, id DESC`;
    },
    async close() {
      await sql.end();
    },
  };
}
