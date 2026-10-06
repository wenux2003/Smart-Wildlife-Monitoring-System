# User Groups, Screens and Account Access — Wana Rakshaka (Wildlife Guardian)

**Group 037 | 6 October 2026 | Reference note: what exists now is separated from what is planned**

> **6 October 2026 update: Phase B account management and sign-in are implemented.** Accounts follow **Super Admin → Park Manager → park staff** (§2). The Ops account pages, API-side permission checks, temporary-password flow, account audit history and Ranger sign-in are implemented. This is account administration, not one of the four graded business use cases. See [web-auth.md](./web-auth.md) for routes and limitations.

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
| **Super Admin** | National admin role | Ops account administration (port 5174) | **Yes** | **No** | Bootstrap seed; then manages accounts in `/admin` |
| **Park Manager** | Staff role, also park-level admin | Ops workspace and `/staff` | **Yes** | **No** | Super Admin; manages own park staff in `/staff` |
| **Ranger** | Staff role | Ranger mobile app (PWA, port 5173) | **Yes** | **No** | Their park's Park Manager |
| **Liaison Officer** | Staff role | Operations website | **Yes** | **No** | **Their park's Park Manager** |
| **Researcher** | Partner role | Operations website | **Yes** | **Yes**, the only role that can self-register | Themselves. Park access is granted by that park's Park Manager or the Super Admin |
| **Community member / villager** | Public, not a role | SMS (mock gateway) or the public community form in the Ranger app | **No** | **No** | No account. Identified by phone number only |
| **Public visitor** | Public, not a role | Ops public home page | **No** | Can register, which makes them a Researcher | No account |
| **Government ministries and funding bodies** | External recipients | None. They receive exported PDF/CSV reports | **No** | **No** | No account |
| **Devices and simulators** (GPS collars, camera traps, SMS gateway) | System actors | Call the API directly | No user login | No | No account |

The seed creates demo accounts for the shared demonstration. After that, the Super Admin and Park Managers use their account-management screens to provision staff.

**In short:**

- **Sign-in only:** Super Admin, Park Manager, Ranger and Liaison Officer. Someone higher up the chain always creates these accounts, because a staff role and a park assignment carry operational authority.
- **Sign-up and sign-in:** Researcher only. A public visitor who registers becomes a Researcher with **no park**. They see no park data until a Park Manager or the Super Admin grants access.
- **No account:** community members, public visitors who don't register, ministries and funding bodies, and devices or simulators.

---

## 2. Account hierarchy: who creates whom

*Phase A (database rules, seed and route guard) and Phase B (account-management screens and sign-in flows) are implemented; see §2.5.*

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
7. **Audit trail.** Every account or park change records the actor, time, target user where applicable, action, and old/new values in `account_events`. Password values are never recorded.

### 2.5 Build in two phases

| Phase | What | When | Needed for the demo? |
|---|---|---|---|
| **A: foundation** ✅ *done* | Migration `0002` with `parks`, `SUPER_ADMIN` and the account flags (§3). `corepack pnpm db:seed`, which creates the Super Admin from `.env`, then Park Managers, Liaison Officers, Rangers and a Researcher for each demo park (§6.3). The route guard `app.authorize()` and `assertParkAccess()` for M1–M4. | **Done 6 October.** It unblocks every module. | **Yes** |
| **B: account management and sign-in** ✅ *done* | Ops `/admin` (park creation, Park Manager provisioning and account search/actions), `/staff` (park staff, lifecycle and Researcher access), audit history, and forced password change. Ranger `/login`, `/change-password` and protected home. API routes enforce the rules in §2.4; migration `0003_account_audit.sql` records changes. | **Implemented 6 October.** Apply migration `0003` to a database before using these endpoints. | Supporting infrastructure only; not a graded use case. |

New users receive a temporary password from their creator and must change it at first sign-in. Deactivation and password reset revoke all existing sessions.

### 2.6 Scope check against the assignment

- **This doesn't break the assignment rules.** The plans, quoting the specification and campus FAQ, say *"login/logout and privilege administration are not graded use cases."* They earn no marks, but they aren't banned.
- **It is supporting work, not an assessed business use case.** Login/logout and privilege administration receive no separate use-case marks. The four assessed workflows remain the priority, and [Shared features plan](./Shared_Features_Plan.md) §7 now records the account screens as implemented rather than deferred.
- **It isn't any member's graded use case.** Each member's marks still come from incidents (M1), patrols (M2), alerts (M3) or analytics (M4), with their main, alternate and error flows and more than 80% test coverage. Admin work must not take time from these.
- **In the report:** if the improved use-case diagram shows a Super Admin actor, justify it briefly. For example: "the case study requires several parks with different staffing, so accounts are provisioned per park under national control." Alternatively, describe it as supporting infrastructure outside the four main use cases. Group 039's design is the one being critiqued, and new actors need a reason.
- The plans quote the Assignment 02 specification and FAQ; this note did not check them directly. If unsure, confirm with the module team at a tutorial.

