import { readFile } from "node:fs/promises";
import postgres from "postgres";

if (!process.env.DATABASE_URL)
  throw new Error("Set DATABASE_URL in the root .env first.");
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
try {
  const migration = await readFile(
    new URL("../drizzle/0001_auth.sql", import.meta.url),
    "utf8",
  );
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(37001)`;
    await tx.unsafe(migration);
  });
  console.log("Authentication tables ready: auth_users, auth_sessions.");
} catch {
  console.error(
    "Auth migration failed. Check database connectivity and schema permissions.",
  );
  process.exitCode = 1;
} finally {
  await sql.end();
}
