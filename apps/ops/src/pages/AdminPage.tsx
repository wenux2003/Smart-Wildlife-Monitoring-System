import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
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

export function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"parks" | "accounts">("parks");
  const [parks, setParks] = useState<AccountPark[]>([]);
  const [accounts, setAccounts] = useState<ManagedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [parkName, setParkName] = useState("");
  const [parkCode, setParkCode] = useState("");
  const [terrain, setTerrain] = useState("");
  const [parkPending, setParkPending] = useState(false);
  const [parkSuccess, setParkSuccess] = useState("");
  const [parkError, setParkError] = useState("");
  const [filterPark, setFilterPark] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [search, setSearch] = useState("");

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

  const visibleAccounts = useMemo(() => accounts.filter((account) =>
    (!filterPark || account.parkId === filterPark) &&
    (!filterRole || account.role === filterRole) &&
    (!search || `${account.name} ${account.email}`.toLowerCase().includes(search.toLowerCase())),
  ), [accounts, filterPark, filterRole, search]);
  const managers = accounts.filter((account) => account.role === "PARK_MANAGER");

  async function createPark(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setParkPending(true);
    setParkError("");
    setParkSuccess("");
    try {
      await apiRequest<AccountPark>("/api/parks", {
        body: { code: parkCode, name: parkName, terrain },
      });
      setParkCode("");
      setParkName("");
      setTerrain("");
      setParkSuccess("Park created.");
      await reload();
    } catch (failure) {
      setParkError((failure as Error).message);
    } finally {
      setParkPending(false);
    }
  }

  if (loading)
    return <main className="center-state" role="status">Loading parks and accounts…</main>;
  return (
    <div className="workspace-page">
      <AccountHeader />
      <main id="main-content" className="content-width account-admin-main">
        <p className="section-kicker">NATIONAL ACCOUNT ADMINISTRATION</p>
        <h1>Parks &amp; accounts</h1>
        <p className="workspace-intro">Manage access and staff identities. Operational park data is not available to the Super Admin account.</p>
        {error && <div className="account-inline-error" role="alert"><p>{error}</p><button className="button button-outline" onClick={() => void reload()}>Try again</button></div>}
        <div className="admin-tabs" role="tablist" aria-label="Administration sections">
          <button role="tab" aria-selected={tab === "parks"} id="parks-tab" aria-controls="parks-panel" onClick={() => setTab("parks")}>Parks &amp; managers</button>
          <button role="tab" aria-selected={tab === "accounts"} id="accounts-tab" aria-controls="accounts-panel" onClick={() => setTab("accounts")}>All accounts</button>
        </div>
        {tab === "parks" ? (
          <section role="tabpanel" id="parks-panel" aria-labelledby="parks-tab" className="account-admin-section">
            <section className="account-panel">
              <h2>Create a park</h2>
              <form className="account-form" onSubmit={(event) => void createPark(event)}>
                <div className="account-form-grid">
                  <label className="field-label" htmlFor="park-code">PARK CODE
                    <input id="park-code" value={parkCode} onChange={(event) => setParkCode(event.target.value.toUpperCase())} pattern="[A-Z][A-Z0-9_]{0,31}" maxLength={32} required disabled={parkPending} />
                  </label>
                  <label className="field-label" htmlFor="park-name">PARK NAME
                    <input id="park-name" value={parkName} onChange={(event) => setParkName(event.target.value)} minLength={2} maxLength={120} required disabled={parkPending} />
                  </label>
                  <label className="field-label account-form-wide" htmlFor="park-terrain">TERRAIN
                    <textarea id="park-terrain" value={terrain} onChange={(event) => setTerrain(event.target.value)} maxLength={3000} rows={3} disabled={parkPending} />
                  </label>
                </div>
                {parkError && <p role="alert" className="form-error">{parkError}</p>}
                {parkSuccess && <p role="status" className="form-success">{parkSuccess}</p>}
                <button className="button button-green" type="submit" disabled={parkPending}>{parkPending ? "Creating…" : "Create park"}</button>
              </form>
            </section>
            <section className="account-panel">
              <h2>Create Park Manager</h2>
              <p className="field-hint">The new manager receives a temporary password and must replace it at first sign-in.</p>
              <CreateAccountForm parks={parks} allowedRoles={["PARK_MANAGER"]} onCreated={reload} />
            </section>
            <section className="account-panel">
              <h2>Park list</h2>
              {parks.length === 0 ? <p className="account-empty">No parks have been created.</p> : (
                <div className="park-list">
                  {parks.map((park) => (
                    <article key={park.id}>
                      <span className="park-code">{park.code}</span>
                      <div><h3>{park.name}</h3><p>{park.terrain || "Terrain not recorded."}</p></div>
                      <span>{managers.filter((manager) => manager.parkId === park.id).length} manager(s)</span>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </section>
        ) : (
          <section role="tabpanel" id="accounts-panel" aria-labelledby="accounts-tab" className="account-admin-section">
            <section className="account-panel">
              <CreateAccountForm parks={parks} allowedRoles={["PARK_MANAGER", "RANGER", "LIAISON_OFFICER"]} onCreated={reload} />
            </section>
            <section className="account-panel">
              <ResearcherAccessForm parks={parks} onChanged={reload} />
            </section>
            <section className="account-panel">
              <h2>Search accounts</h2>
              <div className="account-filters">
                <label className="field-label" htmlFor="filter-park">PARK
                  <select id="filter-park" value={filterPark} onChange={(event) => setFilterPark(event.target.value)}>
                    <option value="">All parks</option>
                    {parks.map((park) => <option key={park.id} value={park.id}>{park.name}</option>)}
                  </select>
                </label>
                <label className="field-label" htmlFor="filter-role">ROLE
                  <select id="filter-role" value={filterRole} onChange={(event) => setFilterRole(event.target.value)}>
                    <option value="">All roles</option>
                    {["SUPER_ADMIN", "PARK_MANAGER", "RANGER", "LIAISON_OFFICER", "RESEARCHER"].map((role) => <option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}
                  </select>
                </label>
                <label className="field-label account-search" htmlFor="account-search">NAME OR EMAIL
                  <input id="account-search" value={search} onChange={(event) => setSearch(event.target.value)} />
                </label>
              </div>
              <AccountsTable accounts={visibleAccounts} parks={parks} currentUserId={user?.id ?? ""} allowRoleChanges onChanged={reload} />
            </section>
          </section>
        )}
        <Link className="inline-link" to="/change-password">Change your password</Link>
      </main>
    </div>
  );
}
