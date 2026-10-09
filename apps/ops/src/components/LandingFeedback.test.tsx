// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { LandingFeedback } from "./LandingFeedback.js";

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("frontend-only landing feedback", () => {
  it("saves valid feedback locally and clearly states it was not sent", () => {
    const request = vi.spyOn(globalThis, "fetch");
    render(<LandingFeedback />);
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Your name/), {
      target: { value: "  Visitor  " },
    });
    fireEvent.change(screen.getByLabelText("Your feedback"), {
      target: { value: "  The field stories are easy to explore.  " },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Website feedback" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "It has not been sent to our team",
    );
    expect(JSON.parse(localStorage.getItem("wr.landing-feedback")!)).toEqual([
      expect.objectContaining({
        name: "Visitor",
        message: "The field stories are easy to explore.",
      }),
    ]);
    expect(request).not.toHaveBeenCalled();
  });
  it("rejects blank feedback without showing success or storing a record", () => {
    render(<LandingFeedback />);
    fireEvent.change(screen.getByLabelText("Your feedback"), {
      target: { value: "              " },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Website feedback" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "at least 10 characters",
    );
    expect(localStorage.getItem("wr.landing-feedback")).toBeNull();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
  it("keeps the draft and shows an honest error when local saving fails", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });
    render(<LandingFeedback />);
    fireEvent.change(screen.getByLabelText("Your feedback"), {
      target: { value: "Please add more stories about communities." },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Website feedback" }));
    expect(screen.getByRole("alert")).toHaveTextContent("could not save");
    expect(screen.getByLabelText("Your feedback")).toHaveValue(
      "Please add more stories about communities.",
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
