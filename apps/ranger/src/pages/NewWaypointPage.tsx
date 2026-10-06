import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  savePatrolWaypoint,
  waypointCategories,
  type WaypointCategory,
} from "../lib/patrolWaypoints.js";
import { useGpsPosition } from "../lib/useGpsPosition.js";

export function NewWaypointPage() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const gps = useGpsPosition();
  const [online, setOnline] = useState(() => navigator.onLine);
  const [category, setCategory] = useState<WaypointCategory>();
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File>();
  const [photoPreview, setPhotoPreview] = useState<string>();

  useEffect(() => {
    const updateConnection = () => setOnline(navigator.onLine);
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, []);

  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const nextPhoto = event.target.files?.[0];
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(nextPhoto);
    setPhotoPreview(nextPhoto ? URL.createObjectURL(nextPhoto) : undefined);
  }

  function save(event: FormEvent) {
    event.preventDefault();
    if (!assignmentId || !category || gps.status !== "ready") return;

    savePatrolWaypoint({
      id: crypto.randomUUID(),
      assignmentId,
      category,
      note: note.trim(),
      photoName: photo?.name ?? null,
      position: gps.position,
      accuracyM: gps.accuracy,
      observedAt: new Date().toISOString(),
    });
    navigate(`/patrol/${assignmentId}/active`, { replace: true });
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
          <span className={online ? "is-online" : "is-offline"}>
            {online ? "Online · saves locally" : "Offline · saves locally"}
          </span>
          <span className={gps.status === "ready" ? "is-ready" : "is-waiting"}>{gpsMessage}</span>
        </div>
      </header>

      <form className="waypoint-form" aria-label="New waypoint" onSubmit={save}>
        <fieldset className="waypoint-categories">
          <legend>Observation type</legend>
          {waypointCategories.map((option) => (
            <label key={option} className={category === option ? "is-selected" : ""}>
              <input
                type="radio"
                name="waypoint-category"
                value={option}
                checked={category === option}
                onChange={() => setCategory(option)}
              />
              <span>{option}</span>
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
            A valid GPS position is required. Enable location access and try again.
          </p>
        )}

        <button
          className="save-waypoint-button"
          type="submit"
          disabled={!category || gps.status !== "ready"}
        >
          Save waypoint
        </button>
      </form>
    </main>
  );
}
