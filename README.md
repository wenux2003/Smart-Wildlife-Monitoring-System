# Smart-Wildlife-Monitoring-System

# Wana Rakshaka — Wildlife Guardian

A digital platform for the Department of Wildlife Conservation of Sri Lanka.
Rangers log patrols and incidents from an offline-first mobile web app, villagers
report human-elephant conflict by SMS or a basic app, GPS collar data triggers
geofence alerts, and park managers get an operations dashboard with patrol
coverage, hotspot maps, and conservation reports.

Built for SE3070 — Case Studies in Software Engineering (Group 037, SLIIT
Malabe). Reviewed design: Group 39.

## Project status

| Area | Status |
|---|---|
| Ops public website, registration, email/password sign-in and sign-out | ✅ Done |
| Ranger app sign-in, forced first-login password change and home page | ✅ Done |
| Account hierarchy: Super Admin → Park Manager → staff | ✅ Done |
| Super Admin page (parks, Park Managers, all accounts) and Park Manager staff page | ✅ Done |
| Deactivate/reactivate, temporary-password reset and account audit history | ✅ Done |
| Server-side access checks (`app.authorize()`, `assertParkAccess()`) | ✅ Done |
| Migrations, seed, demo accounts and required CI checks on `main` | ✅ Done |
| Ranger patrol route/assignment database, authenticated API and assignment UI (M2 foundation) | ✅ Done |
| Ranger patrol start/GPS/waypoints/end and idempotent sync (M2) | ✅ Done |
| Patrol offline storage/recovery and shared patrol map | ✅ Done |
| Incidents (M1), patrol coverage/manager tools, alerts (M3), analytics and reports (M4) | ⏳ Not started |

Details: [web authentication](./docs/web-auth.md), [user groups](./docs/User_groups.md)
and [demo accounts](./docs/Demo_Accounts.md).

## Repository layout

- `apps/api` — Fastify API starter and Drizzle migration location
- `apps/ranger` — React/Vite PWA shell for ranger workflows (port 5173)
- `apps/ops` — React/Vite shell for park operations (port 5174)
- `packages/shared` — shared TypeScript types, Zod schemas, and geo helpers
- `packages/ui` — shared React UI package
- `packages/offline` — Dexie/outbox package used by the Ranger App
- `tools` — planned simulator tools (the account and park seed lives in `apps/api/src/seed.ts`)
- `docker-compose.yml` — local API, Ranger, Ops, and PostGIS services

See [Group037_Implementation_Plan.md](./docs/Group037_Implementation_Plan.md) for
the full feature and database design.

## Run locally

With Neon, Docker and a local PostgreSQL installation are optional. Follow
[Neon setup](./docs/neon-setup.md) to configure the hosted database.

Requirements: Node.js 22 or newer, Corepack/pnpm, and internet access for Neon.

1. If `.env` does not exist, copy `.env.example` to `.env`. Set `DATABASE_URL`
   to your private Neon connection URL and enable PostGIS in that database.
2. Install dependencies:

   ```sh
   corepack pnpm install
   ```

3. Check the database connection and bring the schema up to date:

   ```sh
   corepack pnpm db:check
   corepack pnpm db:migrate
   ```

   `db:migrate` is safe to repeat. Run it again after every `git pull` that
   adds a migration.

