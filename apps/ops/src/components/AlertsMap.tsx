import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, Polygon } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import { getSeverityColor } from "../utils/colors.js";
import { MapPolygonDrawer } from "./MapPolygonDrawer.js";
import type { Alert, Collar, CollarPing } from "@wr/shared";
import type { AlertConfig } from "./AlertSettings.js";

type AlertsMapProps = {
  center: LatLngExpression;
  zoom: number;
  collars: Collar[];
  pings: CollarPing[];
  alerts: Alert[];
  config: AlertConfig | undefined;
  selectedCollar: string | null;
  setSelectedCollar: (id: string | null) => void;
  isDrawing: boolean;
  setNewPolygon: (poly: [number, number][]) => void;
  onDeleteZone?: (index: number) => void;
};

export function AlertsMap({
  center, zoom, collars, pings, alerts, config,
  selectedCollar, setSelectedCollar, isDrawing, setNewPolygon, onDeleteZone
}: AlertsMapProps) {
  return (
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
              color: getSeverityColor(alert.severity),
              fillColor: 'transparent', 
              fillOpacity: 0, 
              weight: 3,
              dashArray: '4'
            }}
          >
            <Popup>
              <strong>{alert.type}</strong> ({alert.severity})<br/>
              Status: {alert.status === 'ACCEPTED' ? 'REQUIRES DISPATCH' : 
                       alert.status === 'DISPATCHED' ? (alert.hasActiveDispatch ? 'RANGER DISPATCHED' : <span className="loading-dots">DISPATCHING</span>) :
                       alert.status}
            </Popup>
          </CircleMarker>
        ))}

        {config?.geofenceZones?.map((zone, i) => (
          <Polygon 
            key={i} 
            positions={zone.polygon.map(p => [p[1], p[0]])}
            pathOptions={{
              color: getSeverityColor(zone.severity),
              fillColor: getSeverityColor(zone.severity),
              fillOpacity: 0.1,
              weight: 2,
              dashArray: '4, 4'
            }}
          >
            <Popup>
              <strong>{zone.name}</strong><br/>
              Alert on {zone.alertOn} ({zone.severity})
              {onDeleteZone && (
                <div style={{ marginTop: '8px' }}>
                  <button 
                    onClick={() => onDeleteZone(i)}
                    style={{
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Delete Zone
                  </button>
                </div>
              )}
            </Popup>
          </Polygon>
        ))}

        <MapPolygonDrawer 
          isActive={isDrawing} 
          onComplete={setNewPolygon} 
        />
      </MapContainer>

      {isDrawing && (
        <div style={{ position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 9999 }} className="bg-white/90 backdrop-blur px-5 py-2.5 rounded-2xl shadow-lg border border-[#DCE5DC] text-sm text-[#14352B] flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[#166534] animate-pulse"></div>
          <div className="flex flex-col">
            <span className="font-semibold">Click to draw boundary points</span>
            <span className="text-xs text-[#4B5563]">
              Click the <strong className="text-[#166534]">first point (green)</strong> or Right-click to finish. Press <strong className="text-gray-700">Backspace</strong> to undo.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
