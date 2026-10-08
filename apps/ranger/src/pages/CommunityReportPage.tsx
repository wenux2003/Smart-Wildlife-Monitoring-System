import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CommunityReportSchema, CommunitySmsSchema } from "@wr/shared";
import { incidentRequest } from "../lib/incidents.js";
export function CommunityReportPage() {
  const parks = useQuery({
    queryKey: ["m1-public-parks"],
    queryFn: () =>
      incidentRequest<{ id: string; name: string }[]>("/api/community/parks"),
  });
  const [sms, setSms] = useState(false);
  const [parkId, setParkId] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [landmark, setLandmark] = useState("");
  const [rawText, setRawText] = useState("");
  const [providerMessageId, setProviderMessageId] = useState<string>(() =>
    crypto.randomUUID(),
  );
  const [id, setId] = useState<string>(() => crypto.randomUUID());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<{
    id: string;
    locationStatus: string;
  } | null>(null);
  async function send() {
    setBusy(true);
    setError("");
    try {
      const body = sms
        ? CommunitySmsSchema.parse({
            providerMessageId,
            parkId,
            phone,
            rawText,
          })
        : CommunityReportSchema.parse({
            id,
            parkId,
            phone,
            description,
            locationText: landmark,
          });
      const result = await incidentRequest<{
        id: string;
        locationStatus: string;
      }>(sms ? "/api/community/sms" : "/api/community/reports", body);
      setReceipt(result);
    } catch (failure) {
      setError(
        (failure as Error).name === "ZodError"
          ? "Check park, phone, description and landmark."
          : (failure as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main-content" className="m1-page">
      <nav className="m1-nav">
        <Link to="/login">Ranger sign in</Link>
      </nav>
      <p className="m1-kicker">COMMUNITY REPORTING</p>
      <h1>Report a wildlife conflict</h1>
      <p>
        No account required. Unknown landmarks are accepted for officer
        follow-up.
      </p>
      <form
        className="m1-card m1-form"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <label className="m1-checkbox">
          <input
            type="checkbox"
            checked={sms}
            onChange={(e) => {
              setSms(e.target.checked);
              setReceipt(null);
            }}
          />
          Use mock SMS gateway
        </label>
        <label>
          Park
          <select
            required
            value={parkId}
            onChange={(e) => setParkId(e.target.value)}
          >
            <option value="">Select park</option>
            {parks.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {parks.isError && (
          <p role="alert">
            Parks could not be loaded.{" "}
            <button type="button" onClick={() => void parks.refetch()}>
              Retry
            </button>
          </p>
        )}
        <label>
          Phone/contact
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={30}
          />
        </label>
        {sms ? (
          <>
            <label>
              Provider message ID
              <input
                required
                value={providerMessageId}
                onChange={(e) => setProviderMessageId(e.target.value)}
                maxLength={150}
              />
            </label>
            <label>
              Raw SMS
              <textarea
                required
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                maxLength={4000}
                placeholder="ELEPHANT crop damage @ Galge entrance"
              />
            </label>
            <p>
              Keywords: ELEPHANT, POACHING, INJURED. Incomplete messages are
              retained for follow-up. Reusing the same message ID retries the
              same report.
            </p>
          </>
        ) : (
          <>
            <label>
              Description
              <textarea
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={4000}
              />
            </label>
            <label>
              Location / landmark
              <input
                required
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                maxLength={1000}
              />
            </label>
          </>
        )}
        {error && <p role="alert">{error}</p>}
        {receipt && (
          <p role="status">
            Report received. Reference: {receipt.id}. Location:{" "}
            {receipt.locationStatus}.{" "}
            {sms && "This is a mock gateway; no real SMS was sent."}
          </p>
        )}
        <button disabled={busy}>
          {busy
            ? "Sending…"
            : receipt
              ? "Retry same submission"
              : "Submit report"}
        </button>
        {receipt && (
          <button
            type="button"
            onClick={() => {
              setId(crypto.randomUUID());
              setProviderMessageId(crypto.randomUUID());
              setReceipt(null);
              setDescription("");
              setRawText("");
            }}
          >
            Start another report
          </button>
        )}
      </form>
    </main>
  );
}
