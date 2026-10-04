export const Role = {
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
