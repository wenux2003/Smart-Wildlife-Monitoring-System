import { z } from "zod";
import { AssignmentStatus } from "./enums.js";

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
