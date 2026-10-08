import type { SessionUser } from "../auth/guard.js";
import type { AlertRepository } from "./repository.js";
import { AlertStatus, AlertType, DispatchStatus } from "@wr/shared";
import { AppError } from "../../core/errors.js";

// ── helpers ──────────────────────────────────────────────────────────────────

function mapAlert(alert: {
  id: string; park_id: string; collar_id: string | null;
  type: string; severity: string; status: string;
  location: [number, number] | null;
  created_at: Date; resolved_at: Date | null;
  resolution_reason: string | null; is_broadcast: boolean;
  has_active_dispatch?: boolean;
}) {
  return {
    id: alert.id,
    parkId: alert.park_id,
    collarId: alert.collar_id,
    type: alert.type,
    severity: alert.severity,
    status: alert.status,
    location: alert.location,
    createdAt: alert.created_at.toISOString(),
    resolvedAt: alert.resolved_at?.toISOString() ?? null,
    resolutionReason: alert.resolution_reason,
    isBroadcast: alert.is_broadcast,
    hasActiveDispatch: alert.has_active_dispatch,
  };
}

function mapDispatch(dispatch: {
  id: string; alert_id: string; ranger_id: string; status: string;
  notes: string | null; sent_at: Date;
  responded_at: Date | null; arrived_at: Date | null; completed_at: Date | null;
}) {
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
}

// ─────────────────────────────────────────────────────────────────────────────

