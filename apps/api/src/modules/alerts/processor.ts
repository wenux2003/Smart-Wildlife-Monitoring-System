import type { AlertRepository } from "./repository.js";
import { AlertType, Severity, AlertStatus } from "@wr/shared";

// Example config shape from parks.config:
// {
//   "alerts": {
//     "geofenceCenter": [80.5, 7.5],
//     "geofenceRadiusKm": 20,
//     "immobilitySpeedThreshold": 0.5,
//     "lowBatteryThreshold": 15
//   }
// }

export class PingProcessor {
  constructor(
    private readonly repository: AlertRepository
  ) {}

  async processPing(pingData: {
    collarId: string;
    location: [number, number];
    speed: number | null;
    battery: number | null;
    recordedAt: Date;
  }) {
    // 1. Get the collar to find its park
    const collar = await this.repository.getCollarById(pingData.collarId);
    if (!collar) throw new Error("Collar not found");

    const parkId = collar.park_id;
    
    // Save ping
    await this.repository.createPing({
      collar_id: pingData.collarId,
      location: pingData.location,
      speed: pingData.speed,
      battery: pingData.battery,
      recorded_at: pingData.recordedAt,
    });

    // Get config
    const parkConfig = await this.repository.getParkConfig(parkId);
    const alertsConfig = parkConfig?.alerts || {
      geofenceCenter: [80.3, 7.3],
      geofenceRadiusKm: 25,
      immobilitySpeedThreshold: 0.1,
      lowBatteryThreshold: 20,
    };

    // Run rules
    await this.checkGeofence(collar, pingData, parkId, alertsConfig);
    await this.checkImmobility(collar, pingData, parkId, alertsConfig);
    await this.checkBattery(collar, pingData, parkId, alertsConfig);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async checkGeofence(collar: any, ping: any, parkId: string, alertsConfig: any) {
    let breachDetected = false;
    let breachSeverity = Severity.HIGH;

    // 1. Check Multi-Tiered Polygon Zones
    if (alertsConfig.geofenceZones && Array.isArray(alertsConfig.geofenceZones)) {
      for (const zone of alertsConfig.geofenceZones) {
        const isInside = this.pointInPolygon(ping.location, zone.polygon);
        
        if (zone.alertOn === "exit" && !isInside) {
          breachDetected = true;
          breachSeverity = zone.severity || Severity.HIGH;
          break; // Stop at first matched zone rule
        }
        
        if (zone.alertOn === "enter" && isInside) {
          breachDetected = true;
          breachSeverity = zone.severity || Severity.CRITICAL;
          break;
        }
      }
    } 
    // 2. Fallback to Circular Geofence
    else if (alertsConfig.geofenceCenter && alertsConfig.geofenceRadiusKm) {
      const center = alertsConfig.geofenceCenter;
      const radius = alertsConfig.geofenceRadiusKm;
      const distance = this.haversineDistance(center, ping.location);
      if (distance > radius) {
        breachDetected = true;
        breachSeverity = Severity.HIGH;
      }
    }

    if (breachDetected) {
      const active = await this.repository.getActiveAlertForCollar(collar.id, AlertType.GEOFENCE_BREACH);
      if (!active) {
        await this.repository.createAlert({
          park_id: parkId,
          collar_id: collar.id,
          type: AlertType.GEOFENCE_BREACH,
          severity: breachSeverity,
          status: AlertStatus.NEW,
          location: ping.location
        });
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async checkImmobility(collar: any, ping: any, parkId: string, alertsConfig: any) {
    // Treat speed exactly zero as a valid zero value (not null)
    if (ping.speed !== null && ping.speed !== undefined && ping.speed <= alertsConfig.immobilitySpeedThreshold) {
      const active = await this.repository.getActiveAlertForCollar(collar.id, AlertType.IMMOBILITY);
      if (!active) {
        await this.repository.createAlert({
          park_id: parkId,
          collar_id: collar.id,
          type: AlertType.IMMOBILITY,
          severity: Severity.MEDIUM,
          status: AlertStatus.NEW,
          location: ping.location
        });
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async checkBattery(collar: any, ping: any, parkId: string, alertsConfig: any) {
    if (ping.battery !== null && ping.battery <= alertsConfig.lowBatteryThreshold) {
      const active = await this.repository.getActiveAlertForCollar(collar.id, AlertType.LOW_BATTERY);
      if (!active) {
        await this.repository.createAlert({
          park_id: parkId,
          collar_id: collar.id,
          type: AlertType.LOW_BATTERY,
          severity: Severity.LOW,
          status: AlertStatus.NEW,
          location: ping.location
        });
      }
    }
  }

  private haversineDistance([lon1, lat1]: [number, number], [lon2, lat2]: [number, number]) {
    const toRad = (x: number) => x * Math.PI / 180;
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private pointInPolygon(point: [number, number], polygon: [number, number][]) {
    const [x, y] = point;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];
      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }
}
