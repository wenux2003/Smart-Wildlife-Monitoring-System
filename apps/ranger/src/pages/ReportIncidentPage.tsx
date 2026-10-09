import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { IncidentCategorySchema, IncidentCreateSchema } from "@wr/shared";
import {
  CoordinateFields,
  IncidentPhotoInput,
  localDateTime,
  parseCoordinates,
} from "@wr/ui";
import { saveOfflineIncident, saveOfflineMedia } from "@wr/offline";
import { useAuth } from "../auth/AuthContext.js";
import { incidentDb, syncIncidents } from "../lib/incidents.js";
import { RangerPageHeader } from "../components/RangerPageHeader.js";
export function ReportIncidentPage() {
  const { user, captureOnly } = useAuth();
  const [type, setType] = useState("POACHING");
  const [description, setDescription] = useState("");
  const [capturedAt, setCapturedAt] = useState(localDateTime);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [locationStatus, setLocationStatus] = useState<"GPS" | "MANUAL">(
    "MANUAL",
  );
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [gps, setGps] = useState("");
  const [gpsBusy, setGpsBusy] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const id = useRef(crypto.randomUUID());
  const mediaId = useRef(crypto.randomUUID());
  function captureGps() {
    setGpsBusy(true);
    setGps("Obtaining GPS…");
    setLatitude("");
    setLongitude("");
    setAccuracy(null);
    if (!navigator.geolocation) {
      setGps("GPS is unavailable. Enter location manually.");
      setGpsBusy(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(String(position.coords.latitude));
        setLongitude(String(position.coords.longitude));
        setLocationStatus("GPS");
        setAccuracy(position.coords.accuracy);
        setGps(
          `GPS captured · accuracy ±${Math.round(position.coords.accuracy)} m · ${new Date(position.timestamp).toLocaleTimeString()}`,
        );
        setGpsBusy(false);
      },
      () => {
        setGps("GPS failed. Retry GPS or enter location manually.");
        setLocationStatus("MANUAL");
        setGpsBusy(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!user?.parkId) {
      setError("A ranger park assignment is required.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (!saved) {
        const input = IncidentCreateSchema.parse({
          id: id.current,
          parkId: user.parkId,
          type,
          description,
          capturedAt: new Date(capturedAt).toISOString(),
          location: parseCoordinates(latitude, longitude),
          locationStatus,
          locationAccuracy: accuracy,
        });
        if (new Date(input.capturedAt).getTime() > Date.now() + 300000)
          throw new Error("Incident time cannot be in the future.");
        await saveOfflineIncident(incidentDb, user.id, input);
        setSaved(true);
      }
      let photoProblem = false;
      if (photo)
        try {
          await saveOfflineMedia(incidentDb, user.id, id.current, {
            id: mediaId.current,
            dataUrl: photo,
          });
          setPhotoFailed(false);
        } catch {
          photoProblem = true;
          setPhotoFailed(true);
          setError(
            "Report saved. The photo could not be stored; retry the photo or continue without it.",
          );
        }
      try {
        if (!captureOnly) await syncIncidents(user);
      } catch {
        /* Already committed locally; report actual state below. */
      }
      const local = await incidentDb.incidents.get(id.current);
      const media = await incidentDb.incidentMedia
        .where("incidentId")
        .equals(id.current)
        .toArray();
      setNotice(
        local?.syncStatus === "SYNCED"
          ? `Incident submitted successfully${media.some((m) => m.syncStatus !== "SYNCED") || photoProblem ? ". Photo pending synchronization." : "."}`
          : "Incident saved offline. Pending synchronization.",
      );
    } catch (failure) {
      setError(
        failure instanceof Error && failure.name === "ZodError"
          ? "Check category, description, time and coordinates."
          : (failure as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main-content" className="m1-page">
      <RangerPageHeader title="Report incident" />
      {captureOnly && (
        <p role="status">
          Offline capture for {user?.name}. Sign in again before
          synchronization.
        </p>
      )}
      <form className="m1-card m1-form" onSubmit={(e) => void submit(e)}>
        <fieldset disabled={saved || busy}>
          <legend>Incident details</legend>
          <label>
            Category
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {IncidentCategorySchema.options.map((option) => (
                <option key={option} value={option}>
                  {option.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label>
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              maxLength={4000}
              rows={4}
            />
          </label>
          <label>
            Incident date/time
            <input
              type="datetime-local"
              value={capturedAt}
              onChange={(e) => setCapturedAt(e.target.value)}
              required
            />
          </label>
          <button type="button" onClick={captureGps} disabled={gpsBusy}>
            {gpsBusy ? "Obtaining GPS…" : "Capture / retry GPS"}
          </button>
          <p role="status">
            {gps || "Capture GPS or enter coordinates manually."}
          </p>
          <CoordinateFields
            latitude={latitude}
            longitude={longitude}
            onChange={(lat, lng) => {
              setLatitude(lat);
              setLongitude(lng);
              setLocationStatus("MANUAL");
              setAccuracy(null);
              setGps("Manual location entered.");
            }}
          />
          <p>Location source: {locationStatus}</p>
        </fieldset>
        {(!saved || photoFailed) && (
          <IncidentPhotoInput value={photo} onChange={setPhoto} />
        )}
        {error && (
          <p className="m1-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="m1-notice" role="status">
            {notice}
          </p>
        )}
        {(!saved || photoFailed) && (
          <button
            className="primary-button"
            type="submit"
            disabled={busy || gpsBusy}
          >
            {busy
              ? "Saving…"
              : saved
                ? "Retry photo / continue without photo"
                : "Save and submit report"}
          </button>
        )}
        {saved && (
          <Link className="m1-button" to={`/incidents/${id.current}`}>
            View saved incident
          </Link>
        )}
      </form>
    </main>
  );
}
