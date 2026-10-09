import { checkSeedTarget, seedAnalytics } from "./modules/analytics/seed.js";
const url = process.env.DATABASE_URL;
if (!url) throw new Error("Set DATABASE_URL first.");
checkSeedTarget(
  url,
  process.env.NODE_ENV === "production",
  process.argv.includes("--confirm-shared-db"),
);
console.table(await seedAnalytics(url, process.argv.includes("--remove")));
