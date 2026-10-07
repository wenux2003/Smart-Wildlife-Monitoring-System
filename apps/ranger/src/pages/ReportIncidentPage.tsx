import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";


export function ReportIncidentPage() {
  const navigate = useNavigate();
  const [type, setType] = useState("POACHING");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoMock, setPhotoMock] = useState<string | null>(null);

  // Use a ref to store a mock local photo selection
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      // Create a mock local URL for the selected image
      const url = URL.createObjectURL(e.target.files[0]);
      setPhotoMock(url);
    }
  };

  const handlePhotoRemove = () => {
    if (photoMock) {
      URL.revokeObjectURL(photoMock);
      setPhotoMock(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const submitIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // In a real app we'd get the actual device location using geolocation.
      // Mocking Sri Lankan coordinates around Yala National Park for now.
      const lat = 6.3686 + (Math.random() * 0.05 - 0.025);
      const lng = 81.5173 + (Math.random() * 0.05 - 0.025);

      // In a real app with offline sync, we'd save to IDB first using @wr/offline 
      // or directly if we assume online for now.
      // E.g.: syncQueue.enqueue("incidents:report", { ... })
      
      const payload = {
        type,
        description,
        location: [lng, lat],
        photoUrl: photoMock ? "https://example.com/mock-photo.jpg" : undefined, // In a real app, upload photo to object storage and get URL
      };

      await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      navigate("/");
    } catch (err) {
      console.error("Failed to report incident:", err);
      // Fallback offline save logic would go here
      alert("Failed to report incident. In a real app with offline support, this would be queued.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <header className="patrol-header">
        <div className="patrol-nav-row">
          <button className="back-button" onClick={() => navigate(-1)} type="button">
            <span>Back</span>
          </button>
        </div>
        <div className="patrol-title-row">
          <h1>Report Incident</h1>
        </div>
      </header>
      <main className="content" id="main-content">
        <form onSubmit={submitIncident} className="flex-col gap-4">
          <div className="form-group">
            <label htmlFor="type">Incident Type</label>
            <select
              id="type"
              className="form-control"
              value={type}
              onChange={(e) => setType(e.target.value)}
              required
            >
              <option value="POACHING">Poaching Activity</option>
              <option value="INJURED_ANIMAL">Injured Animal</option>
              <option value="SNARE_FOUND">Snare/Trap Found</option>
              <option value="FENCE_DAMAGE">Fence Damage</option>
              <option value="HUMAN_WILDLIFE_CONFLICT">Human-Wildlife Conflict</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              className="form-control"
              rows={4}
              placeholder="Describe what you found..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Photo Evidence</label>
            {!photoMock ? (
              <div 
                className="card flex-col align-center justify-center p-6 gap-2" 
                style={{ border: '2px dashed var(--color-border)', cursor: 'pointer', background: 'transparent' }}
                onClick={() => fileInputRef.current?.click()}
              >
                <span>[ Camera Icon ]</span>
                <span className="eyebrow" style={{ color: 'var(--color-fg-muted)' }}>Tap to take photo</span>
              </div>
            ) : (
              <div style={{ position: 'relative', width: '100%', borderRadius: '12px', overflow: 'hidden' }}>
                <img src={photoMock} alt="Evidence" style={{ width: '100%', height: 'auto', display: 'block' }} />
                <button 
                  type="button" 
                  onClick={handlePhotoRemove}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: 'rgba(0,0,0,0.6)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <span>X</span>
                </button>
              </div>
            )}
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              ref={fileInputRef} 
              style={{ display: 'none' }}
              onChange={handlePhotoSelect}
            />
          </div>

          <button 
            type="submit" 
            className="primary-button" 
            disabled={isSubmitting || !description}
            style={{ marginTop: '1rem' }}
          >
            {isSubmitting ? "Submitting..." : "Submit Report"}
          </button>
        </form>
      </main>
    </>
  );
}
