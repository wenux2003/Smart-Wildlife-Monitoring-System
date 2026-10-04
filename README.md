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

The repository currently contains the monorepo foundation and separate Ranger,
Ops, and API shells. Domain modules, database schema/migrations and seed data,
authentication, offline synchronization, and the simulator tools are still to
be implemented.

## Repository layout

- `apps/api` — Fastify API starter and Drizzle migration location
- `apps/ranger` — React/Vite PWA shell for ranger workflows (port 5173)
- `apps/ops` — React/Vite shell for park operations (port 5174)
- `packages/shared` — shared TypeScript types, Zod schemas, and geo helpers
- `packages/ui` — shared React UI package
- `packages/offline` — Dexie/outbox package used by the Ranger App
- `tools` — planned seed-data and simulator tools
- `docker-compose.yml` — local API, Ranger, Ops, and PostGIS services

See [Group037_Implementation_Plan.md](./Group037_Implementation_Plan.md) for
the full feature and database design.

## Run locally

Requirements: Node.js 20 or newer, Corepack/pnpm, and Docker Desktop with the
Docker engine running.

1. Copy `.env.example` to `.env` and adjust local values if needed.
2. Install dependencies and generate the workspace lockfile:

   ```sh
   corepack pnpm install
   ```

3. Start the local services:

   ```sh
   docker compose up --build
   ```

The API health endpoint is available at `http://localhost:3000/health`; the
Ranger shell is at `http://localhost:5173` and Ops at
`http://localhost:5174`. Start all three development servers with
`corepack pnpm dev:all`, or start individual apps with `corepack pnpm dev:api`,
`corepack pnpm dev:ranger`, and `corepack pnpm dev:ops`.

Run checks with `corepack pnpm lint`, `corepack pnpm -r typecheck`, and
`corepack pnpm -r test`.
