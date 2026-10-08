import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";

export function LoginPage() {
  const { user, signIn, error: authError, captureOnly } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user && !captureOnly)
      navigate(
        user.role === "RANGER" && user.mustChangePassword
          ? "/change-password"
          : "/",
        { replace: true },
      );
  }, [navigate, user, captureOnly]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen" id="main-content">
      <section className="auth-card" aria-labelledby="login-title">
        <p className="eyebrow">WILDLIFE GUARDIAN · RANGER ACCESS</p>
        <h1 id="login-title">Welcome back</h1>
        <p className="lead">Sign in to continue your field work.</p>
        {(error || authError) && (
          <p className="alert" id="login-error" role="alert">
            {error || authError}
          </p>
        )}
        <form aria-label="Ranger sign in" onSubmit={submit}>
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-describedby={error || authError ? "login-error" : undefined}
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="help-copy">Need access? Contact your park manager.</p>
        <a className="inline-link" href="/community/new">
          Report a community wildlife conflict without an account
        </a>
      </section>
    </main>
  );
}
