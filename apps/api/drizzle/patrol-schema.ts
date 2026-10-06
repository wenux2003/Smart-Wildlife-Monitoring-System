import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { authUsers } from "./auth-schema.js";
import { parks } from "./reference-schema.js";

const geometry = customType<{ data: string; config: { type: string } }>({
  dataType(config) {
    return `geometry(${config?.type ?? "Geometry"},4326)`;
  },
});

export const patrolRoutes = pgTable(
  "patrol_routes",
  {
    id: uuid("id").primaryKey(),
    parkId: uuid("park_id").notNull().references(() => parks.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 32 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    sector: varchar("sector", { length: 120 }).notNull(),
    description: text("description").notNull().default(""),
    routeGeometry: geometry("route_geometry", { type: "LineString" }),
    targetArea: geometry("target_area", { type: "Polygon" }),
    estimatedDistanceM: integer("estimated_distance_m").notNull(),
    version: integer("version").notNull().default(1),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("patrol_routes_park_code_unique").on(table.parkId, table.code),
    index("patrol_routes_park_active_idx").on(table.parkId, table.active),
    check("patrol_routes_distance_check", sql`${table.estimatedDistanceM} > 0`),
    check("patrol_routes_version_check", sql`${table.version} > 0`),
  ],
);

export const patrolAssignments = pgTable(
  "patrol_assignments",
  {
    id: uuid("id").primaryKey(),
    routeId: uuid("route_id").notNull().references(() => patrolRoutes.id, { onDelete: "restrict" }),
    routeVersion: integer("route_version").notNull(),
    rangerId: uuid("ranger_id").notNull().references(() => authUsers.id, { onDelete: "restrict" }),
    assignedBy: uuid("assigned_by").notNull().references(() => authUsers.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("ASSIGNED"),
    revision: integer("revision").notNull().default(1),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("patrol_assignments_ranger_status_idx").on(table.rangerId, table.status, table.assignedAt),
    uniqueIndex("patrol_assignments_one_active_ranger").on(table.rangerId).where(sql`${table.status} = 'ACTIVE'`),
  ],
);

export const patrolSessions = pgTable(
  "patrol_sessions",
  {
    id: uuid("id").primaryKey(),
    assignmentId: uuid("assignment_id").notNull().unique().references(() => patrolAssignments.id, { onDelete: "restrict" }),
    status: text("status").notNull(),
    revision: integer("revision").notNull().default(1),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    terminationReason: text("termination_reason"),
    distanceM: doublePrecision("distance_m").notNull().default(0),
    coveragePercent: doublePrecision("coverage_percent").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("patrol_sessions_status_idx").on(table.status, table.startedAt)],
);