---

## 3. Roles in the code

The system has **five login roles**, defined in `packages/shared/src/enums.ts` and enforced by a database `CHECK` constraint (`0001_auth.sql`, widened by `0002_parks_and_account_hierarchy.sql`):

```text
SUPER_ADMIN | RANGER | PARK_MANAGER | LIAISON_OFFICER | RESEARCHER
```

Each account (`auth_users`) stores `name`, `email` (unique, lowercase), `password_hash` (salted scrypt), `role` (default `RESEARCHER`), `park_id`, `disabled_at`, `must_change_password`, `created_by` and `created_at`.

**Database rules added by migration `0002` (implemented):**

| Rule | How |
|---|---|
| `park_id` must be a real park, and a park that still has staff can't be deleted | Foreign key `auth_users_park_fk` → `parks(id)`, `ON DELETE RESTRICT` |
| Super Admin has no park; Ranger, Park Manager and Liaison Officer must have one; Researcher may or may not | Check `auth_users_park_scope_check` |
| Exactly one Super Admin | Unique partial index `auth_users_single_super_admin` |
| Deactivation (§2.4 rule 4) | `disabled_at`: sign-in, `/me` and `app.authorize()` treat a deactivated account as signed out |
| Temporary passwords (§2.4 rule 6) | `must_change_password`: `app.authorize()` returns `403 PASSWORD_CHANGE_REQUIRED`; both apps expose the forced change-password flow. Seeded demo accounts have this flag set to false |
| Who created the account | `created_by`: the seed records Super Admin → Park Manager → staff; `NULL` for self-registered accounts |
| Account audit | Migration `0003_account_audit.sql`: `account_events` records account and park changes without password values |

