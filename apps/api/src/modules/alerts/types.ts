import { AlertStatus, DispatchStatus, AlertType, Severity } from "@wr/shared";

export interface CollarRecord {
  id: string;
  park_id: string;
  animal_name: string | null;
  species: string | null;
  latest_battery: number | null;
  status: string | null;
  last_ping_at: Date | null;
}

export interface AlertRecord {
  id: string;
  park_id: string;
  collar_id: string | null;
  type: AlertType;
  severity: Severity;
  status: AlertStatus;
  location: [number, number] | null; // [lon, lat] from GeoJSON
  created_at: Date;
  resolved_at: Date | null;
  resolution_reason: string | null;
  is_broadcast: boolean;
  has_active_dispatch?: boolean;
}

export interface CollarPingRecord {
  id: string;
  collar_id: string;
  location: [number, number]; // [lon, lat] from GeoJSON
  speed: number | null;
  battery: number | null;
  recorded_at: Date;
}

export interface AlertDispatchRecord {
  id: string;
  alert_id: string;
  ranger_id: string;
  status: DispatchStatus;
  notes: string | null;
  sent_at: Date;
  responded_at: Date | null;
  arrived_at: Date | null;
  completed_at: Date | null;
}

export type AlertsConfig = {
  geofenceCenter?: [number, number];
  geofenceRadiusKm?: number;
  geofenceZones?: { name: string; polygon: [number, number][]; alertOn: "enter" | "exit"; severity: Severity }[];
  immobilitySpeedThreshold?: number;
  lowBatteryThreshold?: number;
};

export type ParkConfig = { alerts?: AlertsConfig };

export type RangerDispatchRecord = AlertDispatchRecord & {
  alert_type: AlertType;
  alert_severity: Severity;
  alert_location: [number, number] | null;
  animal_name: string | null;
};

export type AlertContext = {
  settlements: { name: string; distanceM: number }[];
  cameras: { name: string; distanceM: number }[];
  history: { timestamp: string; event: string }[];
};
