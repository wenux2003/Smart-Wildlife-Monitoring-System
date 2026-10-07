import { useState } from "react";
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
        <aside className="w-[420px] flex-shrink-0 flex flex-col bg-[#14352B] border-r border-[#DCE5DC] z-[500] shadow-[4px_0_24px_rgba(20,53,43,0.06)] relative text-white">
          <div className="p-6 border-b border-[#DCE5DC]">
            <p className="section-kicker !mb-2 !text-[#DCE5DC]">MONITORING</p>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Active Alerts</h1>
            <p className="text-sm text-gray-300 mt-1.5">Manage and dispatch rangers to live alerts</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {alertsLoading && (
              <div className="flex justify-center py-12 text-[var(--muted)] animate-pulse">
                <p>Loading alerts...</p>
              </div>
            )}
            
            {!alertsLoading && alerts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-[#FFFFFF] flex items-center justify-center text-[#15803D] mb-4 ring-8 ring-[#15803D]/20">
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                </div>
                <h3 className="text-lg font-medium text-white">All Clear</h3>
                <p className="text-sm text-gray-300 mt-2">There are no active alerts at the moment.</p>
              </div>
            )}
            
            {alerts.map(alert => (
              <div key={alert.id} className="bg-[#FFFFFF] border border-[#DCE5DC] rounded-[12px] overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-[#D97706] group text-[#1F2937]">
                <div className="p-5">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-semibold text-[15px] text-[#1F2937] capitalize">
                      {alert.type.replace('_', ' ').toLowerCase()}
                    </h3>
                    <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-widest text-white ${
                      alert.severity === 'CRITICAL' ? 'bg-[#B91C1C]' : 
                      alert.severity === 'HIGH' ? 'bg-[#B45309]' : 
                      'bg-[#1D4ED8]'
                    }`}>
                      {alert.severity}
                    </span>
                  </div>
                  
                  <div className="space-y-2.5 text-[13px] text-[#64748B]">
                    <div className="flex justify-between items-center pb-2 border-b border-[#DCE5DC]/50">
                      <span>Status</span> 
                      <span className="font-medium text-[#1F2937] bg-[#f6f8f5] px-2 py-0.5 rounded-sm">{alert.status}</span>
                    </div>
                    {alert.collarId && (
                      <div className="flex justify-between items-center pb-2 border-b border-[#DCE5DC]/50">
                        <span>Collar</span>
                        <span className="font-medium text-[#1F2937]">
                          {collars.find(c => c.id === alert.collarId)?.animalName || alert.collarId}
                        </span>
                      </div>
                    )}
                    <div className="pt-1 flex items-center gap-1.5 text-[11px] text-[#64748B]">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {new Date(alert.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                  </div>
                  
                  {alert.status === 'NEW' && (
                    <div className="mt-5">
                      <button 
                        className="button button-green w-full !py-2.5 !min-h-0 text-[13px] tracking-wide shadow-sm"
                        onClick={() => acknowledgeMutation.mutate(alert.id)}
                        disabled={acknowledgeMutation.isPending}
                      >
                        {acknowledgeMutation.isPending ? 'Acknowledging...' : 'Acknowledge Alert'}
                      </button>
                    </div>
                  )}
                  
                  {alert.status === 'ACCEPTED' && (
                    <div className="mt-5 space-y-3">
                      <div className="relative">
                        <select 
                          id={`ranger-select-${alert.id}`} 
                          className="w-full appearance-none bg-[#FFFFFF] border border-[#DCE5DC] text-[#1F2937] text-[13px] font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-[#166534]/20 focus:border-[#166534] block p-2.5 transition-colors"
                          defaultValue=""
                        >
                          <option value="" disabled>Assign to a ranger...</option>
                          {staff.filter(s => s.role === 'RANGER').map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-[#64748B]">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                      </div>
                      <button 
                        className="button button-green w-full !py-2.5 !min-h-0 text-[13px] tracking-wide shadow-sm"
                        onClick={() => {
                          const select = document.getElementById(`ranger-select-${alert.id}`) as HTMLSelectElement;
                          if (select.value) {
                            dispatchMutation.mutate({ alertId: alert.id, rangerId: select.value });
                          }
                        }}
                        disabled={dispatchMutation.isPending}
                      >
                        {dispatchMutation.isPending ? 'Dispatching...' : 'Dispatch Ranger'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="border-t border-[#DCE5DC] bg-[#FFFFFF]">
                  <details className="group/details">
                    <summary className="cursor-pointer text-[11px] font-semibold tracking-wide uppercase text-[#166534] px-5 py-3 hover:bg-[#f6f8f5] transition-colors list-none flex justify-between items-center select-none">
                      Advanced Context
                      <svg className="w-3.5 h-3.5 transition-transform duration-200 group-open/details:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path></svg>
                    </summary>
                    <div className="px-5 pb-5 pt-1 text-[12px] text-[#64748B] space-y-3.5">
                      <div>
                        <strong className="text-[#1F2937] block mb-1">Nearby Settlements</strong>
                        Mahiyangana (12km), Bibile (18km)
                      </div>
                      <div>
                        <strong className="text-[#1F2937] block mb-1">Camera Images</strong>
                        No relevant camera trap images in the last 2 hours.
                      </div>
                      <div>
                        <strong className="text-[#1F2937] block mb-1">Event History</strong>
                        <ul className="space-y-2 mt-2 pl-2 border-l-2 border-[#DCE5DC]">
                          <li className="pl-3 relative before:absolute before:w-1.5 before:h-1.5 before:bg-[var(--green)] before:rounded-full before:-left-[4px] before:top-1.5">
                            {new Date(alert.createdAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })} - Alert Created
                          </li>
                          {alert.status !== 'NEW' && (
                            <li className="pl-3 relative before:absolute before:w-1.5 before:h-1.5 before:bg-[var(--green)] before:rounded-full before:-left-[4px] before:top-1.5">
                              Status updated to {alert.status}
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div className="flex-1 relative bg-[#bad2e3] z-0">
          <MapContainer center={center} zoom={zoom} className="absolute inset-0 w-full h-full z-0" style={{ height: '100%', width: '100%', zIndex: 0 }}>
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

