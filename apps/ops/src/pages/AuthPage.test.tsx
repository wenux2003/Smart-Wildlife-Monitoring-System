// @vitest-environment jsdom
import React from "react";
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
import { AuthProvider } from "../auth/AuthContext.js";
import { AuthPage } from "./AuthPage.js";
import { WorkspacePage } from "./WorkspacePage.js";

vi.mock("../components/Reveal.js", () => ({
  Reveal: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: "Sign in" }),
      }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function show(mode: "login" | "register") {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <AuthPage mode={mode} />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("account screens", () => {
  it("shows accessible sign-in fields and toggles password visibility", async () => {
    show("login");
    expect(screen.getByLabelText("EMAIL ADDRESS")).toHaveAttribute(
      "autocomplete",
      "email",
    );
    expect(screen.getByLabelText("PASSWORD")).toHaveAttribute(
      "type",
      "password",
    );
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("PASSWORD")).toHaveAttribute("type", "text");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled(),
    );
  });
  it("keeps entered email and gives retry feedback on failed sign-in", async () => {
    show("login");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled(),
    );
    fireEvent.change(screen.getByLabelText("EMAIL ADDRESS"), {
      target: { value: "person@example.com" },
    });
    fireEvent.change(screen.getByLabelText("PASSWORD"), {
      target: { value: "long-password-example" },
    });
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
    fireEvent.submit(screen.getByRole("form", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Check your connection",
    );
    expect(screen.getByLabelText("EMAIL ADDRESS")).toHaveValue(
      "person@example.com",
    );
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });
  it("prevents mismatched registration passwords from reaching the API", async () => {
    show("register");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Create account" }),
      ).toBeEnabled(),
    );
    fireEvent.change(screen.getByLabelText("PASSWORD"), {
      target: { value: "long-password-one" },
    });
    fireEvent.change(screen.getByLabelText("CONFIRM PASSWORD"), {
      target: { value: "long-password-two" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Create account" }));
    expect(screen.getByRole("alert")).toHaveTextContent("don’t match");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/You’ll join as a Researcher/)).toBeInTheDocument();
  });
  it("does not pretend to send password recovery emails", async () => {
    show("login");
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "no reset email has been sent",
    );
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  });
  it("offers retry when the account service fails instead of showing a workspace", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
    render(
      <MemoryRouter>
        <AuthProvider>
          <WorkspacePage />
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Your account is ready")).not.toBeInTheDocument();
  });
});
