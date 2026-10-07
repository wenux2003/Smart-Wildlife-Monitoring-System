import {
  IncidentOfflineDatabase,
  flushIncidentOutbox,
  retryIncidentSync,
} from "@wr/offline";
import { IncidentSchema } from "@wr/shared";
import type { RangerUser } from "../auth/AuthContext.js";
export const incidentDb = new IncidentOfflineDatabase();
export async function incidentRequest<T>(
  path: string,
  body?: object,
): Promise<T> {
  const response = await fetch(path, {
    method: body ? "POST" : "GET",
    credentials: "same-origin",
    signal: AbortSignal.timeout(15000),
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw Object.assign(
      new Error(data.message ?? "The incident service is unavailable."),
      { status: response.status },
    );
  return data as T;
}
export async function syncIncidents(user: RangerUser, retry = false) {
  if (!user.parkId || user.role !== "RANGER" || user.mustChangePassword) return;
  const owner = { userId: user.id, parkId: user.parkId };
  // A remembered identity only permits local capture. Live auth must match before sending any work.
  const current = await incidentRequest<{ user: RangerUser }>("/api/auth/me");
  if (
    current.user.id !== user.id ||
    current.user.parkId !== user.parkId ||
    current.user.role !== "RANGER" ||
    current.user.mustChangePassword
  )
    throw new Error(
      "Sign in with the original report account before synchronizing.",
    );
  if (retry) await retryIncidentSync(incidentDb, owner);
  await flushIncidentOutbox(incidentDb, owner, {
    reachable: async () => {
      try {
        return (
          await fetch("/health", {
            signal: AbortSignal.timeout(5000),
            cache: "no-store",
          })
        ).ok;
      } catch {
        return false;
      }
    },
    create: async (payload) =>
      IncidentSchema.parse(await incidentRequest("/api/incidents", payload)),
    media: (id, payload) =>
      incidentRequest(`/api/incidents/${id}/media`, payload),
  });
}
