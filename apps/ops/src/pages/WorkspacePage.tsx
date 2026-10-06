import { Link, Navigate } from "react-router-dom";
import {
  ArrowRight,
  Binoculars,
  ChartNoAxesCombined,
  Footprints,
  Radio,
  ShieldCheck,
} from "lucide-react";
import { AccountHeader } from "../components/AccountHeader.js";
import { useAuth } from "../auth/AuthContext.js";

export function WorkspacePage() {
  const { user, loading, error, refresh } = useAuth();
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
  return (
    <div className="workspace-page">
      <AccountHeader />
      <main id="main-content" className="workspace-main content-width">
        <p className="section-kicker">YOUR CONSERVATION WORKSPACE</p>
        <h1>
          Welcome, {user.name.split(" ")[0]}
          <span className="brand-dot">.</span>
        </h1>
        <p className="workspace-intro">
          A shared purpose. A new starting point.
        </p>
        {user.role === "PARK_MANAGER" && (
          <Link className="button button-green staff-link" to="/staff">
            Manage staff accounts
          </Link>
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
