import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import postgres from "postgres";

// Opt-in real database smoke check. Deletes only the uniquely generated test account.
const origin = "http://localhost:5174";
const email = `auth-smoke-${randomUUID()}@example.invalid`;
const password = randomBytes(24).toString("hex");
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
const headers = { "Content-Type": "application/json", Origin: origin };
try {
  const registered = await fetch(`${origin}/api/auth/register`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "Temporary auth verification",
      email,
      password,
    }),
  });
  assert.equal(
    registered.status,
    201,
    "Registration through the website proxy must succeed",
  );
  const result = await registered.json();
  assert.equal(result.user.role, "RESEARCHER");
  assert.equal(result.user.parkId, null);
  const cookie = registered.headers.get("set-cookie").split(";")[0];
  const [stored] =
    await sql`SELECT password_hash FROM auth_users WHERE email=${email}`;
  assert.ok(stored.password_hash.startsWith("scrypt-v1$"));
  assert.notEqual(stored.password_hash, password);
  assert.equal(
    (await fetch(`${origin}/api/auth/me`, { headers: { Cookie: cookie } }))
      .status,
    200,
  );
  assert.equal(
    (
      await fetch(`${origin}/api/auth/logout`, {
        method: "POST",
        headers: { ...headers, Cookie: cookie },
        body: "{}",
      })
    ).status,
    204,
  );
  assert.equal(
    (await fetch(`${origin}/api/auth/me`, { headers: { Cookie: cookie } }))
      .status,
    401,
  );
  const login = await fetch(`${origin}/api/auth/login`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, password }),
  });
  assert.equal(login.status, 200);
  console.log(
    "PASS: website proxy, registration, Neon persistence, password hash, session, logout revocation and sign-in.",
  );
} catch (error) {
  console.error(
    error instanceof assert.AssertionError
      ? error.message
      : "Authentication smoke check failed; check the running API, website, and database.",
  );
  process.exitCode = 1;
} finally {
  try {
    await sql`DELETE FROM auth_users WHERE email=${email}`;
    console.log("Temporary verification account removed (sessions cascade).");
  } finally {
    await sql.end();
  }
}
