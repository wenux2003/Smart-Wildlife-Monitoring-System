import { useState } from "react";
import type { ChangeEvent } from "react";
import { CoordinatesSchema, ImageDataSchema } from "@wr/shared";
import "./IncidentFields.css";
export function CoordinateFields({
  latitude,
  longitude,
  onChange,
}: {
  latitude: string;
  longitude: string;
  onChange: (latitude: string, longitude: string) => void;
}) {
  return (
    <div className="m1-coordinate-fields">
      <label>
        Latitude
        <input
          type="number"
          step="any"
          min="-90"
          max="90"
          value={latitude}
          onChange={(e) => onChange(e.target.value, longitude)}
          required
        />
      </label>
      <label>
        Longitude
        <input
          type="number"
          step="any"
          min="-180"
          max="180"
          value={longitude}
          onChange={(e) => onChange(latitude, e.target.value)}
          required
        />
      </label>
    </div>
  );
}
export function parseCoordinates(latitude: string, longitude: string) {
  if (!latitude.trim() || !longitude.trim())
    throw new Error("Enter latitude and longitude or capture GPS.");
  const result = CoordinatesSchema.safeParse({
    latitude: Number(latitude),
    longitude: Number(longitude),
  });
  if (!result.success)
    throw new Error(
      "Latitude must be −90 to 90; longitude must be −180 to 180.",
    );
  return result.data;
}
export function localDateTime() {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export async function prepareIncidentPhoto(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Choose a JPEG, PNG or WebP image.");
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Choose a photo smaller than 10 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error(
        "Photo processing is unavailable. You can report without a photo.",
      );
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.8, 0.6, 0.4]) {
      const result = canvas.toDataURL("image/jpeg", quality);
      if (ImageDataSchema.safeParse(result).success) return result;
    }
    throw new Error(
      "This photo is too large after compression. Choose a smaller photo or submit without one.",
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
export function IncidentPhotoInput({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function select(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      onChange(await prepareIncidentPhoto(file));
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="m1-photo-input">
      <label>
        Optional photo
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={(e) => void select(e)}
          disabled={busy}
        />
      </label>
      {busy && <p role="status">Preparing photo…</p>}
      {error && (
        <p role="alert">
          {error} Your report can be submitted without a photo.
        </p>
      )}
      {value && (
        <>
          <img
            className="m1-photo"
            src={value}
            alt="Selected incident evidence"
          />
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setError("");
            }}
          >
            Remove photo
          </button>
        </>
      )}
    </section>
  );
}
