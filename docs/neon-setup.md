# Neon PostgreSQL setup

Neon replaces the local PostgreSQL host. Keep the existing Fastify API, postgres driver, Drizzle ORM, shared packages and frontend architecture. Neon supports PostGIS; enable it in the selected database. No Neon-specific driver is required for this ordinary Node API.

## Configure your database

1. Create a Neon project, select a suitable nearby region and create/select the development database. Prefer PostgreSQL 16 to match the existing local setup if available.
2. Open Connect, select the intended branch/database/role and copy its PostgreSQL connection URL. A pooled URL is suitable for application connections; preserve the supplied TLS parameters. A direct URL can be used for migration tooling when required.
3. Set `DATABASE_URL` in the existing root `.env` to that URL. Edit the file locally; do not put the password in Markdown, Git, frontend variables or chat. `.env` is already ignored by Git. The example URL in `.env.example` is only a placeholder.
4. In the Neon SQL Editor, select that same branch/database and run:

   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   SELECT PostGIS_Version();
   ```

5. Install the project dependencies if necessary, then run the read-only connection check from the repository root (Node 20.6+ for `--env-file`):

   ```sh
   corepack pnpm install
   corepack pnpm db:check
   ```

The check reads the root `.env`, connects using the existing postgres dependency, checks PostGIS and closes its connection. It does not create tables or change data. Do not use a successful `/health` response as database proof: the current API health handler does not query a database.

On Windows, use `corepack pnpm` if `pnpm` is not on PATH. Root scripts also invoke pnpm through Corepack, so a global pnpm installation is not required. Run `corepack pnpm install` before `corepack pnpm db:check`; a missing `node_modules` warning means dependencies have not been installed. Keep pnpm for this repository: its workspace dependencies and catalog references require migration before switching package managers.

## Start with Neon

### Without Docker (team development)

Install Node.js 22 or newer and Corepack. Each teammate needs a private root
`.env` containing the intended Neon connection URL. If `.env` already exists,
edit it rather than overwriting it with the example.

From the repository root:

```sh
corepack pnpm install
corepack pnpm db:check
corepack pnpm dev:all
```

Open Ops at http://localhost:5174, Ranger at http://localhost:5173, and the API
health check at http://localhost:3000/health. Keep the terminal running and use
Ctrl+C to stop. No Docker or local PostgreSQL installation is needed.
The API development script loads the root `.env`; restart it after environment
changes. Frontend development ports are fixed by their scripts at 5173/5174.

### Optional Docker startup

```sh
docker compose -f docker-compose.neon.yml up --build
```

This standalone Compose file runs API/Ranger/Ops and injects DATABASE_URL into the API only. The original `docker-compose.yml` remains the local PostGIS alternative and deliberately uses its local `db` service instead. Do not combine these two files as overrides.

The Neon API shell receives the URL, but business persistence is still planned work: there are no business tables/migrations or domain repositories yet. Implement them in `apps/api/drizzle` and the existing API modules. Host development loads root `.env` through the API dev script; Docker supplies environment variables through Compose. The `db:check` command also loads root `.env` explicitly.

Neon requires an internet connection for API/database work. Ranger offline collection remains local IndexedDB behavior and synchronizes once the API is reachable. Keep the local PostGIS option for offline development/demo fallback.

Sources: [Neon connection documentation](https://neon.com/docs/get-started-with-neon/connect-neon) and [Neon PostGIS support](https://github.com/neondatabase/neon/discussions/1913).
