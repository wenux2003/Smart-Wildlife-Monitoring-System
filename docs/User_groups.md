# User Groups, Screens and Account Access — Wana Rakshaka (Wildlife Guardian)

**Group 037 | 6 October 2026 | Reference note: what exists now is separated from what is planned**

> **6 October 2026 update: account hierarchy proposed.** This note now describes a three-level account structure: **Super Admin → Park Manager → park staff** (§2). It is a **proposal pending team agreement**. The [Shared features plan](./Shared_Features_Plan.md) §7 still lists user-administration screens as deferred, and [web-auth.md](./web-auth.md) still says administrative provisioning is not implemented. Update both if the team adopts this design. Scope impact is covered in §2.6.

This note answers five questions for the whole team:

1. Who uses the system?
2. Which app and which screens does each group use?
3. Who needs to **sign in** (log in), who can also **sign up** (register), and who uses the system without an account?
4. Which accounts must be **created for the user in advance** rather than self-registered?
5. **Who creates those accounts?**

Sources: the client brief `Case study 01.pdf` (pp. 1–3), [Implementation plan](./Group037_Implementation_Plan.md) §3 and §8, [Shared features plan](./Shared_Features_Plan.md) §2, §4 and §7, [Web authentication](./web-auth.md), the Group 039 use-case diagram (p. 2) and the current code (`packages/shared/src/enums.ts`, `apps/api/drizzle/0001_auth.sql`, `apps/api/src/modules/auth/routes.ts`, `apps/ops/src/app/App.tsx`, `apps/ranger/src/app/App.tsx`).

> **Terminology.** "Sign in" and "log in" mean the same thing: entering an email and password for an existing account. "Sign up" and "register" mean creating a new account yourself. The Ops website uses `/login` and `/register`; `/signin` and `/signup` redirect to them.

---

## 1. Quick answer

| User group | Type | App they use | Sign in? | Self sign-up? | Who creates the account |
|---|---|---|---|---|---|
| **Super Admin** | National admin role *(proposed)* | Operations website (port 5174) | **Yes** | **No** | Created once by the **bootstrap seed script** |
| **Park Manager** | Staff role, also park-level admin | Operations website | **Yes** | **No** | The **Super Admin** |
| **Ranger** | Staff role | Ranger mobile app (PWA, port 5173) | **Yes** | **No** | **Their park's Park Manager** |
| **Liaison Officer** | Staff role | Operations website | **Yes** | **No** | **Their park's Park Manager** |
| **Researcher** | Partner role | Operations website | **Yes** | **Yes**, the only role that can self-register | Themselves. Park access is granted by that park's Park Manager or the Super Admin |
| **Community member / villager** | Public, not a role | SMS (mock gateway) or the public community form in the Ranger app | **No** | **No** | No account. Identified by phone number only |
| **Public visitor** | Public, not a role | Ops public home page | **No** | Can register, which makes them a Researcher | No account |
| **Government ministries and funding bodies** | External recipients | None. They receive exported PDF/CSV reports | **No** | **No** | No account |
| **Devices and simulators** (GPS collars, camera traps, SMS gateway) | System actors | Call the API directly | No user login | No | No account |

Until the staff-account screen is built (§2.5, Phase B), the seed script creates every demo account and a team member does the Super Admin's job directly on the database.

**In short:**

- **Sign-in only:** Super Admin, Park Manager, Ranger and Liaison Officer. Someone higher up the chain always creates these accounts, because a staff role and a park assignment carry operational authority.
- **Sign-up and sign-in:** Researcher only. A public visitor who registers becomes a Researcher with **no park**. They see no park data until a Park Manager or the Super Admin grants access.
- **No account:** community members, public visitors who don't register, ministries and funding bodies, and devices or simulators.

---

## 2. Account hierarchy: who creates whom *(proposed)*

### 2.1 Why

