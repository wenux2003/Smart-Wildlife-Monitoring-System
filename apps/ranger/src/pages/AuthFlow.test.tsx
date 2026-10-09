// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { App } from "../app/App.js";

vi.mock("@wr/offline", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@wr/offline")>();
  type Session = {
    id: string;
    assignmentId: string;
    rangerId: string;
    route: Record<string, unknown>;
    revision: number;
    status: "ACTIVE" | "COMPLETED";
    startedAt: string;
    endedAt: string | null;
    distanceM: number;
    durationSeconds: number;
    syncStatus: "PENDING_SYNC" | "SYNCED";
    lastSyncError: null;
  };
  const sessions = new Map<string, Session>();
  const gpsLogs: Record<string, unknown>[] = [];
  const waypoints: Record<string, unknown>[] = [];
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  return {
    ...actual,
    startOfflinePatrol: vi.fn(async (input) => {
      const existing = sessions.get(input.assignmentId);
      if (existing) return existing;
      const session: Session = {
        id: "60000000-0000-4000-8000-000000000002",
        ...input,
        revision: 1,
        status: "ACTIVE",
        startedAt: new Date().toISOString(),
        endedAt: null,
        distanceM: 0,
        durationSeconds: 0,
        syncStatus: "PENDING_SYNC",
        lastSyncError: null,
      };
      sessions.set(input.assignmentId, session);
      notify();
      return session;
    }),
    getPatrolByAssignment: vi.fn(async (assignmentId) =>
      sessions.get(assignmentId),
    ),
    getGpsLogs: vi.fn(async (sessionId) =>
      gpsLogs.filter((item) => item.sessionId === sessionId),
    ),
    getWaypoints: vi.fn(async (sessionId) =>
      waypoints.filter((item) => item.sessionId === sessionId),
    ),
    addGpsLog: vi.fn(async (input) => {
      const point = {
        ...input,
        clientRecordId: crypto.randomUUID(),
        syncStatus: "PENDING_SYNC",
      };
      gpsLogs.push(point);
      notify();
      return point;
    }),
    addWaypoint: vi.fn(async (input) => {
      const waypoint = {
        ...input,
        clientRecordId: crypto.randomUUID(),
        syncStatus: "PENDING_SYNC",
      };
      waypoints.push(waypoint);
      notify();
      return waypoint;
    }),
    endOfflinePatrol: vi.fn(async (sessionId) => {
      const session = [...sessions.values()].find(
        (item) => item.id === sessionId,
      )!;
      session.status = "COMPLETED";
      session.endedAt = new Date().toISOString();
      notify();
      return session;
    }),
    countPendingPatrolRecords: vi.fn(
      async () => gpsLogs.length + waypoints.length + sessions.size,
    ),
    subscribeToPatrolChanges: vi.fn((listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }),
    getPendingSyncBundles: vi.fn(async () => []),
    markPatrolSynced: vi.fn(),
    markPatrolSyncFailed: vi.fn(),
  };
});

function response(body: object, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function rangerUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "ranger-1",
    name: "Kamal Perera",
    email: "kamal@example.org",
    role: "RANGER",
    parkId: "park-1",
    parkName: "Yala National Park",
    mustChangePassword: false,
    ...overrides,
  };
}

function patrolAssignments() {
  const route = (id: string, name: string, distance: number) => ({
    id,
    name,
    sector: "Southern Ridge",
    description: `${name} patrol route`,
    estimatedDistanceKm: distance,
    version: 1,
    path: [
      [81.516, 6.372],
      [81.523, 6.365],
      [81.531, 6.359],
    ],
  });
  return [
    {
      id: "50000000-0000-4000-8000-000000000001",
      status: "ASSIGNED",
      assignedAt: "2026-10-07T10:00:00.000Z",
      route: route("40000000-0000-4000-8000-000000000001", "Trail 4B", 4.2),
      coveragePercentage: 0,
      completedAt: null,
    },
    {
      id: "50000000-0000-4000-8000-000000000002",
      status: "ASSIGNED",
      assignedAt: "2026-10-07T10:15:00.000Z",
      route: route("40000000-0000-4000-8000-000000000002", "Trail 4C", 4.7),
      coveragePercentage: 0,
      completedAt: null,
    },
    {
      id: "50000000-0000-4000-8000-000000000003",
      status: "COMPLETED",
      assignedAt: "2026-10-06T10:15:00.000Z",
      route: route("40000000-0000-4000-8000-000000000003", "Trail 3A", 3.8),
      coveragePercentage: 100,
      completedAt: "2026-10-06T12:00:00.000Z",
    },
  ];
}

