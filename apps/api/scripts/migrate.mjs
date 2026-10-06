import { readdir, readFile } from "node:fs/promises";
import postgres from "postgres";

// Applies drizzle/NNNN_*.sql in order, once each, recording them in schema_migrations.
// Every migration is also written to be idempotent, so databases migrated before
// this table existed are brought up to date safely.
if (!process.env.DATABASE_URL)
  throw new Error("Set DATABASE_URL in the root .env first.");
const directory = new URL("../drizzle/", import.meta.url);
const sql = postgres(process.env.DATABASE_URL, {
  max: 1,
  prepare: false,
  onnotice: () => {},
});
try {
  const files = (await readdir(directory))
    .filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/.test(name))
    .sort();
  const applied = await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(37001)`;
    await tx`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
    const done = new Set(
      (await tx`SELECT name FROM schema_migrations`).map((row) => row.name),
    );
    const pending = files.filter((name) => !done.has(name));
    for (const name of pending) {
      await tx.unsafe(await readFile(new URL(name, directory), "utf8"));
      await tx`INSERT INTO schema_migrations (name) VALUES (${name})`;
    }
    return pending;
  });
  console.log(
    applied.length
      ? `Applied migrations: ${applied.join(", ")}.`
      : "Database schema is already up to date.",
  );
} catch (error) {
  // Report the database's own reason (SQL state and message) without the connection URL.
  console.error(
    `Migration failed${error?.code ? ` (${error.code})` : ""}: ${error?.message ?? "unknown error"}. Check database connectivity and schema permissions.`,
  );
  process.exitCode = 1;
} finally {
  await sql.end();
}
