import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import postgres from "postgres";
import { createIncidentRepository } from "./repository.js";

// Use a fresh, isolated LOCAL PostGIS database; never use the team's DATABASE_URL.
const url = process.env.M1_UPGRADE_TEST_DATABASE_URL;
describe.skipIf(!url)("M1 legacy database upgrade", () => {
  it("preserves pre-0008 reviews and photos across upgrade and repeated migration", async () => {
    const target = new URL(url!);
    if (!["localhost", "127.0.0.1"].includes(target.hostname))
      throw new Error("Upgrade tests require an isolated local database.");
    const sql = postgres(url!, { max: 1, prepare: false, onnotice: () => {} });
    const rollback = new Error("UPGRADE_TEST_ROLLBACK");
    const directory = new URL("../../../drizzle/", import.meta.url);
    try {
      const [existing] =
        await sql`SELECT to_regclass('public.incidents') AS incidents`;
      if (existing.incidents) throw new Error("Use a fresh test database.");
      try {
        await sql.begin(async (tx) => {
          for (const file of (await readdir(directory))
            .filter((name) => /^000[1-7]_.*\.sql$/.test(name))
            .sort())
            await tx.unsafe(await readFile(new URL(file, directory), "utf8"));
          const parkId = randomUUID();
          const authorId = randomUUID();
          const incidentId = randomUUID();
          const reviewId = randomUUID();
          const createdAt = "2026-10-06T08:00:00.000Z";
          const photoUrl = "https://example.org/legacy-evidence.jpg";
          await tx`INSERT INTO parks(id, code, name) VALUES(${parkId}, 'UPGRADE_TEST', 'Upgrade test')`;
          await tx`INSERT INTO auth_users(id, name, email, password_hash, role, park_id) VALUES(${authorId}, 'Legacy author', 'legacy@example.org', 'unused', 'LIAISON_OFFICER', ${parkId})`;
          await tx`INSERT INTO incidents(id, park_id, type, description, photo_url) VALUES(${incidentId}, ${parkId}, 'POACHING', 'Legacy report', ${photoUrl})`;
          await tx`INSERT INTO incident_reviews(id, incident_id, reviewer_id, notes, created_at) VALUES(${reviewId}, ${incidentId}, ${authorId}, 'Original review notes', ${createdAt})`;
          const migration = await readFile(
            new URL("0008_incident_workflow.sql", directory),
            "utf8",
          );
          const repository = createIncidentRepository("", tx);
          for (let run = 0; run < 2; run++) {
            await tx.unsafe(migration);
            const detail = await repository.detail(incidentId);
            expect(detail.incident.photoUrl).toBe(photoUrl);
            expect(detail.history).toEqual([
              {
                id: reviewId,
                incidentId,
                actorId: authorId,
                eventType: "REVIEW_NOTE",
                oldStatus: null,
                newStatus: null,
                notes: "Original review notes",
                createdAt,
              },
            ]);
          }
          throw rollback;
        });
      } catch (error) {
        if (error !== rollback) throw error;
      }
      const [remaining] =
        await sql`SELECT to_regclass('public.incidents') AS incidents`;
      expect(remaining.incidents).toBeNull();
    } finally {
      await sql.end();
    }
  }, 120000);
});
