import { useState, useCallback } from 'react';

export function useGeofenceDrawing() {
  const [isDrawing, setIsDrawing] = useState(false);
  const [newPolygon, setNewPolygon] = useState<[number, number][] | null>(null);

  const toggleDrawing = useCallback(() => {
    setIsDrawing((prev) => !prev);
  }, []);

  const completeDrawing = useCallback((poly: [number, number][]) => {
    setNewPolygon(poly);
  }, []);

  const cancelDrawing = useCallback(() => {
    setNewPolygon(null);
    setIsDrawing(false);
  }, []);

  return {
    isDrawing,
    newPolygon,
    toggleDrawing,
    completeDrawing,
    cancelDrawing
  };
}
