import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AccountHeader } from "../components/AccountHeader.js";
import {
  AccountsTable,
  CreateAccountForm,
  ResearcherAccessForm,
} from "../components/AccountsTable.js";
import type { AccountPark, ManagedAccount } from "../components/AccountsTable.js";
import { apiRequest } from "../api.js";
import { useAuth } from "../auth/AuthContext.js";

export function StaffPage() {
  const { user } = useAuth();
  const [parks, setParks] = useState<AccountPark[]>([]);
  const [accounts, setAccounts] = useState<ManagedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [parkRows, accountRows] = await Promise.all([
        apiRequest<AccountPark[]>("/api/parks"),
        apiRequest<ManagedAccount[]>("/api/accounts"),
      ]);
      setParks(parkRows);
      setAccounts(accountRows);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  if (loading)
    return <main className="center-state" role="status">Loading your park’s staff…</main>;
  const park = parks.find((item) => item.id === user?.parkId);
  return (
    <div className="workspace-page">
      <AccountHeader />
      <main id="main-content" className="content-width account-admin-main">
        <p className="section-kicker">PARK ADMINISTRATION{park ? ` · ${park.name.toUpperCase()}` : ""}</p>
        <h1>Staff accounts</h1>
        <p className="workspace-intro">Create and manage Rangers and Liaison Officers in your park. Researcher access is limited to this park.</p>
        {error && <div className="account-inline-error" role="alert"><p>{error}</p><button className="button button-outline" onClick={() => void reload()}>Try again</button></div>}
        <section className="account-panel">
          <CreateAccountForm parks={parks} allowedRoles={["RANGER", "LIAISON_OFFICER"]} forcedParkId={user?.parkId ?? ""} onCreated={reload} />
        </section>
        <section className="account-panel">
          <ResearcherAccessForm parks={parks} forcedParkId={user?.parkId ?? ""} onChanged={reload} />
        </section>
        <section className="account-panel">
          <h2>Your park’s accounts</h2>
          <AccountsTable accounts={accounts} parks={parks} currentUserId={user?.id ?? ""} managerMode onChanged={reload} />
        </section>
        <Link className="inline-link" to="/dashboard">Back to workspace</Link>
      </main>
    </div>
  );
}
