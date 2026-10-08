// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App.js";
import { CreateAccountForm } from "../components/AccountsTable.js";

vi.mock("../pages/HomePage.js", () => ({
  HomePage: () => <main><h1>Public home</h1></main>,
}));
vi.mock("../components/Reveal.js", () => ({
  Reveal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../features/analytics/pages/AnalyticsOverviewPage.js", () => ({
  AnalyticsOverviewPage: () => <main><h1>Analytics overview</h1></main>,
}));
vi.mock("../features/analytics/pages/AnalyticsMapPage.js", () => ({
  AnalyticsMapPage: () => <main><h1>Hotspot map view</h1></main>,
}));
vi.mock("../features/analytics/pages/PatrolGapsPage.js", () => ({
  PatrolGapsPage: () => <main><h1>Patrol gap view</h1></main>,
}));
vi.mock("../features/analytics/pages/ConflictTrendsPage.js", () => ({
  ConflictTrendsPage: () => <main><h1>Conflict trends view</h1></main>,
}));
vi.mock("../features/analytics/pages/ReportHistoryPage.js", () => ({
  ReportHistoryPage: () => <main><h1>Report history view</h1></main>,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function account(overrides: Partial<{
  role: string;
  mustChangePassword: boolean;
}> = {}) {
  return {
    id: "account-1",
    name: "Test User",
    email: "test@example.org",
    role: "RANGER",
    parkId: "park-1",
    parkName: "Yala National Park",
    mustChangePassword: false,
    ...overrides,
  };
}

function mountApp(path: string, user: ReturnType<typeof account>) {
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async (input: RequestInfo | URL) => ({
    ok: true,
    status: 200,
    json: async () => String(input).includes("/api/auth/me") ? { user } : [],
  })));
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("role-aware Ops routes", () => {
  it("sends a Ranger from the Ops dashboard to the Ranger app notice", async () => {
    mountApp("/dashboard", account());
    expect(await screen.findByRole("heading", { name: "Rangers use the Ranger app." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Ranger app" })).toHaveAttribute("href", "http://localhost:5173/");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("routes a Super Admin to account-only administration", async () => {
    mountApp("/dashboard", account({ role: "SUPER_ADMIN" }));
    expect(await screen.findByRole("heading", { name: "Parks & accounts" })).toBeInTheDocument();
    expect(screen.getByText(/Operational park data is not available/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("opens the analytics module from a Park Manager workspace", async () => {
    mountApp("/dashboard", account({ role: "PARK_MANAGER" }));
    expect(await screen.findByRole("heading", { name: /Welcome, Test/ })).toBeInTheDocument();
    const analyticsLink = screen
      .getAllByRole("link", { name: "Open" })
      .find((link) => link.getAttribute("href") === "/analytics");
    expect(analyticsLink).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Open" }).some(
      (link) => link.getAttribute("href") === "/reports",
    )).toBe(true);
    fireEvent.click(analyticsLink!);
    expect(await screen.findByRole("heading", { name: "Analytics overview" })).toBeInTheDocument();
  });

  it("guards the report history route for Park Managers and Researchers", async () => {
    mountApp("/reports", account({ role: "PARK_MANAGER" }));
    expect(await screen.findByRole("heading", { name: "Report history view" })).toBeInTheDocument();
  });

  it("forces a temporary-password account to change the password before the workspace", async () => {
    mountApp("/dashboard", account({ role: "PARK_MANAGER", mustChangePassword: true }));
    expect(await screen.findByRole("heading", { name: "Choose a new password" })).toBeInTheDocument();
    expect(screen.getByText(/temporary password/)).toBeInTheDocument();
    expect(screen.queryByText("Your account is ready")).not.toBeInTheDocument();
  });
});

describe("staff account form", () => {
  it("validates required fields and shows API errors without fake success", async () => {
    const created = vi.fn().mockResolvedValue(undefined);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ message: "An account with this email already exists." }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <CreateAccountForm
        parks={[{ id: "park-1", code: "YALA", name: "Yala National Park", terrain: "" }]}
        allowedRoles={["RANGER", "LIAISON_OFFICER"]}
        forcedParkId="park-1"
        onCreated={created}
      />,
    );
    const form = screen.getByRole("form", { name: "Create account" });
    expect((form as HTMLFormElement).checkValidity()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("FULL NAME"), { target: { value: "Test Ranger" } });
    fireEvent.change(screen.getByLabelText("EMAIL ADDRESS"), { target: { value: "taken@example.org" } });
    fireEvent.change(screen.getByLabelText("TEMPORARY PASSWORD"), { target: { value: "temporary-password-123" } });
    fireEvent.submit(form);
    expect(await screen.findByRole("alert")).toHaveTextContent("already exists");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(created).not.toHaveBeenCalled();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });
});
