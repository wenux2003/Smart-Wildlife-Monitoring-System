// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { saveOfflineIncident, saveOfflineMedia } from "@wr/offline";
import type { IncidentDetail } from "@wr/shared";
import { MyIncidentsPage } from "./MyIncidentsPage.js";
import { IncidentSync } from "../components/IncidentSync.js";
import { incidentDb, syncIncidents } from "../lib/incidents.js";
const state = vi.hoisted(() => ({
  user: {
    id: "33333333-3333-4333-8333-333333333333",
    parkId: "11111111-1111-4111-8111-111111111111",
    role: "RANGER",
    name: "Test",
    email: "test@example.org",
    parkName: "Yala",
    mustChangePassword: false,
  },
  captureOnly: false,
  refresh: vi.fn(async () => {}),
}));
vi.mock("../auth/AuthContext.js", () => ({ useAuth: () => state }));
vi.mock("../lib/incidents.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/incidents.js")>();
  return { ...actual, syncIncidents: vi.fn(async () => {}) };
});
const input = {
  id: "44444444-4444-4444-8444-444444444444",
  parkId: state.user.parkId,
  type: "POACHING" as const,
  description: "Saved snare report",
  capturedAt: "2026-10-07T10:00:00.000Z",
  location: { latitude: 6.52, longitude: 81.42 },
  locationStatus: "MANUAL" as const,
  locationAccuracy: null,
};
beforeEach(async () => {
  state.captureOnly = true;
  await incidentDb.delete();
  await incidentDb.open();
  vi.mocked(syncIncidents).mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => [] })),
  );
});
afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await incidentDb.delete();
});
function show(id?: string) {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[id ? `/incidents/${id}` : "/incidents"]}>
        <Routes>
          <Route path="/incidents" element={<MyIncidentsPage />} />
          <Route path="/incidents/:id" element={<MyIncidentsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
function serveIncidentDetail(
  incident: Partial<IncidentDetail["incident"]> = {},
  evidence: Partial<Pick<IncidentDetail, "media" | "history">> = {},
) {
  state.captureOnly = false;
  const detail: IncidentDetail = {
    incident: {
      ...input,
      source: "RANGER",
      status: "VERIFIED",
      reporterId: state.user.id,
      reporterPhone: null,
      photoUrl: null,
      locationText: null,
      revision: 1,
      assignedTo: null,
      assignedAt: null,
      firstResponseAt: null,
      resolvedAt: null,
      outcomeNotes: null,
      receivedAt: input.capturedAt,
      reportedAt: input.capturedAt,
      createdAt: input.capturedAt,
      updatedAt: input.capturedAt,
      ...incident,
    },
    media: [],
    history: [],
    messages: [],
    followUps: [],
    ...evidence,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () =>
        url === `/api/incidents/${input.id}` ? detail : [detail.incident],
    })),
  );
}

