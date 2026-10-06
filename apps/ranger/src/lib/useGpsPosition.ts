import { useEffect, useState } from "react";
import type { LongitudeLatitude } from "@wr/ui";

export type GpsState =
  | { status: "locating" }
  | { status: "unavailable" }
  | { status: "ready"; position: LongitudeLatitude; accuracy: number };

/** Watches the latest valid browser GPS fix and cleans up the watcher on exit. */
export function useGpsPosition(): GpsState {
  const [gps, setGps] = useState<GpsState>({ status: "locating" });

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGps({ status: "unavailable" });
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => setGps({
        status: "ready",
        position: [coords.longitude, coords.latitude],
        accuracy: coords.accuracy,
      }),
      () => setGps({ status: "unavailable" }),
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return gps;
}
