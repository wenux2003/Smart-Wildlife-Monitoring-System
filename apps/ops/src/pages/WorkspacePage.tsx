import { Link, Navigate } from "react-router-dom";
import {
  ArrowRight,
  Camera,
  ChartNoAxesCombined,
  FileClock,
  MessageSquare,
  Radio,
  TriangleAlert,
  Users,
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
  const operational = ["PARK_MANAGER", "LIAISON_OFFICER"].includes(user.role);
  const analytical = ["PARK_MANAGER", "RESEARCHER"].includes(user.role);
  const modules = [
    ...(operational
      ? [
          {
            icon: TriangleAlert,
            name: "Incident reporting",
            description: "Review incidents and coordinate follow-up.",
            link: "/incidents",
          },
          {
            icon: MessageSquare,
            name: "Community conflict inbox",
            description: "Review reports from communities near the park.",
            link: "/conflicts",
          },
          {
            icon: Camera,
            name: "Camera-trap review",
            description: "Review wildlife detections and camera evidence.",
            link: "/camera-traps",
          },
          {
            icon: Radio,
            name: "Wildlife alerts",
            description: "Monitor collar alerts and ranger dispatches.",
            link: "/alerts",
          },
        ]
      : []),
    ...(analytical
      ? [
          {
            icon: ChartNoAxesCombined,
            name: "Conservation analytics",
            description: "Explore incidents, hotspots and patrol coverage.",
            link: "/analytics",
          },
          {
            icon: FileClock,
            name: "Report history",
            description: "Reopen saved reports and download exports.",
            link: "/reports",
          },
        ]
      : []),
  ];
  return (
    <div className="workspace-page">
      <AccountHeader />
      <main
        id="main-content"
        className="workspace-main content-width workspace-dashboard"
      >
        <header className="dashboard-heading">
          <div>
            <p className="section-kicker">YOUR CONSERVATION WORKSPACE</p>
            <h1>
              Welcome, {user.name.split(" ")[0]}
              <span className="brand-dot">.</span>
            </h1>
            <p className="workspace-intro">
              Your park operations, all in one place.
            </p>
          </div>
          {user.role === "PARK_MANAGER" && (
            <Link className="button button-outline dashboard-staff" to="/staff">
              <Users size={16} /> Manage staff accounts
            </Link>
          )}
        </header>
        {!user.parkId && (
          <p className="dashboard-access-note" role="status">
            Park access is pending. Contact your park manager to arrange access.
          </p>
        )}
        <section aria-labelledby="dashboard-modules-title">
          <div className="dashboard-section-heading">
            <h2 id="dashboard-modules-title">Park workspaces</h2>
            <span>{modules.length} workspaces</span>
          </div>
          <div className="workspace-modules dashboard-modules">
            {modules.map(({ icon: Icon, name, description, link }) => (
              <article key={name} className="dashboard-module">
                <div className="dashboard-module-top">
                  <span className="dashboard-module-icon">
                    <Icon size={22} strokeWidth={1.7} />
                  </span>
                </div>
                <h3>{name}</h3>
                <p>{description}</p>
                <Link className="dashboard-module-link" to={link}>
                  Open <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