The system serves the Department of Wildlife Conservation across **all national parks and forest reserves in Sri Lanka**. The case study describes "multiple parks with differing terrain and staffing levels." One person cannot create every ranger's account in every park, and park staff change often. Accounts should be created by someone who knows the staff at that park, under one national authority.

### 2.2 Structure

```text
Super Admin  (DWC head office — whole Sri Lanka; one account, owned by Wenura)
   │  creates parks and Park Manager accounts; can act on any park
   ▼
Park Manager  (one or more per park: Yala, Wilpattu, Sinharaja, Udawalawe …)
   │  is the account admin for THEIR OWN park only
   ▼
Ranger · Liaison Officer   (created by their park's Park Manager)
Researcher                 (self-registers; park access granted by that park's Park Manager)
```

**Design choice:** the Park Manager is the admin for their park. There is no separate "park admin" role. The Park Manager is already the most senior person at a park, and a second park-level role would add a role, permissions and tests without adding any capability.

### 2.3 Who can do what with accounts

| Action | Super Admin | Park Manager | Everyone else |
|---|---|---|---|
| Create a park | ✅ | — | — |
| Create a Park Manager | ✅ any park | — | — |
| Create a Ranger or Liaison Officer | ✅ any park | ✅ **own park only** | — |
| Grant or remove a Researcher's park access | ✅ any park | ✅ **own park only** | — |
| Move a user to a different park | ✅ | — | — |
| Change someone's role | ✅ | — | — |
| Deactivate or reactivate an account | ✅ any account except their own | ✅ Rangers and Liaison Officers in own park | — |
| Create another Super Admin | — (seed script only) | — | — |
| See the staff list | ✅ all parks | ✅ own park | — |

### 2.4 Rules the API must enforce

The server must enforce these rules on every request. Hiding buttons in the interface is not enough.

1. **No escalation.** A Park Manager can't create or edit a Park Manager or Super Admin, can't change a role, and can't touch their own role or park.
2. **Park boundary.** A Park Manager acts only on users whose `park_id` matches their own. A request for a user in another park is rejected with `403`.
3. **No self-lockout.** The Super Admin can't deactivate or demote their own account, so the system always has a working Super Admin.
4. **Deactivate, never delete.** Rangers' past incidents, patrols and dispatches must keep their author, so accounts are switched off, not removed. Deactivating an account also revokes all its sessions immediately.
5. **The first account comes from a seed script.** The Super Admin account is created once by the bootstrap script, using `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_NAME` and `SUPER_ADMIN_PASSWORD` from `.env`. It can't be created from a screen, and public registration can never produce it.
6. **Temporary passwords.** There is no email system, so whoever creates an account sets a temporary password (12–128 characters) and gives it to the person directly. The account is flagged so that the user must **change the password at first sign-in**.
7. **Audit trail.** Every create, park change, role change, deactivation and reactivation records the actor, time, target user, old and new values, and a reason. This uses the shared audit-event format.

### 2.5 Build in two phases

| Phase | What | When | Needed for the demo? |
|---|---|---|---|
| **A: seed only** | Migration adding `SUPER_ADMIN` and the account flags (§3). A seed script that creates the Super Admin from `.env`, then Park Managers, Liaison Officers, Rangers and a Researcher for each demo park (§6.3). | **Now.** It is small and unblocks every module's demo. | **Yes** |
| **B: staff-account screens** | Ops pages: *Parks & managers* for the Super Admin, *Staff accounts* for Park Managers (create, list, deactivate, grant Researcher access), plus a first-login password-change page. API endpoints and tests for the rules in §2.4. | **Only after** the four graded modules work, around 7–8 October at the earliest. | No. Phase A already gives the demo its accounts. |

Until Phase B exists, a team member does the Super Admin's work with the seed script or SQL against Neon. Nobody may claim in the report that Phase B screens exist unless they are built and tested.

### 2.6 Scope check against the assignment

