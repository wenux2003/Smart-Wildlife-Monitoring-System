import type { LongitudeLatitude } from "@wr/ui";

export const waypointCategories = [
  "Sign of wildlife",
  "Hazard / snare",
  "Trail marker",
  "Other",
] as const;

export type WaypointCategory = typeof waypointCategories[number];

export type PatrolWaypointDraft = {
  id: string;
  assignmentId: string;
  category: WaypointCategory;
  note: string;
  photoName: string | null;
  position: LongitudeLatitude;
  accuracyM: number;
  observedAt: string;
};

const storageKey = (assignmentId: string) => `wr:patrol:${assignmentId}:waypoints`;

export function loadPatrolWaypoints(assignmentId?: string): PatrolWaypointDraft[] {
  if (!assignmentId) return [];
  try {
    const stored = localStorage.getItem(storageKey(assignmentId));
    return stored ? JSON.parse(stored) as PatrolWaypointDraft[] : [];
  } catch {
    return [];
  }
}

export function savePatrolWaypoint(waypoint: PatrolWaypointDraft) {
  const waypoints = loadPatrolWaypoints(waypoint.assignmentId);
  localStorage.setItem(
    storageKey(waypoint.assignmentId),
    JSON.stringify([...waypoints, waypoint]),
  );
}
