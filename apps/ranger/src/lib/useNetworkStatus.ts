import { useEffect, useState } from "react";

export type NetworkStatus = "ONLINE" | "OFFLINE";

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(
    navigator.onLine ? "ONLINE" : "OFFLINE",
  );

  useEffect(() => {
    const online = () => setStatus("ONLINE");
    const offline = () => setStatus("OFFLINE");
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);

  return status;
}
