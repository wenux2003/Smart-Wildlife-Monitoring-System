// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KpiValue } from "../components/KpiValue.js";

let reduced = false;
let now = 0;
let nextFrame = 0;
let frames: Map<number, FrameRequestCallback>;
let listeners: Set<() => void>;
beforeEach(() => {
  reduced = false;
  now = 0;
  nextFrame = 0;
  frames = new Map();
  listeners = new Set();
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("matchMedia", () => ({
    get matches() {
      return reduced;
    },
    addEventListener: (_event: string, listener: () => void) =>
      listeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) =>
      listeners.delete(listener),
  }));
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function tick(time: number) {
  now = time;
  const pending = [...frames.values()];
  frames.clear();
  act(() => pending.forEach((callback) => callback(time)));
}
function visibleValue(label: string) {
  return screen.getByLabelText(label).querySelector('[aria-hidden="true"]')
    ?.textContent;
}

describe("P8 accessible KPI motion", () => {
  it("exposes the final value immediately and animates new reports from the displayed value", () => {
    const view = render(<KpiValue value={40} />);
    expect(screen.getByLabelText("40")).toBeInTheDocument();
    expect(visibleValue("40")).toBe("0");
    tick(350);
    expect(visibleValue("40")).toBe("35");
    view.rerender(<KpiValue value={60} />);
    expect(visibleValue("60")).toBe("35");
    expect(frames.size).toBe(1);
    tick(1050);
    expect(visibleValue("60")).toBe("60");
    expect(frames.size).toBe(0);
    view.unmount();
    expect(listeners.size).toBe(0);
  });

  it("uses static final values under reduced motion and responds to preference changes", () => {
    reduced = true;
    const view = render(<KpiValue value={18.4} decimals={1} suffix=" km²" />);
    expect(visibleValue("18.4 km²")).toBe("18.4 km²");
    expect(frames.size).toBe(0);
    act(() => {
      reduced = false;
      listeners.forEach((listener) => listener());
    });
    view.rerender(<KpiValue value={25} decimals={1} suffix=" km²" />);
    expect(frames.size).toBe(1);
    act(() => {
      reduced = true;
      listeners.forEach((listener) => listener());
    });
    expect(visibleValue("25.0 km²")).toBe("25.0 km²");
    expect(frames.size).toBe(0);
  });

  it("never animates unavailable data and cancels work on unmount", () => {
    const view = render(<KpiValue value={5} />);
    expect(frames.size).toBe(1);
    view.rerender(<KpiValue value={null} />);
    expect(visibleValue("Not configured")).toBe("Not configured");
    expect(frames.size).toBe(0);
    view.rerender(<KpiValue value={12} />);
    expect(frames.size).toBe(1);
    view.unmount();
    expect(frames.size).toBe(0);
    expect(listeners.size).toBe(0);
  });
});
