import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  useMap,
} from "react-leaflet";
import type { LatLngBoundsExpression, LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";

export type LongitudeLatitude = readonly [longitude: number, latitude: number];

type PatrolMapProps = {
  routePath: readonly LongitudeLatitude[];
  currentPosition?: LongitudeLatitude;
  trackedPositions?: readonly LongitudeLatitude[];
  waypointPositions?: readonly LongitudeLatitude[];
  className?: string;
};

function toLeafletPosition([longitude, latitude]: LongitudeLatitude): LatLngExpression {
  return [latitude, longitude];
}

function FitPatrolBounds({
  routePath,
  currentPosition,
}: Pick<PatrolMapProps, "routePath" | "currentPosition">) {
  const map = useMap();

  useEffect(() => {
    const positions = routePath.map(toLeafletPosition);
    if (currentPosition) positions.push(toLeafletPosition(currentPosition));
    if (positions.length > 1) {
      map.fitBounds(positions as LatLngBoundsExpression, { padding: [28, 28] });
    }
  }, [currentPosition, map, routePath]);

  return null;
}

/** Presentational patrol map. GPS lifecycle and persistence remain app concerns. */
export function PatrolMap({
  routePath,
  currentPosition,
  trackedPositions = [],
  waypointPositions = [],
  className,
}: PatrolMapProps) {
  const center = toLeafletPosition(currentPosition ?? routePath[0] ?? [81.52, 6.37]);
  const line = routePath.map(toLeafletPosition);

  return (
    <MapContainer
      className={className}
      center={center}
      zoom={14}
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {line.length > 1 && (
        <Polyline positions={line} pathOptions={{ color: "#173e2b", weight: 6 }} />
      )}
      {trackedPositions.length > 1 && (
        <Polyline
          positions={trackedPositions.map(toLeafletPosition)}
          pathOptions={{ color: "#2477d4", weight: 5, opacity: 0.9 }}
        />
      )}
      {routePath[0] && (
        <CircleMarker
          center={toLeafletPosition(routePath[0])}
          radius={6}
          pathOptions={{ color: "#fff", fillColor: "#173e2b", fillOpacity: 1, weight: 2 }}
        />
      )}
      {waypointPositions.map((position, index) => (
        <CircleMarker
          key={`${position[0]}-${position[1]}-${index}`}
          center={toLeafletPosition(position)}
          radius={7}
          pathOptions={{ color: "#fff", fillColor: "#c47818", fillOpacity: 1, weight: 3 }}
        />
      ))}
      {currentPosition && (
        <CircleMarker
          center={toLeafletPosition(currentPosition)}
          radius={8}
          pathOptions={{ color: "#fff", fillColor: "#2477d4", fillOpacity: 1, weight: 3 }}
        />
      )}
      <FitPatrolBounds routePath={routePath} currentPosition={currentPosition} />
    </MapContainer>
  );
}
