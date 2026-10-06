# Public website and real account access

Implemented on 6 October 2026 following the user's explicit change from demo access to real email/password authentication. This addition supports, but does not replace, the four assessed workflows.

## Start without Docker

From the repository root, with your private Neon `DATABASE_URL` in `.env`:

```sh
corepack pnpm install
corepack pnpm dev:all
```

The shared Neon database already contains the seed accounts. **Do not run `db:seed` against it.** Migration `0003_account_audit.sql` has been applied to Neon (6 October 2026); run `corepack pnpm db:migrate` after pulling new migrations. Open http://localhost:5174 for Ops or http://localhost:5173 for Ranger. Demo accounts are listed in [Demo accounts](./Demo_Accounts.md).

`db:migrate` applies each numbered SQL file in `apps/api/drizzle/` once, in order, in one locked transaction, and records it in `schema_migrations`; migrations are idempotent and none drops data. `0001_auth.sql` creates `auth_users` and `auth_sessions`; `0002_parks_and_account_hierarchy.sql` adds parks, the Super Admin role and account flags; `0003_account_audit.sql` adds `account_events` and indexes on target user and creation time. `auth-schema.ts` and `reference-schema.ts` are the matching Drizzle models. Add new numbered migrations rather than editing applied ones.

## Accounts and the seed

Accounts follow the hierarchy in [User groups](./User_groups.md) §2: **Super Admin → Park Manager → park staff**. Public registration is unchanged: it always creates a `RESEARCHER` with no park, and cannot set either field.

The account hierarchy is managed in the Ops website. `corepack pnpm db:seed` is for first-time demo setup on a database that has not been seeded; the shared Neon database is already seeded. The seed creates:

- the parks Yala, Sinharaja and Wilpattu;
- the single Super Admin from `SUPER_ADMIN_*`;
- demo staff (`manager.yala@example.org`, `ranger1.yala@example.org`, and so on), all using `DEMO_ACCOUNT_PASSWORD`. Each account's `created_by` follows the hierarchy.

Re-running the seed is safe. It updates names, roles and parks but keeps existing passwords; add `--reset-passwords` to reset them to the `.env` values, or `--no-demo` to create only the parks and the Super Admin. It refuses to create a second Super Admin with a different email. Passwords are never printed or committed.

## Account administration

- Sign in to Ops as the Super Admin and use `/admin`. **Parks & managers** creates parks and Park Managers; **All accounts** searches by park/role and can create Rangers and Liaison Officers, deactivate/reactivate accounts, reset temporary passwords, update a non-Super-Admin role or park, grant/remove Researcher access, and view each account's audit history.
- A Park Manager uses `/staff` to create/list Rangers and Liaison Officers for their own park, deactivate/reactivate them, reset their passwords, and grant/remove Researcher access to that park. The API forces the manager's park and rejects attempts to act outside their permissions.
- A new account's creator sets a temporary password (12–128 characters) and gives it to the user directly. On the first sign-in, Ops and Ranger force the user to change it before any other page or protected API route. Password reset and deactivation immediately revoke all of the account's existing sessions.
- The Super Admin has account-administration access only, not operational park data. Rangers who sign into Ops see a link to the Ranger app and a sign-out control, not operational data.
- Liaison Officers and Researchers use the existing Ops account workspace as their single home page. A Researcher without a park sees pending-access status.

All account API mutations validate strict Zod request bodies and trusted origins. `GET /api/parks` returns all parks to the Super Admin and only the manager's park to a Park Manager. `GET /api/accounts?parkId=` returns the selected park to the Super Admin and always forces the Park Manager's own park. `POST /api/accounts` creates a Park Manager, Ranger or Liaison Officer, with the Park Manager limited to Rangers and Liaison Officers. Lifecycle endpoints are `POST /api/accounts/:id/deactivate`, `/reactivate` and `/reset-password`; Super Admin-only updates use `PATCH /api/accounts/:id`. `POST /api/accounts/researcher-access` grants or removes a Researcher's park access, and `GET /api/accounts/:id/events` returns permitted audit history. No account endpoint returns `password_hash`.

Each account or park change and its audit row are written in the same database transaction. The event log stores actor, target when applicable, action, timestamp and old/new public values; it never stores passwords. The Super Admin cannot deactivate their own account or change an account to/from `SUPER_ADMIN`. Park Managers cannot create or alter managers, change roles, or operate on another park.

## Protecting module routes (M1–M4)

Every module route must check access on the server. `createServer()` provides `app.authorize()` and `assertParkAccess()` in `apps/api/src/modules/auth/guard.ts`:

```ts
import { Role } from "@wr/shared";
import { assertParkAccess } from "../auth/guard.js";

app.get(
  "/api/incidents/:id",
  { preHandler: app.authorize({ roles: [Role.PARK_MANAGER, Role.LIAISON_OFFICER] }) },
  async (request) => {
    const incident = await findIncident(request.params.id);
    assertParkAccess(request.user, incident.parkId); // 403 PARK_FORBIDDEN for another park
    return incident;
  },
);
```

