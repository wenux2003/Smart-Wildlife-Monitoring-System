// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { IncidentDetail } from "@wr/shared";
import { IncidentsPage } from "./IncidentsPage.js";
import { IncidentDetailPage } from "./IncidentDetailPage.js";
const parkId = "11111111-1111-4111-8111-111111111111";
const id = "44444444-4444-4444-8444-444444444444";
const responderId = "33333333-3333-4333-8333-333333333333";
vi.mock("../auth/AuthContext.js", () => ({
  useAuth: () => ({
    user: {
      id: "liaison-test",
      name: "Test liaison",
      role: "LIAISON_OFFICER",
      parkId: "11111111-1111-4111-8111-111111111111",
    },
  }),
}));
vi.mock("../components/AccountHeader.js", () => ({
  AccountHeader: () => <header>Account</header>,
}));
const request = vi.fn();
let data: IncidentDetail;
beforeEach(() => {
  data = {
    incident: {
      id,
      parkId,
      reporterId: null,
      source: "COMMUNITY",
      type: "HUMAN_WILDLIFE_CONFLICT",
      status: "NEW",
      description: "Elephant in an unknown field",
      location: null,
      locationStatus: "UNRESOLVED",
      locationText: "Unknown field",
      locationAccuracy: null,
      photoUrl: null,
      reporterPhone: "0771234567",
      capturedAt: "2026-10-07T10:00:00.000Z",
      receivedAt: "2026-10-07T10:01:00.000Z",
      reportedAt: "2026-10-07T10:01:00.000Z",
      revision: 1,
      assignedTo: null,
      assignedAt: null,
      firstResponseAt: null,
      resolvedAt: null,
      outcomeNotes: null,
      createdAt: "2026-10-07T10:01:00.000Z",
      updatedAt: "2026-10-07T10:01:00.000Z",
    },
    history: [],
    media: [],
    messages: [
      {
        id,
        incidentId: id,
        providerMessageId: "sms-1",
        phone: "0771234567",
        rawText: "ELEPHANT crop damage @ Unknown field",
        locationText: "Unknown field",
        state: "RECEIVED",
        createdAt: "2026-10-07T10:01:00.000Z",
      },
    ],
    followUps: [],
  };
  request.mockReset();
  vi.stubGlobal("fetch", request);
  request.mockImplementation(async (path: string, options?: RequestInit) => {
    const body = options?.body ? JSON.parse(String(options.body)) : null;
    if (body) {
      if (path.endsWith("/status")) {
        data.incident.status = body.status;
        data.incident.revision++;
      }
      if (path.endsWith("/location")) {
        data.incident.location = body.location;
        data.incident.locationStatus = "MANUAL";
        data.incident.revision++;
      }
      if (path.endsWith("/assign")) {
        data.incident.assignedTo = body.responderId;
        data.incident.assignedAt = data.incident.receivedAt;
        data.incident.revision++;
      }
      if (path.endsWith("/response")) {
        data.incident.status =
          body.action === "START" ? "IN_PROGRESS" : "RESOLVED";
        data.incident.outcomeNotes = body.outcomeNotes ?? null;
        data.incident.firstResponseAt = data.incident.receivedAt;
        if (body.action === "RESOLVE")
          data.incident.resolvedAt = data.incident.receivedAt;
        data.incident.revision++;
      }
      if (path.endsWith("/follow-up"))
        data.followUps.push({
          id: body.id,
          messageId: id,
          actorId: responderId,
          text: body.text,
          sentAt: data.incident.receivedAt,
          state: "SENT",
        });
      data.history.push({
        id: crypto.randomUUID(),
        incidentId: id,
        actorId: responderId,
        createdAt: data.incident.receivedAt,
        eventType: path.endsWith("follow-up")
          ? "COMMUNITY_FOLLOW_UP_SENT"
          : "INCIDENT_UPDATED",
        oldStatus: null,
        newStatus: data.incident.status,
        notes: body.notes ?? body.outcomeNotes ?? null,
      });
    }
    const result = path.endsWith("/responders")
      ? [{ id: responderId, name: "Kamal Ranger" }]
      : path === "/api/incidents"
        ? [data.incident]
        : data;
    return { ok: true, status: 200, json: async () => structuredClone(result) };
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function show(detail = false, communityOnly = false) {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter
        initialEntries={[detail ? `/incidents/${id}` : "/incidents"]}
      >
        <Routes>
          <Route
            path="/incidents"
            element={<IncidentsPage communityOnly={communityOnly} />}
          />
          <Route path="/incidents/:id" element={<IncidentDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
describe("Ops M1 incident workflow", () => {
  it.each(["RANGER", "COMMUNITY"] as const)(
    "labels the original %s report description without changing its text",
    async (source) => {
      const description =
        "  Original report:\nElephant near Gate 4.\nPlease call before responding.  ";
      data.incident.source = source;
      data.incident.description = description;
      show(true);
      const report = await screen.findByRole("region", {
        name: "Report description",
      });
      expect(
        within(report).getByRole("heading", {
          name: "Report description",
        }),
      ).toBeVisible();
      expect(within(report).getByText(/Original report:/).textContent).toBe(
        description,
      );
    },
  );
  it.each(["NEW", "VERIFIED", "IN_PROGRESS", "RESOLVED", "REJECTED"] as const)(
    "offers the response-start explanation and action only when VERIFIED (status %s)",
    async (status) => {
      data.incident.status = status;
      data.incident.assignedTo = responderId;
      data.incident.location = { latitude: 6.52, longitude: 81.42 };
      data.incident.locationStatus = "MANUAL";
      show(true);
      await screen.findByRole("region", { name: "Report description" });
      const button = screen.queryByRole("button", {
        name: "Mark response as started",
      });
      const helper =
        "Use this when the assigned Ranger has begun responding. The incident will move to In Progress.";
      if (status !== "VERIFIED") {
        expect(button).not.toBeInTheDocument();
        expect(screen.queryByText(helper)).not.toBeInTheDocument();
        return;
      }
      expect(button).toBeEnabled();
      expect(button).toHaveAccessibleDescription(helper);
      expect(screen.getByText(helper)).toBeVisible();
      expect(
        screen.getByText(
          "Select the Ranger responsible for this incident. Assignment does not start the response.",
        ),
      ).toBeVisible();
      fireEvent.click(button!);
      await screen.findByLabelText("Outcome notes");
      const startRequest = request.mock.calls.find((call) =>
        call[0].endsWith("/response"),
      );
      expect(startRequest?.[1]?.method).toBe("POST");
      expect(JSON.parse(startRequest![1].body)).toEqual({
        expectedRevision: 1,
        action: "START",
      });
      expect(screen.getByText("IN_PROGRESS")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", {
          name: "Mark response as started",
        }),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(helper)).not.toBeInTheDocument();
    },
  );
  it.each(["assignment", "confirmed location"])(
    "keeps response-start disabled for a VERIFIED incident missing %s",
    async (missing) => {
      data.incident.status = "VERIFIED";
      data.incident.assignedTo = missing === "assignment" ? null : responderId;
      data.incident.location =
        missing === "confirmed location"
          ? null
          : { latitude: 6.52, longitude: 81.42 };
      show(true);
      const button = await screen.findByRole("button", {
        name: "Mark response as started",
      });
      expect(button).toBeDisabled();
      fireEvent.click(button);
      expect(
        request.mock.calls.some((call) => call[0].endsWith("/response")),
      ).toBe(false);
    },
  );
  it("renders a legacy photo and avoids duplicating matching media", async () => {
    data.incident.photoUrl = "https://example.org/legacy.jpg";
    show(true);
    expect(await screen.findByAltText("Incident evidence")).toHaveAttribute(
      "src",
      data.incident.photoUrl,
    );
    cleanup();
    data.media.push({
      id: crypto.randomUUID(),
      incidentId: id,
      dataUrl: data.incident.photoUrl,
      createdAt: data.incident.createdAt,
    });
    show(true);
    await screen.findByAltText("Incident evidence");
    expect(screen.getAllByAltText("Incident evidence")).toHaveLength(1);
  });
  it("renders correctly shaped API lists, filters and incident detail links", async () => {
    show();
    await screen.findByText("Open incident");
    expect(screen.getByText("Open incident")).toHaveAttribute(
      "href",
      `/incidents/${id}`,
    );
    expect(screen.getByText("UNRESOLVED")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "RESOLVED" },
    });
    expect(
      screen.getByText("No incidents match these filters."),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Source"), {
      target: { value: "RANGER" },
    });
    expect(
      screen.getByText("No incidents match these filters."),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Source"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "POACHING" },
    });
    expect(
      screen.getByText("No incidents match these filters."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText("Refresh"));
  });
  it("shows community-only inbox and server errors", async () => {
    show(false, true);
    await screen.findByText("Community conflict inbox");
    await screen.findByText("Open incident");
    expect(screen.queryByLabelText("Source")).toBeNull();
    cleanup();
    request.mockImplementation(async () => ({
      ok: false,
      status: 503,
      json: async () => ({ message: "Incident list unavailable" }),
    }));
    show();
    await screen.findByText(
      "An unexpected error occurred. Please try again later.",
    );
    expect(screen.queryByText("Incident list unavailable")).toBeNull();
  });
  it("supports clarify → verify → assign → start → outcome → resolved with revisions", async () => {
    show(true);
    await screen.findByText("Elephant in an unknown field");
    expect(screen.queryByText("Mark response as started")).toBeNull();
    fireEvent.change(screen.getByLabelText("Latitude"), {
      target: { value: "6.52" },
    });
    fireEvent.change(screen.getByLabelText("Longitude"), {
      target: { value: "81.42" },
    });
    fireEvent.change(screen.getByLabelText("Confirmation notes"), {
      target: { value: "Caller confirmed entrance" },
    });
    fireEvent.click(screen.getByText("Save confirmed location"));
    await screen.findByText("Location clarified; original landmark retained.");
    const locationCall = request.mock.calls.find((call) =>
      call[0].endsWith("/location"),
    )!;
    expect(JSON.parse(locationCall[1].body)).toMatchObject({
      expectedRevision: 1,
      location: { latitude: 6.52, longitude: 81.42 },
    });
    fireEvent.click(screen.getByText("Verify"));
    await screen.findByText("Incident verified.");
    await screen.findByText("Assign responder");
    fireEvent.change(screen.getByLabelText("Ranger"), {
      target: { value: responderId },
    });
    fireEvent.click(screen.getByText("Assign ranger"));
    await screen.findByText("Responder assigned.");
    await waitFor(() =>
      expect(screen.getByText("Mark response as started")).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByText("Mark response as started"));
    await screen.findByText("Response started.");
    await screen.findByLabelText("Outcome notes");
    fireEvent.change(screen.getByLabelText("Outcome notes"), {
      target: { value: "Elephant returned to forest. No injuries." },
    });
    fireEvent.click(screen.getByText("Record outcome and resolve"));
    await screen.findByText("Incident resolved.");
    await screen.findByText(/Outcome: Elephant returned to forest/);
    expect(screen.queryByText("Verify")).toBeNull();
    expect(screen.queryByText("Save confirmed location")).toBeNull();
    expect(data.history).toHaveLength(5);
  });
  it("records mock follow-up and rejects reports with a reason", async () => {
    show(true);
    await screen.findByLabelText("Follow-up text");
    fireEvent.change(screen.getByLabelText("Follow-up text"), {
      target: { value: "Please confirm nearest gate" },
    });
    fireEvent.click(screen.getByText("Send mock follow-up"));
    await screen.findByText("Mock follow-up stored. No real SMS was sent.");
    await screen.findByText(/SENT · Please confirm nearest gate/);
    fireEvent.change(screen.getByLabelText("Reason"), {
      target: { value: "Duplicate report reviewed by liaison" },
    });
    fireEvent.click(screen.getByText("Reject incident"));
    await screen.findByText("Incident rejected.");
    expect(screen.queryByText("Verify")).toBeNull();
  });
  it("retains notes on revision conflict and provides invalid-coordinate feedback", async () => {
    show(true);
    await screen.findByText("Verify");
    fireEvent.change(screen.getByLabelText("Latitude"), {
      target: { value: "91" },
    });
    fireEvent.change(screen.getByLabelText("Longitude"), {
      target: { value: "81" },
    });
    fireEvent.change(screen.getByLabelText("Confirmation notes"), {
      target: { value: "Confirmed" },
    });
    fireEvent.submit(
      screen.getByText("Save confirmed location").closest("form")!,
    );
    await screen.findByText(/Latitude must/);
    const normal = request.getMockImplementation()!;
    request.mockImplementation(async (path, options) =>
      options?.body
        ? {
            ok: false,
            status: 409,
            json: async () => ({ message: "Reload before continuing" }),
          }
        : normal(path, options),
    );
    fireEvent.click(screen.getByText("Verify"));
    await screen.findByText("Reload before continuing");
    expect(screen.getByLabelText("Confirmation notes")).toHaveValue(
      "Confirmed",
    );
  });
  it("renders camera-source details and media, handles missing detail and responder failures", async () => {
    data.incident.source = "CAMERA_TRAP";
    data.media.push({
      id,
      incidentId: id,
      dataUrl: "data:image/png;base64,iVBORw0KGgoAAAA=",
      createdAt: data.incident.receivedAt,
    });
    show(true);
    await screen.findByText("View source camera image");
    expect(screen.getByAltText("Incident evidence")).toBeInTheDocument();
    cleanup();
    request.mockImplementation(async () => ({
      ok: false,
      status: 404,
      json: async () => ({ message: "Incident not found" }),
    }));
    show(true);
    await screen.findByText("Incident not found");
  });
});
