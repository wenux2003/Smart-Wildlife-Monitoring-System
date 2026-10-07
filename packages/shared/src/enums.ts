export const Role = {
  SUPER_ADMIN: "SUPER_ADMIN",
  RANGER: "RANGER",
  PARK_MANAGER: "PARK_MANAGER",
  LIAISON_OFFICER: "LIAISON_OFFICER",
  RESEARCHER: "RESEARCHER",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const IncidentStatus = {
  NEW: "NEW",
  VERIFIED: "VERIFIED",
  IN_PROGRESS: "IN_PROGRESS",
  RESOLVED: "RESOLVED",
  REJECTED: "REJECTED",
} as const;

export type IncidentStatus =
  (typeof IncidentStatus)[keyof typeof IncidentStatus];

export const AssignmentStatus = {
  ASSIGNED: "ASSIGNED",
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
  PARTIAL: "PARTIAL",
  CANCELLED: "CANCELLED",
} as const;

export type AssignmentStatus =
  (typeof AssignmentStatus)[keyof typeof AssignmentStatus];

export const SessionStatus = {
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
  PARTIAL: "PARTIAL",
} as const;

export type SessionStatus =
  (typeof SessionStatus)[keyof typeof SessionStatus];

export const SyncStatus = {
  SYNCED: "SYNCED",
  PENDING_SYNC: "PENDING_SYNC",
  FAILED: "FAILED",
} as const;

export type SyncStatus = (typeof SyncStatus)[keyof typeof SyncStatus];

export const WaypointCategory = {
  WILDLIFE_SIGN: "WILDLIFE_SIGN",
  HAZARD_SNARE: "HAZARD_SNARE",
  TRAIL_MARKER: "TRAIL_MARKER",
  OTHER: "OTHER",
} as const;

export type WaypointCategory =
  (typeof WaypointCategory)[keyof typeof WaypointCategory];
