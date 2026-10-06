import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { z } from "zod";
import { Role } from "@wr/shared";

// Reference parks and demo accounts for the Super Admin -> Park Manager -> staff
// hierarchy (docs/User_groups.md section 2). All accounts here are demo data.

export type SeedPark = { code: string; name: string; terrain: string };
export type SeedAccount = {
  email: string;
  name: string;
  role: Role;
  parkCode: string | null;
  password: string;
};
export type SeedPlan = {
  parks: SeedPark[];
  superAdmin: SeedAccount;
  /** Ordered so each park's manager comes before the staff they create. */
  staff: SeedAccount[];
};

export const DEMO_PARKS: SeedPark[] = [
  {
    code: "YALA",
    name: "Yala National Park",
    terrain: "Dry-zone scrub, open grassland and coastal lagoons",
  },
  {
    code: "SINHARAJA",
    name: "Sinharaja Forest Reserve",
    terrain: "Dense lowland tropical rainforest",
  },
  {
    code: "WILPATTU",
    name: "Wilpattu National Park",
    terrain: "Dry-zone forest with natural lakes (villus)",
  },
];

// [park, role, email local part, count]
const DEMO_STAFF: [string, Role, string, number][] = [
  ["YALA", Role.PARK_MANAGER, "manager", 1],
  ["YALA", Role.LIAISON_OFFICER, "liaison", 1],
  ["YALA", Role.RANGER, "ranger", 3],
  ["YALA", Role.RESEARCHER, "researcher", 1],
  ["SINHARAJA", Role.PARK_MANAGER, "manager", 1],
  ["SINHARAJA", Role.LIAISON_OFFICER, "liaison", 1],
  ["SINHARAJA", Role.RANGER, "ranger", 2],
  ["WILPATTU", Role.PARK_MANAGER, "manager", 1],
  ["WILPATTU", Role.RANGER, "ranger", 2],
];
const ROLE_LABEL: Partial<Record<Role, string>> = {
  [Role.PARK_MANAGER]: "Park Manager",
  [Role.LIAISON_OFFICER]: "Liaison Officer",
  [Role.RANGER]: "Ranger",
  [Role.RESEARCHER]: "Researcher",
};

const password = (variable: string) =>
  z
    .string({ required_error: `Set ${variable} in the root .env.` })
    .min(12, `${variable} must be 12–128 characters.`)
    .max(128, `${variable} must be 12–128 characters.`);
const AdminEnv = z.object({
  SUPER_ADMIN_EMAIL: z
    .string({ required_error: "Set SUPER_ADMIN_EMAIL in the root .env." })
    .trim()
    .email("SUPER_ADMIN_EMAIL must be a valid email address.")
    .max(254)
    .transform((value) => value.toLowerCase()),
  SUPER_ADMIN_NAME: z
    .string({ required_error: "Set SUPER_ADMIN_NAME in the root .env." })
    .trim()
    .min(2, "SUPER_ADMIN_NAME must be 2–100 characters.")
    .max(100, "SUPER_ADMIN_NAME must be 2–100 characters."),
  SUPER_ADMIN_PASSWORD: password("SUPER_ADMIN_PASSWORD"),
});
const DemoEnv = z.object({
  DEMO_ACCOUNT_PASSWORD: password("DEMO_ACCOUNT_PASSWORD"),
});

export class SeedError extends Error {}

/** Validates the environment and lists what to seed. Never echoes password values. */
export function buildSeedPlan(
  env: Record<string, string | undefined>,
  options: { demo: boolean },
): SeedPlan {
  const admin = AdminEnv.safeParse(env);
  if (!admin.success) throw new SeedError(admin.error.issues[0].message);
  const superAdmin: SeedAccount = {
    email: admin.data.SUPER_ADMIN_EMAIL,
    name: admin.data.SUPER_ADMIN_NAME,
    role: Role.SUPER_ADMIN,
    parkCode: null,
    password: admin.data.SUPER_ADMIN_PASSWORD,
  };
  if (!options.demo) return { parks: DEMO_PARKS, superAdmin, staff: [] };
  const demo = DemoEnv.safeParse(env);
  if (!demo.success) throw new SeedError(demo.error.issues[0].message);
  const staff: SeedAccount[] = [];
  for (const [parkCode, role, local, count] of DEMO_STAFF) {
    const park = DEMO_PARKS.find((item) => item.code === parkCode)!;
    const shortPark = park.name.split(" ")[0];
    for (let index = 1; index <= count; index++) {
      const suffix = count > 1 ? String(index) : "";
      staff.push({
        email: `${local}${suffix}.${parkCode.toLowerCase()}@example.org`,
        name: `Demo ${ROLE_LABEL[role]}${suffix ? ` ${suffix}` : ""} (${shortPark})`,
        role,
        parkCode,
        password: demo.data.DEMO_ACCOUNT_PASSWORD,
      });
    }
  }
  if (staff.some((account) => account.email === superAdmin.email))
    throw new SeedError(
      "SUPER_ADMIN_EMAIL must not be one of the demo account emails.",
    );
  return { parks: DEMO_PARKS, superAdmin, staff };
}

