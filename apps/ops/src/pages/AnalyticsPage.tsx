import { useState, useEffect } from "react";
import { AccountHeader } from "../components/AccountHeader.js";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface HotspotRecord {
  type: string;
  count: number;
  location: [number, number];
}

export function AnalyticsPage() {
  const [hotspots, setHotspots] = useState<HotspotRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHotspots() {
      try {
        const res = await fetch("/api/analytics/hotspots?parkId=park123");
        if (!res.ok) throw new Error("Failed to load hotspots");
        const json = await res.json();
        setHotspots(json.data);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    fetchHotspots();
  }, []);

  const handleExport = async (type: "PDF" | "CSV") => {
    try {
      await fetch("/api/analytics/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exportType: type, queryParams: { parkId: "park123" } }),
      });
      alert(`${type} exported and logged to audit!`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      alert("Export failed: " + e.message);
    }
  };

  return (
    <div className="workspace-page">
      <AccountHeader />
      <main id="main-content" className="content-width account-panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p className="section-kicker">ANALYTICS</p>
            <h1>Conservation Reporting</h1>
          </div>
          <div>
            <button className="button button-outline" onClick={() => handleExport("CSV")} style={{ marginRight: 8 }}>Export CSV</button>
            <button className="button button-green" onClick={() => handleExport("PDF")}>Export PDF</button>
          </div>
        </div>

        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}

        {loading ? (
          <p>Loading analytics data...</p>
        ) : (
          <div style={{ height: "500px", marginTop: "2rem" }}>
            <MapContainer
              center={[6.8, 80.0]} // default center for Sri Lanka
              zoom={7}
              style={{ height: "100%", width: "100%", borderRadius: "8px" }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />
              {hotspots.map((h, i) => (
                <CircleMarker
                  key={i}
                  center={[h.location[1], h.location[0]]}
                  radius={h.count * 5}
                  color="red"
                  fillOpacity={0.6}
                >
                  <Popup>
                    <strong>{h.type}</strong>
                    <br />
                    Count: {h.count}
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        )}

        <div style={{ marginTop: "2rem" }}>
          <Link to="/dashboard" className="inline-link">
            &larr; Back to Dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}
