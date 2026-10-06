import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";

export function ChangePasswordPage() {
  const { user, loading, changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingState />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "RANGER") return <Navigate to="/" replace />;
  if (!user.mustChangePassword) return <Navigate to="/" replace />;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (newPassword !== confirmation) {
      setError("The new passwords don’t match.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("Choose a new password that is different from the temporary one.");
      return;
    }
    setBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      setSuccess("Password updated. Your ranger workspace is ready.");
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen" id="main-content">
      <section className="auth-card" aria-labelledby="password-title">
        <p className="eyebrow">ACCOUNT SECURITY</p>
        <h1 id="password-title">Set a new password</h1>
        <p className="lead">
          Your temporary password must be replaced before you can continue.
        </p>
        {error && <p className="alert" role="alert">{error}</p>}
        {success && <p className="notice" role="status">{success}</p>}
        <form aria-label="Change temporary password" onSubmit={submit}>
          <label htmlFor="current-password">Temporary password</label>
          <input
            id="current-password"
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
          <label htmlFor="new-password">New password</label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <span className="field-hint">Use at least 12 characters.</span>
          <label htmlFor="confirm-password">Confirm new password</label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? "Updating password…" : "Update password"}
          </button>
        </form>
      </section>
    </main>
  );
}

export function LoadingState() {
  return (
    <main className="center-state" id="main-content" aria-live="polite">
      <p className="eyebrow">WILDLIFE GUARDIAN</p>
      <p>Checking your account…</p>
    </main>
  );
}
