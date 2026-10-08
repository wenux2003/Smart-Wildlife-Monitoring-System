import {
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  customType,
  index,
  integer,
  doublePrecision,
  boolean,
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
    parkId: uuid("park_id")
      .notNull()
      .references(() => parks.id, { onDelete: "restrict" }),
    reporterId: uuid("reporter_id").references(() => authUsers.id, {
      onDelete: "set null",
    }), // Can be null for community/SMS
    type: varchar("type", { length: 50 }).notNull(), // e.g., 'POACHING', 'CROP_DAMAGE', 'INJURED_ANIMAL'
    status: varchar("status", { length: 30 }).notNull().default("NEW"),
    description: text("description").notNull(),
    location: geometry("location", { type: "Point" }),
    photoUrl: text("photo_url"),
    source: text("source").notNull().default("RANGER"),
    locationStatus: text("location_status").notNull().default("UNRESOLVED"),
    locationText: text("location_text"),
    locationAccuracy: doublePrecision("location_accuracy"),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    reporterPhone: text("reporter_phone"),
    revision: integer("revision").notNull().default(1),
    assignedTo: uuid("assigned_to").references(() => authUsers.id, {
      onDelete: "restrict",
    }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }),
    firstResponseAt: timestamp("first_response_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    outcomeNotes: text("outcome_notes"),
    creationHash: text("creation_hash"),
    reportedAt: timestamp("reported_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("incidents_park_status_idx").on(table.parkId, table.status),
    index("incidents_reported_at_idx").on(table.reportedAt),
  ],
);

export const incidentEvents = pgTable(
  "incident_events",
  {
    id: uuid("id").primaryKey(),
    incidentId: uuid("incident_id")
      .notNull()
      .references(() => incidents.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => authUsers.id, {
      onDelete: "restrict",
    }),
    eventType: text("event_type").notNull(),
    oldStatus: text("old_status"),
    newStatus: text("new_status"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("incident_events_incident_idx").on(table.incidentId, table.createdAt),
  ],
);
export const incidentMedia = pgTable("incident_media", {
  id: uuid("id").primaryKey(),
  incidentId: uuid("incident_id")
    .notNull()
    .references(() => incidents.id, { onDelete: "cascade" }),
  dataUrl: text("data_url").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const communityMessages = pgTable("community_messages", {
  id: uuid("id").primaryKey(),
  incidentId: uuid("incident_id")
    .notNull()
    .references(() => incidents.id, { onDelete: "cascade" }),
  providerMessageId: text("provider_message_id").unique(),
  phone: text("phone").notNull(),
  rawText: text("raw_text").notNull(),
  locationText: text("location_text").notNull(),
  state: text("state").notNull(),
  creationHash: text("creation_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const communityFollowUps = pgTable("community_follow_ups", {
  id: uuid("id").primaryKey(),
  messageId: uuid("message_id")
    .notNull()
    .references(() => communityMessages.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id")
    .notNull()
    .references(() => authUsers.id, { onDelete: "restrict" }),
  text: text("text").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  state: text("state").notNull().default("SENT"),
});
export const incidentLandmarks = pgTable("incident_landmarks", {
  id: uuid("id").primaryKey(),
  parkId: uuid("park_id")
    .notNull()
    .references(() => parks.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
});
export const cameraImages = pgTable(
  "camera_images",
  {
    id: uuid("id").primaryKey(),
    parkId: uuid("park_id")
      .notNull()
      .references(() => parks.id, { onDelete: "restrict" }),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    dataUrl: text("data_url").notNull(),
    personFlag: boolean("person_flag").notNull().default(false),
    classification: text("classification").notNull().default("PENDING"),
    reviewerId: uuid("reviewer_id").references(() => authUsers.id, {
      onDelete: "restrict",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    resultingIncidentId: uuid("resulting_incident_id").references(
      () => incidents.id,
      { onDelete: "restrict" },
    ),
    revision: integer("revision").notNull().default(1),
    creationHash: text("creation_hash").notNull(),
  },
  (table) => [index("camera_images_park_idx").on(table.parkId)],
);

export const incidentReviews = pgTable(
  "incident_reviews",
  {
    id: uuid("id").primaryKey(),
    incidentId: uuid("incident_id")
      .notNull()
      .references(() => incidents.id, { onDelete: "cascade" }),
    reviewerId: uuid("reviewer_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    notes: text("notes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("incident_reviews_incident_idx").on(table.incidentId)],
);
