import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./auth/AuthContext.js";

export function RangerHomePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [online, setOnline] = useState(() => navigator.onLine);
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const updateConnection = () => setOnline(navigator.onLine);
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, []);

  async function leaveAccount() {
    setError("");
    setSigningOut(true);
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <main className="home-screen" id="main-content">
      <header className="home-header">
        <div>
          <p className="eyebrow">WILDLIFE GUARDIAN</p>
          <h1>Ranger account</h1>
        </div>
        <span className={`connection-pill ${online ? "is-online" : "is-offline"}`} role="status">
          <span aria-hidden="true" className="connection-dot" />
          {online ? "Online" : "Offline"}
        </span>
      </header>

      <section className="welcome-card" aria-labelledby="welcome-title">
        <p className="eyebrow">FIELD ACCESS</p>
        <h2 id="welcome-title">Hello, {user?.name}</h2>
        <p>Your ranger account is signed in and ready.</p>
      </section>

      <section className="account-card" aria-labelledby="account-title">
        <h2 id="account-title">Account &amp; park</h2>
        <dl className="account-details">
          <div>
            <dt>Name</dt>
            <dd>{user?.name}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user?.email}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>Ranger</dd>
          </div>
          <div>
            <dt>Assigned park</dt>
            <dd>{user?.parkName ?? "No park assigned"}</dd>
          </div>
        </dl>
      </section>

      <section className="connection-card" aria-labelledby="connection-title">
        <h2 id="connection-title">Connection</h2>
        <p>
          {online
            ? "You’re connected. Account updates can reach the service."
            : "You’re offline. Sign-in and account updates need a connection."}
        </p>
      </section>

      {error && <p className="alert" role="alert">{error}</p>}
      <button
        className="secondary-button"
        type="button"
        onClick={() => void leaveAccount()}
        disabled={signingOut}
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </main>
  );
}
