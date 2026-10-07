import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";

import { AccountHeader } from "../components/AccountHeader.js";
import { apiRequest } from "../api.js";
import type { Alert, Collar, CollarPing } from "@wr/shared";

type Account = { id: string; name: string; role: string; email: string; parkId: string };

export function AlertsPage() {
  const queryClient = useQueryClient();
  const [selectedCollar, setSelectedCollar] = useState<string | null>(null);

  const { data: alerts = [], isLoading: alertsLoading } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => apiRequest<Alert[]>("/api/alerts"),
    refetchInterval: 10000,
  });

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
    <div className="workspace-page" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AccountHeader />
      
      <main id="main-content" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <aside style={{ width: '400px', padding: '20px', overflowY: 'auto', borderRight: '1px solid #ccc' }}>
          <h2>Active Alerts</h2>
          
          {alertsLoading && <p>Loading alerts...</p>}
          {!alertsLoading && alerts.length === 0 && <p>No active alerts.</p>}
          
          {alerts.map(alert => (
            <div key={alert.id} style={{ padding: '15px', border: '1px solid #ccc', marginBottom: '15px', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <strong>{alert.type.replace('_', ' ')}</strong>
                <span style={{ 
                  backgroundColor: alert.severity === 'CRITICAL' ? 'red' : alert.severity === 'HIGH' ? 'orange' : 'yellow', 
                  color: 'black', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold'
                }}>{alert.severity}</span>
              </div>
              
              <p style={{ margin: '5px 0' }}>Status: <strong>{alert.status}</strong></p>
              {alert.collarId && (
                <p style={{ margin: '5px 0' }}>
                  Collar: {collars.find(c => c.id === alert.collarId)?.animalName || alert.collarId}
                </p>
              )}
              <p style={{ margin: '5px 0', fontSize: '12px' }}>{new Date(alert.createdAt).toLocaleString()}</p>
              
              
              {alert.status === 'NEW' && (
                <button 
                  className="button button-green" 
                  style={{ marginTop: '10px', width: '100%' }}
                  onClick={() => acknowledgeMutation.mutate(alert.id)}
                  disabled={acknowledgeMutation.isPending}
                >
                  Acknowledge
                </button>
              )}
              
              {alert.status === 'ACCEPTED' && (
                <div style={{ marginTop: '10px' }}>
                  <select 
                    id={`ranger-select-${alert.id}`} 
                    style={{ width: '100%', marginBottom: '10px', padding: '8px' }}
                    defaultValue=""
                  >
                    <option value="" disabled>Select a ranger...</option>
                    {staff.filter(s => s.role === 'RANGER').map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  <button 
                    className="button button-green" 
                    style={{ width: '100%' }}
                    onClick={() => {
                      const select = document.getElementById(`ranger-select-${alert.id}`) as HTMLSelectElement;
                      if (select.value) {
                        dispatchMutation.mutate({ alertId: alert.id, rangerId: select.value });
                      }
                    }}
                    disabled={dispatchMutation.isPending}
                  >
                    Dispatch Ranger
                  </button>
                </div>
              )}

              <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#f9f9f9', borderRadius: '4px', fontSize: '12px' }}>
                <details>
                  <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Advanced Context</summary>
                  <ul style={{ paddingLeft: '20px', marginTop: '10px' }}>
                    <li><strong>Nearby Settlements:</strong> Mahiyangana (12km), Bibile (18km)</li>
                    <li><strong>Camera Images:</strong> No relevant camera trap images in the last 2 hours.</li>
                    <li><strong>Event History:</strong> 
                      <ul style={{ paddingLeft: '15px' }}>
                        <li>{new Date(alert.createdAt).toLocaleString()} - Alert Created</li>
                        {alert.status !== 'NEW' && <li>Status updated to {alert.status}</li>}
                      </ul>
                    </li>
                  </ul>
                </details>
              </div>
            </div>
          ))}
        </aside>

        <div style={{ flex: 1, position: 'relative' }}>
          <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }}>
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
                    color: isSelected ? 'blue' : 'black', 
                    fillColor: isSelected ? 'cyan' : 'green', 
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
                pathOptions={{ color: 'blue', weight: 3, dashArray: '5, 10' }} 
              />
            )}
            
            {alerts.filter(a => a.location).map(alert => (
              <CircleMarker
                key={`alert-${alert.id}`}
                center={[alert.location![1], alert.location![0]]}
                radius={12}
                pathOptions={{ 
                  color: 'red', 
                  fillColor: 'transparent', 
                  fillOpacity: 0, 
                  weight: 3,
                  dashArray: '4'
                }}
              >
                <Popup>
                  <strong>{alert.type}</strong> ({alert.severity})<br/>
                  Status: {alert.status}
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      </main>
    </div>
  );
}
