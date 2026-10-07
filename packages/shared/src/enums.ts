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

export const AlertStatus = {
  NEW: "NEW",
  DISPATCHED: "DISPATCHED",
  ACCEPTED: "ACCEPTED",
  ON_SCENE: "ON_SCENE",
  RESOLVED: "RESOLVED",
  CANCELLED: "CANCELLED",
  AUTO_RESOLVED: "AUTO_RESOLVED",
} as const;

export type AlertStatus =
  (typeof AlertStatus)[keyof typeof AlertStatus];

export const DispatchStatus = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  TIMED_OUT: "TIMED_OUT",
  ARRIVED: "ARRIVED",
  DONE: "DONE",
  CANCELLED: "CANCELLED",
} as const;

export type DispatchStatus =
  (typeof DispatchStatus)[keyof typeof DispatchStatus];

export const AlertType = {
  GEOFENCE_BREACH: "GEOFENCE_BREACH",
  IMMOBILITY: "IMMOBILITY",
  SIGNAL_LOST: "SIGNAL_LOST",
  LOW_BATTERY: "LOW_BATTERY",
} as const;

export type AlertType =
  (typeof AlertType)[keyof typeof AlertType];

export const Severity = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;

export type Severity =
  (typeof Severity)[keyof typeof Severity];
