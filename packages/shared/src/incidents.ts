import { z } from "zod";
import { IncidentStatus } from "./enums.js";

export const IncidentSourceSchema = z.enum([
  "RANGER",
  "COMMUNITY",
  "CAMERA_TRAP",
]);
export const LocationStatusSchema = z.enum([
  "GPS",
  "MANUAL",
  "LANDMARK",
  "UNRESOLVED",
]);
export const SyncStatusSchema = z.enum([
  "PENDING",
  "SYNCING",
  "SYNCED",
  "FAILED",
]);
export const CameraReviewSchema = z.enum([
  "PENDING",
  "WILDLIFE",
  "AUTHORIZED_PERSON",
  "SUSPICIOUS_ACTIVITY",
  "UNSURE",
]);
export const CoordinatesSchema = z
  .object({
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
  })
  .strict();
export const IncidentCategorySchema = z.enum([
  "POACHING",
  "INJURED_ANIMAL",
  "SNARE_FOUND",
  "FENCE_DAMAGE",
  "HUMAN_WILDLIFE_CONFLICT",
  "CROP_DAMAGE",
  "OTHER",
]);
const notes = z.string().trim().min(1).max(4000);
export const IncidentCreateSchema = z
  .object({
    id: z.string().uuid(),
    parkId: z.string().uuid(),
    type: IncidentCategorySchema,
    description: notes,
    capturedAt: z.string().datetime(),
    location: CoordinatesSchema,
    locationStatus: z.enum(["GPS", "MANUAL"]),
    locationAccuracy: z
      .number()
      .finite()
      .nonnegative()
      .nullable()
      .default(null),
  })
  .strict();
