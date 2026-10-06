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

The Operations website includes a public home page, registration, real email/password
sign-in and an account workspace backed by Neon. See [web authentication](./docs/web-auth.md).
Parks, the Super Admin → Park Manager → staff account hierarchy, demo account
seeding and the shared server-side access check are in place. Ranger and the
four business modules remain foundation work. Business database schemas,
offline synchronization and simulator tools still need implementation.

## Repository layout

- `apps/api` — Fastify API starter and Drizzle migration location
- `apps/ranger` — React/Vite PWA shell for ranger workflows (port 5173)
- `apps/ops` — React/Vite shell for park operations (port 5174)
- `packages/shared` — shared TypeScript types, Zod schemas, and geo helpers
- `packages/ui` — shared React UI package
- `packages/offline` — Dexie/outbox package used by the Ranger App
- `tools` — planned seed-data and simulator tools
- `docker-compose.yml` — local API, Ranger, Ops, and PostGIS services

See [Group037_Implementation_Plan.md](./docs/Group037_Implementation_Plan.md) for
the full feature and database design.

## Run locally

With Neon, Docker and a local PostgreSQL installation are optional. Follow
[Neon setup](./docs/neon-setup.md) to configure the hosted database.

Requirements: Node.js 20.6 or newer, Corepack/pnpm, and internet access for Neon.

1. If `.env` does not exist, copy `.env.example` to `.env`. Set `DATABASE_URL`
   to your private Neon connection URL and enable PostGIS in that database.
2. Install dependencies:

   ```sh
   corepack pnpm install
   ```

3. Verify the database and bring its schema up to date:

   ```sh
   corepack pnpm db:check
   corepack pnpm db:migrate
   ```

4. Seed parks and accounts **only if your database has none yet**. See
   [Database: migrations and seeding](#database-migrations-and-seeding) below.
5. Start all three development servers:

   ```sh
   corepack pnpm dev:all
   ```

The API health endpoint is available at `http://localhost:3000/health`; the
Ranger shell is at `http://localhost:5173` and Ops at
`http://localhost:5174`. Start all three development servers with
`corepack pnpm dev:all`, or start individual apps with `corepack pnpm dev:api`,
`corepack pnpm dev:ranger`, and `corepack pnpm dev:ops`.

The API development command loads the root `.env`. Keep the terminal running;
press Ctrl+C to stop the development servers. The frontends use ports 5173 and
5174 in their development scripts. Never put database credentials in frontend
environment variables.

Docker remains an optional alternative: use `docker compose -f
docker-compose.neon.yml up --build` for apps with Neon, or `docker compose up
--build` for apps with local PostGIS. These commands require Docker Desktop.

Run checks with `corepack pnpm lint`, `corepack pnpm -r typecheck`, and
`corepack pnpm -r test`.

## Database: migrations and seeding

Run every command from the repository root. They read `DATABASE_URL` and the
other settings from the root `.env`.

| Command | What it does | Who runs it, and when |
|---|---|---|
| `corepack pnpm db:check` | Connects to the database and reports whether PostGIS is enabled | Anyone, when setting up or if the connection fails |
| `corepack pnpm db:migrate` | Creates or updates the tables, applying each file in `apps/api/drizzle/` once, in order | **Everyone**: once at setup, and **after every `git pull` that adds a migration** |
| `corepack pnpm db:seed` | Creates the parks (Yala, Sinharaja, Wilpattu), the single Super Admin and the demo staff accounts | **Only the database owner**, once per database (see below) |

### Migrations

- `db:migrate` is safe to run at any time. Migrations that have already run
  are skipped, and every migration is idempotent. Running it again prints
  `Database schema is already up to date.`
- If sign-in suddenly says *"Account service is temporarily unavailable"*
  after a pull, the database is probably missing a new migration. Run
  `corepack pnpm db:migrate`.
- **Adding a table or column (module owners):** create a new numbered file
  such as `apps/api/drizzle/0003_incidents.sql`, using the next free number.
  Write it to be idempotent (`CREATE TABLE IF NOT EXISTS`,
  `ADD COLUMN IF NOT EXISTS`). Update the matching Drizzle schema file, run
  `db:migrate`, and commit both. **Never edit a migration that has already
  been committed**; add a new one instead.
- Applied migrations are recorded in the `schema_migrations` table.

### Seeding accounts

There is no sign-up for staff. Rangers, Park Managers and Liaison Officers are
created by the seed, following the hierarchy **Super Admin → Park Manager →
park staff** in [User groups](./docs/User_groups.md#2-account-hierarchy-who-creates-whom).

**If the team shares one Neon database (the normal setup):**

- **The database owner (Wenura)** seeds it once. Nobody else needs to run `db:seed`.
- Everyone else only needs `DATABASE_URL` in their `.env` and to run
  `db:migrate`. They sign in with the demo accounts below; get the demo
  password privately from the owner.
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

**Demo accounts.** All use `DEMO_ACCOUNT_PASSWORD`, and all are demo data on
the reserved `example.org` domain.

| Park | Park Manager | Liaison Officer | Rangers | Researcher |
|---|---|---|---|---|
| Yala | `manager.yala@example.org` | `liaison.yala@example.org` | `ranger1.yala@example.org` – `ranger3.yala@example.org` | `researcher.yala@example.org` |
| Sinharaja | `manager.sinharaja@example.org` | `liaison.sinharaja@example.org` | `ranger1.sinharaja@example.org`, `ranger2.sinharaja@example.org` | — |
| Wilpattu | `manager.wilpattu@example.org` | — | `ranger1.wilpattu@example.org`, `ranger2.wilpattu@example.org` | — |

The Super Admin signs in with `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD`.
A self-registered account at `/register` is always a Researcher with no park.

**Common seed messages**

| Message | Fix |
|---|---|
| `Seed stopped: Set SUPER_ADMIN_EMAIL in the root .env.` (or another variable) | Add the missing variable to `.env` |
| `... must be 12–128 characters.` | Use a longer password |
| `The parks table is missing. Run corepack pnpm db:migrate first.` | Run `db:migrate`, then seed again |
| `A Super Admin already exists (...)` | This database is already seeded; ask its owner for access instead |

More detail: [web authentication](./docs/web-auth.md#accounts-and-the-seed) and
[how module routes check roles and parks](./docs/web-auth.md#protecting-module-routes-m1m4).