export type SeedResult = {
  parks: string[];
  accounts: {
    email: string;
    role: Role;
    park: string | null;
    status: "created" | "updated";
  }[];
};

/**
 * Applies a plan in one transaction. Re-running updates names, roles and parks
 * but keeps existing passwords unless `resetPasswords` is set.
 */
export async function applySeedPlan(
  sql: postgres.Sql,
  plan: SeedPlan,
  options: {
    resetPasswords: boolean;
    hash: (password: string) => Promise<string>;
  },
): Promise<SeedResult> {
  // Hash outside the transaction; scrypt is deliberately slow.
  const hashes = new Map<string, string>();
  for (const account of [plan.superAdmin, ...plan.staff])
    hashes.set(account.email, await options.hash(account.password));

  return sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(37002)`;
    const [{ ready }] =
      await tx`SELECT to_regclass('public.parks') IS NOT NULL AS ready`;
    if (!ready)
      throw new SeedError(
        "The parks table is missing. Run corepack pnpm db:migrate first.",
      );

    const parkIds = new Map<string, string>();
    for (const park of plan.parks) {
      const [row] = await tx`
        INSERT INTO parks (id, code, name, terrain)
        VALUES (${randomUUID()}, ${park.code}, ${park.name}, ${park.terrain})
        ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, terrain = EXCLUDED.terrain
        RETURNING id`;
      parkIds.set(park.code, row.id);
    }

    const [existingAdmin] =
      await tx`SELECT email FROM auth_users WHERE role = 'SUPER_ADMIN'`;
    if (existingAdmin && existingAdmin.email !== plan.superAdmin.email)
      throw new SeedError(
        `A Super Admin already exists (${existingAdmin.email}). Only one is allowed: set SUPER_ADMIN_EMAIL to that address, or change the existing account in the database first.`,
      );

    const accounts: SeedResult["accounts"] = [];
    async function upsert(account: SeedAccount, createdBy: string | null) {
      const parkId = account.parkCode ? parkIds.get(account.parkCode)! : null;
      const [row] = await tx`
        INSERT INTO auth_users (id, name, email, password_hash, role, park_id, created_by, must_change_password)
        VALUES (${randomUUID()}, ${account.name}, ${account.email}, ${hashes.get(account.email)!},
                ${account.role}, ${parkId}, ${createdBy}, false)
        ON CONFLICT (email) DO UPDATE SET
          name = EXCLUDED.name,
          role = EXCLUDED.role,
          park_id = EXCLUDED.park_id,
          created_by = COALESCE(auth_users.created_by, EXCLUDED.created_by),
          disabled_at = NULL,
          password_hash = CASE WHEN ${options.resetPasswords}::boolean
            THEN EXCLUDED.password_hash ELSE auth_users.password_hash END
        RETURNING id, (xmax = 0) AS inserted`;
      accounts.push({
        email: account.email,
        role: account.role,
        park: account.parkCode,
        status: row.inserted ? "created" : "updated",
      });
      return row.id as string;
    }

    const adminId = await upsert(plan.superAdmin, null);
    // The Super Admin creates Park Managers; each Park Manager creates their park's staff.
    const managers = new Map<string, string>();
    for (const account of plan.staff) {
      const creator =
        account.role === Role.PARK_MANAGER || account.role === Role.RESEARCHER
          ? adminId
          : (managers.get(account.parkCode!) ?? adminId);
      const id = await upsert(account, creator);
      if (account.role === Role.PARK_MANAGER)
        managers.set(account.parkCode!, id);
    }
    return { parks: plan.parks.map((park) => park.code), accounts };
  });
}
