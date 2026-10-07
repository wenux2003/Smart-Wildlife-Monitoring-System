import { afterEach, describe, expect, it } from "vitest";
import { AssignmentStatus, Role } from "@wr/shared";
import { createServer } from "../../server.js";
import type { AuthUser } from "../auth/repository.js";
import { sessionToken, tokenHash } from "../auth/security.js";
import { memoryRepository } from "../auth/testing.js";
import type { PatrolRepository } from "./repository.js";

const NOW = new Date("2026-10-07T10:30:00.000Z");
const YALA = "11111111-1111-4111-8111-111111111111";
const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

function setup(role: Role = Role.RANGER) {
  const auth = memoryRepository();
  const id = "10000000-0000-4000-8000-000000000001";
  const user: AuthUser = {
    id,
    name: "Test Ranger",
    email: "ranger@example.org",
    password_hash: "unused",
    role,
    park_id: YALA,
    park_name: "Yala National Park",
    disabled_at: null,
    must_change_password: false,
  };
  auth.users.set(id, user);
  const token = sessionToken();
  auth.sessions.set(tokenHash(token), {
    id,
    expires: new Date(NOW.getTime() + 60_000),
  });
  const patrolRepository: PatrolRepository = {
    async listForRanger(rangerId, parkId) {
      expect(rangerId).toBe(id);
      expect(parkId).toBe(YALA);
      return [{
        id: "50000000-0000-4000-8000-000000000001",
        status: AssignmentStatus.ASSIGNED,
        assigned_at: new Date("2026-10-07T10:00:00.000Z"),
        route_id: "40000000-0000-4000-8000-000000000001",
        route_name: "Trail 4B",
        sector: "Southern Ridge",
        description: "Boundary patrol",
        estimated_distance_m: 4200,
        route_version: 1,
        route_path: [[81.516, 6.372], [81.523, 6.365]],
        coverage_percentage: 0,
        completed_at: null,
      }];
    },
    async syncPatrol(rangerId, parkId, payload) {
      expect(rangerId).toBe(id);
      expect(parkId).toBe(YALA);
      return {
        sessionId: payload.patrolSession.id,
        clientRevision: payload.patrolSession.clientRevision,
        syncedGpsRecordIds: payload.gpsLogs.map((point) => point.clientRecordId),
        syncedWaypointRecordIds: payload.waypoints.map((waypoint) => waypoint.clientRecordId),
        status: payload.patrolSession.status,
      };
    },
  };
  const server = createServer({
    repository: auth.repository,
    patrolRepository,
    clock: { now: () => NOW },
  });
  servers.push(server);
  return { server, cookie: `wr_session=${token}` };
}

describe("ranger patrol assignments", () => {
  it("returns only the signed-in ranger's park-scoped assignments", async () => {
    const { server, cookie } = setup();
    const response = await server.inject({
      method: "GET",
      url: "/api/patrol-assignments/mine",
      headers: { cookie },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([{
      id: "50000000-0000-4000-8000-000000000001",
      status: "ASSIGNED",
      assignedAt: "2026-10-07T10:00:00.000Z",
      route: {
        id: "40000000-0000-4000-8000-000000000001",
        name: "Trail 4B",
        sector: "Southern Ridge",
        description: "Boundary patrol",
        estimatedDistanceKm: 4.2,
        version: 1,
        path: [[81.516, 6.372], [81.523, 6.365]],
      },
      coveragePercentage: 0,
      completedAt: null,
    }]);
  });

  it("rejects non-ranger roles", async () => {
    const { server, cookie } = setup(Role.PARK_MANAGER);
    const response = await server.inject({
      method: "GET",
      url: "/api/patrol-assignments/mine",
      headers: { cookie },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().code).toBe("FORBIDDEN");
  });

  it("syncs a client-generated session and child records as one batch", async () => {
    const { server, cookie } = setup();
    const sessionId = "60000000-0000-4000-8000-000000000002";
    const gpsId = "70000000-0000-4000-8000-000000000001";
    const waypointId = "80000000-0000-4000-8000-000000000001";
    const response = await server.inject({
      method: "POST",
      url: "/api/patrol-sessions/sync",
      headers: { cookie },
      payload: {
        patrolSession: {
          id: sessionId,
          assignmentId: "50000000-0000-4000-8000-000000000001",
          routeId: "40000000-0000-4000-8000-000000000001",
          rangerId: "10000000-0000-4000-8000-000000000001",
          clientRevision: 1,
          status: "ACTIVE",
          startedAt: "2026-10-07T10:00:00.000Z",
          endedAt: null,
          distanceM: 22,
          durationSeconds: 300,
        },
        gpsLogs: [{
          clientRecordId: gpsId,
          latitude: 6.365,
          longitude: 81.523,
          accuracyM: 8,
          recordedAt: "2026-10-07T10:05:00.000Z",
        }],
        waypoints: [{
          clientRecordId: waypointId,
          category: "WILDLIFE_SIGN",
          note: "Fresh tracks",
          photoName: null,
          latitude: 6.365,
          longitude: 81.523,
          accuracyM: 8,
          observedAt: "2026-10-07T10:05:00.000Z",
        }],
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      sessionId,
      clientRevision: 1,
      syncedGpsRecordIds: [gpsId],
      syncedWaypointRecordIds: [waypointId],
      status: "ACTIVE",
    });
  });
});
