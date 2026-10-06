# Public website and real account access

Implemented on 6 October 2026 following the user's explicit change from demo access to real email/password authentication. This addition supports, but does not replace, the four assessed workflows.

## Start without Docker

From the repository root, with your private Neon `DATABASE_URL` in `.env`:

```sh
corepack pnpm install
corepack pnpm db:migrate
corepack pnpm dev:all
```

Open http://localhost:5174. Routes: `/` (public home), `/login`, `/register`, `/dashboard` (account workspace). `/signin` and `/signup` redirect to the corresponding account pages. The home page distinguishes planned modules from working account access.

The idempotent, transaction-protected migration creates only `auth_users` and `auth_sessions`, with unique normalized emails, session expiry/user indexes and cascading session deletion. SQL lives in `apps/api/drizzle/0001_auth.sql`; `auth-schema.ts` provides the matching Drizzle model. The SQL additionally enforces the allowed-role and lowercase-email checks. The migration does not drop existing data. Future schema changes need new versioned migrations rather than editing the applied migration.

`auth_users.park_id` is deliberately nullable while the park schema is unimplemented. New users receive `RESEARCHER` and no park. Link this field to the future park table and enforce domain authorization before exposing operational data. Staff provisioning/park assignment has no UI yet and must be a trusted administrative operation; registration cannot set either field.

## Account behavior

- Registration: name, normalized email, password of 12–128 characters and client confirmation. Passwords are salted with random 16-byte salts and hashed with asynchronous scrypt (N=32768, r=8, p=3).
- Sign-in: generic invalid-credential response, equivalent password derivation for unknown emails, no password/connection-string logs.
- Sessions: 32 random bytes; only SHA-256 token hashes are stored in Neon. HttpOnly, SameSite=Lax cookies expire after seven days; `NODE_ENV=production` adds Secure. A new login rotates the current session; logout revokes it. Passwords and session tokens are never kept in localStorage.
- Auth mutations require an exact allowed Origin. `APP_ORIGINS` defaults to `http://localhost:5174,http://localhost:5173`; set it explicitly for other origins. No wildcard origins.
- Thirty auth mutations per IP per 15 minutes limit repeated attempts within one API process. This in-memory limiter is a development baseline; use a shared limiter and correct trusted-proxy configuration before multi-instance public deployment.
- Ops calls relative `/api/auth/*` paths through Vite's development proxy. `API_PROXY_TARGET` can override `http://localhost:3000`; Docker uses `http://api:3000`.
- `/api/auth/me` validates expiry and returns only public account fields. Future module routes must validate the session and enforce role/park permissions themselves; protecting a client route is not sufficient.

Production requires HTTPS, secure cookies and same-origin reverse proxy routing for `/api`. These pages are a development implementation, not a claim of completed production security or operational modules. Email ownership verification, password reset, MFA and administrative provisioning are not implemented. The forgot-password help explicitly says no recovery email is sent. Do not treat an unverified email address as proof of identity.

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

Tests cover password hashing, least-privilege registration, normalized duplicates, rejected role fields, origin checks, bad credentials, cookie flags, session rotation/expiry/revocation, rate limits, private error responses, accessible forms, password matching, network errors and honest recovery messaging. Real database smoke validation is separate from the fake repository tests.

With the API and Ops running on their default ports, `corepack pnpm auth:check`
creates a uniquely named temporary account through the website proxy, verifies
Neon persistence and the complete session lifecycle, then removes only that
account and its sessions. It never prints credentials.

## Third-party assets

- React Bits FadeContent: https://github.com/DavidHDev/react-bits — Copyright 2026 David Haz, MIT + Commons Clause. Full license is retained beside the local component in `apps/ops/src/components/react-bits/LICENSE.md`.
- Hero: [Sri Lankan elephant, Udawalawe NP](https://commons.wikimedia.org/wiki/File:Sri_Lankan_elephant,_Udawalawe_NP.jpg), M.S Dulan De Silva, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Local thumbnail; presentation crops, mirrors and tints the photograph. The image and these image adaptations remain under CC BY-SA 4.0. Credit is also visible in the website footer.
- Lucide icons and GSAP are package dependencies; their licenses are supplied with the packages.

Browser automation was unavailable during this implementation session, so desktop/mobile screenshots and interactive visual review remain a manual verification step. Automated DOM tests and a production build do not substitute for that review.
