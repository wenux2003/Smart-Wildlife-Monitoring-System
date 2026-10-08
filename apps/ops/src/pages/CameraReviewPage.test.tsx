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
import type { CameraImage } from "@wr/shared";
import { CameraReviewPage } from "./CameraReviewPage.js";
const id = "44444444-4444-4444-8444-444444444444";
const parkId = "11111111-1111-4111-8111-111111111111";
vi.mock("../auth/AuthContext.js", () => ({
  useAuth: () => ({
    user: {
      id: "liaison-test",
      role: "LIAISON_OFFICER",
      parkId: "11111111-1111-4111-8111-111111111111",
    },
  }),
}));
vi.mock("../components/AccountHeader.js", () => ({
  AccountHeader: () => <header>Account</header>,
}));
vi.mock("@wr/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@wr/ui")>();
  return {
    ...actual,
    IncidentPhotoInput: ({
      onChange,
    }: {
      onChange: (value: string | null) => void;
    }) => (
      <button
        type="button"
        onClick={() => onChange("data:image/jpeg;base64,/9j/AAAA")}
      >
        Select test photo
      </button>
    ),
  };
});
let images: CameraImage[];
const request = vi.fn();
beforeEach(() => {
  images = [
    {
      id,
      parkId,
      capturedAt: "2026-10-07T10:00:00.000Z",
      location: { latitude: 6.5, longitude: 81.4 },
      dataUrl: "data:image/jpeg;base64,/9j/AAAA",
      personFlag: true,
      classification: "PENDING",
      reviewerId: null,
      reviewedAt: null,
      resultingIncidentId: null,
      revision: 1,
    },
  ];
  request.mockReset();
  vi.stubGlobal("fetch", request);
  request.mockImplementation(async (_path: string, options?: RequestInit) => {
    if (options?.method === "PATCH") {
      const body = JSON.parse(String(options.body));
      images[0] = {
        ...images[0],
        classification: body.classification,
        revision: 2,
        resultingIncidentId:
          body.classification === "SUSPICIOUS_ACTIVITY" ? id : null,
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => structuredClone(options?.body ? images[0] : images),
    };
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function show() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <CameraReviewPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
describe("Ops camera review", () => {
  it("keeps UNSURE images reviewable and only links incidents after explicit suspicious review", async () => {
    show();
    await screen.findByText("PENDING");
    fireEvent.change(screen.getByLabelText("Review notes"), {
      target: { value: "Need another view" },
    });
    fireEvent.click(screen.getByText("Save human review"));
    await screen.findByText("This image remains in the review queue.");
    expect(screen.queryByText("Open resulting incident")).toBeNull();
    fireEvent.change(screen.getByLabelText("Classification"), {
      target: { value: "SUSPICIOUS_ACTIVITY" },
    });
    fireEvent.change(screen.getByLabelText("Review notes"), {
      target: { value: "Explicit suspicious activity observed" },
    });
    fireEvent.click(screen.getByText("Save human review"));
    await screen.findByText("No images awaiting review.");
    fireEvent.click(
      screen.getByLabelText("Include previously reviewed images"),
    );
    await screen.findByText("Open resulting incident");
    expect(screen.getByText("Open resulting incident")).toHaveAttribute(
      "href",
      `/incidents/${id}`,
    );
  });
  it("uploads an actual selected image with validated coordinates and shows failures", async () => {
    show();
    await screen.findByText("PENDING");
    fireEvent.click(screen.getByText("Select test photo"));
    fireEvent.change(screen.getByLabelText("Latitude"), {
      target: { value: "6.5" },
    });
    fireEvent.change(screen.getByLabelText("Longitude"), {
      target: { value: "81.4" },
    });
    fireEvent.click(screen.getByText("Add image to review queue"));
    await waitFor(() =>
      expect(
        request.mock.calls.some((call) => call[1]?.method === "POST"),
      ).toBe(true),
    );
    const payload = JSON.parse(
      request.mock.calls.find((call) => call[1]?.method === "POST")![1].body,
    );
    expect(payload.location).toEqual({ latitude: 6.5, longitude: 81.4 });
    expect(payload.dataUrl).toContain("data:image/jpeg");
    const normal = request.getMockImplementation()!;
    request.mockImplementation(async (path, options) =>
      options?.body
        ? {
            ok: false,
            status: 409,
            json: async () => ({ message: "Image changed; reload" }),
          }
        : normal(path, options),
    );
    fireEvent.change(screen.getByLabelText("Review notes"), {
      target: { value: "Review again" },
    });
    fireEvent.click(screen.getByText("Save human review"));
    await screen.findByText("Image changed; reload");
  });
  it("shows unavailable camera queue and rejects invalid upload locations without clearing photo", async () => {
    request.mockImplementation(async () => ({
      ok: false,
      status: 503,
      json: async () => ({ message: "Camera queue unavailable" }),
    }));
    show();
    await screen.findByText("An unexpected error occurred. Please try again later.");
    expect(screen.queryByText("Camera queue unavailable")).toBeNull();
    fireEvent.click(screen.getByText("Select test photo"));
    fireEvent.change(screen.getByLabelText("Latitude"), {
      target: { value: "92" },
    });
    fireEvent.change(screen.getByLabelText("Longitude"), {
      target: { value: "81" },
    });
    fireEvent.submit(
      screen.getByText("Add image to review queue").closest("form")!,
    );
    await screen.findByText(/Latitude must/);
  });
});
