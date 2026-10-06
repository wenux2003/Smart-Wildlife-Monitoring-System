import { useState } from "react";
import type { FormEvent } from "react";
import { apiRequest } from "../api.js";

export type ManagedAccount = {
  id: string;
  name: string;
  email: string;
  role: string;
  parkId: string | null;
  parkName: string | null;
  disabledAt: string | null;
  mustChangePassword: boolean;
  createdAt: string;
};
export type AccountPark = { id: string; code: string; name: string; terrain: string };
type Event = {
  id: string;
  actorId: string;
  action: string;
  oldValue: unknown;
  newValue: unknown;
  createdAt: string;
};
const roles = [
  "PARK_MANAGER",
  "RANGER",
  "LIAISON_OFFICER",
  "RESEARCHER",
] as const;
const roleLabel = (role: string) => role.replaceAll("_", " ");

export function CreateAccountForm({
  parks,
  allowedRoles,
  forcedParkId,
  onCreated,
}: {
  parks: AccountPark[];
  allowedRoles: readonly string[];
  forcedParkId?: string;
  onCreated: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setPending(true);
    setError("");
    setSuccess("");
    const form = new FormData(formElement);
    try {
      await apiRequest<ManagedAccount>("/api/accounts", {
        body: {
          name: String(form.get("name") ?? ""),
          email: String(form.get("email") ?? ""),
          role: String(form.get("role") ?? ""),
          parkId: forcedParkId ?? String(form.get("parkId") ?? ""),
          temporaryPassword: String(form.get("temporaryPassword") ?? ""),
        },
      });
      formElement.reset();
      setSuccess("Account created. Share the temporary password securely; the user will be asked to change it at first sign-in.");
      await onCreated();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setPending(false);
    }
  }
  return (
    <form className="account-form account-create-form" onSubmit={submit} aria-label="Create account">
      <h3>Create an account</h3>
      <div className="account-form-grid">
        <label className="field-label" htmlFor="new-account-name">
          FULL NAME
          <input id="new-account-name" name="name" minLength={2} maxLength={100} autoComplete="name" required disabled={pending} />
        </label>
        <label className="field-label" htmlFor="new-account-email">
          EMAIL ADDRESS
          <input id="new-account-email" name="email" type="email" maxLength={254} autoComplete="email" required disabled={pending} />
        </label>
        <label className="field-label" htmlFor="new-account-role">
          ROLE
          <select id="new-account-role" name="role" required disabled={pending}>
            {allowedRoles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
          </select>
        </label>
        {!forcedParkId && (
          <label className="field-label" htmlFor="new-account-park">
            PARK
            <select id="new-account-park" name="parkId" required disabled={pending}>
              <option value="">Select a park</option>
              {parks.map((park) => <option key={park.id} value={park.id}>{park.name}</option>)}
            </select>
          </label>
        )}
        <label className="field-label account-form-wide" htmlFor="new-account-password">
          TEMPORARY PASSWORD
          <input id="new-account-password" name="temporaryPassword" type="password" minLength={12} maxLength={128} autoComplete="new-password" required disabled={pending} />
        </label>
      </div>
      {error && <p role="alert" className="form-error">{error}</p>}
      {success && <p role="status" className="form-success">{success}</p>}
      <button className="button button-green" type="submit" disabled={pending}>{pending ? "Creating…" : "Create account"}</button>
    </form>
  );
}

export function ResearcherAccessForm({
  parks,
  forcedParkId,
  onChanged,
}: {
  parks: AccountPark[];
  forcedParkId?: string;
  onChanged: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setStatus("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await apiRequest<ManagedAccount>("/api/accounts/researcher-access", {
        body: {
          email: String(form.get("researcherEmail") ?? ""),
          parkId: forcedParkId ?? String(form.get("researcherPark") ?? ""),
          grant: form.get("grant") === "true",
        },
      });
      setStatus(`${form.get("grant") === "true" ? "Granted" : "Removed"} park access ${form.get("grant") === "true" ? "for" : "from"} ${result.email}.`);
      await onChanged();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setPending(false);
    }
  }
  return (
    <form className="account-form account-access-form" onSubmit={submit}>
      <h3>Researcher park access</h3>
      <div className="account-form-grid">
        <label className="field-label" htmlFor="researcher-email">
          RESEARCHER EMAIL
          <input id="researcher-email" name="researcherEmail" type="email" autoComplete="email" required disabled={pending} />
        </label>
        {!forcedParkId && (
          <label className="field-label" htmlFor="researcher-park">
            PARK
            <select id="researcher-park" name="researcherPark" required disabled={pending}>
              <option value="">Select a park</option>
              {parks.map((park) => <option key={park.id} value={park.id}>{park.name}</option>)}
            </select>
          </label>
        )}
        <label className="field-label" htmlFor="researcher-grant">
          ACTION
          <select id="researcher-grant" name="grant" defaultValue="true" disabled={pending}>
            <option value="true">Grant access</option>
            <option value="false">Remove access</option>
          </select>
        </label>
      </div>
      {error && <p role="alert" className="form-error">{error}</p>}
      {status && <p role="status" className="form-success">{status}</p>}
      <button className="button button-outline" type="submit" disabled={pending}>{pending ? "Saving…" : "Save access"}</button>
    </form>
  );
}