- **This doesn't break the assignment rules.** The plans, quoting the specification and campus FAQ, say *"login/logout and privilege administration are not graded use cases."* They earn no marks, but they aren't banned.
- **It changes the team's own agreed scope.** [Shared features plan](./Shared_Features_Plan.md) §7 defers "user-administration screens." Phase A only adds a seed script and a role value, which fits the existing "Team setup: migrations, seed commands" shared item. Phase B needs team agreement and an update to that plan.
- **It isn't any member's graded use case.** Each member's marks still come from incidents (M1), patrols (M2), alerts (M3) or analytics (M4), with their main, alternate and error flows and more than 80% test coverage. Admin work must not take time from these.
- **In the report:** if the improved use-case diagram shows a Super Admin actor, justify it briefly. For example: "the case study requires several parks with different staffing, so accounts are provisioned per park under national control." Alternatively, describe it as supporting infrastructure outside the four main use cases. Group 039's design is the one being critiqued, and new actors need a reason.
- The plans quote the Assignment 02 specification and FAQ; this note did not check them directly. If unsure, confirm with the module team at a tutorial.

---

## 3. Roles in the code

**Today**, the system has exactly **four login roles**, defined in `packages/shared/src/enums.ts` and enforced by a database `CHECK` constraint in `apps/api/drizzle/0001_auth.sql`:

```text
RANGER | PARK_MANAGER | LIAISON_OFFICER | RESEARCHER
```

Each account (`auth_users`) currently stores `name`, `email` (unique, lowercase), `password_hash` (salted scrypt), `role` (default `RESEARCHER`), `park_id` (nullable) and `created_at`.

**Proposed changes for the hierarchy (Phase A):**

| Change | Where | Notes |
|---|---|---|
| Add `SUPER_ADMIN` to `Role` | `packages/shared/src/enums.ts` | Keep the existing four values and names unchanged |
| Allow `SUPER_ADMIN` in the role check | **New** migration `apps/api/drizzle/0002_…sql` | Don't edit `0001_auth.sql`; it is already applied (web-auth.md) |
| A Super Admin has `park_id = NULL` | Same migration, as a check rule | National scope; every other staff role must have a park |
| `disabled_at timestamptz NULL` | `auth_users` | Deactivation (§2.4 rule 4); sign-in and `/me` reject disabled users |
| `must_change_password boolean` | `auth_users` | Temporary passwords (§2.4 rule 6) |
| `created_by uuid NULL` | `auth_users` | Who created the account; `NULL` for seeded or self-registered accounts |

Public registration stays exactly as it is: always `RESEARCHER`, always `park_id = NULL`, and any role or park field in the request is rejected.

Community members, ministries and devices are **not** roles. There is deliberately no `VILLAGER` value. The shared features plan says community intake is "a small public-facing report form/mock SMS flow, not a fifth staff role."

---

## 4. Each user group in detail

### 4.1 Super Admin *(proposed)*

**Who:** the national administrator at Department of Wildlife Conservation head office. In this project it is **Wenura**, and in the demo it is the seeded Super Admin account.

**App:** Operations website.

**Account:**

- **Sign in: yes.** **Sign up: no.**
- Exactly one account is created by the bootstrap seed script from `.env` (§2.4 rule 5). It has `role = SUPER_ADMIN` and `park_id = NULL`.

**Screens:**

| Area | Route (proposed) | Purpose | Phase |
|---|---|---|---|
| Dashboard | `/dashboard` | Identity, national scope, links to administration | A (the existing page shows the role) |
| Parks & managers | `/admin/parks` | List and create parks; create, deactivate and move Park Managers | B |
| All staff | `/admin/users` | Search accounts across all parks; change role or park; deactivate or reactivate | B |

**Can do:** everything in §2.3 for any park.
**Not decided:** whether the Super Admin can also *view* operational data and analytics across all parks. See §9. The default is account administration only, so the Super Admin doesn't become a hidden fifth operational role.

---

### 4.2 Park Manager

**Who:** the officer in charge of one park. They oversee operations, assign patrols, handle wildlife alerts and produce reports for head office, ministries and funding bodies. **They are also the account admin for their park** (§2).

