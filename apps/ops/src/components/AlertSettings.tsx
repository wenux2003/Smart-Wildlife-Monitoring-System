import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../api.js";

export type GeofenceZone = {
  name: string;
  polygon: [number, number][]; // [lon, lat][]
  alertOn: "enter" | "exit";
  severity: string;
};

export type AlertConfig = {
  geofenceCenter?: [number, number];
  geofenceRadiusKm?: number;
  geofenceZones?: GeofenceZone[];
  immobilitySpeedThreshold?: number;
  lowBatteryThreshold?: number;
};

export function AlertSettings({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  
  const { data: config, isLoading } = useQuery({
    queryKey: ["alertConfig"],
    queryFn: () => apiRequest<AlertConfig>("/api/alerts/config"),
  });

  const [geofenceCenterLat, setGeofenceCenterLat] = useState("");
  const [geofenceCenterLng, setGeofenceCenterLng] = useState("");
  const [geofenceRadiusKm, setGeofenceRadiusKm] = useState("");
  const [immobilitySpeedThreshold, setImmobilitySpeedThreshold] = useState("");
  const [lowBatteryThreshold, setLowBatteryThreshold] = useState("");

  const updateMutation = useMutation({
    mutationFn: (newConfig: AlertConfig) => 
      apiRequest("/api/alerts/config", { method: "PATCH", body: newConfig }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alertConfig"] });
      onClose();
    },
  });

  if (isLoading) {
    return <div className="p-5 text-center">Loading settings...</div>;
  }

  // Populate form whenever config loads or changes.
  // geofenceCenter is stored as [lon, lat] (GeoJSON order), so index 1 = lat, index 0 = lon.
  useEffect(() => {
    if (!config) return;
    setGeofenceCenterLat(config.geofenceCenter?.[1]?.toString() ?? "");
    setGeofenceCenterLng(config.geofenceCenter?.[0]?.toString() ?? "");
    setGeofenceRadiusKm(config.geofenceRadiusKm?.toString() ?? "");
    setImmobilitySpeedThreshold(config.immobilitySpeedThreshold?.toString() ?? "");
    setLowBatteryThreshold(config.lowBatteryThreshold?.toString() ?? "");
  }, [config]);

  const handleSave = () => {
    updateMutation.mutate({
      // Store as [lon, lat] (GeoJSON order) — form shows lat first, then lon
      geofenceCenter: geofenceCenterLat && geofenceCenterLng
        ? [parseFloat(geofenceCenterLng), parseFloat(geofenceCenterLat)]
        : undefined,
      geofenceRadiusKm: geofenceRadiusKm ? parseFloat(geofenceRadiusKm) : undefined,
      immobilitySpeedThreshold: immobilitySpeedThreshold ? parseFloat(immobilitySpeedThreshold) : undefined,
      lowBatteryThreshold: lowBatteryThreshold ? parseFloat(lowBatteryThreshold) : undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden text-[#1F2937]">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800">Alert Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Geofence Center</label>
            <div className="flex gap-2">
              <input 
                type="number" 
                step="any"
                value={geofenceCenterLat} 
                onChange={e => setGeofenceCenterLat(e.target.value)} 
                placeholder="Latitude" 
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534] focus:border-transparent" 
              />
              <input 
                type="number" 
                step="any"
                value={geofenceCenterLng} 
                onChange={e => setGeofenceCenterLng(e.target.value)} 
                placeholder="Longitude" 
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534] focus:border-transparent" 
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Geofence Radius (km)</label>
            <input 
              type="number" 
              step="any"
              value={geofenceRadiusKm} 
              onChange={e => setGeofenceRadiusKm(e.target.value)} 
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534] focus:border-transparent" 
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Immobility Speed Threshold (km/h)</label>
            <input 
              type="number" 
              step="any"
              value={immobilitySpeedThreshold} 
              onChange={e => setImmobilitySpeedThreshold(e.target.value)} 
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534] focus:border-transparent" 
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Low Battery Threshold (%)</label>
            <input 
              type="number" 
              step="any"
              value={lowBatteryThreshold} 
              onChange={e => setLowBatteryThreshold(e.target.value)} 
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534] focus:border-transparent" 
            />
          </div>
        </div>
        
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button 
            onClick={onClose} 
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            disabled={updateMutation.isPending}
            className="px-4 py-2 bg-[#166534] rounded-md text-sm font-medium text-white hover:bg-[#14532d] transition-colors disabled:opacity-50 flex items-center justify-center min-w-[80px]"
          >
            {updateMutation.isPending ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
