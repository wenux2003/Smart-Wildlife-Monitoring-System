import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  char,
  index,
  boolean,
  check,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
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

export const accountEvents = pgTable(
  "account_events",
  {
    id: uuid("id").primaryKey(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    targetUserId: uuid("target_user_id").references(() => authUsers.id, {
      onDelete: "restrict",
    }),
    action: text("action").notNull(),
    oldValue: jsonb("old_value"),
    newValue: jsonb("new_value"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "account_events_action_check",
      sql`${table.action} IN ('CREATED','DEACTIVATED','REACTIVATED','PASSWORD_RESET','PASSWORD_CHANGED','PARK_CHANGED','ROLE_CHANGED','RESEARCHER_ACCESS_GRANTED','RESEARCHER_ACCESS_REMOVED','PARK_CREATED')`,
    ),
    index("account_events_target_user_idx").on(table.targetUserId),
    index("account_events_created_at_idx").on(table.createdAt),
  ],
);
