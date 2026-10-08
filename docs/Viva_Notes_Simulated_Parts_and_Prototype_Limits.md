# Viva notes — simulated parts and prototype limits

**Group 037 | Wana Rakshaka — Wildlife Guardian | Checked against the code on 8 October 2026**
**Author :** Wenura Kavinda

Use this sheet to answer the panel's "is this real or simulated?" questions honestly and
consistently. Every point below was checked in the code. Re-check anything marked ⚠ before the
viva, because teammates may still be changing it.

---

## 1. The one-sentence answer

> "The hardware and telecom parts — SMS gateway, GPS collars and camera traps — are simulated, as
> the assignment allows. Everything they feed into is real: the API validates the data, stores it
> in PostgreSQL/PostGIS, applies the business rules and drives the same screens and workflows a
> live system would."

The assignment specification permits mocking IoT/ML behaviour and the SMS gateway; the marks are
for the business workflows built around them ([Assignment plan §1](./Group037_Assignment02_Plan.md)).

---

## 2. Simulated parts: real world vs. our prototype

| Part | In the real system | In our prototype | How to demo it | What is real after that point |
|---|---|---|---|---|
| **Villager SMS** (M1) | Villager texts a short code → the phone company's SMS gateway forwards it to our API automatically | No short code or telecom contract. The Ranger app's public page **"Report a community wildlife conflict without an account"** has a **"Use mock SMS gateway"** tick box that sends exactly the request a gateway would (`POST /api/community/sms`) | Ranger app sign-in page → community report link → tick the mock box → send `ELEPHANT herd in the paddy @ Galge entrance` | Parsing, category, landmark lookup, `LANDMARK` / `UNRESOLVED` location, `NEEDS_INFO` state, Liaison inbox, follow-up, verify, assign, respond, resolve |
| **SMS reply to the villager** (M1) | Gateway sends the follow-up question back by SMS | The follow-up is **recorded** (`community_follow_ups`) and shown in the incident history; no SMS is sent | Liaison inbox → open a report → send follow-up | The record, its time, who sent it and the message state |
| **GPS collars** (M3) | Collar hardware sends position, speed and battery over satellite or GSM | A script replays pings to `POST /api/pings`: `tools/collar-simulator/index.mjs <data.json>` (sample file `sample-data.json`). The endpoint checks the `x-ping-secret` header when `PING_SECRET` is set | Run the simulator with a ping inside a geofence zone, then open **Wildlife alerts** | Ping storage, geofence breach / immobility / low-battery rules, alert creation, dispatch, ranger response, history |
| **Collar signal loss** (M3) | A scheduler notices a collar has gone silent | A timer inside the API checks every minute; a collar with no ping for **60 minutes** gets a `SIGNAL_LOST` alert | Leave a collar without pings for an hour (the sample collars do this on their own) | The scanner, the alert and its workflow are real |
| **Camera traps** (M1) | Motion-triggered cameras upload images automatically | Staff upload an image on **Camera review** with a **"Mock person flag"** tick box that stands in for an automatic person detector | Ops → Camera review → upload image → tick or untick the flag → classify | Review queue, classification, and creating an incident only when a reviewer marks it **suspicious activity** |
| **Person / species detection (ML)** | An ML model flags people or species in images | The person flag is a manual tick box; species are never auto-detected | As above | The rule that a person flag alone is **not** proof of poaching, so a human must review it |
| **Ranger live positions** (M3) | The Ranger app reports each ranger's position so the nearest available ranger can be dispatched | ⚠ **No app code writes ranger positions yet.** The `ranger_locations` table is only read. Distances shown when dispatching come from the sample data | Ops → Wildlife alerts → an alert → choose ranger | Distance sorting works on whatever positions exist |
| **Phone battery level** (M2) | Low battery ends the patrol as `PARTIAL` and saves data | ⚠ **Not implemented.** The Ranger app has no battery detection and always ends a patrol as `COMPLETED`. `PARTIAL` patrols exist only in the sample data | — | The database and sync accept `PARTIAL` with a termination reason |
| **Real-time updates** | Push or server events | **Polling:** alerts and dispatches refresh every 3 seconds, collars every 30 seconds. Server-sent events were planned but not built | Open alerts in two windows | The data itself is live from the database |
| **Map background** | Offline or licensed map tiles | Live OpenStreetMap tiles; **needs internet**. Route lines and markers still draw without tiles | Any map page | Geometry, routes, zones and markers come from our database |
| **Sample data** | Real field records | `corepack pnpm db:seed:demo` adds synthetic data (Yala six months; Wilpattu and Sinharaja smaller). Every sample incident starts with **[Demo data]** and SMS numbers use the fake `+94 70 000 ….` range | [Demo accounts → Sample data](./Demo_Accounts.md#sample-data) | It goes through the same tables and screens as real data |
| **Park geography** | Official boundaries, landmarks and zones | Landmarks, geofence zones, settlements and camera-trap positions are **approximate demo coordinates**; parks have no official boundary polygon yet | Wildlife alerts map | Spatial checks (inside zone, distance) run in PostGIS |

### SMS format (know this by heart)

```text
KEYWORD description @ landmark
ELEPHANT herd in the paddy @ Galge entrance
```

| First word | Category |
|---|---|
| `ELEPHANT` | Human–wildlife conflict |
| `POACHING` | Poaching |
| `INJURED` | Injured animal |
| anything else | Other |

- The text after `@` is matched against the park's saved landmarks. A match gives an approximate location (`LANDMARK`). An unknown place is **never rejected**: it stays `UNRESOLVED` for the Liaison Officer to resolve.
- A message without the keyword format or without a place is marked `NEEDS_INFO`, so the officer sends a follow-up.
- The basic public form (the same page with the tick box off) can report any category, including crop and fence damage.
- The sample data follows these rules. Historical sample SMS use this format, and crop and fence reports appear as public-form reports. The six newest Yala SMS (`demo-sms-live-yala-01` to `06`) were sent **through the real endpoint** by `db:seed:demo`, so they show the automated path end to end, including one badly formatted message that became `NEEDS_INFO`. Only their incident descriptions lack the `[Demo data]` prefix, because the parser writes those from the SMS text itself; they are recognisable by their `+94 70 000 90..` numbers.

---

## 3. Prototype simplifications (say these before the panel finds them)

| Area | What we did | Why, and what production would do |
|---|---|---|
| Offline storage | Ranger data is stored in the browser (IndexedDB) **without encryption** | Kept the prototype focused on assessed workflows. Production would encrypt on the device. This is a justified change from Group 039's design ([Implementation plan §6](./Group037_Implementation_Plan.md#6-offline-and-synchronization-contract)) |
| Background sync | Sync runs **while the app is open**: every 15 seconds and when the network comes back | Browsers don't guarantee background work for a closed web app. A native app or Background Sync API would be used in production |
| App shell offline | The Ranger app caches its own files (PWA), so it opens without a network | Map tiles are not cached for a whole route, so plan with the drawn route line |
| Photos | Resized in the browser (longest side 1,200 px, JPEG) and stored in the database as data URLs | Simple and transactional. Production would use object storage (for example S3) and keep only a link in the database |
| Patrol coverage | ⚠ The server never calculates `coverage_percent`; it stays 0 for real patrols. M4's plan calculates coverage from GPS points instead | Spatial coverage with buffers and a grid is defined in the [M4 plan §8.2](./M4_Analytics_and_Export_Plan.md#82-patrol-coverage-and-gaps) |
| Scheduled jobs | Signal-loss and dispatch-timeout checks run on timers inside the API process | Good enough for one server. Production would use a job scheduler so checks survive restarts and scale out |
| Accounts | Real email/password sign-in with hashed passwords and sessions. No password recovery, email verification or MFA; the sign-in page says so | Login and account administration are **not graded use cases**; they are supporting infrastructure |
| Analytics (M4) | ⚠ Planned in detail, not yet built | [M4 plan](./M4_Analytics_and_Export_Plan.md) |

---

## 4. Numbers the panel may ask about

These are the values **in the code today**. Where the plan said something different, the report must
match the code, or the code must change before submission.

| Setting | Code value | Plan said | Where |
|---|---|---|---|
| Signal lost after | 60 minutes without a ping | 6 hours | `alerts/service.ts` `checkLostSignals` |
| Dispatch times out after | 15 minutes without a response | 2 minutes | `alerts/service.ts` |
| Low battery alert | Below 20% (park setting `lowBatteryThreshold`) | 15% | `alerts/processor.ts` |
| Immobility | Speed ≤ 0.1 (park setting `immobilitySpeedThreshold`) | Within 50 m over 2 hours | `alerts/processor.ts` |
| Ranger sync interval | 15 seconds while online | 15 seconds | `PatrolSyncCoordinator.tsx`, `IncidentSync.tsx` |
| GPS fix timeout | 15 seconds, high accuracy | — | `useGpsPosition.ts`, `ReportIncidentPage.tsx` |
| Photo limit | 10 MB before resizing; JPEG, PNG or WebP | — | `packages/ui/src/IncidentFields.tsx` |
| Alerts screen refresh | Every 3 seconds | Server events | `AlertsPage.tsx` |

---

## 5. Likely panel questions

**"Is the SMS feature real?"**
The SMS flow is real from the moment the message reaches our API. The telecom part is mocked, as the
assignment allows. A real gateway would call the same endpoint with the same fields.

**"How do collars send data?"**
Collar hardware is simulated by a script that sends the same JSON a collar gateway would. The API
validates it, stores the ping and runs the alert rules.

**"What if the collar stops sending?"**
Silence can't trigger a rule through a new ping, so a scanner inside the API checks every minute and
raises **Signal lost** after 60 minutes. This was a flaw we corrected from the received design
([Plan review](./Group037_Plan_Review.md)).

**"Does a person in a camera image mean poaching?"**
No. The person flag only asks for review. An incident is created only when staff classify the image
as suspicious activity, because the person could be a ranger or a tourist.

**"What if a villager sends a place we don't know?"**
We never reject it. It's saved as `UNRESOLVED` with the original text, the Liaison Officer sends a
follow-up and confirms the location by hand. We never invent coordinates.

**"What happens offline?"**
Reports and patrols are saved on the phone first and shown as pending. They sync when the network
returns, without duplicates, because every record has its own ID created on the phone.

**"Is the data real?"**
No. It's synthetic and labelled `[Demo data]`; the demo accounts use `example.org` emails.

**"Why polling instead of push?"**
Polling was simpler to build reliably for the prototype; the data on screen is still read live from
the database. Server-sent events are the planned improvement.

---

## 6. Demo cheat sheet

| What | Command or place |
|---|---|
| Start everything | `corepack pnpm dev:all` |
| Ops website / Ranger app | http://localhost:5174 / http://localhost:5173 |
| Accounts and password | [Demo accounts](./Demo_Accounts.md) |
| Add or remove sample data | `corepack pnpm db:seed:demo` / `corepack pnpm db:seed:demo --remove` |
| Send simulated collar pings | `node tools/collar-simulator/index.mjs tools/collar-simulator/sample-data.json` (set `PING_SECRET` if the API uses one) |
| Mock SMS | Ranger app sign-in page → "Report a community wildlife conflict without an account" → tick "Use mock SMS gateway" |
| Mock camera image | Ops → Camera review → upload form → "Mock person flag" |

⚠ `tools/simulator/collar_simulator.ts` (the second collar script) calls `/api/collars` without
signing in, so it currently sends nothing. Use `tools/collar-simulator/index.mjs`.
`tools/sms-gateway-mock` and `tools/camera-trap-feeder` contain only a README; their roles are
covered by the in-app mock options above.

---

## 7. Before the viva

- [ ] Re-check every ⚠ item.
- [ ] Make the report's thresholds (section 4) match the code.
- [x] Sample SMS messages use the real `KEYWORD … @ landmark` format; six were sent through the real endpoint (8 October).
- [ ] Close or explain the open findings in [Implementation audit §8](./Implementation_Audit_2026-10-08.md#8-viva-preparation-findings--2026-10-08).
- [ ] Each member can explain their own module's simulated parts and limits in their own words.
- [ ] Rehearse the demo once from a fresh start, including one mocked SMS, one collar ping and one camera upload.
