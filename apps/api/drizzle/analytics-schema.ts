import { pgTable, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { authUsers } from "./auth-schema.js";

export const exportAudits = pgTable("export_audits", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  exportType: text("export_type").notNull(),
  queryParams: jsonb("query_params").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
