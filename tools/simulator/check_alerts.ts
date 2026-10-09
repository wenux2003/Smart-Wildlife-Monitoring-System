import postgres from "postgres";

const sql = postgres('postgres://wildlife:wildlife@127.0.0.1:5433/wildlife');

async function check() {
  const alerts = await sql`SELECT * FROM alerts ORDER BY created_at DESC LIMIT 5`;
  console.log("Alerts:", JSON.stringify(alerts, null, 2));
  await sql.end();
}

check().catch(console.error);
