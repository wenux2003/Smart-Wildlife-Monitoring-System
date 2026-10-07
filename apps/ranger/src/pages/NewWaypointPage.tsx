import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { WaypointCategory, type WaypointCategory as WaypointCategoryValue } from "@wr/shared";
import {
  addWaypoint,
  getPatrolByAssignment,
  type OfflinePatrolSession,
} from "@wr/offline";
import { useNavigate, useParams } from "react-router-dom";
import { useGpsPosition } from "../lib/useGpsPosition.js";
import { useNetworkStatus } from "../lib/useNetworkStatus.js";

const categories: readonly { value: WaypointCategoryValue; label: string }[] = [
  { value: WaypointCategory.WILDLIFE_SIGN, label: "Sign of wildlife" },
  { value: WaypointCategory.HAZARD_SNARE, label: "Hazard / snare" },
  { value: WaypointCategory.TRAIL_MARKER, label: "Trail marker" },
  { value: WaypointCategory.OTHER, label: "Other" },
];

export function NewWaypointPage() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const gps = useGpsPosition();
  const network = useNetworkStatus();
  const [session, setSession] = useState<OfflinePatrolSession>();
  const [category, setCategory] = useState<WaypointCategoryValue>();
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File>();
  const [photoPreview, setPhotoPreview] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (assignmentId)
      void getPatrolByAssignment(assignmentId).then(setSession);
  }, [assignmentId]);

  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const nextPhoto = event.target.files?.[0];
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(nextPhoto);
    setPhotoPreview(nextPhoto ? URL.createObjectURL(nextPhoto) : undefined);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!session || !category || gps.status !== "ready") return;
    setSaving(true);
    setError("");
    try {
      await addWaypoint({
        sessionId: session.id,
        category,
        note: note.trim(),
        photoName: photo?.name ?? null,
        photo,
        longitude: gps.position[0],
        latitude: gps.position[1],
        accuracyM: gps.accuracy,
        observedAt: new Date(gps.timestamp).toISOString(),
      });
      navigate(`/patrol/${session.assignmentId}/active`, { replace: true });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The waypoint could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  const gpsMessage = gps.status === "ready"
    ? `GPS ready · ±${Math.round(gps.accuracy)} m`
    : gps.status === "locating" ? "Finding your GPS position…" : "GPS is unavailable";

  return (
    <main className="waypoint-screen" id="main-content">
      <header className="waypoint-header">
        <button
          className="waypoint-back-button"
          type="button"
          onClick={() => navigate(`/patrol/${assignmentId}/active`)}
        >
          <span aria-hidden="true">←</span> Patrol map
        </button>
        <p className="patrol-kicker">FIELD OBSERVATION</p>
        <h1>New Waypoint</h1>
        <div className="waypoint-status-row">
          <span className={network === "ONLINE" ? "is-online" : "is-offline"}>
            {network === "ONLINE" ? "Online" : "Offline · saves locally"}
          </span>
          <span className={gps.status === "ready" ? "is-ready" : "is-waiting"}>{gpsMessage}</span>
        </div>
      </header>

      {network === "OFFLINE" && (
        <aside className="waypoint-offline-notice" role="status">
          No Internet Connection. This waypoint will be stored safely and synchronized later.
        </aside>
      )}

      <form className="waypoint-form" aria-label="New waypoint" onSubmit={(event) => void save(event)}>
        <fieldset className="waypoint-categories">
          <legend>Observation type</legend>
          {categories.map((option) => (
            <label key={option.value} className={category === option.value ? "is-selected" : ""}>
              <input
                type="radio"
                name="waypoint-category"
                value={option.value}
                checked={category === option.value}
                onChange={() => setCategory(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>

        <div className="waypoint-field">
          <span className="waypoint-field-label">Photo <small>Optional</small></span>
          <label className={`waypoint-photo-input ${photoPreview ? "has-photo" : ""}`}>
            <input type="file" accept="image/*" capture="environment" onChange={choosePhoto} />
            {photoPreview ? (
              <img src={photoPreview} alt="Selected waypoint" />
            ) : (
              <span><strong>＋</strong>Add field photo<small>Use camera or choose an image</small></span>
            )}
          </label>
          {photo && <p className="waypoint-file-name">{photo.name}</p>}
        </div>

        <label className="waypoint-field" htmlFor="waypoint-note">
          <span className="waypoint-field-label">Note <small>Optional</small></span>
          <textarea
            id="waypoint-note"
            rows={5}
            maxLength={500}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Describe what you observed…"
          />
          <small className="waypoint-character-count">{note.length}/500</small>
        </label>

        {gps.status === "unavailable" && (
          <p className="waypoint-gps-warning" role="alert">
            A valid GPS position is required. Network access is not required.
          </p>
        )}
        {error && <p className="waypoint-gps-warning" role="alert">{error}</p>}

        <button
          className="save-waypoint-button"
          type="submit"
          disabled={!session || !category || gps.status !== "ready" || saving}
        >
          {saving ? "Saving safely…" : "Save waypoint"}
        </button>
      </form>
    </main>
  );
}