**App:** Operations website (`apps/ops`, port 5174), a desktop dashboard.

**Account:**

- **Sign in: yes.** **Sign up: no.**
- **Created by the Super Admin** (by the seed script until Phase B), with `role = PARK_MANAGER` and a `park_id`. Managers have the widest operational authority in their park, so the account must never be self-created.

**Planned screens:**

| Area | Route | Purpose | Owner |
|---|---|---|---|
| Dashboard | `/dashboard` | Identity, park, summary cards from each module, shortcuts | Shared |
| **Staff accounts** | `/staff` *(proposed, Phase B)* | Create Rangers and Liaison Officers for own park; list and deactivate them; grant or remove Researcher access to own park | Shared |
| Incidents | `/incidents`, `/incidents/:id` | Park-wide incident review, status changes and history | M1 |
| Camera review | `/camera-traps` | Classify camera images: wildlife, authorised person, suspicious, unsure | M1 (who reviews is still to be confirmed by M1) |
| Patrols | `/patrols` | Assign and reassign patrols; detect conflicts | M2 |
| | `/patrols/coverage` | Coverage map and neglected areas | M2 / M4 |
| | `/patrols/:id` | Static track, observations and statistics for one patrol | M2 |
| Alerts | `/alerts` | Live alert feed and map | M3 |
| | `/alerts/:id` | Details, acknowledge, dispatch nearest ranger, cancel, broadcast, history | M3 |
| | `/collars` | Collar diagnostics: battery, signal and last ping | M3 |
| Analytics | `/analytics` | Filters, KPIs, trends, table, heatmap, patrol gaps | M4 |
| | `/analytics/conflicts` | Human-wildlife conflict trends | M4 |
| | `/reports` | PDF/CSV export and report audit | M4 |
| Settings | park settings screen | Edit park configuration: types, species, thresholds (manager-only) | Shared |

**Can do:** park-wide operational review, patrol assignment, alert dispatch and broadcast, analytics and reports, park settings, and staff accounts for their park. All of this is limited to their own park.
**Cannot do:** create other Park Managers, change anyone's role, or act on another park.

---

### 4.3 Ranger

**Who:** field officers who patrol a park, report incidents and respond to collar alerts. They often work with weak or no mobile signal.

**App:** Ranger mobile web app (`apps/ranger`, port 5173). It is offline-first: data is saved to the phone (IndexedDB) and synchronised when the connection returns.

**Account:**

- **Sign in: yes.** **Sign up: no.**
- **Created by their park's Park Manager** (by the seed script until Phase B), with `role = RANGER` and that park's `park_id`. A self-registered account always becomes a Researcher, so a ranger account can't be made that way.
- At first sign-in the ranger sets their own password, replacing the temporary one (§2.4 rule 6).
- The ranger should sign in **while online, before going into the field**. Sessions last seven days. Offline records must stay attached to the original user and park, even if the session expires before sync (Shared features plan §2). If the session has expired, the outbox should wait for the ranger to sign in again rather than discard or reassign the work.
- If a ranger is deactivated, work they recorded **before** deactivation and still queued offline should still be accepted and attributed to them. The server should flag it for the Park Manager to review rather than silently drop it. Confirm this in §9.

**Planned screens** (Implementation plan §8):

| Area | Route | Purpose | Owner |
|---|---|---|---|
| Sign in | `/login` *(to add)* | Email and password; first-login password change | Shared |
| Home | `/` | Signed-in identity, assigned park, shortcuts, connection and sync status | Shared |
| Sync panel | panel or dialog | Pending and failed item counts; manual retry | Shared (M2 lead) |
| Incidents | `/incidents` | List of own reports and their sync status | M1 |
| | `/incidents/new` | Report an incident: category, description, GPS or manual location, optional photo; review and submit; works offline | M1 |
| | `/incidents/:id` | Detail of own report | M1 |
| Patrols | `/patrol` | Assigned patrols; download offline pack; offline readiness | M2 |
| | `/patrol/active` | Map with live tracking; GPS accuracy, source and age | M2 |
| | `/patrol/waypoint` | Add a manual observation or waypoint | M2 |
| | `/patrol/summary` | End-of-patrol summary (completed or partial) | M2 |
| Alert response | `/alerts/:dispatchId` | Accept or reject a dispatch | M3 |
| | `/alerts/:dispatchId/active` | Mark arrived, then resolve with notes | M3 |

