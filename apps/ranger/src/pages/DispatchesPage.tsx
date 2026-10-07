import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";

async function apiRequest<T>(
  path: string,
  options: { method?: string; body?: object } = {},
): Promise<T> {
  const response = await fetch(path, {
    method: options.method ?? (options.body ? "POST" : "GET"),
    credentials: "same-origin",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!response.ok) throw new Error("API Request Failed");
  return response.json() as Promise<T>;
}

type AlertDispatch = {
  id: string;
  alertId: string;
  rangerId: string;
  status: string;
  notes: string | null;
  sentAt: string;
};

export function DispatchesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: dispatches = [], isLoading } = useQuery({
    queryKey: ["dispatches"],
    queryFn: () => apiRequest<AlertDispatch[]>("/api/alerts/dispatches/mine"),
    refetchInterval: 10000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: string; notes?: string }) => 
      apiRequest(`/api/alerts/dispatches/${id}/status`, { method: "POST", body: { status, notes } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dispatches"] }),
  });

  return (
    <main className="patrol-screen" id="main-content">
      <header className="patrol-header">
        <div className="patrol-nav-row">
          <button className="back-button" type="button" onClick={() => navigate("/")}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
            <span>Home</span>
          </button>
        </div>
        <div className="patrol-title-row">
          <div>
            <p className="patrol-kicker">FIELD OPERATIONS</p>
            <h1>My Dispatches</h1>
          </div>
        </div>
      </header>

      <section className="patrol-content" style={{ padding: '20px' }}>
        {isLoading ? (
          <p>Loading dispatches...</p>
        ) : dispatches.length === 0 ? (
          <p>You have no dispatches.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {dispatches.map(dispatch => (
              <div key={dispatch.id} style={{ padding: '15px', border: '1px solid #ccc', borderRadius: '8px' }}>
                <p>Status: <strong>{dispatch.status}</strong></p>
                <p>Sent: {new Date(dispatch.sentAt).toLocaleString()}</p>
                
                {dispatch.status === 'PENDING' && (
                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <button className="primary-button" onClick={() => updateMutation.mutate({ id: dispatch.id, status: 'ACCEPTED' })}>Accept</button>
                    <button className="secondary-button" onClick={() => updateMutation.mutate({ id: dispatch.id, status: 'REJECTED' })}>Reject</button>
                  </div>
                )}
                {dispatch.status === 'ACCEPTED' && (
                  <button className="primary-button" style={{ marginTop: '10px' }} onClick={() => updateMutation.mutate({ id: dispatch.id, status: 'ARRIVED' })}>Mark Arrived</button>
                )}
                {dispatch.status === 'ARRIVED' && (
                  <div style={{ marginTop: '10px' }}>
                    <input type="text" id={`notes-${dispatch.id}`} placeholder="Resolution notes..." style={{ width: '100%', padding: '8px', marginBottom: '10px' }} />
                    <button className="primary-button" onClick={() => {
                      const notes = (document.getElementById(`notes-${dispatch.id}`) as HTMLInputElement).value;
                      updateMutation.mutate({ id: dispatch.id, status: 'DONE', notes });
                    }}>Resolve</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
