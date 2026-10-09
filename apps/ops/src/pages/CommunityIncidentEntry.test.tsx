// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import { HomePage } from "./HomePage.js";

vi.mock("../auth/AuthContext.js", () => ({
  useAuth: () => ({ user: null }),
}));
vi.mock("../components/Reveal.js", () => ({
  Reveal: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

beforeEach(() => {
  vi.stubEnv("VITE_PUBLIC_APP_URL", undefined);
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

function show() {
  render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );
}

describe("M1 public community entry point", () => {
  it("offers a prominent wildlife report link on the signed-out HomePage", () => {
    show();
    const report = screen.getByRole("link", {
      name: "Report a wildlife incident",
    });
    expect(report).toBeVisible();
    expect(report).toHaveClass("button", "button-cream");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it.each([
    [undefined, "http://localhost:5173/community/new"],
    ["https://public.example.org", "https://public.example.org/community/new"],
    ["https://public.example.org/", "https://public.example.org/community/new"],
  ])("targets the existing public form with app URL %s", (appUrl, expected) => {
    vi.stubEnv("VITE_PUBLIC_APP_URL", appUrl);
    show();
    expect(
      screen.getByRole("link", { name: "Report a wildlife incident" }),
    ).toHaveAttribute("href", expected);
  });
});
