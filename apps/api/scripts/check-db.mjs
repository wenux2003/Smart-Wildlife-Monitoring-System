import postgres from "postgres";

// Read-only connection/extension check. Never print the connection string.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Set DATABASE_URL in the root .env before checking the database.");
  process.exitCode = 1;
} else {
  let sql;
  try {
    const url = new URL(connectionString);
    if (!["postgres:", "postgresql:"].includes(url.protocol)) {
      throw new Error("Invalid database URL protocol");
    }
    sql = postgres(connectionString, {
      max: 1,
      connect_timeout: 20,
      idle_timeout: 5,
      prepare: false,
    });
    await sql`select 1`;
    const extensions = await sql`
      select extversion from pg_extension where extname = 'postgis'
    `;
    console.log("PostgreSQL connection successful.");
    if (extensions.length === 0) {
      console.error("PostGIS is not enabled. Run CREATE EXTENSION IF NOT EXISTS postgis in the database SQL editor.");
      process.exitCode = 1;
    } else {
      console.log(`PostGIS enabled: ${extensions[0].extversion}`);
    }
  } catch {
    console.error("Database check failed. Check DATABASE_URL, TLS parameters, credentials and network access. Connection details were not logged.");
    process.exitCode = 1;
  } finally {
    if (sql) await sql.end({ timeout: 5 });
  }
}
