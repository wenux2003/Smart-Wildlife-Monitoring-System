import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AccountHeader } from "../components/AccountHeader.js";
import { useAuth } from "../auth/AuthContext.js";

export function ChangePasswordPage() {
  const { user, loading, changePassword } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  if (loading)
    return <main className="center-state" role="status">Loading account…</main>;
  if (!user) return <Navigate to="/login" replace />;
  const signedInUser = user;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get("currentPassword") ?? "");
    const newPassword = String(form.get("newPassword") ?? "");
    if (newPassword !== form.get("confirmPassword")) {
      setError("The new passwords do not match.");
      return;
    }
    if (currentPassword === newPassword) {
      setError("Choose a new password different from your current password.");
      return;
    }
    setPending(true);
    try {
      await changePassword(currentPassword, newPassword);
      navigate(signedInUser.role === "SUPER_ADMIN" ? "/admin" : signedInUser.role === "RANGER" ? "/ranger" : "/dashboard", { replace: true });
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="workspace-page">
      <AccountHeader />
      <main id="main-content" className="content-width account-panel">
        <p className="section-kicker">ACCOUNT SECURITY</p>
        <h1>Choose a new password</h1>
        <p className="workspace-intro">
          {signedInUser.mustChangePassword
            ? "Your account uses a temporary password. Change it before continuing."
            : "Update your account password."}
        </p>
        <form className="account-form change-password-form" onSubmit={submit}>
          <label className="field-label" htmlFor="currentPassword">
            CURRENT PASSWORD
            <input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required maxLength={128} disabled={pending} />
          </label>
          <label className="field-label" htmlFor="newPassword">
            NEW PASSWORD
            <input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} disabled={pending} />
          </label>
          <label className="field-label" htmlFor="confirmPassword">
            CONFIRM NEW PASSWORD
            <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} disabled={pending} />
          </label>
          <p className="field-hint">Use 12–128 characters.</p>
          {error && <p role="alert" className="form-error">{error}</p>}
          <button className="button button-green" type="submit" disabled={pending}>
            {pending ? "Updating…" : "Change password"}
          </button>
        </form>
      </main>
    </div>
  );
}
