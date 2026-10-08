import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { CameraImage } from "@wr/shared";
import {
  CoordinateFields,
  IncidentPhotoInput,
  localDateTime,
  parseCoordinates,
} from "@wr/ui";
import { useAuth } from "../auth/AuthContext.js";
import { apiRequest } from "../api.js";
import { IncidentLayout } from "../components/IncidentLayout.js";
function CameraCard({
  image,
  refresh,
}: {
  image: CameraImage;
  refresh: () => Promise<unknown>;
}) {
  const [classification, setClassification] = useState("UNSURE");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function review() {
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/api/camera-images/${image.id}/review`, {
        method: "PATCH",
        body: { classification, notes, expectedRevision: image.revision },
      });
      await refresh();
    } catch (failure) {
      setError((failure as Error).message);
      if ((failure as { status?: number }).status === 409) await refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="m1-card m1-form">
      <h2>{image.classification.replaceAll("_", " ")}</h2>
      <img
        className="m1-photo"
        src={image.dataUrl}
        alt="Camera-trap observation awaiting human classification"
      />
      <p>
        {new Date(image.capturedAt).toLocaleString()} ·{" "}
        {image.location.latitude}, {image.location.longitude}
      </p>
      <p>
        Mock person flag: {image.personFlag ? "Yes" : "No"}. A flag alone does
        not indicate poaching.
      </p>
      <label>
        Classification
        <select
          value={classification}
          onChange={(e) => setClassification(e.target.value)}
        >
          {[
            "WILDLIFE",
            "AUTHORIZED_PERSON",
            "SUSPICIOUS_ACTIVITY",
            "UNSURE",
          ].map((value) => (
            <option key={value} value={value}>
              {value.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label>
        Review notes
        <textarea
          required
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={4000}
        />
      </label>
      <button disabled={busy || !notes.trim()} onClick={() => void review()}>
        {busy ? "Reviewing…" : "Save human review"}
      </button>
      {error && <p role="alert">{error}</p>}
      {image.classification === "UNSURE" && (
        <p>This image remains in the review queue.</p>
      )}
      {image.resultingIncidentId && (
        <Link to={`/incidents/${image.resultingIncidentId}`}>
          Open resulting incident
        </Link>
      )}
    </article>
  );
}
export function CameraReviewPage() {
  const { user } = useAuth();
  const images = useQuery({
    queryKey: ["m1-cameras", user?.id],
    queryFn: () => apiRequest<CameraImage[]>("/api/camera-images"),
  });
  const [photo, setPhoto] = useState<string | null>(null);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [capturedAt, setCapturedAt] = useState(localDateTime);
  const [personFlag, setPersonFlag] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showReviewed, setShowReviewed] = useState(false);
  const [imageId, setImageId] = useState(() => crypto.randomUUID());
  async function add() {
    setBusy(true);
    setError("");
    try {
      if (!photo) throw new Error("Choose a camera image.");
      await apiRequest("/api/camera-images", {
        body: {
          id: imageId,
          parkId: user?.parkId,
          location: parseCoordinates(latitude, longitude),
          capturedAt: new Date(capturedAt).toISOString(),
          dataUrl: photo,
          personFlag,
        },
      });
      setPhoto(null);
      setImageId(crypto.randomUUID());
      await images.refetch();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <IncidentLayout title="Camera-trap review">
      <form
        className="m1-card m1-form"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <h2>camera observation</h2>
        
        <label>
          Captured time
          <input
            type="datetime-local"
            value={capturedAt}
            onChange={(e) => setCapturedAt(e.target.value)}
            required
          />
        </label>
        <CoordinateFields
          latitude={latitude}
          longitude={longitude}
          onChange={(lat, lng) => {
            setLatitude(lat);
            setLongitude(lng);
          }}
        />
        <IncidentPhotoInput value={photo} onChange={setPhoto} />
        <label className="m1-checkbox">
          <input
            type="checkbox"
            checked={personFlag}
            onChange={(e) => setPersonFlag(e.target.checked)}
          />
          Mock person flag
        </label>
        <button disabled={busy || !photo}>
          {busy ? "Adding…" : "Add image to review queue"}
        </button>
        {error && <p role="alert">{error}</p>}
      </form>
      <label className="m1-checkbox">
        <input
          type="checkbox"
          checked={showReviewed}
          onChange={(e) => setShowReviewed(e.target.checked)}
        />
        Include previously reviewed images
      </label>
      {images.isLoading ? (
        <p role="status">Loading camera images…</p>
      ) : images.isError ? (
        <p role="alert">{(images.error as Error).message}</p>
      ) : (
        <section className="m1-grid">
          {images.data
            ?.filter(
              (image) =>
                showReviewed ||
                ["PENDING", "UNSURE"].includes(image.classification),
            )
            .map((image) => (
              <CameraCard
                key={image.id}
                image={image}
                refresh={images.refetch}
              />
            ))}
          {!images.data?.some(
            (image) =>
              showReviewed ||
              ["PENDING", "UNSURE"].includes(image.classification),
          ) && <p>No images awaiting review.</p>}
        </section>
      )}
    </IncidentLayout>
  );
}
