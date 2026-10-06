import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  char,
  index,
  boolean,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { parks } from "./reference-schema.js";

// 0001_auth.sql plus 0002_parks_and_account_hierarchy.sql. The SQL also enforces
// the allowed roles, lowercase emails, park scope per role and a single Super Admin.
export const authUsers = pgTable(
  "auth_users",
  {
    id: uuid("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    email: varchar("email", { length: 254 }).notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("RESEARCHER"),
    parkId: uuid("park_id").references(() => parks.id, {
      onDelete: "restrict",
    }),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    mustChangePassword: boolean("must_change_password")
      .notNull()
      .default(false),
    createdBy: uuid("created_by").references((): AnyPgColumn => authUsers.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("auth_users_park_idx").on(table.parkId)],
);
export const authSessions = pgTable(
  "auth_sessions",
  {
    tokenHash: char("token_hash", { length: 64 }).primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("auth_sessions_user_idx").on(table.userId),
    index("auth_sessions_expiry_idx").on(table.expiresAt),
  ],
);
