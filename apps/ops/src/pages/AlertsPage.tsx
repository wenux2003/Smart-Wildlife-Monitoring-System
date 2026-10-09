import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";

import { AccountHeader } from "../components/AccountHeader.js";
import { AlertCard } from "../components/AlertCard.js";
import { AlertSettings } from "../components/AlertSettings.js";
import type { AlertConfig } from "../components/AlertSettings.js";
import { AlertsMap } from "../components/AlertsMap.js";
import { useGeofenceDrawing } from "../hooks/useGeofenceDrawing.js";
import { NewZoneModal } from "../components/NewZoneModal.js";
import { apiRequest } from "../api.js";
import type { Alert, Collar, CollarPing } from "@wr/shared";


export function AlertsPage() {
  const queryClient = useQueryClient();
  const [selectedCollar, setSelectedCollar] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const { isDrawing, newPolygon, toggleDrawing, completeDrawing, cancelDrawing } = useGeofenceDrawing();

  const { data: config } = useQuery({
    queryKey: ["alertConfig"],
    queryFn: () => apiRequest<AlertConfig>("/api/alerts/config"),
  });

  const updateConfigMutation = useMutation({
    mutationFn: (newConfig: AlertConfig) => 
      apiRequest("/api/alerts/config", { method: "PATCH", body: newConfig }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alertConfig"] });
      cancelDrawing();
    },
  });

  const { data: alerts = [], isLoading: alertsLoading } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => apiRequest<Alert[]>("/api/alerts"),
    refetchInterval: 3000,
  });

  const { data: collars = [] } = useQuery({
    queryKey: ["collars"],
    queryFn: () => apiRequest<Collar[]>("/api/collars"),
    refetchInterval: 30000,
  });

  const { data: pings = [] } = useQuery({
    queryKey: ["collars", selectedCollar, "pings"],
    queryFn: () => apiRequest<CollarPing[]>(`/api/collars/${selectedCollar}/pings`),
    enabled: !!selectedCollar,
  });

  const center: LatLngExpression = [7.8731, 80.7718]; // Sri Lanka center
  const zoom = 7;

  return (
    <div className="workspace-page flex flex-col h-screen">
      <AccountHeader />
      
      <main id="main-content" className="flex flex-1 overflow-hidden relative">
        <aside className="w-[420px] flex-shrink-0 flex flex-col bg-[#F4F6F1] border-r border-[#DCE5DC] z-[500] shadow-[4px_0_24px_rgba(0,0,0,0.06)] relative text-[#1F2937]">
          <div className="p-6 border-b border-[#DCE5DC] flex justify-between items-start">
            <div>
              <p className="section-kicker !mb-2 text-[#14352B]">MONITORING</p>
              <h1 className="text-3xl font-semibold tracking-tight text-[#1F2937]">Active Alerts</h1>
              <p className="text-sm text-[#4B5563] mt-1.5">Manage and dispatch rangers to live alerts</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={toggleDrawing}
                className={`px-4 py-2 rounded-md transition-colors flex items-center justify-center font-bold text-sm ${isDrawing ? 'bg-[#166534] text-white hover:bg-[#14532d]' : 'bg-[#E8EDE4] text-[#14352B] hover:bg-[#DCE5DC]'}`}
                title={isDrawing ? "Cancel Drawing" : "Draw Geofence Zone"}
              >
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                {isDrawing ? "CANCEL DRAWING" : "DRAW ZONE"}
              </button>
              <button 
                onClick={() => setShowSettings(true)}
                className="p-2 bg-[#E8EDE4] text-[#14352B] hover:bg-[#DCE5DC] rounded-md transition-colors"
                title="Alert Settings"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {alertsLoading && (
              <div className="flex justify-center py-12 text-[var(--muted)] animate-pulse">
                <p>Loading alerts...</p>
              </div>
            )}
            
            {!alertsLoading && alerts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-[#E8EDE4] flex items-center justify-center text-[#15803D] mb-4 ring-8 ring-[#15803D]/10">
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                </div>
                <h3 className="text-lg font-medium text-[#1F2937]">All Clear</h3>
                <p className="text-sm text-[#4B5563] mt-2">There are no active alerts at the moment.</p>
              </div>
            )}
            
            {alerts.map(alert => (
              <AlertCard key={alert.id} alert={alert} collars={collars} />
            ))}
          </div>
        </aside>

        <AlertsMap 
          center={center}
          zoom={zoom}
          collars={collars}
          pings={pings}
          alerts={alerts}
          config={config}
          selectedCollar={selectedCollar}
          setSelectedCollar={setSelectedCollar}
          isDrawing={isDrawing}
          setNewPolygon={completeDrawing}
          onDeleteZone={(index) => {
            if (!config) return;
            const newZones = config.geofenceZones.filter((_, i) => i !== index);
            updateConfigMutation.mutate({
              ...config,
              geofenceZones: newZones
            });
          }}
        />
      </main>
      
      {showSettings && <AlertSettings onClose={() => setShowSettings(false)} />}
      
      {newPolygon && (
        <NewZoneModal 
          polygon={newPolygon}
          onCancel={cancelDrawing}
          onSave={(zone) => {
            const zones = config?.geofenceZones || [];
            updateConfigMutation.mutate({
              ...config,
              geofenceZones: [...zones, zone]
            });
          }}
        />
      )}
    </div>
  );
}

