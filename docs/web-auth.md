# Public website and real account access

Implemented on 6 October 2026 following the user's explicit change from demo access to real email/password authentication. This addition supports, but does not replace, the four assessed workflows.

## Start without Docker

From the repository root, with your private Neon `DATABASE_URL` in `.env`, and `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_NAME`, `SUPER_ADMIN_PASSWORD` and `DEMO_ACCOUNT_PASSWORD` set there too (see `.env.example`):

```sh
corepack pnpm install
corepack pnpm db:migrate
corepack pnpm db:seed
corepack pnpm dev:all
```

Open http://localhost:5174. Routes: `/` (public home), `/login`, `/register`, `/dashboard` (account workspace). `/signin` and `/signup` redirect to the corresponding account pages. The home page distinguishes planned modules from working account access.

`db:migrate` applies each numbered SQL file in `apps/api/drizzle/` once, in order, in one locked transaction, and records it in `schema_migrations`; every migration is also idempotent and none drops data. `0001_auth.sql` creates `auth_users` and `auth_sessions` (unique lowercase emails, session indexes, cascading session deletion). `0002_parks_and_account_hierarchy.sql` adds `parks`, the `SUPER_ADMIN` role and the `disabled_at`, `must_change_password` and `created_by` columns. It also enforces: a foreign key from `park_id` to `parks`, exactly one Super Admin, no park for the Super Admin, and a park for every Ranger, Park Manager and Liaison Officer. `auth-schema.ts` and `reference-schema.ts` are the matching Drizzle models. Add new numbered migrations rather than editing applied ones.

## Accounts and the seed

Accounts follow the hierarchy in [User groups](./User_groups.md) §2: **Super Admin → Park Manager → park staff**. Public registration is unchanged: it always creates a `RESEARCHER` with no park, and cannot set either field.

There is no account-management screen yet (Phase B). `corepack pnpm db:seed` creates:

- the parks Yala, Sinharaja and Wilpattu;
- the single Super Admin from `SUPER_ADMIN_*`;
- demo staff (`manager.yala@example.org`, `ranger1.yala@example.org`, and so on), all using `DEMO_ACCOUNT_PASSWORD`. Each account's `created_by` follows the hierarchy.

Re-running the seed is safe. It updates names, roles and parks but keeps existing passwords; add `--reset-passwords` to reset them to the `.env` values, or `--no-demo` to create only the parks and the Super Admin. It refuses to create a second Super Admin with a different email. Passwords are never printed or committed.

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
- Ops calls relative `/api/auth/*` paths through Vite's development proxy. `API_PROXY_TARGET` can override `http://localhost:3000`; Docker uses `http://api:3000`.
- `/api/auth/me` validates expiry and returns only public account fields. Future module routes must validate the session and enforce role/park permissions themselves; protecting a client route is not sufficient.

Production requires HTTPS, secure cookies and same-origin reverse proxy routing for `/api`. These pages are a development implementation, not a claim of completed production security or operational modules. Email ownership verification, password reset, MFA and account-management screens are not implemented; accounts come from `db:seed` until then. The forgot-password help explicitly says no recovery email is sent. Do not treat an unverified email address as proof of identity.

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

Tests cover password hashing, least-privilege registration, normalized duplicates, rejected role fields, origin checks, bad credentials, cookie flags, session rotation/expiry/revocation, rate limits, private error responses, the route guard (roles, deactivated accounts, temporary passwords, park scoping, store failures), error mapping, seed planning and validation, accessible forms, password matching, network errors and honest recovery messaging. Real database smoke validation is separate from the fake repository tests. Migration 0002 and the seed were also checked against Neon inside a rolled-back transaction: both migrations applied, the seed was idempotent, and the database rejected a second Super Admin, staff without a park, a Super Admin with a park, an unknown park, and deleting a park that has staff.

With the API and Ops running on their default ports, `corepack pnpm auth:check`
creates a uniquely named temporary account through the website proxy, verifies
Neon persistence and the complete session lifecycle, then removes only that
account and its sessions. It never prints credentials.

## Third-party assets

- React Bits FadeContent: https://github.com/DavidHDev/react-bits — Copyright 2026 David Haz, MIT + Commons Clause. Full license is retained beside the local component in `apps/ops/src/components/react-bits/LICENSE.md`.
- Hero: [Sri Lankan elephant, Udawalawe NP](https://commons.wikimedia.org/wiki/File:Sri_Lankan_elephant,_Udawalawe_NP.jpg), M.S Dulan De Silva, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Local thumbnail; presentation crops, mirrors and tints the photograph. The image and these image adaptations remain under CC BY-SA 4.0. Credit is also visible in the website footer.
- Lucide icons and GSAP are package dependencies; their licenses are supplied with the packages.

Browser automation was unavailable during this implementation session, so desktop/mobile screenshots and interactive visual review remain a manual verification step. Automated DOM tests and a production build do not substitute for that review.
