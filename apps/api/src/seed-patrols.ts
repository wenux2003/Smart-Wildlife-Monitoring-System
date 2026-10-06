import postgres from "postgres";
import {
  PatrolSeedError,
  seedPatrolDemo,
} from "./modules/patrols/seed.js";

if (!process.env.DATABASE_URL) {
  console.error("Set DATABASE_URL in the root .env first.");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, {
  max: 1,
  prepare: false,
  onnotice: () => {},
});

try {
  const result = await seedPatrolDemo(sql);
  console.log(
    `Patrol demo ready: ${result.routes} routes and ${result.assignments} assignments for ${result.ranger}.`,
  );
} catch (error) {
  console.error(
    error instanceof PatrolSeedError
      ? `Patrol seed stopped: ${error.message}`
      : `Patrol seed failed: ${(error as Error).message}`,
  );
  process.exitCode = 1;
} finally {
  await sql.end();
}