**Can do:** submit and view **own** reports; see **own** assigned patrols; respond to dispatches **assigned to them**; manage **own** offline work.
**Cannot do:** view other rangers' private data, assign patrols, dispatch alerts, open park-wide analytics, change park settings or manage accounts.

**Status today:** the Ranger app is only a shell with a single `/` placeholder page. It has **no sign-in screen yet**. The API already accepts auth requests from `http://localhost:5173`, so the Ranger app can use the same `/api/auth/login`, `/me` and `/logout` endpoints when it is integrated.

---

### 4.4 Liaison Officer

**Who:** the officer who handles reports from villagers about human-elephant conflict and other community issues, and coordinates the response.

The case study (p. 2) says that when a collared elephant enters a high-risk zone, "a ranger **or community liaison officer** can be dispatched." The current plan sends only rangers to collar alerts (M3). The team should either support dispatching a Liaison Officer or record why it doesn't (see §9). If it does, the Liaison Officer also needs to see dispatches assigned to them.

**App:** Operations website.

**Account:**

- **Sign in: yes.** **Sign up: no.**
- **Created by their park's Park Manager** (by the seed script until Phase B), with `role = LIAISON_OFFICER` and a `park_id`. They change the temporary password at first sign-in.

**Planned screens:**

| Area | Route | Purpose | Owner |
|---|---|---|---|
| Dashboard | `/dashboard` | Identity, park, pending community items | Shared |
| Conflict inbox | `/conflicts` | Incoming SMS and community-form reports; resolve landmark or location; send a follow-up for missing details; assign a responder; record the outcome | M1 |
| Incidents | `/incidents`, `/incidents/:id` | Verify or reject, view history, close with outcome notes | M1 |
| Camera review | `/camera-traps` | Possibly; to be confirmed in M1's permission contract | M1 |

**Can do:** community reports, follow-ups, verification, location clarification and response coordination within the assigned park.
**Cannot do:** patrol assignment, alert dispatch, park settings or account management.

---

### 4.5 Researcher

**Who:** conservation researchers and analysts, for example university or NGO partners, who study trends, hotspots and conflict patterns. They don't take part in field operations.

**App:** Operations website.

**Account:**

- **Sign in: yes.** **Sign up: yes.** This is the **only** group that can create its own account.
- Registering at `/register` requires a name, email and a password of 12–128 characters. The server **always** sets `role = RESEARCHER` and `park_id = NULL`. A request that includes a `role` or park field is rejected.
- A new Researcher has **no park access**. The workspace currently says: *"Park access is pending. Contact your project administrator to arrange a park assignment."* Under the hierarchy, **the Park Manager of the park they want to study, or the Super Admin, grants access** (§2.3). Until Phase B, this is done with the seed script or SQL. When Phase B ships, change the message to "Contact the park manager of the park you want to study."
- For the demo, a Researcher account **with a park already assigned** is seeded so analytics can be shown immediately (§6.3).

**Planned screens:**

| Area | Route | Purpose | Owner |
|---|---|---|---|
| Dashboard | `/dashboard` | Identity, allowed park(s) | Shared |
| Analytics | `/analytics`, `/analytics/conflicts` | Read-only statistics, trends and heatmaps | M4 |
| Reports | `/reports` | PDF/CSV export, recorded in the report audit | M4 |

**Can do:** read-only analytics and report export within allowed parks.
**Cannot do:** any operational change, such as editing incidents, assigning patrols or dispatching. They also must not see **unnecessary reporter contact details**, such as villagers' phone numbers.

---