function renderApp(path = "/login") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        response({ message: "Please sign in to continue." }, 401),
      ),
  );
});

describe("Merged offline identity access", () => {
  const cachedUser = () =>
    rangerUser({
      id: "33333333-3333-4333-8333-333333333333",
      parkId: "11111111-1111-4111-8111-111111111111",
    });
  it.each(["/", "/incidents"])(
    "restores local access to %s from the patrol identity cache",
    async (path) => {
      localStorage.setItem(
        "wr:ranger:offline-user",
        JSON.stringify(cachedUser()),
      );
      vi.mocked(fetch).mockRejectedValue(new Error("Offline"));
      renderApp(path);
      await screen.findByRole("heading", {
        name: path === "/" ? "Patrol" : "My incidents",
      });
      expect(localStorage.getItem("wr-ranger-capture-identity")).not.toBeNull();
    },
  );
  it("clears both identities when the server rejects the session", async () => {
    localStorage.setItem(
      "wr:ranger:offline-user",
      JSON.stringify(cachedUser()),
    );
    localStorage.setItem(
      "wr-ranger-capture-identity",
      JSON.stringify({ user: cachedUser(), savedAt: Date.now() }),
    );
    renderApp("/");
    await screen.findByRole("form", { name: "Ranger sign in" });
    expect(localStorage.getItem("wr:ranger:offline-user")).toBeNull();
    expect(localStorage.getItem("wr-ranger-capture-identity")).toBeNull();
  });
});

afterEach(() => {
  cleanup();
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value: true,
  });
  vi.unstubAllGlobals();
});

