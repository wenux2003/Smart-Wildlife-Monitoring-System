import { z } from "zod";
import { AssignmentStatus, SessionStatus, WaypointCategory } from "./enums.js";

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
    path: z
      .array(z.tuple([z.number(), z.number()]))
      .min(2)
      .nullable(),
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

export const PatrolGpsLogSchema = z
  .object({
    clientRecordId: z.string().uuid(),
    latitude: LatitudeSchema,
    longitude: LongitudeSchema,
    accuracyM: z.number().nonnegative().nullable(),
    recordedAt: z.string().datetime(),
  })
  .strict();

export const PatrolWaypointSyncSchema = z
  .object({
    clientRecordId: z.string().uuid(),
    category: z.nativeEnum(WaypointCategory),
    note: z.string().max(500),
    photoName: z.string().max(255).nullable(),
    latitude: LatitudeSchema,
    longitude: LongitudeSchema,
    accuracyM: z.number().nonnegative().nullable(),
    observedAt: z.string().datetime(),
  })
  .strict();

export const PatrolSessionSyncSchema = z
  .object({
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
  })
  .strict();

export const PatrolSyncRequestSchema = z
  .object({
    patrolSession: PatrolSessionSyncSchema,
    gpsLogs: z.array(PatrolGpsLogSchema).max(10_000),
    waypoints: z.array(PatrolWaypointSyncSchema).max(1_000),
  })
  .strict();

export const PatrolSyncResponseSchema = z
  .object({
    sessionId: z.string().uuid(),
    clientRevision: z.number().int().positive(),
    syncedGpsRecordIds: z.array(z.string().uuid()),
    syncedWaypointRecordIds: z.array(z.string().uuid()),
    status: z.nativeEnum(SessionStatus),
  })
  .strict();

export type PatrolSyncRequest = z.infer<typeof PatrolSyncRequestSchema>;
export type PatrolSyncResponse = z.infer<typeof PatrolSyncResponseSchema>;

export const CollarSchema = z.object({
  id: z.string().uuid(),
  parkId: z.string().uuid(),
  animalName: z.string().nullable(),
  species: z.string().nullable(),
  latestBattery: z.number().nullable(),
  status: z.string().nullable(),
  lastPingAt: z.string().datetime().nullable(),
  location: z.tuple([z.number(), z.number()]).nullable(),
});
export type Collar = z.infer<typeof CollarSchema>;

export const AlertSchema = z.object({
  id: z.string().uuid(),
  parkId: z.string().uuid(),
  collarId: z.string().uuid().nullable(),
  type: z.string(),
  severity: z.string(),
  status: z.string(),
  location: z.tuple([z.number(), z.number()]).nullable(),
  createdAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable(),
  resolutionReason: z.string().nullable().optional(),
  isBroadcast: z.boolean().optional(),
  hasActiveDispatch: z.boolean().optional(),
});
export type Alert = z.infer<typeof AlertSchema>;

export const AlertContextSchema = z.object({
  settlements: z.array(z.object({ name: z.string(), distanceM: z.number() })),
  cameras: z.array(z.object({ name: z.string(), distanceM: z.number() })),
  history: z.array(z.object({ timestamp: z.string().datetime(), event: z.string() })),
});

export const RangerDistanceSchema = z.object({
  rangerId: z.string().uuid(),
  name: z.string(),
  distanceM: z.number().nullable(),
});
export const RangerDistanceListSchema = z.array(RangerDistanceSchema);


export const CollarPingSchema = z.object({
  id: z.string().uuid(),
  collarId: z.string().uuid(),
  location: z.tuple([z.number(), z.number()]),
  speed: z.number().nullable(),
  battery: z.number().nullable(),
  recordedAt: z.string().datetime(),
});
export type CollarPing = z.infer<typeof CollarPingSchema>;

export const AlertDispatchSchema = z.object({
  id: z.string().uuid(),
  alertId: z.string().uuid(),
  rangerId: z.string().uuid(),
  status: z.string(),
  notes: z.string().nullable(),
  sentAt: z.string().datetime(),
  respondedAt: z.string().datetime().nullable(),
  arrivedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  alertType: z.string().optional(),
  alertSeverity: z.string().optional(),
  alertLocation: z.tuple([z.number(), z.number()]).nullable().optional(),
  animalName: z.string().nullable().optional(),
});
export type AlertDispatch = z.infer<typeof AlertDispatchSchema>;

export const AlertListSchema = z.array(AlertSchema);
export const CollarListSchema = z.array(CollarSchema);
export const CollarPingListSchema = z.array(CollarPingSchema);
export const AlertDispatchListSchema = z.array(AlertDispatchSchema);

export const IncidentReviewSchema = z.object({
  id: z.string().uuid(),
  incidentId: z.string().uuid(),
  reviewerId: z.string().uuid(),
  notes: z.string(),
  createdAt: z.string().datetime(),
});
export type IncidentReview = z.infer<typeof IncidentReviewSchema>;
export const IncidentReviewListSchema = z.array(IncidentReviewSchema);
