import { describe, expect, it } from "vitest";
import { Role } from "@wr/shared";
import { buildSeedPlan, DEMO_PARKS, SeedError } from "./seed.js";

const env = {
  SUPER_ADMIN_EMAIL: "  Head.Office@Example.ORG ",
  SUPER_ADMIN_NAME: "Head Office Admin",
  SUPER_ADMIN_PASSWORD: "super-admin-passphrase",
  DEMO_ACCOUNT_PASSWORD: "demo-account-passphrase",
};

describe("buildSeedPlan", () => {
  it("creates one national Super Admin with a normalised email", () => {
    const plan = buildSeedPlan(env, { demo: true });
    expect(plan.superAdmin).toMatchObject({
      email: "head.office@example.org",
      role: Role.SUPER_ADMIN,
      parkCode: null,
    });
  });

  it("gives every demo staff account a seeded park and a unique email", () => {
    const { staff } = buildSeedPlan(env, { demo: true });
    const parks = DEMO_PARKS.map((park) => park.code);
    expect(
      staff.every(
        (account) => account.parkCode && parks.includes(account.parkCode),
      ),
    ).toBe(true);
    expect(new Set(staff.map((account) => account.email)).size).toBe(
      staff.length,
    );
    expect(staff.some((account) => account.role === Role.SUPER_ADMIN)).toBe(
      false,
    );
    expect(
      staff.every((account) => account.email.endsWith("@example.org")),
    ).toBe(true);
  });

  it("seeds a manager for every park before that park's other staff", () => {
    const { staff } = buildSeedPlan(env, { demo: true });
    for (const park of DEMO_PARKS) {
      const inPark = staff.filter((account) => account.parkCode === park.code);
      expect(inPark[0].role).toBe(Role.PARK_MANAGER);
      expect(
        inPark.filter((account) => account.role === Role.PARK_MANAGER),
      ).toHaveLength(1);
      expect(
        inPark.filter((account) => account.role === Role.RANGER).length,
      ).toBeGreaterThanOrEqual(2);
    }
  });

  it("seeds enough Yala rangers to demo nearest-available dispatch", () => {
    const { staff } = buildSeedPlan(env, { demo: true });
    const yala = staff.filter((account) => account.parkCode === "YALA");
    expect(yala.filter((account) => account.role === Role.RANGER)).toHaveLength(
      3,
    );
    expect(yala.map((account) => account.email)).toContain(
      "researcher.yala@example.org",
    );
  });

  it("can seed only the Super Admin and parks without a demo password", () => {
    const plan = buildSeedPlan(
      { ...env, DEMO_ACCOUNT_PASSWORD: undefined },
      { demo: false },
    );
    expect(plan.staff).toEqual([]);
    expect(plan.parks).toHaveLength(3);
  });

  it.each([
    [{ SUPER_ADMIN_EMAIL: undefined }, "Set SUPER_ADMIN_EMAIL"],
    [{ SUPER_ADMIN_EMAIL: "not-an-email" }, "valid email"],
    [{ SUPER_ADMIN_NAME: undefined }, "Set SUPER_ADMIN_NAME"],
    [{ SUPER_ADMIN_PASSWORD: "short" }, "12–128"],
    [{ SUPER_ADMIN_PASSWORD: "x".repeat(129) }, "12–128"],
    [{ DEMO_ACCOUNT_PASSWORD: undefined }, "Set DEMO_ACCOUNT_PASSWORD"],
    [
      { SUPER_ADMIN_EMAIL: "manager.yala@example.org" },
      "must not be one of the demo",
    ],
  ])("rejects invalid settings %#", (override, message) => {
    expect(() =>
      buildSeedPlan({ ...env, ...override }, { demo: true }),
    ).toThrow(SeedError);
    expect(() =>
      buildSeedPlan({ ...env, ...override }, { demo: true }),
    ).toThrow(message);
  });

  it("never includes a password value in an error message", () => {
    const secret = "short-pw";
    try {
      buildSeedPlan({ ...env, SUPER_ADMIN_PASSWORD: secret }, { demo: true });
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain(secret);
    }
  });
});
