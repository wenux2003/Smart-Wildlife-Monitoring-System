import postgres from "postgres";
import { hashPassword } from "./modules/auth/security.js";
import {
  applySeedPlan,
  buildSeedPlan,
  SeedError,
} from "./modules/reference/seed.js";

// corepack pnpm db:seed [--no-demo] [--reset-passwords]
// Creates the parks, the single Super Admin and (unless --no-demo) demo staff.
const args = new Set(process.argv.slice(2));
const demo = !args.has("--no-demo");
const resetPasswords = args.has("--reset-passwords");

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
  const plan = buildSeedPlan(process.env, { demo });
  const result = await applySeedPlan(sql, plan, {
    resetPasswords,
    hash: hashPassword,
  });
  console.log(`Parks ready: ${result.parks.join(", ")}.`);
  console.table(result.accounts);
  console.log(
    [
      "Passwords are the SUPER_ADMIN_PASSWORD and DEMO_ACCOUNT_PASSWORD values in .env.",
      resetPasswords
        ? "Existing accounts were reset to those passwords."
        : "Existing accounts kept their current passwords (use --reset-passwords to reset them).",
    ].join("\n"),
  );
} catch (error) {
  console.error(
    error instanceof SeedError
      ? `Seed stopped: ${error.message}`
      : `Seed failed${(error as { code?: string }).code ? ` (${(error as { code?: string }).code})` : ""}: ${(error as Error).message}`,
  );
  process.exitCode = 1;
} finally {
  await sql.end();
}
