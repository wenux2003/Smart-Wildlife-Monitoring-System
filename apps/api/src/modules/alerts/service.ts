import type { SessionUser } from "../auth/guard.js";
import type { AlertRepository } from "./repository.js";
import { AlertStatus, DispatchStatus } from "@wr/shared";

export function createAlertService(repository: AlertRepository) {
  return {
    async listAlerts(user: SessionUser) {
      if (!user.parkId) return [];
      const alerts = await repository.listAlertsForPark(user.parkId);
      return alerts.map(alert => ({
        id: alert.id,
        parkId: alert.park_id,
        collarId: alert.collar_id,
        type: alert.type,
        severity: alert.severity,
        status: alert.status,
        location: alert.location,
        createdAt: alert.created_at.toISOString(),
        resolvedAt: alert.resolved_at?.toISOString() ?? null,
      }));
    },
    async acknowledgeAlert(user: SessionUser, alertId: string) {
      if (!user.parkId || user.role !== "PARK_MANAGER") {
        throw new Error("Unauthorized");
      }
      const updated = await repository.updateAlertStatus(alertId, AlertStatus.ACCEPTED);
      if (!updated) throw new Error("Alert not found");
      return updated;
    },
    async dispatchRanger(user: SessionUser, alertId: string, rangerId: string) {
      if (!user.parkId || user.role !== "PARK_MANAGER") {
        throw new Error("Unauthorized");
      }
      
      const dispatch = await repository.createDispatch({
        alert_id: alertId,
        ranger_id: rangerId,
        status: DispatchStatus.PENDING,
      });

      await repository.updateAlertStatus(alertId, AlertStatus.DISPATCHED);

      return {
        id: dispatch.id,
        alertId: dispatch.alert_id,
        rangerId: dispatch.ranger_id,
        status: dispatch.status,
        sentAt: dispatch.sent_at.toISOString(),
      };
    },
    async listCollars(user: SessionUser) {
      if (!user.parkId) return [];
      const collars = await repository.listCollarsForPark(user.parkId);
      return collars.map(collar => ({
        id: collar.id,
        parkId: collar.park_id,
        animalName: collar.animal_name,
        species: collar.species,
        latestBattery: collar.latest_battery,
        status: collar.status,
        lastPingAt: collar.last_ping_at?.toISOString() ?? null,
        location: collar.location,
      }));
    },
    async getCollarPings(user: SessionUser, collarId: string) {
      if (!user.parkId) return [];
      const pings = await repository.getCollarPings(collarId, 50);
      return pings.map(ping => ({
        id: ping.id,
        collarId: ping.collar_id,
        location: ping.location,
        speed: ping.speed,
        battery: ping.battery,
        recordedAt: ping.recorded_at.toISOString(),
      }));
    },
    async getMyDispatches(user: SessionUser) {
      if (!user.id || user.role !== "RANGER") return [];
      const dispatches = await repository.listDispatchesForRanger(user.id);
      return dispatches.map(dispatch => ({
        id: dispatch.id,
        alertId: dispatch.alert_id,
        rangerId: dispatch.ranger_id,
        status: dispatch.status,
        notes: dispatch.notes,
        sentAt: dispatch.sent_at.toISOString(),
        respondedAt: dispatch.responded_at?.toISOString() ?? null,
        arrivedAt: dispatch.arrived_at?.toISOString() ?? null,
        completedAt: dispatch.completed_at?.toISOString() ?? null,
      }));
    },
    async updateDispatchStatus(user: SessionUser, dispatchId: string, status: DispatchStatus, notes?: string) {
      if (!user.id || user.role !== "RANGER") throw new Error("Unauthorized");
      const dispatch = await repository.updateDispatchStatus(dispatchId, status, notes);
      if (!dispatch) throw new Error("Dispatch not found");
      
      // If completed, maybe auto-resolve the alert?
      if (status === DispatchStatus.DONE) {
         await repository.updateAlertStatus(dispatch.alert_id, AlertStatus.RESOLVED, new Date());
      } else if (status === DispatchStatus.ARRIVED) {
         await repository.updateAlertStatus(dispatch.alert_id, AlertStatus.ON_SCENE);
      } else if (status === DispatchStatus.ACCEPTED) {
         await repository.updateAlertStatus(dispatch.alert_id, AlertStatus.DISPATCHED);
      } else if (status === DispatchStatus.REJECTED) {
         // Optionally change alert back to ACCEPTED or NEW
         await repository.updateAlertStatus(dispatch.alert_id, AlertStatus.ACCEPTED);
      }

      return {
        id: dispatch.id,
        alertId: dispatch.alert_id,
        rangerId: dispatch.ranger_id,
        status: dispatch.status,
        notes: dispatch.notes,
        sentAt: dispatch.sent_at.toISOString(),
        respondedAt: dispatch.responded_at?.toISOString() ?? null,
        arrivedAt: dispatch.arrived_at?.toISOString() ?? null,
        completedAt: dispatch.completed_at?.toISOString() ?? null,
      };
    },
    async checkLostSignals() {
      // 60 minutes threshold
      const collars = await repository.getCollarsWithLostSignal(60);
      for (const collar of collars) {
        const active = await repository.getActiveAlertForCollar(collar.id, 'LOST_SIGNAL');
        if (!active) {
          await repository.createAlert({
            park_id: collar.park_id,
            collar_id: collar.id,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            type: 'LOST_SIGNAL' as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            severity: 'CRITICAL' as any,
            status: AlertStatus.NEW,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            location: null as any // we might not know location
          });
        }
      }
    },
    async checkTimeouts() {
      // 15 minutes timeout
      const timedOutDispatches = await repository.getTimedOutDispatches(15);
      for (const dispatch of timedOutDispatches) {
        // Mark dispatch as TIMED_OUT
        await repository.updateDispatchStatus(dispatch.id, 'TIMED_OUT' as DispatchStatus, 'Auto-timeout');
        // Reset alert to ACCEPTED so it can be reassigned
        await repository.updateAlertStatus(dispatch.alert_id, AlertStatus.ACCEPTED);
      }
    }
  };
}
