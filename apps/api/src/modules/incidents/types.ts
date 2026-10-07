import type { IncidentStatus } from "@wr/shared";

export type IncidentRecord = {
  id: string;
  park_id: string;
  reporter_id: string | null;
  type: string;
  status: IncidentStatus;
  description: string;
  location: [number, number] | null;
  photo_url: string | null;
  reported_at: Date;
  created_at: Date;
  updated_at: Date;
};

export type IncidentReviewRecord = {
  id: string;
  incident_id: string;
  reviewer_id: string;
  notes: string;
  created_at: Date;
};