describe("Ranger account access", () => {
  it("signs in a ranger and shows assigned patrols, park, and connection status", async () => {
    renderApp();
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "kamal@example.org" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct-horse-battery" },
    });
    vi.mocked(fetch)
      .mockResolvedValueOnce(response({ user: rangerUser() }))
      .mockResolvedValueOnce(response(patrolAssignments()));
    fireEvent.submit(screen.getByRole("form", { name: "Ranger sign in" }));

    expect(
      await screen.findByRole("heading", { name: "Patrol" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Yala National Park")).toBeInTheDocument();
    expect(screen.getByText("Synced just now")).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /Start patrol/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Start selected patrol" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Ranger navigation" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Patrol" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Report" })).toHaveAttribute(
      "href",
      "/incidents/report",
    );
    expect(screen.getByRole("link", { name: "Incidents" })).toHaveAttribute(
      "href",
      "/incidents",
    );
    expect(screen.getByRole("link", { name: "Dispatches" })).toHaveAttribute(
      "href",
      "/dispatches",
    );
    expect(
      screen.getByText("Past patrols").closest("details"),
    ).not.toHaveAttribute("open");
    expect(fetch).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        body: JSON.stringify({
          email: "kamal@example.org",
          password: "correct-horse-battery",
        }),
      }),
    );

    fireEvent.click(screen.getByRole("link", { name: "Report" }));
    expect(
      await screen.findByRole("heading", { name: "Report incident" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open account menu" }));
    expect(
      screen.getByRole("region", { name: "Ranger account" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sign out" }),
    ).toBeInTheDocument();
  });

  it("selects an assigned trail and updates the start patrol action", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response({ user: rangerUser() }))
      .mockResolvedValueOnce(response(patrolAssignments()));
    renderApp("/");

    expect(
      await screen.findByRole("button", { name: /Start patrol/i }),
    ).toHaveTextContent("Start Trail 4B");

    fireEvent.click(
      screen.getByRole("button", { name: "Select Trail 4C · Southern Ridge" }),
    );

    expect(
      screen.getByRole("button", { name: /Start patrol: Trail 4C/i }),
    ).toHaveTextContent("Southern Ridge · 4.7 km");
    expect(
      screen.getByRole("button", {
        name: "Selected Trail 4C · Southern Ridge",
      }),
    ).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(
      screen.getByRole("button", { name: /Start patrol: Trail 4C/i }),
    );
    expect(
      await screen.findByLabelText("Trail 4C patrol map"),
    ).toBeInTheDocument();
    expect(screen.getByText("Trail 4C · 4.7 km")).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Ranger navigation" }),
    ).not.toBeInTheDocument();
  });

  it("records a GPS waypoint locally and returns it to the patrol map", async () => {
    const clearWatch = vi.fn();
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        clearWatch,
        watchPosition: vi.fn((success: PositionCallback) => {
          success({
            coords: {
              accuracy: 8,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              latitude: 6.365,
              longitude: 81.523,
              speed: null,
              toJSON: () => ({
                accuracy: 8,
                altitude: null,
                altitudeAccuracy: null,
                heading: null,
                latitude: 6.365,
                longitude: 81.523,
                speed: null,
              }),
            },
            timestamp: Date.now(),
            toJSON: () => ({
              coords: {
                accuracy: 8,
                altitude: null,
                altitudeAccuracy: null,
                heading: null,
                latitude: 6.365,
                longitude: 81.523,
                speed: null,
              },
              timestamp: Date.now(),
            }),
          });
          return 7;
        }),
      },
    });
    vi.mocked(fetch)
      .mockResolvedValueOnce(response({ user: rangerUser() }))
      .mockResolvedValueOnce(response(patrolAssignments()));
    renderApp("/");

    const startPatrol = await screen.findByRole("button", {
      name: /Start patrol/i,
    });
    fireEvent.click(startPatrol);

    const markWaypoint = await screen.findByRole("button", {
      name: /Mark waypoint/i,
    });
    await waitFor(() => expect(markWaypoint).toBeEnabled());
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });
    window.dispatchEvent(new Event("offline"));
    expect(
      await screen.findByText("No Internet Connection"),
    ).toBeInTheDocument();
    fireEvent.click(markWaypoint);

    expect(
      await screen.findByRole("heading", { name: "New Waypoint" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/This waypoint will be stored safely/i),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Sign of wildlife"));
    fireEvent.change(screen.getByLabelText(/Note/i), {
      target: { value: "Fresh elephant tracks near the watering point." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save waypoint" }));

    expect(
      await screen.findByLabelText("Trail 4B patrol map"),
    ).toBeInTheDocument();
    expect(screen.getByText("Waypoints").parentElement).toHaveTextContent("1");
    expect(clearWatch).toHaveBeenCalled();
  });

  it("shows clear connection guidance when sign-in cannot reach the API", async () => {
    renderApp();
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network down"));
    fireEvent.submit(screen.getByRole("form", { name: "Ranger sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Check your connection",
    );
  });

  it("requires temporary-password replacement before opening the ranger account", async () => {
    renderApp();
    vi.mocked(fetch).mockResolvedValueOnce(
      response({ user: rangerUser({ mustChangePassword: true }) }),
    );
    fireEvent.submit(screen.getByRole("form", { name: "Ranger sign in" }));
    expect(
      await screen.findByRole("heading", { name: "Set a new password" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Temporary password"), {
      target: { value: "temporary-password" },
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "new-secure-password" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "new-secure-password" },
    });
    vi.mocked(fetch)
      .mockResolvedValueOnce(response({ user: rangerUser() }))
      .mockResolvedValueOnce(response(patrolAssignments()));
    fireEvent.submit(
      screen.getByRole("form", { name: "Change temporary password" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Patrol" }),
    ).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "/api/auth/change-password",
      expect.objectContaining({
        body: JSON.stringify({
          currentPassword: "temporary-password",
          newPassword: "new-secure-password",
        }),
      }),
    );
  });

  it("shows a sign-out option after a non-ranger signs in", async () => {
    renderApp();
    vi.mocked(fetch).mockResolvedValueOnce(
      response({ user: rangerUser({ role: "RESEARCHER" }) }),
    );
    vi.mocked(fetch).mockResolvedValueOnce(response({}, 204));
    fireEvent.submit(screen.getByRole("form", { name: "Ranger sign in" }));
    expect(
      await screen.findByRole("heading", { name: "This app is for rangers." }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() =>
      expect(fetch).toHaveBeenLastCalledWith(
        "/api/auth/logout",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    expect(
      screen.queryByRole("heading", { name: "Patrol" }),
    ).not.toBeInTheDocument();
  });
});