export type IncidentCreate = z.infer<typeof IncidentCreateSchema>;
export const IncidentSchema = z.object({
  id: z.string().uuid(),
  parkId: z.string().uuid(),
  reporterId: z.string().uuid().nullable(),
  source: IncidentSourceSchema,
  type: z.string(),
  status: z.nativeEnum(IncidentStatus),
  description: z.string(),
  location: CoordinatesSchema.nullable(),
  locationStatus: LocationStatusSchema,
  locationText: z.string().nullable(),
  locationAccuracy: z.number().nullable(),
  photoUrl: z.string().nullable(),
  capturedAt: z.string().datetime(),
  receivedAt: z.string().datetime(),
  reportedAt: z.string().datetime(),
  reporterPhone: z.string().nullable(),
  revision: z.number().int().positive(),
  assignedTo: z.string().uuid().nullable(),
  assignedAt: z.string().datetime().nullable(),
  firstResponseAt: z.string().datetime().nullable(),
  resolvedAt: z.string().datetime().nullable(),
  outcomeNotes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Incident = z.infer<typeof IncidentSchema>;
export const IncidentListSchema = z.array(IncidentSchema);
export const IncidentEventSchema = z.object({
  id: z.string().uuid(),
  incidentId: z.string().uuid(),
  actorId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  eventType: z.string(),
  oldStatus: z.nativeEnum(IncidentStatus).nullable(),
  newStatus: z.nativeEnum(IncidentStatus).nullable(),
  notes: z.string().nullable(),
});
export type IncidentEvent = z.infer<typeof IncidentEventSchema>;
export const RevisionSchema = z
  .object({ expectedRevision: z.number().int().positive() })
  .strict();
export const IncidentStatusUpdateSchema = RevisionSchema.extend({
  status: z.nativeEnum(IncidentStatus),
  notes: notes.optional(),
});
export const IncidentLocationUpdateSchema = RevisionSchema.extend({
  location: CoordinatesSchema,
  notes: notes,
});
export const IncidentAssignSchema = RevisionSchema.extend({
  responderId: z.string().uuid(),
});
export const IncidentResponseSchema = RevisionSchema.extend({
  action: z.enum(["START", "RESOLVE"]),
  outcomeNotes: notes.optional(),
});
export const ImageDataSchema = z
  .string()
  .max(600000)
  .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/)
  .refine((value) => {
    const [header, body] = value.split(",");
    if (!body) return false;
    return (
      body.length % 4 === 0 &&
      (header.includes("png")
        ? body.startsWith("iVBORw0KGgo")
        : header.includes("jpeg")
          ? body.startsWith("/9j/")
          : body.startsWith("UklGR"))
    );
  }, "Choose a valid PNG, JPEG or WebP image under 400 KB.");
export const IncidentMediaCreateSchema = z
  .object({ id: z.string().uuid(), dataUrl: ImageDataSchema })
  .strict();
export const IncidentMediaSchema = IncidentMediaCreateSchema.extend({
  incidentId: z.string().uuid(),
  createdAt: z.string().datetime(),
});
export type IncidentMedia = z.infer<typeof IncidentMediaSchema>;
const phone = z
  .string()
  .trim()
  .min(7)
  .max(30)
  .regex(/^[+\d ()-]+$/);
export const CommunityReportSchema = z
  .object({
    id: z.string().uuid(),
    parkId: z.string().uuid(),
    phone,
    description: notes,
    locationText: z.string().trim().min(1).max(1000),
    type: IncidentCategorySchema.default("HUMAN_WILDLIFE_CONFLICT"),
  })
  .strict();
export const CommunitySmsSchema = z
  .object({
    providerMessageId: z.string().trim().min(1).max(150),
    parkId: z.string().uuid(),
    phone,
    rawText: z
      .string()
      .min(1)
      .max(4000)
      .refine((value) => value.trim().length > 0),
  })
  .strict();
export const CommunityMessageSchema = z.object({
  id: z.string().uuid(),
  incidentId: z.string().uuid(),
  providerMessageId: z.string().nullable(),
  phone: z.string(),
  rawText: z.string(),
  locationText: z.string(),
  state: z.enum(["RECEIVED", "NEEDS_INFO", "FOLLOW_UP_SENT"]),
  createdAt: z.string().datetime(),
});
export type CommunityMessage = z.infer<typeof CommunityMessageSchema>;
export const CommunityFollowUpSchema = z
  .object({ id: z.string().uuid(), text: notes })
  .strict();
export const CommunityFollowUpRecordSchema = CommunityFollowUpSchema.extend({
  messageId: z.string().uuid(),
  actorId: z.string().uuid(),
  sentAt: z.string().datetime(),
  state: z.literal("SENT"),
});
export type CommunityFollowUp = z.infer<typeof CommunityFollowUpRecordSchema>;
export const CameraCreateSchema = z
  .object({
    id: z.string().uuid(),
    parkId: z.string().uuid(),
    capturedAt: z.string().datetime(),
    location: CoordinatesSchema,
    dataUrl: ImageDataSchema,
    personFlag: z.boolean().default(false),
  })
  .strict();
export const CameraImageSchema = CameraCreateSchema.extend({
  classification: CameraReviewSchema,
  reviewerId: z.string().uuid().nullable(),
  reviewedAt: z.string().datetime().nullable(),
  resultingIncidentId: z.string().uuid().nullable(),
  revision: z.number().int().positive(),
});
export type CameraImage = z.infer<typeof CameraImageSchema>;
export const CameraReviewUpdateSchema = RevisionSchema.extend({
  classification: z.enum([
    "WILDLIFE",
    "AUTHORIZED_PERSON",
    "SUSPICIOUS_ACTIVITY",
    "UNSURE",
  ]),
  notes,
});
export const ResponderSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});
export const PublicParkSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});
export const IncidentDetailSchema = z.object({
  incident: IncidentSchema,
  history: z.array(IncidentEventSchema),
  media: z.array(IncidentMediaSchema),
  messages: z.array(CommunityMessageSchema),
  followUps: z.array(CommunityFollowUpRecordSchema),
});
export type IncidentDetail = z.infer<typeof IncidentDetailSchema>;
