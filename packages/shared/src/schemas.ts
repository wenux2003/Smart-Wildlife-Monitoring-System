import { z } from "zod";
import {
  AssignmentStatus,
  SessionStatus,
  WaypointCategory,
} from "./enums.js";

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const PatrolAssignmentSummarySchema = z.object({
  id: z.string().uuid(),
  status: z.nativeEnum(AssignmentStatus),
  assignedAt: z.string().datetime(),
  route: z.object({
    id: z.string().uuid(),
    name: z.string(),
    sector: z.string(),
    description: z.string(),
    estimatedDistanceKm: z.number().positive(),
    version: z.number().int().positive(),
    path: z.array(z.tuple([z.number(), z.number()])).min(2).nullable(),
  }),
  coveragePercentage: z.number().min(0).max(100),
  completedAt: z.string().datetime().nullable(),
});

export const PatrolAssignmentSummaryListSchema = z.array(
  PatrolAssignmentSummarySchema,
);

export type PatrolAssignmentSummary = z.infer<
  typeof PatrolAssignmentSummarySchema
>;

const LatitudeSchema = z.number().min(-90).max(90);
const LongitudeSchema = z.number().min(-180).max(180);

export const PatrolGpsLogSchema = z.object({
  clientRecordId: z.string().uuid(),
  latitude: LatitudeSchema,
  longitude: LongitudeSchema,
  accuracyM: z.number().nonnegative().nullable(),
  recordedAt: z.string().datetime(),
}).strict();

export const PatrolWaypointSyncSchema = z.object({
  clientRecordId: z.string().uuid(),
  category: z.nativeEnum(WaypointCategory),
  note: z.string().max(500),
  photoName: z.string().max(255).nullable(),
  latitude: LatitudeSchema,
  longitude: LongitudeSchema,
  accuracyM: z.number().nonnegative().nullable(),
  observedAt: z.string().datetime(),
}).strict();

export const PatrolSessionSyncSchema = z.object({
  id: z.string().uuid(),
  assignmentId: z.string().uuid(),
  routeId: z.string().uuid(),
  rangerId: z.string().uuid(),
  clientRevision: z.number().int().positive(),
  status: z.nativeEnum(SessionStatus),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
  distanceM: z.number().nonnegative(),
  durationSeconds: z.number().int().nonnegative(),
}).strict();

export const PatrolSyncRequestSchema = z.object({
  patrolSession: PatrolSessionSyncSchema,
  gpsLogs: z.array(PatrolGpsLogSchema).max(10_000),
  waypoints: z.array(PatrolWaypointSyncSchema).max(1_000),
}).strict();

export const PatrolSyncResponseSchema = z.object({
  sessionId: z.string().uuid(),
  clientRevision: z.number().int().positive(),
  syncedGpsRecordIds: z.array(z.string().uuid()),
  syncedWaypointRecordIds: z.array(z.string().uuid()),
  status: z.nativeEnum(SessionStatus),
}).strict();

export type PatrolSyncRequest = z.infer<typeof PatrolSyncRequestSchema>;
export type PatrolSyncResponse = z.infer<typeof PatrolSyncResponseSchema>;
