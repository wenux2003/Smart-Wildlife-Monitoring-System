import type { AssignmentStatus, PatrolAssignmentSummary } from "@wr/shared";

export type PatrolAssignmentRecord = {
  id: string;
  status: AssignmentStatus;
  assigned_at: Date;
  route_id: string;
  route_name: string;
  sector: string;
  description: string;
  estimated_distance_m: number;
  route_version: number;
  coverage_percentage: number;
  completed_at: Date | null;
};

export type { PatrolAssignmentSummary };