These rules were checked against Neon inside a rolled-back transaction (see [web-auth.md](./web-auth.md#verification)).

Public registration stays exactly as it is: always `RESEARCHER`, always `park_id = NULL`, and any role or park field in the request is rejected.

Community members, ministries and devices are **not** roles. There is deliberately no `VILLAGER` value. The shared features plan says community intake is "a small public-facing report form/mock SMS flow, not a fifth staff role."

---

## 4. Each user group in detail

### 4.1 Super Admin

**Who:** the national administrator at Department of Wildlife Conservation head office. In this project it is **Wenura**, and in the demo it is the seeded Super Admin account.

**App:** Operations website.

**Account:**

- **Sign in: yes.** **Sign up: no.**
- Exactly one account is created by the bootstrap seed script from `.env` (§2.4 rule 5). It has `role = SUPER_ADMIN` and `park_id = NULL`.

**Screens:**

| Area | Route | Purpose | Status |
|---|---|---|---|
| Account administration | `/admin` | Two tabs: **Parks & managers** and **All accounts**; create parks and staff, manage status/password/role/park, and grant Researcher access | Implemented |
| Change password | `/change-password` | Required for a temporary-password account; available to signed-in users | Implemented |

**Can do:** create parks; create Park Managers, Rangers and Liaison Officers in any park; manage accounts and Researcher access; view account audit history.
**Cannot do:** view operational park data, analytics, patrols, incidents or alerts. The Super Admin is an account administrator, not an operational role.

---

### 4.2 Park Manager

**Who:** the officer in charge of one park. They oversee operations, assign patrols, handle wildlife alerts and produce reports for head office, ministries and funding bodies. **They are also the account admin for their park** (§2).

**App:** Operations website (`apps/ops`, port 5174), a desktop dashboard.

**Account:**

- **Sign in: yes.** **Sign up: no.**
- **Created by the Super Admin**, with `role = PARK_MANAGER` and a `park_id`. Managers have the widest operational authority in their park, so the account must never be self-created.

**Screens:**

| Area | Route | Purpose | Owner |
|---|---|---|---|
| Dashboard | `/dashboard` | Identity, park, summary cards from each module, shortcuts | Shared |
| **Staff accounts** | `/staff` | Create and list own-park Rangers and Liaison Officers; deactivate/reactivate them; reset passwords; grant/remove Researcher access; view audit history | Implemented |
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

If a Ranger signs in to the Ops website, Ops shows a short "Rangers use the Ranger app" page with an app link and sign-out. It exposes no Ops data.

**Account:**

- **Sign in: yes.** **Sign up: no.**
- **Created by their park's Park Manager** (or the Super Admin), with `role = RANGER` and that park's `park_id`. A self-registered account always becomes a Researcher, so a ranger account can't be made that way.
- At first sign-in the ranger sets their own password, replacing the temporary one (§2.4 rule 6).
- The ranger should sign in **while online, before going into the field**. Sessions last seven days. Offline records must stay attached to the original user and park, even if the session expires before sync (Shared features plan §2). If the session has expired, the outbox should wait for the ranger to sign in again rather than discard or reassign the work.
- If a ranger is deactivated, work they recorded **before** deactivation and still queued offline should still be accepted and attributed to them. The server should flag it for the Park Manager to review rather than silently drop it. Confirm this in §9.

**Sign-in screens** (implemented; business workflow screens remain planned):

| Area | Route | Purpose | Owner |
|---|---|---|---|
| Sign in | `/login` | Email/password sign-in; online connection required | Shared |
| Change password | `/change-password` | Mandatory for a temporary-password account; session is rotated | Shared |
| Home | `/` | Signed-in identity, assigned park, connection status and sign-out | Shared |
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

**Status today:** Ranger sign-in, forced password change and protected home are implemented. Offline authentication and record synchronization are not part of this work; the ranger must sign in while connected.

---

### 4.4 Liaison Officer

**Who:** the officer who handles reports from villagers about human-elephant conflict and other community issues, and coordinates the response.

The case study (p. 2) says that when a collared elephant enters a high-risk zone, "a ranger **or community liaison officer** can be dispatched." The current plan sends only rangers to collar alerts (M3). The team should either support dispatching a Liaison Officer or record why it doesn't (see §9). If it does, the Liaison Officer also needs to see dispatches assigned to them.

**App:** Operations website.

**Account:**

- **Sign in: yes.** **Sign up: no.**
- **Created by their park's Park Manager** (or the Super Admin), with `role = LIAISON_OFFICER` and a `park_id`. They change the temporary password at first sign-in.

**Planned screens:**

| Area | Route | Purpose | Owner |
|---|---|---|---|
| Dashboard | `/dashboard` | Single home page showing identity and assigned park; no operational modules are implemented yet | Shared |
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
- A new Researcher has **no park access**. The workspace says park access is pending. **The Park Manager of the park they want to study, or the Super Admin, grants access** (§2.3) through `/staff` or `/admin`.
- For the demo, a Researcher account **with a park already assigned** is seeded so analytics can be shown immediately (§6.3).

**Planned screens:**

| Area | Route | Purpose | Owner |
|---|---|---|---|
| Dashboard | `/dashboard` | Single home page showing identity and park access status; no operational modules are implemented yet | Shared |
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

✅ = allowed  ·  👁 = read-only  ·  — = no access  ·  **own** = only their own records  ·  **park** = own park only

| Screen / feature | Public | Community | Ranger | Liaison Officer | Researcher | Park Manager | Super Admin |
|---|---|---|---|---|---|---|---|
| Ops public home, login, register | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ops `/dashboard` workspace | — | — | Guidance page only | ✅ | ✅ | ✅ | — |
| Ops `/admin` parks and all accounts | — | — | — | — | — | — | ✅ |
| Ops `/staff` own-park staff and Researcher access | — | — | — | — | — | ✅ park | — |
| Ops account audit history | — | — | — | — | — | ✅ own park | ✅ all |
| Change temporary password | — | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| Community form `/community/new` / SMS | ✅ | ✅ | — | — | — | — | — |
| Ranger: report incident | — | — | ✅ | — | — | — | — |
| Ranger: incident list/detail | — | — | **own** | — | — | — | — |
| Ranger: patrol screens | — | — | **own assigned** | — | — | — | — |
| Ranger: dispatch accept/arrive/resolve | — | — | **own assigned** | ❓ (§4.4) | — | — | — |
| Ops: incidents list/detail | — | — | — | ✅ park | — | ✅ park | — |
| Ops: camera-trap review | — | — | — | To be agreed in M1 | — | To be agreed in M1 | — |
| Ops: conflict inbox | — | — | — | ✅ park | — | Read-only if agreed in M1 | — |
| Ops: patrol assignment | — | — | — | — | — | ✅ park | — |
| Ops: patrol coverage/tracks | — | — | — | — | Aggregated gaps only if agreed | ✅ park | — |
| Ops: alerts, dispatch, broadcast | — | — | — | — | — | ✅ park | — |
| Ops: collar diagnostics | — | — | — | — | — | ✅ park | — |
| Ops: analytics and conflict trends | — | — | — | — | 👁 allowed parks | ✅ park | — |
| Ops: PDF/CSV export | — | — | — | — | ✅ allowed parks | ✅ park | — |
| Ops: park settings | — | — | — | — | — | ✅ park | — |
| **Ops: staff accounts** (`/staff`) | — | — | — | — | — | ✅ park (Rangers, Liaison Officers, Researcher access) | — |
| **Ops: parks & account administration** (`/admin`) | — | — | — | — | — | — | ✅ |
| Change own password | — | — | ✅ | ✅ | ✅ | ✅ | ✅ |

Every check above must be enforced **by the API** on each request, using the session's role, park and record ownership. Hiding a menu item or protecting a client route is **not** enough (web-auth.md).

---

## 6. Pre-created accounts

### 6.1 Which accounts are created for the user

| Role | Pre-created? | Created by | Reason |
|---|---|---|---|
| Super Admin | **Must** | Bootstrap seed script, once | Someone has to exist before anyone can create accounts |
| Park Manager | **Must** | Super Admin, using `/admin` | Highest operational authority in a park; never self-created |
| Ranger | **Must** | Their park's Park Manager, using `/staff` (or Super Admin) | Registration can't assign this role; it needs a park |
| Liaison Officer | **Must** | Their park's Park Manager, using `/staff` (or Super Admin) | Handles personal data such as villagers' phone numbers |
| Researcher | Optional | Self-registered; park access granted by Park Manager or Super Admin | Self-registered accounts have no park; a seeded one with a park makes the demo smoother |

The initial shared demo identities are seeded. For subsequent accounts, use `/admin` or `/staff`; never create or delete staff records directly in production data.

### 6.2 What exists today

- **`corepack pnpm db:seed` is implemented** (`apps/api/src/seed.ts`, with its logic in `apps/api/src/modules/reference/seed.ts`). It creates the parks, the Super Admin and the demo staff below. **It was run on the shared Neon database on 6 October 2026** by its owner (Wenura): 3 parks and 14 accounts were created, and sign-in was verified for the Super Admin and a ranger. Teammates only run `db:migrate`.
- Self-registration on the Ops website still produces a Researcher with no park.
- `corepack pnpm auth:check` creates a temporary test account and then deletes it. It is a smoke test, not a seed.

### 6.3 Demo seed accounts (what `db:seed` creates)

Parks: **Yala**, **Sinharaja** and **Wilpattu**. The demo must show park switching, so each park has its own staff.

| Scope | Accounts | Emails |
|---|---|---|
| National | **1 Super Admin** (owned by Wenura) | `SUPER_ADMIN_EMAIL` from `.env` |
| Yala | 1 Park Manager, 1 Liaison Officer, 3 Rangers (enough to demo nearest-available dispatch and a rejection or timeout), 1 Researcher with Yala access | `manager.yala@example.org`, `liaison.yala@…`, `ranger1.yala@…` to `ranger3.yala@…`, `researcher.yala@…` |
| Sinharaja | 1 Park Manager, 1 Liaison Officer, 2 Rangers | `manager.sinharaja@example.org`, `liaison.sinharaja@…`, `ranger1.sinharaja@…`, `ranger2.sinharaja@…` |
| Wilpattu | 1 Park Manager, 2 Rangers | `manager.wilpattu@example.org`, `ranger1.wilpattu@…`, `ranger2.wilpattu@…` |

How the seed behaves:

- All demo identities use the reserved `example.org` domain and are named "Demo …", so they are clearly **demo data**.
- **No plaintext passwords are committed.** They come from `.env` (`SUPER_ADMIN_PASSWORD`, `DEMO_ACCOUNT_PASSWORD`) and are hashed with the API's own scrypt function. Both must be 12–128 characters. Only the variable *names* are in `.env.example`.
- **Re-running is safe.** It updates names, roles and parks, and never duplicates accounts. Existing passwords are kept unless you pass `--reset-passwords`. `--no-demo` creates only the parks and the Super Admin.
- It refuses to create a second Super Admin with a different email.
- `created_by` follows the hierarchy: the Super Admin created the Park Managers and the Researcher, and each Park Manager created their park's Rangers and Liaison Officer.
- Seeded accounts have `must_change_password = false`, so the demo isn't interrupted.
- Share the demo passwords privately within the team; the emails aren't secret.

---

## 7. Sign-in and session rules (all signed-in users)

**Implemented now** in the API (see [web-auth.md](./web-auth.md)):

- Email and password only; emails are normalised to lowercase.
- Passwords are 12–128 characters, stored as salted scrypt hashes.
- The session cookie `wr_session` is HttpOnly and SameSite=Lax (plus Secure in production). It lasts **7 days**, is rotated on each login and is revoked on logout. Only a SHA-256 hash of the token is stored in Neon.
- A wrong email or password always gets the same generic error message.
- There is a limit of 30 auth attempts per IP per 15 minutes.
- Requests are accepted only from the allowed origins (`APP_ORIGINS`, by default ports 5174 and 5173).

**Account hierarchy and password handling (implemented):**

- Deactivated accounts can't sign in; deactivation and password reset revoke all existing sessions immediately.
- New staff receive a creator-provided temporary password, and every app forces a change before other pages or API routes.
- Password changes verify the current password, rotate the active session and write a `PASSWORD_CHANGED` audit event.
- Account and park changes are recorded in `account_events` by migration `0003`.

**Not implemented and still deferred:** password reset by email, email verification, MFA and social login. The "Forgot password?" link tells the user to contact an administrator. A Park Manager or Super Admin can set a new temporary password from their account page.

---

## 8. Current status: implemented vs planned

| Item | Status |
|---|---|
| Ops public home, `/login`, `/register`, role-aware `/dashboard`, `/admin`, `/staff`, `/change-password`, access denied and 404 | ✅ Implemented |
| Real accounts and sessions in Neon (`auth_users`, `auth_sessions`) | ✅ Implemented |
| Self-registration as Researcher with no park | ✅ Implemented |
| Ops workspace shows identity and park/access-pending status for Park Managers, Liaison Officers and Researchers | ✅ Implemented |
| `parks` table, `park_id` foreign key, `SUPER_ADMIN` role, deactivation and first-login password flag (migration `0002`) | ✅ Implemented (Phase A) |
| Account change audit trail (`account_events`, migration `0003`) | ✅ Implemented |
| Super Admin park/account administration; Park Manager staff and Researcher-access administration | ✅ Implemented (Phase B) |
| Temporary password, mandatory change, session rotation and password reset/deactivation revocation | ✅ Implemented in Ops, Ranger and API |
| Ranger sign-in, Ranger-only protected home, online requirement and sign-out | ✅ Implemented |
| Migration runner that applies each numbered file once (`schema_migrations`) | ✅ Implemented (Phase A) |
| `db:seed`: parks, the Super Admin and demo staff for each park | ✅ Implemented (Phase A). Run on the shared Neon database on 6 October |
| Shared server-side guard `app.authorize({ roles })` and `assertParkAccess()` | ✅ Implemented (Phase A). M1–M4 must use it on every route |
| Apply migration `0003_account_audit.sql` to the shared Neon database | ⏳ Pending Wenura's approval; do not run `db:migrate` on Neon before approval |
| Offline authentication, offline account changes and synchronization | ❌ Out of scope; Ranger sign-in requires a connection |
| Role, park and ownership checks inside each module's routes | ⏳ Planned. The module APIs don't exist yet; they must call the guard |
| Community form `/community/new` and the SMS mock | ⏳ Planned (M1) |
| All module screens in §4 | ⏳ Planned (M1–M4) |
| Password reset by email, email verification, MFA | ❌ Deferred by design |

---

## 9. Open decisions for the team

**Decisions made 6 October 2026**

1. **Phase B:** build and use the account-management screens. Done; the [Shared features plan](./Shared_Features_Plan.md) §7 is updated.
2. **Super Admin and operational data:** account administration only. No operational park data or analytics.
4. **Deactivated Ranger with queued offline work:** accept work recorded before deactivation and flag it for Park Manager review rather than dropping it. M2 must implement and test this during offline sync; it is not part of account-management code.
10. **Rangers on the Ops website:** show the "Rangers use the Ranger app" page with a link and sign-out; do not show a limited operational dashboard.

**Remaining decisions**

3. **More than one Park Manager per park?** The design allows it. Confirm that two managers in the same park have equal rights.
5. **Who owns the Neon database and runs the seed script** for development and the demo? Where is the demo password list kept?

**Other roles and screens**

6. **Camera-trap review:** done by the Park Manager, the Liaison Officer or both? The case study only says "staff" review the images. (M1's contract)
7. **Liaison Officer dispatch:** should collar alerts also be dispatchable to a Liaison Officer, as the case study suggests, or only to rangers? (M3's contract)
8. **Researcher park scope:** one park or several? A single `park_id` column supports only one. Access to several parks needs a small join table.
9. **Researcher view of patrol coverage:** aggregated gaps only, or nothing?
11. **Ranger session expiry while offline:** confirm that queued records wait for re-login and keep their original user and park.
12. **Device and simulator authentication:** shared key, local-only access, or both?

Record each decision in this file and in the Shared features plan once the team agrees.