describe("Ranger saved reports and sync feedback", () => {
  it("shows the assigned-to-you notice in detail for the logged-in responder", async () => {
    serveIncidentDetail({
      source: "COMMUNITY",
      reporterId: null,
      assignedTo: state.user.id,
    });
    show(input.id);
    expect(
      await screen.findByText(
        "Assigned to you. Coordinate the response with your park operator.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(input.description)).toBeInTheDocument();
  });
  it("displays outcome notes in resolved incident detail", async () => {
    serveIncidentDetail({
      status: "RESOLVED",
      outcomeNotes: "Removed the snare and released the animal.",
      resolvedAt: "2026-10-07T12:00:00.000Z",
    });
    show(input.id);
    expect(
      await screen.findByText(
        "Outcome: Removed the snare and released the animal.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Status: RESOLVED/)).toBeInTheDocument();
  });
  it("renders server history with event labels, timestamps and notes", async () => {
    const assignedAt = "2026-10-07T10:30:00.000Z";
    const startedAt = "2026-10-07T11:00:00.000Z";
    serveIncidentDetail(
      {},
      {
        history: [
          {
            id: "55555555-5555-4555-8555-555555555555",
            incidentId: input.id,
            actorId: state.user.id,
            eventType: "RESPONDER_ASSIGNED",
            oldStatus: "VERIFIED",
            newStatus: "VERIFIED",
            notes: "Respond to the southern entrance.",
            createdAt: assignedAt,
          },
          {
            id: "66666666-6666-4666-8666-666666666666",
            incidentId: input.id,
            actorId: state.user.id,
            eventType: "RESPONSE_STARTED",
            oldStatus: "VERIFIED",
            newStatus: "IN_PROGRESS",
            notes: "Ranger response started.",
            createdAt: startedAt,
          },
        ],
      },
    );
    show(input.id);
    const assignment = await screen.findByText(
      /RESPONDER ASSIGNED Respond to the southern entrance\./,
    );
    expect(assignment).toHaveTextContent(new Date(assignedAt).toLocaleString());
    const response = screen.getByText(
      /RESPONSE STARTED Ranger response started\./,
    );
    expect(response).toHaveTextContent(new Date(startedAt).toLocaleString());
  });
  it("renders evidence once when legacy photoUrl matches server media", async () => {
    const dataUrl = "data:image/jpeg;base64,/9j/AAAA";
    serveIncidentDetail(
      { photoUrl: dataUrl },
      {
        media: [
          {
            id: "55555555-5555-4555-8555-555555555555",
            incidentId: input.id,
            dataUrl,
            createdAt: input.capturedAt,
          },
        ],
      },
    );
    show(input.id);
    expect(await screen.findByAltText("Incident evidence")).toHaveAttribute(
      "src",
      dataUrl,
    );
    expect(
      screen.getAllByRole("img", { name: "Incident evidence" }),
    ).toHaveLength(1);
    expect(screen.getByText("Photo: SYNCED")).toBeInTheDocument();
  });
  it("shows sign-in-to-sync guidance in capture-only mode", async () => {
    await saveOfflineIncident(incidentDb, state.user.id, input);
    show();
    await screen.findByText(input.description);
    const signIn = screen.getByRole("link", {
      name: "Sign in as the original ranger",
    });
    expect(signIn).toHaveAttribute("href", "/login");
    expect(signIn.closest("p")).toHaveTextContent(
      "Offline capture mode. Sign in as the original ranger to synchronize.",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it("shows legacy evidence when the server has no media records", async () => {
    state.captureOnly = false;
    const photoUrl = "https://example.org/legacy.jpg";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        status: 200,
        json: async () =>
          url.endsWith(input.id)
            ? {
                incident: {
                  ...input,
                  photoUrl,
                  status: "VERIFIED",
                  reporterId: state.user.id,
                  assignedTo: null,
                },
                media: [],
                history: [],
              }
            : [],
      })),
    );
    show(input.id);
    expect(await screen.findByAltText("Incident evidence")).toHaveAttribute(
      "src",
      photoUrl,
    );
  });
  it("separates assigned community reports from locally captured reports", async () => {
    state.captureOnly = false;
    await saveOfflineIncident(incidentDb, state.user.id, input);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => [
          {
            ...input,
            id: crypto.randomUUID(),
            description: "Assigned community incident",
            reporterId: null,
            assignedTo: state.user.id,
            status: "VERIFIED",
          },
        ],
      })),
    );
    show();
    await screen.findByText("Saved snare report");
    fireEvent.click(screen.getByText("Assigned to me"));
    await screen.findByText("Assigned community incident");
    expect(screen.queryByText("Saved snare report")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("My reports"));
    expect(screen.getByText("Saved snare report")).toBeInTheDocument();
    expect(
      screen.queryByText("Assigned community incident"),
    ).not.toBeInTheDocument();
  });
  it("restores pending incidents and local photos after reopening", async () => {
    await saveOfflineIncident(incidentDb, state.user.id, input);
    await saveOfflineMedia(incidentDb, state.user.id, input.id, {
      id: crypto.randomUUID(),
      dataUrl: "data:image/jpeg;base64,/9j/AAAA",
    });
    incidentDb.close();
    await incidentDb.open();
    show(input.id);
    await screen.findByText("Saved snare report");
    expect(screen.getByAltText("Incident evidence")).toBeInTheDocument();
    expect(screen.getByText("Photo: PENDING")).toBeInTheDocument();
    vi.mocked(syncIncidents).mockRejectedValue(
      new Error("Sign in before sync"),
    );
    fireEvent.click(screen.getByText("Retry sync"));
    await screen.findByText("Sign in before sync");
    expect(await incidentDb.incidents.count()).toBe(1);
  });
  it("displays failed attempts, original identity, retry and report links", async () => {
    await saveOfflineIncident(incidentDb, state.user.id, input);
    await incidentDb.outbox.update(`INCIDENT_CREATE:${input.id}`, {
      syncStatus: "FAILED",
      lastError: "Revision conflict",
      attemptCount: 1,
    });
    show();
    await screen.findByText("Saved snare report");
    await screen.findByText(/Revision conflict/);
    expect(screen.getByText("View report")).toHaveAttribute(
      "href",
      `/incidents/${input.id}`,
    );
    vi.mocked(syncIncidents).mockResolvedValue();
    fireEvent.click(screen.getByText("Retry sync"));
    await screen.findByText("Retry sync");
    expect(state.refresh).toHaveBeenCalled();
  });
  it("shows empty/unavailable states and handles local-store failures", async () => {
    state.captureOnly = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 503,
        json: async () => ({ message: "API unavailable" }),
      })),
    );
    show();
    await screen.findByText(/Server reports unavailable/);
    expect(screen.getByText("No reports yet.")).toBeInTheDocument();
    cleanup();
    show("missing-report");
    await screen.findByText("This incident is unavailable.");
  });
  it("runs startup, online and resume flushes and cleans up listeners", async () => {
    state.captureOnly = false;
    const view = render(<IncidentSync />);
    expect(syncIncidents).toHaveBeenCalledTimes(1);
    fireEvent(window, new Event("online"));
    fireEvent(window, new Event("focus"));
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    fireEvent(document, new Event("visibilitychange"));
    expect(syncIncidents).toHaveBeenCalledTimes(4);
    view.unmount();
    fireEvent(window, new Event("online"));
    expect(syncIncidents).toHaveBeenCalledTimes(4);
  });
});