### 4.6 Community member (villager)

**Who:** people living near park boundaries who report elephant sightings, crop raids, property damage and similar incidents. The case study (p. 2) notes that many don't own smartphones or have reliable data, so **SMS is the main channel** and requiring an account would shut them out. In Group 039's use-case diagram they appear as the **Villager** actor.

**How they use the system:**

1. **SMS:** they send a keyword, a description and a landmark to the park number. This is simulated by `tools/sms-gateway-mock` and arrives at `POST /api/community/sms`. They get an automatic reply and, if details are missing, a follow-up question.
2. **Basic form:** a simple public page at **`/community/new`** in the Ranger app. It shows online success or failure messages and handles landmark text.

**Account:** **none.** They don't sign in or sign up. Each report is identified by phone number and message ID. Reports with only a landmark are allowed and never rejected. If the landmark is unknown, the report goes to the Liaison Officer's inbox marked `UNRESOLVED`.

**Privacy:** their phone number is visible to the Liaison Officer handling the case, not to Researchers.

---

### 4.7 Public visitor

**Who:** anyone who opens the Operations website without signing in.

**Screens (implemented now):**

| Route | Purpose |
|---|---|
| `/` | Public home: hero, mission, four-module overview, how it works, FAQ |
| `/login` (also `/signin`) | Sign-in page; "Forgot password?" explains that recovery is not available yet |
| `/register` (also `/signup`) | Registration page; creates a Researcher with no park |
| `*` | "404 / Off the trail" page with a link home |

**Account:** none needed. If they register, they become a Researcher (§4.5).

---

### 4.8 Government ministries and funding bodies (external)

The case study (p. 3) says managers and researchers must "report to funding bodies and government ministries on conservation outcomes." Both are **external report recipients**, not users of the apps (Assignment plan §4, item 5). A Park Manager or Researcher exports a PDF or CSV report and sends it outside the system. **No account, no screens.**

---

### 4.9 Devices and simulators (system actors)

| Actor | Simulated by | Talks to | Login |
|---|---|---|---|
| GPS wildlife collars | `tools/collar-simulator` | `POST /api/collar-pings` | No user login |
| Camera traps | `tools/camera-trap-feeder` | `POST /api/camera-images` | No user login |
| SMS gateway | `tools/sms-gateway-mock` | `POST /api/community/sms` | No user login |

These are local demo tools, not people, and they aren't part of the account hierarchy. **How these endpoints authenticate has not been decided yet.** For example, they could use a shared device key or be allowed only on the local network. M1 and M3 should agree this before the endpoints are built, so that nobody on the internet can submit fake pings or images.

---

## 5. Screen access matrix

✅ = allowed  ·  👁 = read-only  ·  — = no access  ·  **own** = only their own records  ·  **park** = own park only  ·  ❓ = to be confirmed

| Screen / feature | Public | Community | Ranger | Liaison Officer | Researcher | Park Manager | Super Admin |
|---|---|---|---|---|---|---|---|
| Ops public home, login, register | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ops `/dashboard` workspace | — | — | ❓ (Ranger uses its own app) | ✅ | ✅ | ✅ | ✅ |
| Community form `/community/new` / SMS | ✅ | ✅ | — | — | — | — | — |
| Ranger: report incident | — | — | ✅ | — | — | — | — |
| Ranger: incident list/detail | — | — | **own** | — | — | — | — |
| Ranger: patrol screens | — | — | **own assigned** | — | — | — | — |
| Ranger: dispatch accept/arrive/resolve | — | — | **own assigned** | ❓ (§4.4) | — | — | — |
| Ops: incidents list/detail | — | — | — | ✅ park | — | ✅ park | ❓ |
| Ops: camera-trap review | — | — | — | ❓ | — | ❓ | — |
| Ops: conflict inbox | — | — | — | ✅ park | — | 👁 ❓ | — |
| Ops: patrol assignment | — | — | — | — | — | ✅ park | — |
| Ops: patrol coverage/tracks | — | — | — | — | 👁 ❓ (aggregated gaps only) | ✅ park | ❓ |
| Ops: alerts, dispatch, broadcast | — | — | — | — | — | ✅ park | — |
| Ops: collar diagnostics | — | — | — | — | — | ✅ park | — |
| Ops: analytics and conflict trends | — | — | — | — | 👁 allowed parks | ✅ park | ❓ 👁 all parks |
| Ops: PDF/CSV export | — | — | — | — | ✅ allowed parks | ✅ park | ❓ |
| Ops: park settings | — | — | — | — | — | ✅ park | ❓ |
| **Ops: staff accounts** (`/staff`) | — | — | — | — | — | ✅ park (Rangers, Liaison Officers, Researcher access) | ✅ all |
| **Ops: parks & managers** (`/admin/parks`) | — | — | — | — | — | — | ✅ |
| Change own temporary password | — | — | ✅ | ✅ | ✅ | ✅ | ✅ |

