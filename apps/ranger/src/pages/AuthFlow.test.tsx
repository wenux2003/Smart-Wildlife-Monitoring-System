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

function response(
  body: object,
  status = 200,
): Response {
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
    path: [[81.516, 6.372], [81.523, 6.365], [81.531, 6.359]],
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
    vi.fn().mockResolvedValue(
      response({ message: "Please sign in to continue." }, 401),
    ),
  );
});

afterEach(() => {
  cleanup();
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

    expect(await screen.findByRole("heading", { name: "Patrol" }))
      .toBeInTheDocument();
    expect(screen.getByText("Yala National Park")).toBeInTheDocument();
    expect(screen.getByText("Synced just now")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Start patrol/i }))
      .toBeInTheDocument();
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
  });

  it("selects an assigned trail and updates the start patrol action", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response({ user: rangerUser() }))
      .mockResolvedValueOnce(response(patrolAssignments()));
    renderApp("/");

    expect(await screen.findByRole("button", { name: /Start patrol/i }))
      .toHaveTextContent("Trail 4B");

    fireEvent.click(
      screen.getByRole("button", { name: "Select Trail 4C · Southern Ridge" }),
    );

    expect(screen.getByRole("button", { name: /Start patrol/i }))
      .toHaveTextContent("Trail 4C");
    expect(
      screen.getByRole("button", { name: "Selected Trail 4C · Southern Ridge" }),
    ).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: /Start patrol/i }));
    expect(await screen.findByLabelText("Trail 4C patrol map")).toBeInTheDocument();
    expect(screen.getByText("Trail 4C · 4.7 km")).toBeInTheDocument();
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
            },
            timestamp: Date.now(),
          });
          return 7;
        }),
      },
    });
    vi.mocked(fetch)
      .mockResolvedValueOnce(response({ user: rangerUser() }))
      .mockResolvedValueOnce(response(patrolAssignments()));
    renderApp("/patrol/50000000-0000-4000-8000-000000000001/active");

    const markWaypoint = await screen.findByRole("button", { name: /Mark waypoint/i });
    await waitFor(() => expect(markWaypoint).toBeEnabled());
    fireEvent.click(markWaypoint);

    expect(await screen.findByRole("heading", { name: "New Waypoint" }))
      .toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Sign of wildlife"));
    fireEvent.change(screen.getByLabelText(/Note/i), {
      target: { value: "Fresh elephant tracks near the watering point." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save waypoint" }));

    expect(await screen.findByLabelText("Trail 4B patrol map")).toBeInTheDocument();
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

    expect(await screen.findByRole("heading", { name: "Patrol" }))
      .toBeInTheDocument();
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
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(
      "/api/auth/logout",
      expect.objectContaining({ method: "POST" }),
    ));
    expect(screen.queryByRole("heading", { name: "Patrol" }))
      .not.toBeInTheDocument();
  });
});
