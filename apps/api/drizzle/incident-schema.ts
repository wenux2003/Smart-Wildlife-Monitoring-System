import {
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  customType,
  index,
} from "drizzle-orm/pg-core";
import { authUsers } from "./auth-schema.js";
import { parks } from "./reference-schema.js";

const geometry = customType<{ data: string; config: { type: string } }>({
  dataType(config) {
    return `geometry(${config?.type ?? "Geometry"},4326)`;
  },
});

export const incidents = pgTable(
  "incidents",
  {
    id: uuid("id").primaryKey(),
    parkId: uuid("park_id").notNull().references(() => parks.id, { onDelete: "restrict" }),
    reporterId: uuid("reporter_id").references(() => authUsers.id, { onDelete: "set null" }), // Can be null for community/SMS
    type: varchar("type", { length: 50 }).notNull(), // e.g., 'POACHING', 'CROP_DAMAGE', 'INJURED_ANIMAL'
    status: varchar("status", { length: 30 }).notNull().default("NEW"),
    description: text("description").notNull(),
    location: geometry("location", { type: "Point" }),
    photoUrl: text("photo_url"),
    reportedAt: timestamp("reported_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("incidents_park_status_idx").on(table.parkId, table.status),
    index("incidents_reported_at_idx").on(table.reportedAt),
  ]
);

export const incidentReviews = pgTable(
  "incident_reviews",
  {
    id: uuid("id").primaryKey(),
    incidentId: uuid("incident_id").notNull().references(() => incidents.id, { onDelete: "cascade" }),
    reviewerId: uuid("reviewer_id").notNull().references(() => authUsers.id, { onDelete: "restrict" }),
    notes: text("notes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("incident_reviews_incident_idx").on(table.incidentId),
  ]
);
