import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthContext.js";
import { apiRequest } from "../api.js";
import type { Incident, IncidentReview } from "@wr/shared";

export function IncidentsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ["incidents"],
    queryFn: async () => {
      const res = await apiRequest<{ data: Incident[] }>("/api/incidents");
      return res.data;
    },
    enabled: !!user,
  });

  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const selectedIncident = incidents.find((i: Incident) => i.id === selectedIncidentId);

  const { data: reviews = [] } = useQuery({
    queryKey: ["incident-reviews", selectedIncidentId],
    queryFn: async () => {
      if (!selectedIncidentId) return [];
      const res = await apiRequest<{ data: IncidentReview[] }>(`/api/incidents/${selectedIncidentId}/reviews`);
      return res.data;
    },
    enabled: !!selectedIncidentId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest<{ data: any }>(`/api/incidents/${id}/status`, {
        method: "POST",
        body: { status }
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
    },
  });

  const addReviewMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const res = await apiRequest<{ data: any }>(`/api/incidents/${id}/reviews`, {
        method: "POST",
        body: { notes }
      });
      return res.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["incident-reviews", variables.id] });
    },
  });

  const [newReviewNotes, setNewReviewNotes] = useState("");

  const handleAddReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncidentId || !newReviewNotes.trim()) return;
    addReviewMutation.mutate({ id: selectedIncidentId, notes: newReviewNotes.trim() }, {
      onSuccess: () => setNewReviewNotes("")
    });
  };

  if (isLoading) {
    return <div style={{ padding: '2rem' }}>Loading incidents...</div>;
  }

  return (
    <div style={{ display: 'flex', height: '100%', gap: '1rem', padding: '1rem' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <h2>Incidents</h2>
        {incidents.length === 0 ? (
          <p>No incidents reported.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {incidents.map((inc: Incident) => (
              <div 
                key={inc.id}
                onClick={() => setSelectedIncidentId(inc.id)}
                style={{ 
                  padding: '1rem', 
                  border: `1px solid ${selectedIncidentId === inc.id ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background: selectedIncidentId === inc.id ? 'var(--color-bg-subtle)' : 'transparent'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{inc.type}</strong>
                  <span style={{ fontSize: '0.85rem', padding: '2px 6px', background: 'var(--color-bg-subtle)', borderRadius: '4px' }}>
                    {inc.status}
                  </span>
                </div>
                <p style={{ margin: '0.5rem 0', fontSize: '0.9rem', color: 'var(--color-fg-muted)' }}>
                  {new Date(inc.reportedAt).toLocaleString()}
                </p>
                <p style={{ margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {inc.description}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ flex: 1, borderLeft: '1px solid var(--color-border)', paddingLeft: '1rem', overflowY: 'auto' }}>
        {selectedIncident ? (
          <div>
            <h2>Incident Details</h2>
            <div style={{ marginBottom: '1rem' }}>
              <strong>Type:</strong> {selectedIncident.type}<br />
              <strong>Status:</strong> {selectedIncident.status}<br />
              <strong>Reported:</strong> {new Date(selectedIncident.reportedAt).toLocaleString()}<br />
              {selectedIncident.location && (
                <><strong>Location:</strong> {selectedIncident.location[1].toFixed(5)}, {selectedIncident.location[0].toFixed(5)}<br /></>
              )}
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <strong>Description:</strong>
              <p>{selectedIncident.description}</p>
            </div>

            {selectedIncident.photoUrl && (
              <div style={{ marginBottom: '1rem' }}>
                <strong>Evidence Photo:</strong>
                <img 
                  src={selectedIncident.photoUrl} 
                  alt="Incident evidence" 
                  style={{ width: '100%', maxHeight: '300px', objectFit: 'contain', borderRadius: '8px', marginTop: '0.5rem', background: '#000' }} 
                />
              </div>
            )}

            <div style={{ marginBottom: '2rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button 
                onClick={() => updateStatusMutation.mutate({ id: selectedIncident.id, status: 'IN_PROGRESS' })}
                disabled={selectedIncident.status === 'IN_PROGRESS' || updateStatusMutation.isPending}
                style={{ padding: '0.5rem', borderRadius: '4px' }}
              >
                Mark In Progress
              </button>
              <button 
                onClick={() => updateStatusMutation.mutate({ id: selectedIncident.id, status: 'VERIFIED' })}
                disabled={selectedIncident.status === 'VERIFIED' || updateStatusMutation.isPending}
                style={{ padding: '0.5rem', borderRadius: '4px' }}
              >
                Verify
              </button>
              <button 
                onClick={() => updateStatusMutation.mutate({ id: selectedIncident.id, status: 'RESOLVED' })}
                disabled={selectedIncident.status === 'RESOLVED' || updateStatusMutation.isPending}
                style={{ padding: '0.5rem', borderRadius: '4px' }}
              >
                Resolve
              </button>
              <button 
                onClick={() => updateStatusMutation.mutate({ id: selectedIncident.id, status: 'REJECTED' })}
                disabled={selectedIncident.status === 'REJECTED' || updateStatusMutation.isPending}
                style={{ padding: '0.5rem', borderRadius: '4px' }}
              >
                Reject
              </button>
            </div>

            <h3>Reviews & Notes</h3>
            {reviews.length === 0 ? (
              <p style={{ fontSize: '0.9rem', color: 'var(--color-fg-muted)' }}>No reviews yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
                {reviews.map((r: IncidentReview) => (
                  <div key={r.id} style={{ padding: '0.75rem', background: 'var(--color-bg-subtle)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-fg-muted)', marginBottom: '0.25rem' }}>
                      {new Date(r.createdAt).toLocaleString()}
                    </div>
                    <p style={{ margin: 0 }}>{r.notes}</p>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleAddReview} style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                value={newReviewNotes} 
                onChange={e => setNewReviewNotes(e.target.value)} 
                placeholder="Add a review note..." 
                style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}
              />
              <button 
                type="submit" 
                disabled={!newReviewNotes.trim() || addReviewMutation.isPending}
                style={{ padding: '0.5rem 1rem', borderRadius: '4px' }}
              >
                Add
              </button>
            </form>
          </div>
        ) : (
          <div style={{ color: 'var(--color-fg-muted)', display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
            Select an incident to view details
          </div>
        )}
      </div>
    </div>
  );
}
