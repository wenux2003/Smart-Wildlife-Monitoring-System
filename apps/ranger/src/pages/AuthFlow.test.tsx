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

function renderApp(path = "/login") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

beforeEach(() => {
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
  it("signs in a ranger and shows account, park, and connection details", async () => {
    renderApp();
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "kamal@example.org" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct-horse-battery" },
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      response({ user: rangerUser() }),
    );
    fireEvent.submit(screen.getByRole("form", { name: "Ranger sign in" }));

    expect(await screen.findByRole("heading", { name: "Hello, Kamal Perera" }))
      .toBeInTheDocument();
    expect(screen.getByText("Yala National Park")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Online");
    expect(fetch).toHaveBeenLastCalledWith(
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
    vi.mocked(fetch).mockResolvedValueOnce(
      response({ user: rangerUser() }),
    );
    fireEvent.submit(
      screen.getByRole("form", { name: "Change temporary password" }),
    );

    expect(await screen.findByRole("heading", { name: "Ranger account" }))
      .toBeInTheDocument();
    expect(fetch).toHaveBeenLastCalledWith(
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
    expect(screen.queryByRole("heading", { name: "Ranger account" }))
      .not.toBeInTheDocument();
  });
});
