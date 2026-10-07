// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import { ReportIncidentPage } from "./ReportIncidentPage.js";
import { incidentDb, syncIncidents } from "../lib/incidents.js";
const state = vi.hoisted(() => ({
  user: {
    id: "33333333-3333-4333-8333-333333333333",
    parkId: "11111111-1111-4111-8111-111111111111",
    name: "Test ranger",
    email: "test@example.org",
    role: "RANGER",
    parkName: "Yala",
    mustChangePassword: false,
  },
  captureOnly: false,
}));
vi.mock("../auth/AuthContext.js", () => ({ useAuth: () => state }));
vi.mock("../lib/incidents.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/incidents.js")>();
  return { ...actual, syncIncidents: vi.fn(async () => {}) };
});
beforeEach(async () => {
  state.captureOnly = false;
  await incidentDb.delete();
  await incidentDb.open();
  vi.mocked(syncIncidents).mockReset();
});
afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await incidentDb.delete();
});
function show() {
  render(
    <MemoryRouter>
      <ReportIncidentPage />
    </MemoryRouter>,
  );
}
function fill() {
  fireEvent.change(screen.getByLabelText("Description"), {
    target: { value: "Snare near boundary fence" },
  });
  fireEvent.change(screen.getByLabelText("Latitude"), {
    target: { value: "6.52" },
  });
  fireEvent.change(screen.getByLabelText("Longitude"), {
    target: { value: "81.42" },
  });
}
describe("Ranger M1 reporting", () => {
  it("saves a no-photo report durably when API is unavailable and displays a truthful offline receipt", async () => {
    vi.mocked(syncIncidents).mockRejectedValue(new Error("Network down"));
    show();
    fill();
    fireEvent.click(screen.getByText("Save and submit report"));
    await screen.findByText("Incident saved offline. Pending synchronization.");
    expect(await incidentDb.incidents.count()).toBe(1);
    expect(await incidentDb.outbox.count()).toBe(1);
    const report = (await incidentDb.incidents.toArray())[0];
    expect(report.payload.location).toEqual({
      latitude: 6.52,
      longitude: 81.42,
    });
    expect(report.payload.locationStatus).toBe("MANUAL");
    expect(report.userId).toBe(state.user.id);
    expect(await incidentDb.incidentMedia.count()).toBe(0);
    expect(screen.getByText("View saved incident")).toHaveAttribute(
      "href",
      `/incidents/${report.id}`,
    );
  });
  it("only reports online success after server acknowledgment", async () => {
    vi.mocked(syncIncidents).mockImplementation(async () => {
      const [report] = await incidentDb.incidents.toArray();
      await incidentDb.incidents.update(report.id, { syncStatus: "SYNCED" });
    });
    show();
    fill();
    fireEvent.click(screen.getByText("Save and submit report"));
    await screen.findByText("Incident submitted successfully.");
  });
  it("uses fresh browser GPS, displays accuracy and retries with manual fallback after failure", async () => {
    const getCurrentPosition = vi
      .fn()
      .mockImplementationOnce((success: PositionCallback) =>
        success({
          coords: { latitude: 6.42, longitude: 81.35, accuracy: 7 },
          timestamp: Date.now(),
        } as GeolocationPosition),
      )
      .mockImplementationOnce(
        (_success: PositionCallback, fail: PositionErrorCallback) =>
          fail({ code: 1 } as GeolocationPositionError),
      );
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition },
    });
    show();
    fireEvent.click(screen.getByText("Capture / retry GPS"));
    expect(screen.getByText(/accuracy ±7 m/)).toBeInTheDocument();
    expect(screen.getByLabelText("Latitude")).toHaveValue(6.42);
    expect(getCurrentPosition.mock.calls[0][2].maximumAge).toBe(0);
    fireEvent.click(screen.getByText("Capture / retry GPS"));
    expect(screen.getByText(/GPS failed/)).toBeInTheDocument();
    expect(screen.getByLabelText("Latitude")).toHaveValue(null);
    fill();
    fireEvent.click(screen.getByText("Save and submit report"));
    await screen.findByText(/Incident saved offline/);
    expect(
      (await incidentDb.incidents.toArray())[0].payload.locationStatus,
    ).toBe("MANUAL");
  });
  it("handles GPS unavailable and prevents future or invalid incident data from entering the outbox", async () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: undefined,
    });
    show();
    fireEvent.click(screen.getByText("Capture / retry GPS"));
    expect(screen.getByText(/GPS is unavailable/)).toBeInTheDocument();
    fill();
    fireEvent.change(screen.getByLabelText("Incident date/time"), {
      target: { value: "2099-01-01T12:00" },
    });
    fireEvent.submit(
      screen.getByText("Save and submit report").closest("form")!,
    );
    await screen.findByText("Incident time cannot be in the future.");
    expect(await incidentDb.incidents.count()).toBe(0);
    fireEvent.change(screen.getByLabelText("Incident date/time"), {
      target: { value: "2026-10-07T12:00" },
    });
    fireEvent.change(screen.getByLabelText("Latitude"), {
      target: { value: "91" },
    });
    fireEvent.submit(
      screen.getByText("Save and submit report").closest("form")!,
    );
    await screen.findByRole("alert");
    expect(await incidentDb.incidents.count()).toBe(0);
  });
  it("retains the filled form and shows no saved receipt if IndexedDB cannot commit", async () => {
    vi.spyOn(incidentDb.outbox, "add").mockRejectedValueOnce(
      new Error("Local storage quota exceeded"),
    );
    show();
    fill();
    fireEvent.click(screen.getByText("Save and submit report"));
    await screen.findByText("Local storage quota exceeded");
    expect(screen.queryByText("View saved incident")).toBeNull();
    expect(screen.getByLabelText("Description")).toHaveValue(
      "Snare near boundary fence",
    );
    expect(await incidentDb.incidents.count()).toBe(0);
    fireEvent.click(screen.getByText("Save and submit report"));
    await screen.findByText(/Incident saved offline/);
    expect(await incidentDb.incidents.count()).toBe(1);
  });
  it("permits capture after offline reopen while withholding synchronization", async () => {
    state.captureOnly = true;
    show();
    fill();
    fireEvent.click(screen.getByText("Save and submit report"));
    await screen.findByText(/Incident saved offline/);
    expect(syncIncidents).not.toHaveBeenCalled();
    await waitFor(async () =>
      expect(await incidentDb.incidents.count()).toBe(1),
    );
    expect(screen.getByText(/Offline capture for/)).toBeInTheDocument();
  });
});
