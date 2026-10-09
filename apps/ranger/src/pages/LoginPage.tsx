import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";

function BrandIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 2.5 27 6.4v8.3c0 7-4.3 12-11 14.8C9.3 26.7 5 21.7 5 14.7V6.4z" />
      <path d="M10.5 19.5c7.7-.5 10.7-5.7 11-10.2-5.2.4-10.3 2.7-11 10.2Z" />
      <path d="M11 22c2.2-4.2 5-7 9-9.2" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m5 8 7 5 7-5" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="10" width="16" height="11" rx="3" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14m-5-5 5 5-5 5" />
    </svg>
  );
}

function CommunityIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21s7-4.6 7-11V5.8L12 3 5 5.8V10c0 6.4 7 11 7 11Z" />
      <path d="M8.5 13.5c4.5-.3 6.2-3.3 6.4-6-3 .2-6 1.6-6.4 6Z" />
    </svg>
  );
}

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
    <main className="auth-screen ranger-login-screen" id="main-content">
      <section
        className="auth-card ranger-login-card"
        aria-labelledby="login-title"
      >
        <header className="login-hero">
          <svg
            className="login-contours"
            viewBox="0 0 440 190"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M-30 156C53 68 112 215 205 123S346 63 475 3" />
            <path d="M-20 178C65 91 134 226 218 149S359 92 468 30" />
            <path d="M45 198c48-70 106-18 153-61s89-94 145-57 82 17 125-34" />
            <path d="M258 204c14-66 51-89 91-72 57 24 70-40 122-54" />
          </svg>
          <div className="login-brand-row">
            <div className="login-brand-mark">
              <BrandIcon />
            </div>
            <div className="login-brand-copy">
              <strong>Wildlife Guardian</strong>
              <span>Ranger field portal</span>
            </div>
            <span className="login-secure-badge">
              <span aria-hidden="true" /> Secure
            </span>
          </div>
          <div className="login-hero-copy">
            <p>PROTECTED FIELD ACCESS</p>
            <strong>Safeguarding wildlife, one patrol at a time.</strong>
          </div>
        </header>

        <div className="login-panel">
          <p className="eyebrow">RANGER ACCESS</p>
          <h1 id="login-title">Welcome back</h1>
          <p className="lead">Sign in to continue your field work.</p>
          {(error || authError) && (
            <p className="alert" id="login-error" role="alert">
              {error || authError}
            </p>
          )}
          <form aria-label="Ranger sign in" onSubmit={submit}>
            <label htmlFor="email">Email address</label>
            <div className="login-input-shell">
              <EmailIcon />
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                inputMode="email"
                placeholder="ranger@wildlife.gov.lk"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-describedby={
                  error || authError ? "login-error" : undefined
                }
              />
            </div>
            <label htmlFor="password">Password</label>
            <div className="login-input-shell">
              <LockIcon />
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <button
              className="primary-button login-submit"
              type="submit"
              disabled={busy}
            >
              <span>{busy ? "Signing in…" : "Sign in"}</span>
              <ArrowIcon />
            </button>
          </form>

          <p className="login-access-help">
            Need ranger access? <strong>Contact your park manager.</strong>
          </p>
          <div className="login-divider" aria-hidden="true">
            <span>Community access</span>
          </div>
          <a className="login-community-link" href="/community/new">
            <CommunityIcon />
            <span>
              <strong>Report a wildlife conflict</strong>
              <small>No ranger account required</small>
            </span>
            <ArrowIcon />
          </a>
        </div>
      </section>
      <p className="login-trust-note">
        Authorized personnel only · Activity is securely recorded
      </p>
    </main>
  );
}