- `authorize()` with no roles allows any active, signed-in account; `request.user` then holds `{ id, name, email, role, parkId, parkName }`.
- Error responses:
  - `401 UNAUTHENTICATED`: no session, an expired session or a deactivated account.
  - `403 FORBIDDEN`: the role is not listed.
  - `403 PASSWORD_CHANGE_REQUIRED`: the account still has a temporary password.
  - `503 AUTH_UNAVAILABLE`: the account database can't be reached.
- The Super Admin is **not** let in automatically. List `Role.SUPER_ADMIN` only on routes it should reach. Once it is allowed on a route, `assertParkAccess` accepts every park for it.
- Filter list queries by `request.user.parkId` as well; the guard does not do that for you.
- `AppError` thrown in a route becomes `{ code, message }` with its status. Unexpected errors return a generic `500 INTERNAL_ERROR`, and their details go only to the server log.

## Account behavior

- Registration: name, normalized email, password of 12–128 characters and client confirmation. Passwords are salted with random 16-byte salts and hashed with asynchronous scrypt (N=32768, r=8, p=3).
- Sign-in: generic invalid-credential response, equivalent password derivation for unknown emails, no password/connection-string logs.
- Sessions: 32 random bytes; only SHA-256 token hashes are stored in Neon. HttpOnly, SameSite=Lax cookies expire after seven days; `NODE_ENV=production` adds Secure. A new login rotates the current session; logout revokes it. Passwords and session tokens are never kept in localStorage.
- Auth mutations require an exact allowed Origin. `APP_ORIGINS` defaults to `http://localhost:5174,http://localhost:5173`; set it explicitly for other origins. No wildcard origins.
- Thirty auth mutations per IP per 15 minutes limit repeated attempts within one API process. This in-memory limiter is a development baseline; use a shared limiter and correct trusted-proxy configuration before multi-instance public deployment.
- Ops and Ranger call relative `/api/*` paths through Vite's development proxy; `/health` is proxied too. `API_PROXY_TARGET` can override `http://localhost:3000`; Docker sets it to `http://api:3000` for both frontends.
- `/api/auth/me` validates expiry and returns only public account fields. Future module routes must validate the session and enforce role/park permissions themselves; protecting a client route is not sufficient.
- `POST /api/auth/change-password` requires the current session and current password, validates a different 12–128 character password, clears `must_change_password`, revokes other sessions, rotates the current cookie and audits `PASSWORD_CHANGED`. It is intentionally available while the temporary-password guard blocks all other protected routes.
- Ranger sign-in requires a network connection. Offline auth and sync are out of scope; the app does not save credentials locally.

Production requires HTTPS, secure cookies and same-origin reverse proxy routing for `/api`. These pages are a development implementation, not a claim of completed production security or operational modules. Email ownership verification, password reset by email, MFA and offline authentication are not implemented. The forgot-password help explicitly says no recovery email is sent. Do not treat an unverified email address as proof of identity.

## Design and accessibility

- Public hero, mission, four-module overview, process, CTA and FAQ, inspired by the structure of the supplied SafeRide reference.
- Split-screen authentication follows the supplied screenshot, using the agreed forest-green palette instead of its brown colors.
- Locally included React Bits FadeContent adds scroll reveals; CSS adds quiet background motion and hover feedback. Reduced-motion preferences disable decorative animations.
- Responsive layouts, labeled inputs, autocomplete, keyboard focus, skip link, password visibility, pending states and retryable errors.
- No fabricated metrics or claims that incomplete modules are operational.

## Verification

```sh
corepack pnpm exec vitest run
corepack pnpm lint
corepack pnpm exec tsc -b packages/shared packages/ui
corepack pnpm --filter @wr/api typecheck
corepack pnpm --filter @wr/ops typecheck
corepack pnpm --filter @wr/ops build
```

Tests cover password hashing and change, least-privilege registration, account creation/duplicate rejection, role and park boundaries, deactivation and reset session revocation, temporary-password changes, audit events, public-only account responses, UI role routing and form errors. The CI database job applies and re-runs all migrations on a fresh PostGIS database and exercises Super Admin → Park Manager → Ranger creation and the temporary-password flow. The new migration has **not** been applied to Neon; apply only after explicit approval. Prior Neon rollback checks covered migrations 0001/0002 and the seed.

With the API and Ops running on their default ports, `corepack pnpm auth:check`
creates a uniquely named temporary account through the website proxy, verifies
Neon persistence and the complete session lifecycle, then removes only that
account and its sessions. It never prints credentials.

## Third-party assets

- React Bits FadeContent: https://github.com/DavidHDev/react-bits — Copyright 2026 David Haz, MIT + Commons Clause. Full license is retained beside the local component in `apps/ops/src/components/react-bits/LICENSE.md`.
- Hero: [Sri Lankan elephant, Udawalawe NP](https://commons.wikimedia.org/wiki/File:Sri_Lankan_elephant,_Udawalawe_NP.jpg), M.S Dulan De Silva, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Local thumbnail; presentation crops, mirrors and tints the photograph. The image and these image adaptations remain under CC BY-SA 4.0. Credit is also visible in the website footer.
- Lucide icons and GSAP are package dependencies; their licenses are supplied with the packages.

Browser automation was unavailable during this implementation session, so desktop/mobile screenshots and interactive visual review remain a manual verification step. Automated DOM tests and a production build do not substitute for that review.
