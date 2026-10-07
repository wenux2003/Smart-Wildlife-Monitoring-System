import { useEffect } from "react";
import { syncPendingPatrols } from "../lib/patrolSync.js";
import { useNetworkStatus } from "../lib/useNetworkStatus.js";
import { useAuth } from "../auth/AuthContext.js";

export function PatrolSyncCoordinator() {
  const network = useNetworkStatus();
  const { user } = useAuth();

  useEffect(() => {
    if (network !== "ONLINE" || user?.role !== "RANGER") return;
    void syncPendingPatrols(user.id);
    const timer = window.setInterval(() => void syncPendingPatrols(user.id), 15_000);
    return () => window.clearInterval(timer);
  }, [network, user?.id, user?.role]);

  return null;
}
