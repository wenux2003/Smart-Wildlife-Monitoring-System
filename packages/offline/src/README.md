# Offline support

The Dexie-backed patrol outbox stores active/completed sessions, GPS points,
waypoints, notes and optional photo blobs. Every record carries `SYNCED`,
`PENDING_SYNC` or `FAILED` state. Client UUIDs make retries idempotent.

The package owns local persistence and distance calculation only. Browser
network detection and API transport remain in the Ranger application; central
authorization and persistence remain in the API.