export function createAlertService(repository: AlertRepository) {
  return {
    async listAlerts(user: SessionUser) {
      if (!user.parkId) return [];
      const alerts = await repository.listAlertsForPark(user.parkId);
      return alerts.map(mapAlert);
    },

    async acknowledgeAlert(user: SessionUser, alertId: string) {
      if (!user.parkId || user.role !== "PARK_MANAGER") {
        throw new AppError("Forbidden", 403, "FORBIDDEN");
      }
      // Verify the alert belongs to this manager's park
      const alert = await repository.getAlertByIdForPark(alertId, user.parkId);
      if (!alert) throw new AppError("Alert not found", 404, "NOT_FOUND");

      const updated = await repository.updateAlertStatus(alertId, AlertStatus.ACCEPTED);
      if (!updated) throw new AppError("Alert not found", 404, "NOT_FOUND");
      return mapAlert(updated);
    },

    async dispatchRanger(user: SessionUser, alertId: string, rangerId: string) {
      if (!user.parkId || user.role !== "PARK_MANAGER") {
        throw new AppError("Forbidden", 403, "FORBIDDEN");
      }

      // Verify the alert belongs to this park
      const alert = await repository.getAlertByIdForPark(alertId, user.parkId);
      if (!alert) throw new AppError("Alert not found", 404, "NOT_FOUND");

      // Validate the ranger is active in the same park
      const ranger = await repository.getRangerForPark(rangerId, user.parkId);
      if (!ranger) throw new AppError("Ranger not found or not in this park", 404, "NOT_FOUND");

      const dispatch = await repository.createDispatch({
        alert_id: alertId,
        ranger_id: rangerId,
        status: DispatchStatus.PENDING,
      });

      await repository.updateAlertStatus(alertId, AlertStatus.DISPATCHED);

      return mapDispatch(dispatch);
    },
    async getParkAlertConfig(user: SessionUser) {
      if (!user.parkId) throw new AppError("No park assigned", 400, "BAD_REQUEST");
      const config = await repository.getParkConfig(user.parkId);
      return config?.alerts || {};
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async updateParkAlertConfig(user: SessionUser, alertConfig: any) {
      if (!user.parkId || user.role !== "PARK_MANAGER") {
        throw new AppError("Forbidden", 403, "FORBIDDEN");
      }
      return repository.updateParkAlertConfig(user.parkId, alertConfig);
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
      // Verify collar belongs to this user's park
      const collar = await repository.getCollarByIdForPark(collarId, user.parkId);
      if (!collar) throw new AppError("Collar not found", 404, "NOT_FOUND");

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
        // Joined fields
        alertType: dispatch.alert_type as string,
        alertSeverity: dispatch.alert_severity as string,
        alertLocation: dispatch.alert_location as [number, number] | null,
        animalName: dispatch.animal_name as string | null,
      }));
    },

    async getAlertContext(alertId: string, parkId: string) {
      return repository.getAlertContext(alertId, parkId);
    },

    async getAvailableRangers(alertId: string, parkId: string) {
      return repository.getAvailableRangers(alertId, parkId);
    },

    async broadcastAlert(alertId: string, parkId: string) {
      await repository.broadcastAlert(alertId, parkId);
    },

    async updateDispatchStatus(user: SessionUser, dispatchId: string, status: DispatchStatus, notes?: string) {
      if (!user.id || user.role !== "RANGER") throw new AppError("Forbidden", 403, "FORBIDDEN");

      // updateDispatchStatus verifies ownership (ranger_id) and validates the transition
      let dispatch;
      try {
        dispatch = await repository.updateDispatchStatus(dispatchId, status, user.id, notes);
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("Invalid status transition")) {
          throw new AppError(err.message, 409, "INVALID_TRANSITION");
        }
        throw err;
      }
      if (!dispatch) throw new AppError("Dispatch not found or not yours", 404, "NOT_FOUND");

      // Keep alert status in sync — in a single separate call for each terminal transition
      if (status === DispatchStatus.DONE) {
        await repository.updateAlertStatus(dispatch.alert_id, AlertStatus.RESOLVED, new Date());
      } else if (status === DispatchStatus.ARRIVED) {
        await repository.updateAlertStatus(dispatch.alert_id, AlertStatus.ON_SCENE);
      } else if (status === DispatchStatus.ACCEPTED) {
        await repository.updateAlertStatus(dispatch.alert_id, AlertStatus.DISPATCHED);
        if (repository.cancelOtherPendingDispatches) {
          await repository.cancelOtherPendingDispatches(dispatch.alert_id, dispatch.id);
        }
      } else if (status === DispatchStatus.REJECTED || status === DispatchStatus.CANCELLED) {
        if (repository.hasActiveDispatches) {
          const hasActive = await repository.hasActiveDispatches(dispatch.alert_id);
          if (!hasActive) {
            await repository.updateAlertStatus(dispatch.alert_id, AlertStatus.ACCEPTED);
          }
        } else {
          await repository.updateAlertStatus(dispatch.alert_id, AlertStatus.ACCEPTED);
        }
      }

      return mapDispatch(dispatch);
    },

    // ── scheduled background jobs (isolated so one failure doesn't cancel the other) ──

    async checkLostSignals() {
      // 60-minute threshold for lost signal
      const collars = await repository.getCollarsWithLostSignal(60);
      for (const collar of collars) {
        // Use the correct enum value: AlertType.SIGNAL_LOST
        const active = await repository.getActiveAlertForCollar(collar.id, AlertType.SIGNAL_LOST);
        if (!active) {
          await repository.createAlert({
            park_id: collar.park_id,
            collar_id: collar.id,
            type: AlertType.SIGNAL_LOST,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            severity: "CRITICAL" as any,
            status: AlertStatus.NEW,
            location: null,   // nullable — supported by repository now
          });
        }
      }
    },

    async checkTimeouts() {
      // 15-minute timeout for unresponded dispatches
      const timedOutDispatches = await repository.getTimedOutDispatches(15);
      for (const dispatch of timedOutDispatches) {
        try {
          // Use the system timeout path that bypasses ranger ownership check
          await repository.markDispatchTimedOut(dispatch.id);
          // Reset alert so ops staff can re-dispatch ONLY IF NO OTHER DISPATCHES ARE ACTIVE
          if (repository.hasActiveDispatches) {
            const hasActive = await repository.hasActiveDispatches(dispatch.alert_id);
            if (!hasActive) {
              await repository.updateAlertStatus(dispatch.alert_id, AlertStatus.ACCEPTED);
            }
          } else {
            await repository.updateAlertStatus(dispatch.alert_id, AlertStatus.ACCEPTED);
          }
        } catch {
          // Log and continue; don't let one failure block others
        }
      }
    },
  };
}
