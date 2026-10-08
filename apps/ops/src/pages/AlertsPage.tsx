import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, Polygon } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";

import { AccountHeader } from "../components/AccountHeader.js";
import { AlertCard } from "../components/AlertCard.js";
import { AlertSettings } from "../components/AlertSettings.js";
import type { AlertConfig } from "../components/AlertSettings.js";
import { MapPolygonDrawer } from "../components/MapPolygonDrawer.js";
import { NewZoneModal } from "../components/NewZoneModal.js";
import { apiRequest } from "../api.js";
import type { Alert, Collar, CollarPing } from "@wr/shared";

type Account = { id: string; name: string; role: string; email: string; parkId: string };

export function AlertsPage() {
  const queryClient = useQueryClient();
  const [selectedCollar, setSelectedCollar] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [newPolygon, setNewPolygon] = useState<[number, number][] | null>(null);

  const { data: config } = useQuery({
    queryKey: ["alertConfig"],
    queryFn: () => apiRequest<AlertConfig>("/api/alerts/config"),
  });

  const updateConfigMutation = useMutation({
    mutationFn: (newConfig: AlertConfig) => 
      apiRequest("/api/alerts/config", { method: "PATCH", body: newConfig }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alertConfig"] });
      setNewPolygon(null);
      setIsDrawing(false);
    },
  });

  const { data: alerts = [], isLoading: alertsLoading } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => apiRequest<Alert[]>("/api/alerts"),
    refetchInterval: 3000,
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { data: collars = [], isLoading: collarsLoading } = useQuery({
    queryKey: ["collars"],
    queryFn: () => apiRequest<Collar[]>("/api/collars"),
    refetchInterval: 30000,
  });

  const { data: pings = [] } = useQuery({
    queryKey: ["collars", selectedCollar, "pings"],
    queryFn: () => apiRequest<CollarPing[]>(`/api/collars/${selectedCollar}/pings`),
    enabled: !!selectedCollar,
  });

  const { data: staff = [] } = useQuery({
    queryKey: ["staff"],
    queryFn: () => apiRequest<Account[]>("/api/accounts"),
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/alerts/${id}/acknowledge`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alerts"] }),
  });

  const dispatchMutation = useMutation({
    mutationFn: ({ alertId, rangerId }: { alertId: string; rangerId: string }) => 
      apiRequest(`/api/alerts/${alertId}/dispatch`, { method: "POST", body: { rangerId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alerts"] }),
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

        <div className="flex-1 bg-[#bad2e3] relative" style={{ zIndex: 0, minHeight: 0 }}>
          <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%', zIndex: 0 }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            
            {collars.map(collar => {
              if (!collar.location) return null;
              const isSelected = selectedCollar === collar.id;
              
              return (
                <CircleMarker
                  key={collar.id}
                  center={[collar.location[1], collar.location[0]]}
                  radius={8}
                  pathOptions={{ 
                    color: isSelected ? '#D97706' : '#1F2937', 
                    fillColor: isSelected ? '#D97706' : '#166534', 
                    fillOpacity: 1, 
                    weight: 2 
                  }}
                  eventHandlers={{
                    click: () => setSelectedCollar(isSelected ? null : collar.id),
                  }}
                >
                  <Popup>
                    <strong>{collar.animalName || 'Unknown Animal'}</strong><br/>
                    Species: {collar.species}<br/>
                    Battery: {collar.latestBattery}%<br/>
                    Status: {collar.status}
                  </Popup>
                </CircleMarker>
              );
            })}
            
            {pings.length > 1 && (
              <Polyline 
                positions={pings.map(p => [p.location[1], p.location[0]])} 
                pathOptions={{ color: '#D97706', weight: 3, dashArray: '5, 10' }} 
              />
            )}
            
            {alerts.filter(a => a.location).map(alert => (
              <CircleMarker
                key={`alert-${alert.id}`}
                center={[alert.location![1], alert.location![0]]}
                radius={12}
                pathOptions={{ 
                  color: alert.severity === 'CRITICAL' ? '#B91C1C' : alert.severity === 'HIGH' ? '#B45309' : '#1D4ED8', 
                  fillColor: 'transparent', 
                  fillOpacity: 0, 
                  weight: 3,
                  dashArray: '4'
                }}
              >
                <Popup>
                  <strong>{alert.type}</strong> ({alert.severity})<br/>
                  Status: {alert.status === 'ACCEPTED' ? 'REQUIRES DISPATCH' : 
                           alert.status === 'DISPATCHED' ? ((alert as any).hasActiveDispatch ? 'RANGER DISPATCHED' : <span className="loading-dots">DISPATCHING</span>) :
                           alert.status}
                </Popup>
              </CircleMarker>
            ))}

            {/* Render existing zones */}
            {config?.geofenceZones?.map((zone, i) => (
              <Polygon 
                key={i} 
                positions={zone.polygon.map(p => [p[1], p[0]])}
                pathOptions={{
                  color: zone.severity === 'CRITICAL' ? '#B91C1C' : zone.severity === 'HIGH' ? '#B45309' : '#D97706',
                  fillColor: zone.severity === 'CRITICAL' ? '#B91C1C' : zone.severity === 'HIGH' ? '#B45309' : '#D97706',
                  fillOpacity: 0.1,
                  weight: 2,
                  dashArray: '4, 4'
                }}
              >
                <Popup>
                  <strong>{zone.name}</strong><br/>
                  Alert on {zone.alertOn} ({zone.severity})
                </Popup>
              </Polygon>
            ))}

            {/* Drawing tool overlay */}
            <MapPolygonDrawer 
              isActive={isDrawing} 
              onComplete={(poly) => setNewPolygon(poly)} 
            />
          </MapContainer>

          {/* Floating Draw Button */}
          <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 9999 }}>
            <button 
              onClick={() => setIsDrawing(!isDrawing)}
              className={`px-4 py-2 rounded-md shadow-lg transition-colors flex items-center gap-2 font-bold ${isDrawing ? 'bg-[#166534] text-white' : 'bg-white text-[#14352B] hover:bg-gray-50 border-2 border-[#166534]'}`}
              title={isDrawing ? "Cancel Drawing" : "Draw Geofence Zone"}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              <span>{isDrawing ? "CANCEL DRAWING" : "DRAW ZONE"}</span>
            </button>
          </div>

          {isDrawing && (
            <div style={{ position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 9999 }} className="bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-md border border-[#DCE5DC] text-sm text-[#14352B] flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#166534] animate-pulse"></div>
              Click on the map to draw points. Right-click when finished.
            </div>
          )}
        </div>
      </main>
      
      {showSettings && <AlertSettings onClose={() => setShowSettings(false)} />}
      
      {newPolygon && (
        <NewZoneModal 
          polygon={newPolygon}
          onCancel={() => {
            setNewPolygon(null);
            setIsDrawing(false);
          }}
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

