// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useExport } from "./useExport.js";
import { exportAnalyticsRun } from "../api.js";

vi.mock("../api.js", () => ({ exportAnalyticsRun: vi.fn() }));
beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(exportAnalyticsRun).mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("P8 independent export feedback", () => {
  it("blocks duplicate in-flight downloads and restores the idle button after 1.6 seconds", async () => {
    let finishCsv!: () => void;
    let finishPdf!: () => void;
    vi.mocked(exportAnalyticsRun).mockImplementation(
      (_id, format) =>
        new Promise<void>((resolve) => {
          if (format === "CSV") finishCsv = resolve;
          else finishPdf = resolve;
        }),
    );
    const { result } = renderHook(() => useExport("report-1"));
    act(() => {
      void result.current.download("CSV");
      void result.current.download("CSV");
      void result.current.download("PDF");
    });
    expect(exportAnalyticsRun).toHaveBeenCalledTimes(2);
    expect(result.current.state).toEqual({
      CSV: "exporting",
      PDF: "exporting",
    });
    await act(async () => finishCsv());
    expect(result.current.state).toEqual({ CSV: "done", PDF: "exporting" });
    act(() => vi.advanceTimersByTime(1599));
    expect(result.current.state.CSV).toBe("done");
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.state.CSV).toBe("idle");
    await act(async () => finishPdf());
    expect(result.current.state.PDF).toBe("done");
  });

  it("retains failures for retry and clears success timers when the report changes", async () => {
    vi.mocked(exportAnalyticsRun).mockRejectedValueOnce(
      new Error("Unavailable"),
    );
    const { result, rerender, unmount } = renderHook(
      ({ id }) => useExport(id),
      { initialProps: { id: "report-1" as string | null } },
    );
    await act(async () => {
      await result.current.download("PDF");
    });
    expect(result.current.state.PDF).toBe("failed");
    vi.mocked(exportAnalyticsRun).mockResolvedValue(undefined);
    await act(async () => {
      await result.current.download("PDF");
    });
    expect(result.current.state.PDF).toBe("done");
    expect(vi.getTimerCount()).toBe(1);
    rerender({ id: "report-2" });
    expect(result.current.state).toEqual({ CSV: "idle", PDF: "idle" });
    expect(vi.getTimerCount()).toBe(0);
    await act(async () => {
      await result.current.download("CSV");
    });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ignores an old completion after a new report is selected and refuses unavailable runs", async () => {
    let finish!: () => void;
    vi.mocked(exportAnalyticsRun).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) => useExport(id),
      { initialProps: { id: "report-1" as string | null } },
    );
    act(() => {
      void result.current.download("CSV");
    });
    rerender({ id: "report-2" });
    await act(async () => finish());
    expect(result.current.state.CSV).toBe("idle");
    expect(vi.getTimerCount()).toBe(0);
    rerender({ id: null });
    await act(async () => {
      await result.current.download("PDF");
    });
    expect(exportAnalyticsRun).toHaveBeenCalledTimes(1);
  });
});
