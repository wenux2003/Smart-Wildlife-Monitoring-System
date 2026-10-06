import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Binoculars,
  ChartNoAxesCombined,
  Footprints,
  LogOut,
  Radio,
  ShieldCheck,
} from "lucide-react";
import { Brand } from "../components/Brand.js";
import { useAuth } from "../auth/AuthContext.js";

export function WorkspacePage() {
  const { user, loading, error, refresh, signOut } = useAuth();
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState("");
  const [pending, setPending] = useState(false);
  if (loading)
    return (
      <main className="center-state" role="status">
        <span className="spinner" /> Opening your workspace…
      </main>
    );
  if (error)
    return (
      <main className="center-state">
        <h1>We couldn’t load your account.</h1>
        <p role="alert">{error}</p>
        <button className="button button-green" onClick={() => void refresh()}>
          Try again
        </button>
        <Link to="/">Back home</Link>
      </main>
    );
  if (!user) return <Navigate to="/login" replace />;
  async function logout() {
    setPending(true);
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch (failure) {
      setLogoutError((failure as Error).message);
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="workspace-page">
      <header className="workspace-header content-width">
        <Brand />
        <button
          className="button button-outline"
          onClick={() => void logout()}
          disabled={pending}
        >
          <LogOut size={16} />
          {pending ? "Signing out…" : "Sign out"}
        </button>
      </header>
      <main id="main-content" className="workspace-main content-width">
        <p className="section-kicker">YOUR CONSERVATION WORKSPACE</p>
        <h1>
          Welcome, {user.name.split(" ")[0]}
          <span className="brand-dot">.</span>
        </h1>
        <p className="workspace-intro">
          A shared purpose. A new starting point.
        </p>
        {logoutError && (
          <p role="alert" className="form-error">
            {logoutError}
          </p>
        )}
        <div className="account-card">
          <ShieldCheck size={30} />
          <div>
            <h2>Your account is ready</h2>
            <p>
              {user.email} · {user.role.replaceAll("_", " ").toLowerCase()}
            </p>
            <p>
              {user.role === "SUPER_ADMIN"
                ? "National access: you manage parks and Park Manager accounts across Sri Lanka."
                : user.parkId
                  ? `Assigned park: ${user.parkName ?? "saved"}.`
                  : "Park access is pending. Contact the park manager of the park you work with to arrange access."}
            </p>
          </div>
          <span className="account-status">Signed in</span>
        </div>
        <h2 className="workspace-section-title">
          What we’re building together
        </h2>
        <div className="workspace-modules">
          {[
            { icon: Binoculars, name: "Incident reporting" },
            { icon: Footprints, name: "Ranger patrols" },
            { icon: Radio, name: "Wildlife alerts" },
            { icon: ChartNoAxesCombined, name: "Conservation analytics" },
          ].map(({ icon: Icon, name }) => (
            <article key={name}>
              <Icon size={27} />
              <h3>{name}</h3>
              <span className="development-tag">In development</span>
            </article>
          ))}
        </div>
        <p className="workspace-footnote">
          These modules are not available yet. Your account does not grant
          access to operational park data until permissions are assigned.
        </p>
        <Link className="inline-link" to="/">
          Explore our mission <ArrowRight size={16} />
        </Link>
      </main>
    </div>
  );
}
