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
import { CommunityReportPage } from "./CommunityReportPage.js";
const parkId = "11111111-1111-4111-8111-111111111111";
const request = vi.fn();
beforeEach(() => {
  request.mockReset();
  vi.stubGlobal("fetch", request);
  request.mockImplementation(async (path: string) => ({
    ok: true,
    status: 200,
    json: async () =>
      path.endsWith("parks")
        ? [{ id: parkId, name: "Yala" }]
        : { id: "receipt-1", locationStatus: "UNRESOLVED" },
  }));
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
        <CommunityReportPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
async function contact() {
  await screen.findByText("Yala");
  fireEvent.change(screen.getByLabelText("Park"), {
    target: { value: parkId },
  });
  fireEvent.change(screen.getByLabelText("Phone/contact"), {
    target: { value: "0771234567" },
  });
}
describe("Public community and SMS intake", () => {
  it("sends a public report without a staff account and retries with the same ID", async () => {
    show();
    await contact();
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Elephant in field" },
    });
    fireEvent.change(screen.getByLabelText("Location / landmark"), {
      target: { value: "Unknown field" },
    });
    fireEvent.click(screen.getByText("Submit report"));
    await screen.findByText(/Report received/);
    const first = JSON.parse(
      request.mock.calls.find((call) => call[0].endsWith("reports"))![1].body,
    );
    fireEvent.click(screen.getByText("Retry same submission"));
    await waitFor(() =>
      expect(
        request.mock.calls.filter((call) => call[0].endsWith("reports")),
      ).toHaveLength(2),
    );
    const second = JSON.parse(
      request.mock.calls.filter((call) => call[0].endsWith("reports"))[1][1]
        .body,
    );
    expect(second.id).toBe(first.id);
    fireEvent.click(screen.getByText("Start another report"));
    expect(screen.getByLabelText("Description")).toHaveValue("");
  });
  it("preserves raw SMS and stable provider message ID for the mock gateway", async () => {
    show();
    await contact();
    fireEvent.click(screen.getByLabelText("Use mock SMS gateway"));
    fireEvent.change(screen.getByLabelText("Provider message ID"), {
      target: { value: "gateway-stable-1" },
    });
    fireEvent.change(screen.getByLabelText("Raw SMS"), {
      target: { value: "ELEPHANT crop damage @ Unknown field" },
    });
    fireEvent.click(screen.getByText("Submit report"));
    await screen.findByText(/Report received/);
    const payload = JSON.parse(
      request.mock.calls.find((call) => call[0].endsWith("sms"))![1].body,
    );
    expect(payload.providerMessageId).toBe("gateway-stable-1");
    expect(payload.rawText).toBe("ELEPHANT crop damage @ Unknown field");
    expect(screen.getByRole("status").textContent).toContain("no real SMS");
  });
  it("retains community input on server failure and rejects invalid contact data", async () => {
    show();
    await contact();
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Elephant report" },
    });
    fireEvent.change(screen.getByLabelText("Location / landmark"), {
      target: { value: "Unknown field" },
    });
    request.mockImplementation(async (path: string) => ({
      ok: path.endsWith("parks"),
      status: 503,
      json: async () => ({ message: "Intake unavailable" }),
    }));
    fireEvent.click(screen.getByText("Submit report"));
    await screen.findByText("Intake unavailable");
    expect(screen.getByLabelText("Description")).toHaveValue("Elephant report");
    fireEvent.change(screen.getByLabelText("Phone/contact"), {
      target: { value: "abc" },
    });
    fireEvent.submit(screen.getByText("Submit report").closest("form")!);
    await screen.findByText("Check park, phone, description and landmark.");
  });
});