4. Seed parks and accounts **only if your database has none yet**. The shared
   Neon database is already seeded, so teammates skip this step. See
   [Database: migrations and seeding](#database-migrations-and-seeding).
5. Start the API, the Ops website and the Ranger app together:

   ```sh
   corepack pnpm dev:all
   ```

   Keep this terminal open. Press **Ctrl+C** to stop everything.

### Open the website and app

| What | URL | Who uses it |
|---|---|---|
| **Ops website** | http://localhost:5174 (sign in at `/login`) | Super Admin, Park Managers, Liaison Officers, Researchers |
| **Ranger app** (mobile) | http://localhost:5173 | Rangers |
| API health check | http://localhost:3000/health | Should return `{"status":"ok"}` |

Demo accounts, the demo password and what to try with each role are in
**[docs/Demo_Accounts.md](./docs/Demo_Accounts.md)**.

**On a phone:** connect it to the same Wi-Fi as your PC and open
`http://<your-PC's-IP-address>:5173` (find the address with `ipconfig`). The
dev servers already listen on your network; allow Node.js through the Windows
firewall if asked.

**Start one part at a time** (each in its own terminal):

```sh
corepack pnpm dev:api      # API on port 3000 (loads the root .env)
corepack pnpm dev:ops      # Ops website on port 5174
corepack pnpm dev:ranger   # Ranger app on port 5173
```

The website and app send `/api` requests to the API on port 3000, so **the API
must be running** for sign-in to work.

**If something doesn't work**

| Problem | Fix |
|---|---|
| Sign-in says *"The account service is unavailable"* | The API isn't running. Start `corepack pnpm dev:api` (or `dev:all`) and check http://localhost:3000/health |
| Sign-in says *"Account service is temporarily unavailable"* | The database is missing a migration. Run `corepack pnpm db:migrate` |
| *"Port 5173/5174 is already in use"* | That app is already running in another terminal. Use it, or stop it with Ctrl+C first |
| Install fails with an engine error | Use Node.js 22 or newer (`node --version`) |

Never put database credentials in frontend environment variables.

Docker remains an optional alternative: use `docker compose -f
docker-compose.neon.yml up --build` for apps with Neon, or `docker compose up
--build` for apps with local PostGIS. These commands require Docker Desktop.

Run checks with `corepack pnpm lint`, `corepack pnpm typecheck`, and
`corepack pnpm test`. These are the same commands CI runs.

## CI and the protected `main` branch

`main` is protected. Changes reach it only through a pull request, and the PR
can be merged only when all three CI jobs in
[`.github/workflows/ci.yml`](./.github/workflows/ci.yml) pass:

| Check | What it verifies |
|---|---|
| **Lint, typecheck, test and build** | The lockfile is up to date (`--frozen-lockfile`); no `.env` file is committed; ESLint; TypeScript for every package; all Vitest tests; and production builds of Ops and Ranger |
| **Migrations, seed and sign-in** | On a fresh PostGIS database: all migrations apply and re-run cleanly; the seed runs twice without creating duplicates; the API starts; Super Admin creates a Park Manager, the manager creates a Ranger, and the temporary-password flow completes; seeded sign-in and wrong-password behavior are checked |
| **Secret scan** | gitleaks finds no keys or tokens in the commits |

**Day-to-day workflow:**

1. Create a branch from the latest `main`, e.g. `git switch -c m4-analytics`.
2. Before pushing, run `corepack pnpm lint`, `corepack pnpm typecheck` and
   `corepack pnpm test`.
3. Push and open a pull request into `main`. Wait for all checks to pass, then merge.
4. If you add a dependency, commit the updated `pnpm-lock.yaml`; CI refuses an
   out-of-date lockfile.
5. If you add a migration, the database job proves it applies and re-runs
   cleanly on a fresh database.

CI uses **Node.js 22**, the minimum this project supports, because a test
dependency requires it.

## Database: migrations and seeding

Run every command from the repository root. They read `DATABASE_URL` and the
other settings from the root `.env`.

| Command | What it does | Who runs it, and when |
|---|---|---|
| `corepack pnpm db:check` | Connects to the database and reports whether PostGIS is enabled | Anyone, when setting up or if the connection fails |
| `corepack pnpm db:migrate` | Creates or updates the tables, applying each file in `apps/api/drizzle/` once, in order | **Everyone**: once at setup, and **after every `git pull` that adds a migration** |
| `corepack pnpm db:seed` | Creates the parks (Yala, Sinharaja, Wilpattu), the single Super Admin and the demo staff accounts | **Only the database owner**, once per database (see below) |

### Migrations

- `db:migrate` is safe to run at any time on approved databases. Migrations that have already run
  are skipped, and every migration is idempotent. Running it again prints
  `Database schema is already up to date.`
- If sign-in suddenly says *"Account service is temporarily unavailable"*
  after a pull, the database is probably missing a new migration. Run
  `corepack pnpm db:migrate`.
- **Adding a table or column (module owners):** create a new numbered file
  such as `apps/api/drizzle/0004_incidents.sql`, using the next free number.
  Write it to be idempotent (`CREATE TABLE IF NOT EXISTS`,
  `ADD COLUMN IF NOT EXISTS`). Update the matching Drizzle schema file, run
  `db:migrate`, and commit both. **Never edit a migration that has already
  been committed**; add a new one instead.
- Migration `0003_account_audit.sql` adds account history. It is already
  applied to the shared Neon database.
- Applied migrations are recorded in the `schema_migrations` table.

### Seeding accounts

There is no sign-up for staff. Rangers, Park Managers and Liaison Officers are
created by the seed, following the hierarchy **Super Admin → Park Manager →
park staff** in [User groups](./docs/User_groups.md#2-account-hierarchy-who-creates-whom).

**If the team shares one Neon database (the normal setup):**

- **The database owner** seeds it once. Nobody else needs to run `db:seed`.
- Everyone else only needs `DATABASE_URL` in their `.env` and to run
  `db:migrate`. They sign in with the demo accounts listed in
  [docs/Demo_Accounts.md](./docs/Demo_Accounts.md), which has the demo password.
- If someone else runs `db:seed` with a different `SUPER_ADMIN_EMAIL`, it stops
  with *"A Super Admin already exists"* and changes nothing.

**If you use your own database** (a personal Neon branch or local Docker
PostGIS), seed it yourself and become that database's Super Admin.

**To seed a database:**

1. Add these to your `.env`. Passwords must be 12–128 characters. **Never commit them.**

   ```sh
   SUPER_ADMIN_EMAIL=you@example.com
   SUPER_ADMIN_NAME=Your Name
   SUPER_ADMIN_PASSWORD=choose-a-long-passphrase
   DEMO_ACCOUNT_PASSWORD=another-long-passphrase
   ```

2. Run the migration first, then the seed:

   ```sh
   corepack pnpm db:migrate
   corepack pnpm db:seed
   ```

3. The seed prints a table of every account and whether it was `created` or
   `updated`. Passwords are never printed. Sign in at
   http://localhost:5174/login.

Re-running `db:seed` is safe. It updates names, roles and parks, never
duplicates accounts, and **keeps existing passwords**. Options:

```sh
corepack pnpm db:seed --reset-passwords   # reset all seeded accounts to the .env passwords
corepack pnpm db:seed --no-demo           # create only the parks and the Super Admin
```

**Demo accounts** (password, URLs and what to test: [docs/Demo_Accounts.md](./docs/Demo_Accounts.md)). All use `DEMO_ACCOUNT_PASSWORD`, and all are demo data on
the reserved `example.org` domain.

| Park | Park Manager | Liaison Officer | Rangers | Researcher |
|---|---|---|---|---|
| Yala | `manager.yala@example.org` | `liaison.yala@example.org` | `ranger1.yala@example.org` – `ranger3.yala@example.org` | `researcher.yala@example.org` |
| Sinharaja | `manager.sinharaja@example.org` | `liaison.sinharaja@example.org` | `ranger1.sinharaja@example.org`, `ranger2.sinharaja@example.org` | — |
| Wilpattu | `manager.wilpattu@example.org` | — | `ranger1.wilpattu@example.org`, `ranger2.wilpattu@example.org` | — |

The Super Admin signs in with `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD`.
A self-registered account at `/register` is always a Researcher with no park.

### Creating staff and setting their passwords

After signing in to Ops, the Super Admin opens **Parks & managers** in `/admin`
to create parks and Park Managers. The **All accounts** tab can create Rangers
and Liaison Officers in any park and manage account role/park assignments.
A Park Manager opens **Staff accounts** at `/staff` to create and manage only
Rangers and Liaison Officers in their own park, and to grant or remove that
park's access for Researchers.

When creating an account or resetting its password, the administrator enters a
temporary password of 12–128 characters and gives it to the user directly.
There is no email delivery. At the user's first sign-in, Ops or Ranger requires
them to choose a different password before proceeding. Initial Ranger sign-in
requires an internet connection; a previously authenticated Ranger can resume
an IndexedDB-backed active patrol after an offline reload. Deactivated
accounts are not deleted, and their existing sessions are revoked immediately.

**Common seed messages**

| Message | Fix |
|---|---|
| `Seed stopped: Set SUPER_ADMIN_EMAIL in the root .env.` (or another variable) | Add the missing variable to `.env` |
| `... must be 12–128 characters.` | Use a longer password |
| `The parks table is missing. Run corepack pnpm db:migrate first.` | Run `db:migrate`, then seed again |
| `A Super Admin already exists (...)` | This database is already seeded; ask its owner for access instead |

More detail: [web authentication](./docs/web-auth.md#accounts-and-the-seed) and
[how module routes check roles and parks](./docs/web-auth.md#protecting-module-routes-m1m4).
