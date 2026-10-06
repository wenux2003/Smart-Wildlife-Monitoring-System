import { Link } from "react-router-dom";
import { AccountHeader } from "../components/AccountHeader.js";

export function AccessDeniedPage() {
  return (
    <div className="workspace-page">
      <AccountHeader />
      <main id="main-content" className="content-width account-panel center-state">
        <p className="section-kicker">ACCESS RESTRICTED</p>
        <h1>You can’t open this page.</h1>
        <p>Your account doesn’t have permission to view this area.</p>
        <Link className="button button-green" to="/dashboard">
          Go to your home page
        </Link>
      </main>
    </div>
  );
}