Every check above must be enforced **by the API** on each request, using the session's role, park and record ownership. Hiding a menu item or protecting a client route is **not** enough (web-auth.md).

---

## 6. Pre-created accounts

### 6.1 Which accounts are created for the user

| Role | Pre-created? | Created by | Reason |
|---|---|---|---|
| Super Admin | **Must** | Bootstrap seed script, once | Someone has to exist before anyone can create accounts |
| Park Manager | **Must** | Super Admin | Highest operational authority in a park; never self-created |
| Ranger | **Must** | Their park's Park Manager | Registration can't assign this role; it needs a park |
| Liaison Officer | **Must** | Their park's Park Manager | Handles personal data such as villagers' phone numbers |
| Researcher | Optional | Self-registered; park access granted by Park Manager or Super Admin | Self-registered accounts have no park; a seeded one with a park makes the demo smoother |

Until Phase B, the seed script creates all of the above, and a team member does the Super Admin's work directly on the database.

### 6.2 What exists today

- **No accounts are seeded yet.** `tools/seed` is a reserved folder with only a README, and the reference module's "seeded users" are still planned.
- **There is no `SUPER_ADMIN` role yet**, and no deactivation or first-login password change.
- The only working account flow is self-registration on the Ops website, which produces a Researcher with no park.
- `park_id` has no foreign key yet, because the `parks` table does not exist. It must be linked when the reference/park schema is added.
- `corepack pnpm auth:check` creates a temporary test account and then deletes it. It is a smoke test, not a seed.

### 6.3 Proposed demo seed accounts

This is a recommendation for the seed script, not existing data. The plan seeds three parks (Yala, Sinharaja and Wilpattu), and the demo must show park switching, so each park needs its own staff.

| Scope | Accounts to seed |
|---|---|
| National | **1 Super Admin** (from `SUPER_ADMIN_*` in `.env`, owned by Wenura) |
| Yala | 1 Park Manager, 1 Liaison Officer, 2–3 Rangers (enough to demo nearest-available dispatch and a rejection or timeout), 1 Researcher with Yala access |
| Sinharaja | 1 Park Manager, 1 Liaison Officer, 1–2 Rangers |
| Wilpattu | 1 Park Manager, 1–2 Rangers |

Rules for the seed script:

- Use clearly fake demo identities on a reserved domain (for example `ranger1.yala@example.org`) and label them as **demo data**.
- **Do not commit plaintext passwords.** Read them from `.env` (`SUPER_ADMIN_PASSWORD`, `DEMO_ACCOUNT_PASSWORD`) and hash them with the same scrypt function the API uses. Passwords must be 12–128 characters to match the login rules. Add the variable *names* to `.env.example` with empty values.
- Make the script idempotent: re-running it updates or skips accounts and never duplicates them. The unique email constraint already enforces this.
- Seeded demo accounts can have `must_change_password = false`, so the demo isn't interrupted.
- Keep the demo account list in a team-only place, not in the public README.

---

## 7. Sign-in and session rules (all signed-in users)

