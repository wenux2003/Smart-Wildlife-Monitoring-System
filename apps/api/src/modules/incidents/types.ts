import type {
  Incident,
  IncidentEvent,
  CommunityMessage,
  CameraImage,
} from "@wr/shared";
export type IncidentInsert = Omit<
  Incident,
  | "revision"
  | "photoUrl"
  | "createdAt"
  | "updatedAt"
  | "receivedAt"
  | "reportedAt"
  | "assignedTo"
  | "assignedAt"
  | "firstResponseAt"
  | "resolvedAt"
  | "outcomeNotes"
> & { creationHash: string };
export type IncidentChanges = Partial<
  Pick<
    Incident,
    | "status"
    | "location"
    | "locationStatus"
    | "assignedTo"
    | "assignedAt"
    | "firstResponseAt"
    | "resolvedAt"
    | "outcomeNotes"
  >
>;
export type EventInput = Pick<
  IncidentEvent,
  "actorId" | "eventType" | "oldStatus" | "newStatus" | "notes"
>;
export type MessageInsert = Omit<
  CommunityMessage,
  "createdAt" | "incidentId"
> & { creationHash: string };
export type CameraInsert = Omit<
  CameraImage,
  | "classification"
  | "reviewerId"
  | "reviewedAt"
  | "resultingIncidentId"
  | "revision"
> & { creationHash: string };
