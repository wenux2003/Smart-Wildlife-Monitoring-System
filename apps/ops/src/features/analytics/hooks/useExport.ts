import { useEffect, useReducer, useRef } from "react";
import { exportAnalyticsRun } from "../api.js";

type Format = "CSV" | "PDF";
type Status = "idle" | "exporting" | "done" | "failed";
type State = Record<Format, Status>;
const initial: State = { CSV: "idle", PDF: "idle" };
type Action =
  { type: "reset" } | { type: "status"; format: Format; status: Status };
function reducer(state: State, action: Action): State {
  return action.type === "reset"
    ? initial
    : { ...state, [action.format]: action.status };
}

export function useExport(runId: string | null) {
  const [state, dispatch] = useReducer(reducer, initial);
  const pending = useRef(new Set<Format>());
  const timers = useRef(new Map<Format, ReturnType<typeof setTimeout>>());
  const version = useRef(0);
  useEffect(() => {
    version.current += 1;
    pending.current.clear();
    dispatch({ type: "reset" });
    const activeTimers = timers.current;
    return () => {
      version.current += 1;
      activeTimers.forEach(clearTimeout);
      activeTimers.clear();
    };
  }, [runId]);

  async function download(format: Format) {
    if (!runId || pending.current.has(format)) return;
    const requestVersion = version.current;
    pending.current.add(format);
    clearTimeout(timers.current.get(format));
    dispatch({ type: "status", format, status: "exporting" });
    try {
      await exportAnalyticsRun(runId, format);
      if (version.current !== requestVersion) return;
      dispatch({ type: "status", format, status: "done" });
      timers.current.set(
        format,
        setTimeout(() => {
          dispatch({ type: "status", format, status: "idle" });
          timers.current.delete(format);
        }, 1600),
      );
    } catch {
      if (version.current === requestVersion)
        dispatch({ type: "status", format, status: "failed" });
    } finally {
      if (version.current === requestVersion) pending.current.delete(format);
    }
  }
  return { state, download };
}
