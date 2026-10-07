import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
  doublePrecision,
  integer,
  uniqueIndex,
  customType,
} from "drizzle-orm/pg-core";
import { parks } from "./reference-schema.js";
import { authUsers } from "./auth-schema.js";

const geometry = customType<{ data: string; config: { type: string } }>({
  dataType(config) {
    return `geometry(${config?.type ?? "Geometry"},4326)`;
  },
});

export const collars = pgTable("collars", {
  id: uuid("id").primaryKey(),
  parkId: uuid("park_id").notNull().references(() => parks.id, { onDelete: "restrict" }),
  animalName: varchar("animal_name", { length: 100 }),
  species: varchar("species", { length: 100 }),
  latestBattery: doublePrecision("latest_battery"),
  status: text("status"),
  lastPingAt: timestamp("last_ping_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const collarPings = pgTable("collar_pings", {
  id: uuid("id").primaryKey(),
  collarId: uuid("collar_id").notNull().references(() => collars.id, { onDelete: "cascade" }),
  location: geometry("location", { type: "Point" }).notNull(),
  speed: doublePrecision("speed"),
  battery: doublePrecision("battery"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("collar_pings_collar_recorded_idx").on(table.collarId, table.recordedAt),
]);

export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey(),
  parkId: uuid("park_id").notNull().references(() => parks.id, { onDelete: "restrict" }),
  collarId: uuid("collar_id").references(() => collars.id, { onDelete: "set null" }),
  type: text("type").notNull(),
  severity: text("severity").notNull(),
  status: text("status").notNull().default("NEW"),
  location: geometry("location", { type: "Point" }),
  revision: integer("revision").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
}, (table) => [
  index("alerts_park_status_idx").on(table.parkId, table.status, table.createdAt),
]);

export const alertDispatches = pgTable("alert_dispatches", {
  id: uuid("id").primaryKey(),
  alertId: uuid("alert_id").notNull().references(() => alerts.id, { onDelete: "cascade" }),
  rangerId: uuid("ranger_id").notNull().references(() => authUsers.id, { onDelete: "restrict" }),
  status: text("status").notNull().default("PENDING"),
  notes: text("notes"),
  revision: integer("revision").notNull().default(1),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  arrivedAt: timestamp("arrived_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => [
  index("alert_dispatches_alert_status_idx").on(table.alertId, table.status),
  uniqueIndex("alert_dispatches_one_open_per_alert").on(table.alertId).where(sql`${table.status} IN ('PENDING', 'ACCEPTED', 'ARRIVED')`),
]);

export const settlements = pgTable("settlements", {
  id: uuid("id").primaryKey(),
  parkId: uuid("park_id").notNull().references(() => parks.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  location: geometry("location", { type: "Point" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
