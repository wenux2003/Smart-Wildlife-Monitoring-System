import { useEffect } from "react";
import { useAuth } from "../auth/AuthContext.js";
import { syncIncidents } from "../lib/incidents.js";
export function IncidentSync() {
  const { user } = useAuth();
  useEffect(() => {
    if (
      !user ||
      user.role !== "RANGER" ||
      !user.parkId ||
      !globalThis.indexedDB
    )
      return;
    let disposed = false;
    const flush = () => {
      if (!disposed)
        void syncIncidents(user).catch(() => {
          /* Local queue retains work and exposes errors on My incidents. */
        });
    };
    flush();
    const timer = window.setInterval(flush, 15000);
    const resume = () => {
      if (document.visibilityState === "visible") flush();
    };
    window.addEventListener("online", flush);
    window.addEventListener("focus", flush);
    document.addEventListener("visibilitychange", resume);
    return () => {
      disposed = true;
      clearInterval(timer);
      window.removeEventListener("online", flush);
      window.removeEventListener("focus", flush);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [user]);
  return null;
}