**Implemented now** in the API (see [web-auth.md](./web-auth.md)):

- Email and password only; emails are normalised to lowercase.
- Passwords are 12–128 characters, stored as salted scrypt hashes.
- The session cookie `wr_session` is HttpOnly and SameSite=Lax (plus Secure in production). It lasts **7 days**, is rotated on each login and is revoked on logout. Only a SHA-256 hash of the token is stored in Neon.
- A wrong email or password always gets the same generic error message.
- There is a limit of 30 auth attempts per IP per 15 minutes.
- Requests are accepted only from the allowed origins (`APP_ORIGINS`, by default ports 5174 and 5173).

**Added by the hierarchy proposal:**

- Deactivated accounts can't sign in, and their existing sessions are revoked immediately.
- Accounts flagged with `must_change_password` can reach only the change-password page until a new password is set.

**Not implemented and still deferred:** password reset by email, email verification, MFA and social login. The "Forgot password?" link tells the user to contact an administrator. Under the hierarchy, that means their Park Manager, who can set a new temporary password in Phase B.

---

## 8. Current status: implemented vs planned

| Item | Status |
|---|---|
| Ops public home, `/login`, `/register`, `/dashboard`, 404 | ✅ Implemented |
| Real accounts and sessions in Neon (`auth_users`, `auth_sessions`) | ✅ Implemented |
| Self-registration as Researcher with no park | ✅ Implemented |
| Ops dashboard shows identity, role and a "park access pending" message | ✅ Implemented |
| `SUPER_ADMIN` role, deactivation, first-login password flag (migration `0002`) | 📝 Proposed: Phase A |
| Seed script: Super Admin plus demo staff for each park | 📝 Proposed: Phase A (`tools/seed` is empty) |
| Ops *Staff accounts* and *Parks & managers* screens, plus their API | 📝 Proposed: Phase B, only after the graded modules work |
| Ranger app sign-in | ⏳ Planned. The app shell has no auth UI yet |
| Role- and park-based menus and route guards | ⏳ Planned |
| Server-side role, park and ownership checks on module APIs | ⏳ Planned (module APIs don't exist yet) |
| Parks table and the `park_id` foreign key | ⏳ Planned |
| Community form `/community/new` and the SMS mock | ⏳ Planned (M1) |
| All module screens in §4 | ⏳ Planned (M1–M4) |
| Password reset by email, email verification, MFA | ❌ Deferred by design |

---

## 9. Open decisions for the team

**Account hierarchy**

1. **Adopt the hierarchy?** Agree Phase A now and Phase B only if time allows. Then update [Shared features plan](./Shared_Features_Plan.md) §7 and [web-auth.md](./web-auth.md) to match.
2. **Super Admin and operational data:** account administration only, or also read-only analytics across all parks? Read-only national analytics fits head-office reporting, but every M4 query must then handle "all parks."
3. **More than one Park Manager per park?** The design allows it. Confirm that two managers in the same park have equal rights.
4. **Deactivated ranger with queued offline work:** accept and flag for review (recommended), or reject?
5. **Who owns the Neon database and runs the seed script** for development and the demo? Where is the demo password list kept?

**Other roles and screens**

6. **Camera-trap review:** done by the Park Manager, the Liaison Officer or both? The case study only says "staff" review the images. (M1's contract)
7. **Liaison Officer dispatch:** should collar alerts also be dispatchable to a Liaison Officer, as the case study suggests, or only to rangers? (M3's contract)
8. **Researcher park scope:** one park or several? A single `park_id` column supports only one. Access to several parks needs a small join table.
9. **Researcher view of patrol coverage:** aggregated gaps only, or nothing?
10. **Rangers on the Ops website:** block them with an "access denied" page, or show a limited dashboard?
11. **Ranger session expiry while offline:** confirm that queued records wait for re-login and keep their original user and park.
12. **Device and simulator authentication:** shared key, local-only access, or both?

Record each decision in this file and in the Shared features plan once the team agrees.
