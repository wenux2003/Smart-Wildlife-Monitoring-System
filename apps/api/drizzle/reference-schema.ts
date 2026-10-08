import {
  customType,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const geometry = customType<{ data: string; config: { type: string } }>({
  dataType(config) {
    return `geometry(${config?.type ?? "Geometry"},4326)`;
  },
});

// Matches 0002_parks_and_account_hierarchy.sql. Zones, species and incident
// types are added by later reference-data migrations; boundary is added by
// 0009_analytics.sql.
export const parks = pgTable("parks", {
  id: uuid("id").primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  terrain: text("terrain").notNull().default(""),
  config: jsonb("config").notNull().default({}),
  boundary: geometry("boundary", { type: "MultiPolygon" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index("parks_boundary_gix").using("gist", table.boundary),
]);
