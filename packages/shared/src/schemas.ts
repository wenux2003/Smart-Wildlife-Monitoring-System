import { z } from "zod";
import { AssignmentStatus, IncidentStatus } from "./enums.js";

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

export const IncidentSchema = z.object({
  id: z.string().uuid(),
  parkId: z.string().uuid(),
  reporterId: z.string().uuid().nullable(),
  type: z.string(),
  status: z.nativeEnum(IncidentStatus),
  description: z.string(),
  location: z.tuple([z.number(), z.number()]).nullable(),
  photoUrl: z.string().nullable(),
  reportedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Incident = z.infer<typeof IncidentSchema>;
export const IncidentListSchema = z.array(IncidentSchema);

export const IncidentReviewSchema = z.object({
  id: z.string().uuid(),
  incidentId: z.string().uuid(),
  reviewerId: z.string().uuid(),
  notes: z.string(),
  createdAt: z.string().datetime(),
});
export type IncidentReview = z.infer<typeof IncidentReviewSchema>;
export const IncidentReviewListSchema = z.array(IncidentReviewSchema);
