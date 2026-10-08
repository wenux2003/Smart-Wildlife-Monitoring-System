# Wana Rakshaka — Wildlife Guardian

A Smart Wildlife Monitoring System for Sri Lankan wildlife conservation, built by **Group 037, SLIIT Malabe**, for **SE3070 — Case Studies in Software Engineering**, based on the reviewed Group 039 design.

The project brings together incident reporting, ranger patrols, wildlife collar alerts, and conservation analytics. It includes a mobile Ranger app for field work and an Operations website for park staff and researchers. SMS and collar telemetry use simulated inputs for the academic prototype.

## Team and responsibilities

| Member | Part | Summary |
|---|---|---|
| Tharushi | **M1 — Wildlife incidents** | Incident reporting with location and photos, offline capture, community reports, and camera-image review. |
| Adeesha | **M2 — Ranger patrols** | Patrol assignments, GPS tracking, waypoints, offline synchronization, and patrol coverage. |
| Thisal | **M3 — Wildlife and collar alerts** | Simulated collar telemetry, geofence and device alerts, ranger dispatch, and response tracking. |
| Wenura Kavinda | **M4 — Analytics and reports** | Filtered statistics, trends, hotspots, patrol gaps, and PDF/CSV reports. |

These are module responsibilities; detailed scope and implementation notes are in the [project plan](docs/Group037_Implementation_Plan.md).

## Technology and structure

React, TypeScript and Vite power both apps; Fastify provides the API. PostgreSQL/PostGIS stores operational and spatial data, with Drizzle schemas and Dexie/IndexedDB for offline field storage.

| Directory | Purpose |
|---|---|
| `apps/ops` | Operations website |
| `apps/ranger` | Ranger mobile web app / PWA |
| `apps/api` | API, database migrations and seed scripts |
| `packages/shared` | Shared types and validation |
| `packages/ui` | Shared UI and map components |
| `packages/offline` | Local storage and synchronization support |
| `tools` | Telemetry simulators |
| `docs` | Setup guides, module plans and project notes |

## Run locally

Requires **Node.js 22+**, **Corepack/pnpm**, and a PostgreSQL database with **PostGIS**. The team uses Neon; follow the [database setup guide](docs/neon-setup.md) for configuration and optional Docker setup.

1. Clone the repository and open its root directory.
2. If `.env` does not exist, copy `.env.example` to `.env`. Configure your `DATABASE_URL` and enable PostGIS using the setup guide. Keep credentials out of Git.
3. Install dependencies, check the database, and apply migrations:

   ```sh
   corepack pnpm install
   corepack pnpm db:check
   corepack pnpm db:migrate
   ```

4. Start the API and both apps:

   ```sh
   corepack pnpm dev:all
   ```

| App | Local URL |
|---|---|
| Operations | http://localhost:5174 |
| Ranger | http://localhost:5173 |
| API health | http://localhost:3000/health |

Keep the terminal running; press **Ctrl+C** to stop. To run services separately, use `corepack pnpm dev:api`, `corepack pnpm dev:ops`, or `corepack pnpm dev:ranger`.

### Database migrations and seeding

Run `corepack pnpm db:migrate` after pulling new migrations. The shared database is already seeded; teammates should not reseed it. For a new personal database, configure the seed settings described in [web authentication](docs/web-auth.md) and run `corepack pnpm db:seed` once. See [demo accounts and sample-data notes](docs/Demo_Accounts.md) for sign-in details and seed rules.

### Development checks

```sh
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

## Documentation

- [Project scope and architecture](docs/Group037_Implementation_Plan.md)
- [Assignment requirements](docs/Group037_Assignment02_Plan.md)
- [Roles and permissions](docs/User_groups.md)
- [Authentication](docs/web-auth.md) · [Database setup](docs/neon-setup.md) · [Demo accounts](docs/Demo_Accounts.md)
- [M1 — Incidents](docs/M1_Incident_Implementation_Codex.md)
- [M2 — Patrols](docs/Ranger_Patrol_Group039_Plan.md)
- [M3 — Collars, alerts and dispatch](docs/Group037_Implementation_Plan.md#m3-collars-alerts-and-dispatch)
- [M4 — Analytics and export](docs/M4_Analytics_and_Export_Plan.md)
- [Implementation audit](docs/Implementation_Audit_2026-10-08.md)
