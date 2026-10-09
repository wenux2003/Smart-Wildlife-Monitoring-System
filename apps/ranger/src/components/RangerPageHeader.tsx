import { useEffect, useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function SyncIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 7h-5V2M4 17h5v5M18.5 11a7 7 0 0 0-11.9-4.9L4 8M5.5 13a7 7 0 0 0 11.9 4.9L20 16" />
    </svg>
  );
}

export function RangerPageHeader({
  title,
  eyebrow,
}: {
  title: string;
  eyebrow?: string;
}) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const menuId = `ranger-account-${useId().replaceAll(":", "")}`;
  const [online, setOnline] = useState(() => navigator.onLine);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");

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
    <header className="ranger-page-header">
      <div className="ranger-header-top-row">
        <p className="patrol-kicker">
          {eyebrow ?? user?.parkName ?? "FIELD OPERATIONS"}
        </p>
        <button
          className="menu-button"
          type="button"
          aria-label="Open account menu"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <MenuIcon />
        </button>
      </div>

      <div className="ranger-header-title-row">
        <h1>{title}</h1>
        <span
          className={`sync-pill ${online ? "is-online" : "is-offline"}`}
          role="status"
        >
          <SyncIcon />
          {online ? "Synced just now" : "Saving offline"}
        </span>
      </div>

      {menuOpen && (
        <section
          className="ranger-menu"
          id={menuId}
          aria-label="Ranger account"
        >
          <div>
            <strong>{user?.name}</strong>
            <span>{user?.parkName ?? "No park assigned"}</span>
          </div>
          <button
            type="button"
            onClick={() => void leaveAccount()}
            disabled={signingOut}
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
          {error && (
            <p className="ranger-menu-error" role="alert">
              {error}
            </p>
          )}
        </section>
      )}
    </header>
  );
}
