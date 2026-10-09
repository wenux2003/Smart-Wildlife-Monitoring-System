// @vitest-environment jsdom
import React from "react";
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
import { MemoryRouter, useLocation } from "react-router-dom";
import { OpsShell } from "./OpsShell.js";
import { AccountHeader } from "./AccountHeader.js";

const auth = vi.hoisted(() => ({
  user: {
    name: "QA Manager",
    email: "qa@example.org",
    role: "PARK_MANAGER",
    parkName: "Yala National Park",
  },
  signOut: vi.fn(),
}));
vi.mock("../auth/AuthContext.js", () => ({ useAuth: () => auth }));
function Content() {
  const location = useLocation();
  return (
    <>
      <AccountHeader />
      <main id="main-content">
        <h1>Park results</h1>
        <output data-testid="location">
          {location.pathname}
          {location.search}
        </output>
      </main>
    </>
  );
}
function mount(
  path = "/analytics?run=saved-run&from=2026-10-01&to=2026-10-09&preset=CUSTOM&group=ALL",
) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <OpsShell>
        <Content />
      </OpsShell>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  localStorage.clear();
  auth.user.role = "PARK_MANAGER";
  auth.signOut.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Ops navigation workspace", () => {
  it("shows allowed modules, highlights the page, and preserves analytics snapshot filters", () => {
    mount();
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(nav).getByRole("link", { name: "Overview" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      within(nav).getByRole("link", { name: "Staff accounts" }),
    ).toBeInTheDocument();
    expect(
      within(nav).queryByRole("link", { name: "Parks & accounts" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Sign out" })).toHaveLength(1);
    fireEvent.click(within(nav).getByRole("link", { name: "Hotspot map" }));
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/analytics/map?run=saved-run&from=2026-10-01",
    );
    expect(
      within(nav).getByRole("link", { name: "Hotspot map" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(nav).getByRole("link", { name: "Incidents" }),
    ).toHaveAttribute("href", "/incidents");
  });
  it("keeps restricted operational and staff links out of Researcher navigation", () => {
    auth.user.role = "RESEARCHER";
    mount();
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    expect(
      within(nav).getByRole("link", { name: "Report history" }),
    ).toBeInTheDocument();
    for (const name of [
      "Incidents",
      "Camera review",
      "Wildlife alerts",
      "Staff accounts",
      "Parks & accounts",
    ])
      expect(within(nav).queryByRole("link", { name })).not.toBeInTheDocument();
  });
  it("removes history-only parameters when returning to analytics", () => {
    mount(
      "/reports?run=saved-run&from=2026-10-01&to=2026-10-09&historyFrom=2026-01-01&status=FAILED&page=2",
    );
    fireEvent.click(screen.getByRole("link", { name: "Overview" }));
    const location = screen.getByTestId("location").textContent;
    expect(location).toContain("run=saved-run");
    expect(location).not.toMatch(/historyFrom|status=|page=/);
  });
  it("remembers sidebar collapse and keeps icon links accessible", () => {
    const view = mount();
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(localStorage.getItem("wr.sidebar.collapsed")).toBe("true");
    expect(screen.getByRole("link", { name: "Hotspot map" })).toHaveAttribute(
      "title",
      "Hotspot map",
    );
    view.unmount();
    mount();
    expect(
      screen.getByRole("button", { name: "Expand sidebar" }),
    ).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));
    expect(localStorage.getItem("wr.sidebar.collapsed")).toBe("false");
  });
  it("opens a mobile dialog, traps keyboard focus, and closes with Escape or navigation", async () => {
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    mount();
    expect(
      screen.queryByRole("navigation", { name: "Main navigation" }),
    ).not.toBeInTheDocument();
    const menu = screen.getByRole("button", { name: "Open navigation" });
    fireEvent.click(menu);
    const dialog = screen.getByRole("dialog", { name: "Workspace navigation" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(
      within(dialog).getByRole("button", { name: "Close navigation" }),
    ).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
    expect(
      screen
        .getByRole("heading", { name: "Park results" })
        .closest(".ops-surface"),
    ).toHaveAttribute("inert");
    const first = within(dialog).getByRole("link", {
      name: "Wana Rakshaka workspace",
    });
    first.focus();
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(
      within(dialog).getByRole("button", { name: "Sign out" }),
    ).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(menu).toHaveFocus());
    expect(document.body.style.overflow).toBe("");
    fireEvent.click(menu);
    fireEvent.click(screen.getByRole("link", { name: "Hotspot map" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/analytics/map");
  });
  it("keeps sign-out failures visible and allows retry", async () => {
    auth.signOut.mockRejectedValueOnce(new Error("Connection lost"));
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Connection lost",
    );
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/login"),
    );
    expect(auth.signOut).toHaveBeenCalledTimes(2);
  });
});
