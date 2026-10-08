import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AccountHeader } from "./AccountHeader.js";
export function IncidentLayout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="workspace-page">
      <AccountHeader />
      <main id="main-content" className="m1-page">
        <nav className="m1-nav">
          <Link to="/dashboard">Workspace</Link>
          <Link to="/incidents">Incidents</Link>
          <Link to="/conflicts">Community inbox</Link>
          <Link to="/camera-traps">Camera review</Link>
        </nav>
        <p className="m1-kicker">INCIDENT OPERATIONS</p>
        <h1>{title}</h1>
        {children}
      </main>
    </div>
  );
}
