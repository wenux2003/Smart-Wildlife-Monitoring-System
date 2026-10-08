import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../api.js";
import type { Alert } from "@wr/shared";

type AlertContextData = {
  settlements: { name: string; distanceM: number }[];
  cameras: { name: string; distanceM: number }[];
  history: { timestamp: string; event: string }[];
};

type RangerDistanceData = {
  rangerId: string;
  name: string;
  distanceM: number | null;
};

export function AlertCard({ alert, collars }: { alert: Alert; collars: any[] }) {
  const queryClient = useQueryClient();

  const { data: context } = useQuery({
    queryKey: ["alerts", alert.id, "context"],
    queryFn: () => apiRequest<AlertContextData>(`/api/alerts/${alert.id}/context`),
    refetchInterval: 3000,
  });

  const { data: rangers = [] } = useQuery({
    queryKey: ["alerts", alert.id, "rangers"],
    queryFn: () => apiRequest<RangerDistanceData[]>(`/api/alerts/${alert.id}/rangers`),
    enabled: alert.status === "ACCEPTED" || alert.status === "TIMED_OUT",
    refetchInterval: 3000,
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

  const broadcastMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/alerts/${id}/broadcast`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alerts"] }),
  });

  return (
    <div className="bg-[#FFFFFF] border border-[#DCE5DC] rounded-[12px] overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-[#D97706] group text-[#1F2937]">
      <div className="p-5">
        <div className="flex justify-between items-start mb-4">
          <h3 className="font-semibold text-[15px] text-[#1F2937] capitalize">
            {alert.type.replace('_', ' ').toLowerCase()}
          </h3>
          <div className="flex gap-2">
            {alert.isBroadcast && (
              <span className="px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-widest text-white bg-purple-600">
                BROADCAST
              </span>
            )}
            <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-widest text-white ${
              alert.severity === 'CRITICAL' ? 'bg-[#B91C1C]' : 
              alert.severity === 'HIGH' ? 'bg-[#B45309]' : 
              'bg-[#1D4ED8]'
            }`}>
              {alert.severity}
            </span>
          </div>
        </div>
        
        <div className="space-y-2.5 text-[13px] text-[#64748B]">
          <div className="flex justify-between items-center pb-2 border-b border-[#DCE5DC]/50">
            <span>Status</span> 
            <span className={`font-medium px-2 py-0.5 rounded-sm ${
              alert.status === 'ACCEPTED' ? 'text-amber-700 bg-amber-50 animate-pulse' : 
              alert.status === 'DISPATCHED' ? (alert.hasActiveDispatch ? 'text-emerald-700 bg-emerald-50' : 'text-blue-700 bg-blue-50') : 
              'text-[#1F2937] bg-[#f6f8f5]'
            }`}>
              {alert.status === 'ACCEPTED' ? 'REQUIRES DISPATCH' : 
               alert.status === 'DISPATCHED' ? (alert.hasActiveDispatch ? 'RANGER DISPATCHED' : <span className="loading-dots">DISPATCHING</span>) : 
               alert.status}
            </span>
          </div>
          {alert.collarId && (
            <div className="flex justify-between items-center pb-2 border-b border-[#DCE5DC]/50">
              <span>Collar</span>
              <span className="font-medium text-[#1F2937]">
                {collars.find(c => c.id === alert.collarId)?.animalName || alert.collarId}
              </span>
            </div>
          )}
          {alert.resolutionReason && (
            <div className="flex justify-between items-center pb-2 border-b border-[#DCE5DC]/50">
              <span>Resolution</span>
              <span className="font-medium text-[#1F2937]">
                {alert.resolutionReason}
              </span>
            </div>
          )}
          <div className="pt-1 flex items-center gap-1.5 text-[11px] text-[#64748B]">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {new Date(alert.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
          </div>
        </div>
        
        {alert.status === 'NEW' && (
          <div className="mt-5 space-y-2">
            <button 
              className="button button-green w-full !py-2.5 !min-h-0 text-[13px] tracking-wide shadow-sm"
              onClick={() => acknowledgeMutation.mutate(alert.id)}
              disabled={acknowledgeMutation.isPending}
            >
              {acknowledgeMutation.isPending ? 'Acknowledging...' : 'Acknowledge Alert'}
            </button>
            <button 
              className="w-full py-2 text-[13px] tracking-wide text-purple-700 hover:text-purple-800 border border-purple-200 rounded-md hover:bg-purple-50 transition-colors"
              onClick={() => broadcastMutation.mutate(alert.id)}
              disabled={broadcastMutation.isPending}
            >
              Broadcast to All Rangers
            </button>
          </div>
        )}
        
        {(alert.status === 'ACCEPTED' || alert.status === 'TIMED_OUT') && (
          <div className="mt-5 space-y-3">
            <div className="relative">
              <select 
                id={`ranger-select-${alert.id}`} 
                className="w-full appearance-none bg-[#FFFFFF] border border-[#DCE5DC] text-[#1F2937] text-[13px] font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-[#166534]/20 focus:border-[#166534] block p-2.5 transition-colors"
                defaultValue=""
              >
                <option value="" disabled>Assign to a ranger...</option>
                {rangers.map(r => (
                  <option key={r.rangerId} value={r.rangerId}>
                    {r.name} {r.distanceM !== null ? `(${Math.round(r.distanceM / 100) / 10}km away)` : ''}
                  </option>
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
            <button 
              className="w-full py-2 text-[13px] tracking-wide text-purple-700 hover:text-purple-800 border border-purple-200 rounded-md hover:bg-purple-50 transition-colors"
              onClick={() => broadcastMutation.mutate(alert.id)}
              disabled={broadcastMutation.isPending}
            >
              Broadcast Escalate
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
              {!context ? "Loading..." : context.settlements.length === 0 ? "None within 25km" : (
                <ul className="list-disc pl-4 space-y-1">
                  {context.settlements.map(s => (
                    <li key={s.name}>{s.name} ({Math.round(s.distanceM / 100) / 10}km)</li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <strong className="text-[#1F2937] block mb-1">Camera Images</strong>
              {!context ? "Loading..." : context.cameras.length === 0 ? "No nearby cameras within 15km." : (
                <ul className="list-disc pl-4 space-y-1">
                  {context.cameras.map(c => (
                    <li key={c.name}>{c.name} ({Math.round(c.distanceM / 100) / 10}km)</li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <strong className="text-[#1F2937] block mb-1">Event History</strong>
              {!context ? "Loading..." : (
                <ul className="space-y-2 mt-2 pl-2 border-l-2 border-[#DCE5DC]">
                  {context.history.map((h, i) => (
                    <li key={i} className="pl-3 relative before:absolute before:w-1.5 before:h-1.5 before:bg-[var(--green)] before:rounded-full before:-left-[4px] before:top-1.5">
                      {new Date(h.timestamp).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })} - {h.event}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
