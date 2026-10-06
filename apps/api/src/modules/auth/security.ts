import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt-v1$${salt}$${(await derive(password, salt)).toString("hex")}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const [version, salt, expected] = encoded.split("$");
  if (
    version !== "scrypt-v1" ||
    !/^[a-f0-9]{32}$/.test(salt ?? "") ||
    !/^[a-f0-9]{128}$/.test(expected ?? "")
  )
    return false;
  return timingSafeEqual(
    await derive(password, salt),
    Buffer.from(expected, "hex"),
  );
}
export function sessionToken() {
  return randomBytes(32).toString("hex");
}
export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
