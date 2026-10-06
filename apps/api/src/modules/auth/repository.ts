import postgres from "postgres";
import type { Role } from "@wr/shared";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  park_id: string | null;
  park_name?: string | null;
  disabled_at: Date | null;
  must_change_password: boolean;
};
export interface AuthRepository {
  findUser(email: string): Promise<AuthUser | undefined>;
  createUser(user: AuthUser): Promise<boolean>;
  saveSession(hash: string, userId: string, expires: Date): Promise<void>;
  sessionUser(hash: string, now: Date): Promise<AuthUser | undefined>;
  removeSession(hash: string): Promise<void>;
  close?(): Promise<void>;
}
export function createAuthRepository(url: string): AuthRepository {
  const sql = postgres(url, { max: 5, prepare: false, connect_timeout: 15 });
  return {
    async findUser(email) {
      const rows = await sql<
        AuthUser[]
      >`SELECT u.*, p.name AS park_name FROM auth_users u LEFT JOIN parks p ON p.id = u.park_id WHERE u.email = ${email}`;
      return rows[0];
    },
    async createUser(user) {
      const rows =
        await sql`INSERT INTO auth_users (id, name, email, password_hash) VALUES (${user.id}, ${user.name}, ${user.email}, ${user.password_hash}) ON CONFLICT (email) DO NOTHING RETURNING id`;
      return rows.length === 1;
    },
    async saveSession(hash, userId, expires) {
      await sql.begin(async (tx) => {
        await tx`DELETE FROM auth_sessions WHERE expires_at <= now()`;
        await tx`INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (${hash}, ${userId}, ${expires})`;
      });
    },
    async sessionUser(hash, now) {
      const rows = await sql<
        AuthUser[]
      >`SELECT u.*, p.name AS park_name FROM auth_users u JOIN auth_sessions s ON s.user_id=u.id LEFT JOIN parks p ON p.id = u.park_id WHERE s.token_hash=${hash} AND s.expires_at > ${now}`;
      return rows[0];
    },
    async removeSession(hash) {
      await sql`DELETE FROM auth_sessions WHERE token_hash=${hash}`;
    },
    async close() {
      await sql.end();
    },
  };
}
