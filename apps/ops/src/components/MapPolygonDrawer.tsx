import { useState } from "react";
import { useMapEvents, Polyline, CircleMarker } from "react-leaflet";

export function MapPolygonDrawer({ 
  onComplete,
  isActive
}: { 
  onComplete: (polygon: [number, number][]) => void;
  isActive: boolean;
}) {
  const [points, setPoints] = useState<[number, number][]>([]);

  useMapEvents({
    click(e) {
      if (!isActive) return;
      setPoints((prev) => [...prev, [e.latlng.lng, e.latlng.lat]]);
    },
    contextmenu(e) {
      if (!isActive) return;
      if (points.length >= 3) {
        onComplete(points);
        setPoints([]);
      }
    }
  });

  if (!isActive) return null;

  return (
    <>
      {points.length > 0 && (
        <Polyline 
          positions={points.map(p => [p[1], p[0]])} 
          pathOptions={{ color: '#166534', weight: 3, dashArray: '5, 10' }} 
        />
      )}
      {points.length > 2 && (
        <Polyline 
          positions={[[points[points.length-1][1], points[points.length-1][0]], [points[0][1], points[0][0]]]} 
          pathOptions={{ color: '#166534', weight: 3, dashArray: '5, 10', opacity: 0.5 }} 
        />
      )}
      {points.map((p, i) => (
        <CircleMarker
          key={i}
          center={[p[1], p[0]]}
          radius={4}
          pathOptions={{ color: '#166534', fillColor: 'white', fillOpacity: 1, weight: 2 }}
        />
      ))}
    </>
  );
}
