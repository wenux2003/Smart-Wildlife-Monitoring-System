# Shared Features Plan — Wildlife Guardian

**Group 037 | 6 October 2026 | Planning only — not a completion record**

## 1. Purpose and scope

Build a small shared foundation that supports the four assessed functions: incidents, patrols, wildlife alerts, and analytics/reports. Do not turn shared features into a fifth large module.

According to the [assignment plan](./Group037_Assignment02_Plan.md), each member is assessed on their substantial use case (30 marks), code quality (20), and testing (20); the collaborative report carries 30 marks. Login/logout and privilege administration are not graded use cases. Shared work should help complete and demonstrate the four functions, not replace them.

Follow the existing [implementation plan](./Group037_Implementation_Plan.md) for architecture, states, offline behavior and the agreed forest-green palette. This document plans shared work only; it does not change business-module ownership. The proposed transfer of patrol coverage calculations from M2 to M4 should be recorded consistently in the main plans if the team adopts that split.

## 2. Authentication decision

**Scope update, explicitly requested on 6 October 2026: real email/password registration and sign-in for the Operations website.** This supersedes the earlier demo-only baseline for web authentication; it does not change assessment weighting.

- Public home, sign-in and registration pages use the agreed palette. Registration creates a Researcher with no park assignment; public visitors cannot choose staff roles.
- Store salted scrypt password hashes and hashed session tokens in Neon. Use HttpOnly session cookies, expiry, logout revocation and server validation.
- Signed-in account details come from the API. Do not trust a local role selector or browser storage as authorization.
- Each future domain API must enforce the account's role, allowed park and record ownership. No operational data is exposed by the initial account workspace.
- **Implemented 6 October (Phase A of [User groups](./User_groups.md) §2):** the account hierarchy Super Admin → Park Manager → park staff. This adds the `parks` table, the `SUPER_ADMIN` role, `corepack pnpm db:seed` for parks and demo accounts, and the shared guard `app.authorize({ roles })` / `assertParkAccess()`, which every module route must use (see [web-auth.md](./web-auth.md#protecting-module-routes-m1m4)). Account-management screens remain deferred (§7).
- Keep pending offline records attached to their original user/park when Ranger authentication is integrated.
- Password recovery, email verification, social login and an account-administration dashboard remain deferred. Recovery UI must describe this limitation honestly.

See [Web authentication](./web-auth.md) for implementation, setup, tests and remaining limitations. Authenticated context replaces the earlier demo selector in the shared work below.

## 3. Minimum shared features

| Feature | Small version to build | Where it belongs |
|---|---|---|
| Account and park context | Signed-in account; server-assigned role/park visible; park-scoped requests | Both app headers and API |
| Access checks | Server-side user, role, park and ownership validation; clear access-denied response | API and route/menu guards |
| Navigation and layout | Ops sidebar/header; mobile Ranger navigation; menus appropriate to each role | Existing app shells |
| Design system | Shared colors, typography, buttons, fields, cards, tables, dialogs and status badges | Shared UI package and app styling |
| Park reference/configuration | Seed parks, species, types, zones and thresholds; small manager-only settings view for editable values | Reference module and Ops settings |
| Shared map | Map frame, markers, legend and reusable location display/selection; show coordinate source and age where relevant | Shared UI package |
| Offline foundation | Durable Ranger storage/outbox, connection and sync status, retry, restart recovery and prepared-route readiness | Offline package and Ranger app |
| Photo handling | Common size/type validation, preview, compression and upload/retry support; preserve no-photo reporting | M1 workflow with shared helpers |
| Feedback and page states | Success/error feedback, loading, no results, not found, access denied and confirmation dialogs | Reusable UI components |
| Search/filter controls | Reuse date, park and category inputs; add sorting/pagination only where needed | Shared UI; queries stay in each module |
| Notifications | Visible pending work and alert indicators linking to existing module screens | App shell with module-provided data |
| Audit events | Common actor/time/action/record fields; modules record meaningful changes and report/export activity | API persistence and module history views |
| Data/API conventions | Shared DTOs, validation, consistent errors, timestamps, IDs and park scoping | Shared package and existing API |
| Team setup | Neon `.env`, migrations, seed commands, Node/Corepack startup instructions and automated checks | Root tooling, API and docs |

Use in-app feedback and existing module lists initially; a separate notification center is unnecessary. Mock SMS intake/replies remain required within M1, and alert dispatch/broadcast remains within M3. Shared scope reduction must not remove these business flows.

Park configuration should demonstrate switching Yala/Sinharaja changes species/types, zones and at least one workflow or threshold. Seed complex geometries; a full polygon editor is unnecessary for the baseline.

## 4. Shared screens and access

Only add these shared surfaces initially:

1. **Account/workspace context:** show the signed-in user and assigned park; allow only authorized park selection. This may be a dialog rather than a separate page.
2. **App shell/home:** navigation, context and shortcuts. Module owners supply summary data; do not duplicate their detailed pages.
3. **Park settings:** a small manager-only screen with essential configuration and validation.
4. **Ranger sync panel:** pending/failed item counts and retry; also show persistent connection/sync feedback.
5. **Common fallback screens:** access denied and page not found, with a route back home.

Proposed minimum permissions, to confirm before implementing routes:

| Role | Main access |
|---|---|
| Ranger | Submit/view own reports; assigned patrols; assigned dispatches; own offline work |
| Park Manager | Park-wide operational review, patrol assignment, alert dispatch, analytics/reports and park settings |
| Liaison Officer | Community reports, follow-up, verification, location clarification and response coordination within the assigned park |
| Researcher | Read-only conservation analytics and report export within allowed parks; no operational mutation or unnecessary reporter contact details |

Community intake remains a small public-facing report form/mock SMS flow, not a fifth staff role. Detailed permission rules for incident review and camera review belong in M1's contract.

## 5. Suggested shared-work allocation

These are coordination leads, not a requirement for one person to implement every shared component.

| Member | Shared contribution |
|---|---|
| M1 — Incidents | Common form/photo helpers and feedback; review offline incident/media integration |
| M2 — Patrols | Coordinate offline storage/outbox and map foundations; other members help integrate their workflows |
| M3 — Alerts | Coordinate authenticated-context/access checks and event updates; review cross-module integration |
| M4 — Analytics (your part) | Coordinate palette and Ops layout, reusable filters/tables and seed-data contracts; each member supplies their own fixtures |
| Whole team | Agree contracts, create each module's migrations, implement permissions/audit in owned routes, review integration, test and document |

Record actual names before work starts. Keep responsibilities small and review the workload together; shared work must not consume one member's entire implementation time.

## 6. Build order

### Step 1 — Agree before coding

- Use the approved real web authentication; agree how Ranger will adopt it.
- Confirm the role-access table, park selection rules and navigation for each app.
- Sketch the shared shell, workspace selector, settings and sync panel.
- Agree shared DTOs, API errors, audit fields and module data needed by analytics.
- Assign shared leads and resolve patrol-coverage ownership in the main plans.

### Step 2 — Build the minimum foundation

- Verify Node/Corepack + Neon setup without Docker using [Neon setup](./neon-setup.md).
- Add reference migrations/seed data, authenticated context and server-side checks.
- Build the reusable layout, palette, essential controls and basic page states.
- Prove one minimal UI → API → database flow with park scoping.

Start the four core modules once this foundation works. Do not wait for every shared helper to be finished.

### Step 3 — Add shared behavior alongside the modules

- Integrate offline storage, photos and maps with the actual incident/patrol flows.
- Add event updates and visible pending work with alerts.
- Connect summary cards, filters, tables and audit history to module data.
- Reuse a component when a second workflow needs it; avoid designing a large generic framework first.

### Step 4 — Verify and freeze shared scope

- Test role/park/ownership failures as well as valid operations.
- Demonstrate offline save, restart, retry and reconnect without duplicate records.
- Check keyboard access, readable contrast, mobile controls and meaningful error/empty states.
- Confirm another teammate can follow setup instructions from a clean clone.
- Return remaining effort to required main/alternate/error flows, per-use-case test coverage and report evidence.

## 7. Defer to protect the assessed scope

- Further authentication expansion (social login/MFA) and user-administration screens.
- Profile avatars and extensive personal preferences.
- Dark mode, multiple themes and decorative animations.
- A separate notification center, email/push integrations and chat.
- Global search across all modules and a custom dashboard builder.
- A full park/zone drawing editor or separate administration application.

Offline recovery, park isolation, required validation, audit records and required PDF/CSV exports are **not** optional extras. Keep their agreed behavior within the relevant modules.

## 8. Ready-to-integrate checklist

- [ ] All members agree on scope, access rules, shared ownership and wireframes.
- [ ] Both apps show the authenticated identity and assigned park clearly.
- [ ] Backend rejects invalid sessions, forbidden operations and cross-park access.
- [ ] Shared layout and controls use the agreed palette and work on intended screen sizes.
- [ ] Reference data and park configuration support the required demonstrations.
- [ ] Offline helpers preserve the original user/park and survive restart/retry.
- [ ] Core modules consume the shared foundation without duplicating it.
- [ ] Setup and checks are reproducible; prototype limitations are documented honestly.

**Success criterion:** shared features make the four assessed functions easier to implement, test and demonstrate, without becoming a competing project.
