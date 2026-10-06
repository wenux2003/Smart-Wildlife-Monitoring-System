import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  char,
  index,
} from "drizzle-orm/pg-core";

export const authUsers = pgTable("auth_users", {
  id: uuid("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 254 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("RESEARCHER"),
  parkId: uuid("park_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
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