export function AccountsTable({
  accounts,
  parks,
  currentUserId,
  allowRoleChanges,
  managerMode,
  onChanged,
}: {
  accounts: ManagedAccount[];
  parks: AccountPark[];
  currentUserId: string;
  allowRoleChanges?: boolean;
  managerMode?: boolean;
  onChanged: () => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState("");
  const [events, setEvents] = useState<Record<string, Event[]>>({});
  const [eventsLoading, setEventsLoading] = useState("");

  async function mutate(id: string, action: "deactivate" | "reactivate", account: ManagedAccount) {
    if (action === "deactivate" && !window.confirm(`Deactivate ${account.name}? Their sessions will be revoked.`)) return;
    setPendingId(id);
    setError("");
    try {
      await apiRequest(`/api/accounts/${id}/${action}`);
      await onChanged();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setPendingId("");
    }
  }
  async function resetPassword(event: FormEvent<HTMLFormElement>, account: ManagedAccount) {
    event.preventDefault();
    if (!window.confirm(`Reset ${account.name}'s password and revoke all their sessions?`)) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const temporaryPassword = String(form.get("temporaryPassword") ?? "");
    setPendingId(account.id);
    setError("");
    try {
      await apiRequest(`/api/accounts/${account.id}/reset-password`, { body: { temporaryPassword } });
      formElement.reset();
      setError("");
      window.alert("Password reset. Share the temporary password securely; the user must change it at first sign-in.");
      await onChanged();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setPendingId("");
    }
  }
  async function saveChanges(event: FormEvent<HTMLFormElement>, account: ManagedAccount) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPendingId(account.id);
    setError("");
    try {
      await apiRequest(`/api/accounts/${account.id}`, {
        method: "PATCH",
        body: {
          role: String(form.get("role") ?? account.role),
          parkId: String(form.get("parkId") ?? "") || null,
        },
      });
      await onChanged();
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setPendingId("");
    }
  }
  async function loadEvents(id: string) {
    if (events[id]) return;
    setEventsLoading(id);
    setError("");
    try {
      const loaded = await apiRequest<Event[]>(`/api/accounts/${id}/events`);
      setEvents((existing) => ({ ...existing, [id]: loaded }));
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setEventsLoading("");
    }
  }

  return (
    <div className="account-table-wrap">
      {error && <p role="alert" className="form-error">{error}</p>}
      {accounts.length === 0 ? (
        <p className="account-empty">No accounts match these filters.</p>
      ) : (
        <table className="account-table">
          <caption className="visually-hidden">Account list and management actions</caption>
          <thead><tr><th>Name and email</th><th>Role</th><th>Park</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id}>
                <td data-label="Account"><strong>{account.name}</strong><small>{account.email}</small></td>
                <td data-label="Role">{roleLabel(account.role)}</td>
                <td data-label="Park">{account.parkName ?? "No park"}</td>
                <td data-label="Status">
                  <span className={account.disabledAt ? "account-status disabled" : "account-status"}>
                    {account.disabledAt ? "Deactivated" : account.mustChangePassword ? "Temporary password" : "Active"}
                  </span>
                </td>
                <td data-label="Actions">
                  <div className="account-row-actions">
                    {(!managerMode || ["RANGER", "LIAISON_OFFICER", "RESEARCHER"].includes(account.role)) && (
                    <>
                      {account.id !== currentUserId &&
                        (!managerMode || ["RANGER", "LIAISON_OFFICER"].includes(account.role)) && (
                        <button className="text-button" disabled={pendingId === account.id} onClick={() => void mutate(account.id, account.disabledAt ? "reactivate" : "deactivate", account)}>
                          {account.disabledAt ? "Reactivate" : "Deactivate"}
                        </button>
                      )}
                      <details className="account-details" onToggle={(event) => { if (event.currentTarget.open) void loadEvents(account.id); }}>
                      <summary>History &amp; password</summary>
                      <div className="account-details-content">
                        {allowRoleChanges && account.role !== "SUPER_ADMIN" && account.id !== currentUserId && (
                          <form className="account-inline-form" onSubmit={(event) => void saveChanges(event, account)}>
                            <label className="field-label" htmlFor={`edit-role-${account.id}`}>ROLE
                              <select id={`edit-role-${account.id}`} name="role" defaultValue={account.role} disabled={pendingId === account.id}>
                                {roles.map((item) => <option key={item} value={item}>{roleLabel(item)}</option>)}
                              </select>
                            </label>
                            <label className="field-label" htmlFor={`edit-park-${account.id}`}>PARK
                              <select id={`edit-park-${account.id}`} name="parkId" defaultValue={account.parkId ?? ""} disabled={pendingId === account.id}>
                                <option value="">No park (Researchers only)</option>
                                {parks.map((park) => <option key={park.id} value={park.id}>{park.name}</option>)}
                              </select>
                            </label>
                            <button className="button button-outline" type="submit" disabled={pendingId === account.id}>Save role and park</button>
                          </form>
                        )}
                        {(!managerMode || ["RANGER", "LIAISON_OFFICER"].includes(account.role)) && <form className="account-inline-form" onSubmit={(event) => void resetPassword(event, account)}>
                          <label className="field-label" htmlFor={`reset-password-${account.id}`}>NEW TEMPORARY PASSWORD
                            <input id={`reset-password-${account.id}`} name="temporaryPassword" type="password" minLength={12} maxLength={128} autoComplete="new-password" required disabled={pendingId === account.id} />
                          </label>
                          <button className="button button-outline" type="submit" disabled={pendingId === account.id}>{pendingId === account.id ? "Saving…" : "Reset password"}</button>
                        </form>}
                        <section className="audit-history" aria-label={`Audit history for ${account.name}`}>
                          <h4>Account history</h4>
                          {eventsLoading === account.id && <p role="status">Loading history…</p>}
                          {events[account.id]?.length === 0 && <p>No recorded account changes.</p>}
                          {events[account.id]?.map((item) => (
                            <article key={item.id}>
                              <strong>{roleLabel(item.action)}</strong>
                              <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
                              {(item.oldValue !== null || item.newValue !== null) && <code>{JSON.stringify({ from: item.oldValue, to: item.newValue })}</code>}
                            </article>
                          ))}
                        </section>
                      </div>
                      </details>
                    </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
