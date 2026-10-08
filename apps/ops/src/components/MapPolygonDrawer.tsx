import { useState, useEffect } from "react";
import { useMapEvents, Polyline, CircleMarker } from "react-leaflet";

export function MapPolygonDrawer({ 
  onComplete,
  isActive
}: { 
  onComplete: (polygon: [number, number][]) => void;
  isActive: boolean;
}) {
  const [points, setPoints] = useState<[number, number][]>([]);
  const [mousePos, setMousePos] = useState<[number, number] | null>(null);

  useEffect(() => {
    if (!isActive) {
      setPoints([]);
      setMousePos(null);
    }
  }, [isActive]);

  useMapEvents({
    click(e) {
      if (!isActive) return;
      setPoints((prev) => [...prev, [e.latlng.lng, e.latlng.lat]]);
    },
    mousemove(e) {
      if (!isActive) return;
      setMousePos([e.latlng.lng, e.latlng.lat]);
    },
    contextmenu(e) {
      if (!isActive) return;
      if (points.length >= 3) {
        onComplete(points);
        setPoints([]);
      }
    }
  });

  // Handle keyboard events (Undo and Cancel)
  useEffect(() => {
    if (!isActive) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Backspace' || e.key === 'z') {
        setPoints(prev => prev.slice(0, -1));
      } else if (e.key === 'Escape') {
        setPoints([]);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, points]);

  if (!isActive) return null;

  return (
    <>
      {points.length > 0 && (
        <Polyline 
          positions={points.map(p => [p[1], p[0]])} 
          pathOptions={{ color: '#166534', weight: 3, dashArray: '5, 10' }} 
        />
      )}
      
      {points.length > 0 && mousePos && (
        <Polyline 
          positions={[
            [points[points.length-1][1], points[points.length-1][0]], 
            [mousePos[1], mousePos[0]]
          ]} 
          pathOptions={{ color: '#166534', weight: 3, dashArray: '5, 10', opacity: 0.6 }} 
        />
      )}

      {points.length >= 2 && mousePos && (
        <Polyline 
          positions={[
            [mousePos[1], mousePos[0]],
            [points[0][1], points[0][0]]
          ]} 
          pathOptions={{ color: '#166534', weight: 3, dashArray: '5, 10', opacity: 0.3 }} 
        />
      )}

      {points.map((p, i) => (
        <CircleMarker
          key={i}
          center={[p[1], p[0]]}
          radius={i === 0 ? 8 : 4}
          pathOptions={{ 
            color: '#166534', 
            fillColor: i === 0 ? '#4ade80' : 'white', 
            fillOpacity: 1, 
            weight: 2 
          }}
          eventHandlers={
            i === 0 && points.length >= 3 
              ? {
                  click: (e) => {
                    // Try to prevent map click from firing
                    if (e.originalEvent) {
                      e.originalEvent.stopPropagation();
                    }
                    onComplete(points);
                    setPoints([]);
                  }
                }
              : undefined
          }
        />
      ))}
      
      {mousePos && (
         <CircleMarker
          center={[mousePos[1], mousePos[0]]}
          radius={4}
          pathOptions={{ color: '#166534', fillColor: 'transparent', fillOpacity: 0, weight: 2, opacity: 0.5 }}
        />
      )}
    </>
  );
}
