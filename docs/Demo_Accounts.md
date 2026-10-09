# Demo Accounts — Wana Rakshaka

**Group 037 | For teammates testing and demonstrating the system**

These accounts exist in the team's **shared Neon database**, created by `corepack pnpm db:seed`
(see the [README](../README.md#database-migrations-and-seeding)). They are fake demo
identities on the reserved `example.org` domain. Never use real people's details here.

## Where to sign in

Start everything with `corepack pnpm dev:all`, then open:

| App | URL | Used by |
|---|---|---|
| **Ops website** | http://localhost:5174/login | Super Admin, Park Managers, Liaison Officers, Researchers |
| **Ranger app** (mobile) | http://localhost:5173 | Rangers |

To open the Ranger app on a phone, connect the phone to the same Wi-Fi and open
`http://<your-PC's-IP-address>:5173`. Find the address with `ipconfig` on Windows.

## Accounts

**Demo password for every account below: `DemoAccount123`**

| Park | Role | Email | Signs in to |
|---|---|---|---|
| Yala | Park Manager | `manager.yala@example.org` | Ops website |
| Yala | Liaison Officer | `liaison.yala@example.org` | Ops website |
| Yala | Ranger | `ranger1.yala@example.org` | Ranger app |
| Yala | Ranger | `ranger2.yala@example.org` | Ranger app |
| Yala | Ranger | `ranger3.yala@example.org` | Ranger app |
| Yala | Researcher | `researcher.yala@example.org` | Ops website |
| Sinharaja | Park Manager | `manager.sinharaja@example.org` | Ops website |
| Sinharaja | Liaison Officer | `liaison.sinharaja@example.org` | Ops website |
| Sinharaja | Ranger | `ranger1.sinharaja@example.org` | Ranger app |
| Sinharaja | Ranger | `ranger2.sinharaja@example.org` | Ranger app |
| Wilpattu | Park Manager | `manager.wilpattu@example.org` | Ops website |
| Wilpattu | Ranger | `ranger1.wilpattu@example.org` | Ranger app |
| Wilpattu | Ranger | `ranger2.wilpattu@example.org` | Ranger app |

### Super Admin

| Role | Email | Password |
|---|---|---|
| Super Admin (national, all parks) | Ask the database owner | **Not stored in the repository.** Ask the database owner. |

The Super Admin can create parks and Park Managers and manage every account, so its
password is kept only in the database owner's private `.env` (`SUPER_ADMIN_PASSWORD`). Never commit it.

## What to try with each role

| Sign in as | Try this |
|---|---|
| Super Admin | **Admin** page: list parks, create a park or a Park Manager, browse all accounts, view an account's history |
| Yala Park Manager | **Staff accounts**: create a Ranger or Liaison Officer with a temporary password, deactivate or reactivate, reset a password, grant a Researcher access to Yala. Only Yala accounts are visible |
| Yala Liaison Officer | Workspace page showing the assigned park; no admin pages |
| Yala Researcher | Workspace page; account-management pages show *access denied* |
| A Ranger, in the Ops website | Told to use the Ranger app; no Ops data |
| A Ranger, in the Ranger app | Signs in and sees their name and park |

**First sign-in flow (good for the demo):**

1. Sign in as the Yala Park Manager.
2. Create a Ranger with a temporary password.
3. Sign in as that new Ranger in the Ranger app. They are forced to choose a new password
   before reaching the home page.

## Sample data

The shared database also holds **synthetic sample data**, added by `corepack pnpm db:seed:demo`
(`apps/api/src/seed-demo-data.ts`). Yala has six months of history (April–October 2026); Wilpattu and
Sinharaja have a smaller set. Every sample incident description starts with **[Demo data]**,
and sample SMS phone numbers use the fake `+94 70 000 ….` range.

| Sign in as | Where to look | What you should see |
|---|---|---|
| `manager.yala` | **Incidents** | About 150 Yala incidents from rangers, villagers (SMS) and a camera trap, in every status from New to Resolved, with history, photos and outcome notes |
| `liaison.yala` | **Community inbox** | About 45 villager reports: SMS in the real `ELEPHANT … @ landmark` format, public-form crop and fence reports, unknown places waiting for a location, and follow-ups sent. The six newest SMS arrived through the real SMS endpoint, one of them badly formatted (`NEEDS_INFO`) |
| `liaison.yala` | **Camera review** | 24 camera-trap frames: 8 waiting for review, the rest classified |
| `manager.yala` | **Wildlife alerts** | 5 collared animals with 48 hours of movement, 3 geofence zones, and about 45 alerts with dispatch history (resolved, auto-resolved, cancelled, one broadcast). A few are open now |
| `ranger1.yala` | Ranger app **home** | A new patrol to start (Trail 4B, Southern Ridge) and a history of completed and partial patrols |
| `ranger3.yala` | Ranger app **dispatches** | One alert where the ranger is on scene, plus past accepted, rejected and timed-out dispatches |

Notes:

- The collar simulator isn't running, so after an hour the alerts module correctly raises
  **Signal lost** alerts for the sample collars. That is expected behaviour.
- The script is safe to repeat: it inserts nothing that already exists and never changes rows it
  didn't create. Park alert zones are only added to a park that has none.
- The script also gives each park the **M4 analysis geography** (an approximate rectangular boundary,
  named sectors, boundary stretches, analytics settings and the grid), drawn around the sample data so
  the hotspot map, patrol gaps and "Where to patrol next" show results. It only fills a park that has no
  boundary yet. `corepack pnpm db:seed:demo --geography-only` adds just this geography. Don't also run
  `db:seed:analytics` on the same database: its sectors would overlap these.
- `corepack pnpm db:seed:demo --remove` deletes exactly the sample rows again (the geography is kept,
  because saved reports may refer to it), together with anything
  added to them through the apps (for example, a status change on a sample incident).

## Rules for the shared database

- Anything you create is **real data in the shared database** and can't be deleted;
  accounts can only be deactivated. Give test accounts obviously fake names and
  `@example.org` emails.
- **Don't change the demo accounts' passwords** through the change-password page, or
  teammates will be locked out. If it happens, the database owner runs
  `corepack pnpm db:seed --reset-passwords`, which resets every seeded account to its
  `.env` password.
- **Don't run `db:seed` yourself** on the shared database. Only `db:migrate`.
- To change the demo password, the database owner updates `DEMO_ACCOUNT_PASSWORD` in `.env`, runs
  `corepack pnpm db:seed --reset-passwords`, and updates this file.

See also: [User groups](./User_groups.md) for who can do what, and
[Web authentication](./web-auth.md) for how sign-in works.
