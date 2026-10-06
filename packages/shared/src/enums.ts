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
