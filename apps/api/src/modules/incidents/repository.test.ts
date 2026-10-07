import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import {
  Role,
  IncidentSchema,
  IncidentDetailSchema,
  CameraImageSchema,
} from "@wr/shared";
import { createIncidentRepository } from "./repository.js";
import { createIncidentService } from "./service.js";
import { TEST_IMAGE, TEST_NOW } from "./testing.js";
const url =
  process.env.M1_TEST_DATABASE_URL ??
  (process.env.M1_TEST_ROLLBACK_DB === "1"
    ? process.env.DATABASE_URL
    : undefined);
// Opt-in only. All fixtures and mutations are rolled back, even if assertions fail.
describe.skipIf(!url)(
  "M1 PostgreSQL/PostGIS persistence (rollback only)",
  { timeout: 120000 },
  () => {
    let sql: postgres.Sql;
    beforeAll(() => {
      sql = postgres(url!, {
        max: 1,
        prepare: false,
        connect_timeout: 15,
        debug: (_connection, query) => {
          if (process.env.M1_SQL_TRACE === "1")
            console.log(query.slice(0, 100).replace(/\s+/g, " "));
        },
      });
    });
    afterAll(async () => {
      await sql.end({ timeout: 3 });
    });
    async function transaction(
    work: (fixtures: Awaited<ReturnType<typeof context>>) => Promise<void>,
    ) {
      const rollback = new Error("M1_TEST_ROLLBACK");
      const parkId = randomUUID();
      try {
        await sql.begin(async (tx) => {
          const fixtures = await context(tx, parkId);
          await work(fixtures);
          throw rollback;
        });
      } catch (error) {
        if (error !== rollback) throw error;
      }
      const [remaining] =
        await sql`SELECT count(*)::int AS count FROM parks WHERE id = ${parkId}`;
      expect(remaining.count).toBe(0);
    }
    async function context(tx: postgres.TransactionSql, parkId: string) {
      const rangerId = randomUUID();
      const liaisonId = randomUUID();
      const otherRanger = randomUUID();
      const otherPark = randomUUID();
      await tx`INSERT INTO parks(id, code, name) VALUES(${parkId},${`M1_${parkId.replaceAll("-", "").slice(0, 24).toUpperCase()}`},'M1 rollback-only test park'),(${otherPark},${`M1_${otherPark.replaceAll("-", "").slice(0, 24).toUpperCase()}`},'M1 other rollback-only park')`;
      for (const [id, role, park] of [
        [rangerId, Role.RANGER, parkId],
        [liaisonId, Role.LIAISON_OFFICER, parkId],
        [otherRanger, Role.RANGER, otherPark],
      ])
        await tx`INSERT INTO auth_users(id,name,email,password_hash,role,park_id) VALUES(${id},'M1 synthetic test',${`${id}@example.invalid`},'unused',${role},${park})`;
      await tx`INSERT INTO incident_landmarks(id,park_id,name,latitude,longitude) VALUES(${randomUUID()},${parkId},'Test entrance',6.52,81.42)`;
      const repository = createIncidentRepository("", tx);
      const service = createIncidentService(repository, {
        now: () => new Date(TEST_NOW),
      });
      const ranger = {
        id: rangerId,
        name: "Test ranger",
        email: "test@example.invalid",
        role: Role.RANGER,
        parkId,
        parkName: null,
      };
      const liaison = { ...ranger, id: liaisonId, role: Role.LIAISON_OFFICER };
      const input = () => ({
        id: randomUUID(),
        parkId,
        type: "POACHING" as const,
        description: "Synthetic snare report",
        capturedAt: TEST_NOW,
        location: { latitude: 6.52, longitude: 81.42 },
        locationStatus: "GPS" as const,
        locationAccuracy: 10,
      });
      return {
        tx,
        repository,
        service,
        ranger,
        liaison,
        input,
        parkId,
        otherPark,
        otherRanger,
      };
    }
    it("round-trips named coordinates, writes history atomically and preserves newer status on create retry", async () => {
      await transaction(async (s) => {
        const input = s.input();
        let incident = await s.service.reportIncident(s.ranger, input);
        expect(IncidentSchema.parse(incident).location).toEqual(input.location);
        const [point] =
          await s.tx`SELECT ST_X(location) AS longitude, ST_Y(location) AS latitude FROM incidents WHERE id = ${incident.id}`;
        expect(point).toEqual(input.location);
        incident = await s.service.updateStatus(s.liaison, incident.id, {
          expectedRevision: incident.revision,
          status: "VERIFIED",
        });
        expect((await s.service.reportIncident(s.ranger, input)).status).toBe(
          "VERIFIED",
        );
        await expect(
          s.service.reportIncident(s.ranger, {
            ...input,
            description: "Changed payload",
          }),
        ).rejects.toMatchObject({ code: "INCIDENT_DUPLICATE_OPERATION" });
        await expect(
          s.repository.mutate(
            incident.id,
            1,
            { status: "REJECTED" },
            {
              actorId: s.liaison.id,
              eventType: "INCIDENT_REJECTED",
              oldStatus: "NEW",
              newStatus: "REJECTED",
              notes: null,
            },
          ),
        ).rejects.toMatchObject({ code: "INCIDENT_REVISION_CONFLICT" });
        await expect(
          s.repository.mutate(
            incident.id,
            incident.revision,
            { assignedTo: s.otherRanger },
            {
              actorId: s.liaison.id,
              eventType: "RESPONDER_ASSIGNED",
              oldStatus: "VERIFIED",
              newStatus: "VERIFIED",
              notes: null,
            },
          ),
        ).rejects.toMatchObject({ code: "INCIDENT_RESPONDER_INVALID" });
        expect((await s.repository.detail(incident.id)).history).toHaveLength(
          2,
        );
        incident = await s.service.assign(s.liaison, incident.id, {
          expectedRevision: incident.revision,
          responderId: s.ranger.id,
        });
        incident = await s.service.response(s.liaison, incident.id, {
          expectedRevision: incident.revision,
          action: "START",
        });
        incident = await s.service.response(s.liaison, incident.id, {
          expectedRevision: incident.revision,
          action: "RESOLVE",
          outcomeNotes: "Synthetic team removed snare.",
        });
        const detail = IncidentDetailSchema.parse(
          await s.repository.detail(incident.id),
        );
        expect(detail.history).toHaveLength(5);
        expect(detail.incident.firstResponseAt).toBe(TEST_NOW);
        expect(detail.incident.resolvedAt).toBe(TEST_NOW);
        expect(await s.repository.list(s.parkId, s.ranger.id)).toHaveLength(1);
        expect(await s.repository.list(s.otherPark)).toHaveLength(0);
        expect(await s.repository.get(randomUUID())).toBeNull();
        await s.repository.close?.();
      });
    });
    it("deduplicates media independently and rejects media IDs belonging to other incidents", async () => {
      await transaction(async (s) => {
        const a = await s.service.reportIncident(s.ranger, s.input());
        const b = await s.service.reportIncident(s.ranger, s.input());
        const photo = { id: randomUUID(), dataUrl: TEST_IMAGE };
        await s.service.media(s.ranger, a.id, photo);
        await s.service.media(s.ranger, a.id, photo);
        await expect(
          s.service.media(s.ranger, b.id, photo),
        ).rejects.toMatchObject({ code: "INCIDENT_DUPLICATE_OPERATION" });
        expect((await s.repository.detail(a.id)).media).toHaveLength(1);
        expect(
          (await s.repository.detail(a.id)).history.filter(
            (e) => e.eventType === "MEDIA_ATTACHED",
          ),
        ).toHaveLength(1);
        await s.service.reviewIncident(s.liaison, a.id, "Review note");
        expect(
          (await s.repository.detail(a.id)).history.at(-1)?.eventType,
        ).toBe("REVIEW_NOTE");
      });
    });
    it("stores raw community messages, landmark resolution and duplicate-safe mock follow-ups", async () => {
      await transaction(async (s) => {
        const sms = {
          providerMessageId: `m1-${randomUUID()}`,
          parkId: s.parkId,
          phone: "0771234567",
          rawText: "  ELEPHANT crop damage @ Test entrance  ",
        };
        const incident = await s.service.community(sms);
        expect(incident.locationStatus).toBe("LANDMARK");
        expect(incident.location).toEqual({ latitude: 6.52, longitude: 81.42 });
        expect((await s.service.community(sms)).id).toBe(incident.id);
        await expect(
          s.service.community({ ...sms, rawText: "changed" }),
        ).rejects.toMatchObject({ code: "INCIDENT_DUPLICATE_OPERATION" });
        const detail = await s.repository.detail(incident.id);
        expect(detail.messages[0].rawText).toBe(sms.rawText);
        const message = await s.repository.message(detail.messages[0].id);
        expect(message?.phone).toBe(sms.phone);
        expect(await s.repository.message(randomUUID())).toBeNull();
        const follow = {
          id: randomUUID(),
          text: "Please confirm the entrance.",
        };
        await s.service.followUp(s.liaison, message!.id, follow);
        await s.service.followUp(s.liaison, message!.id, follow);
        await expect(
          s.service.followUp(s.liaison, message!.id, {
            ...follow,
            text: "Changed",
          }),
        ).rejects.toMatchObject({ code: "INCIDENT_DUPLICATE_OPERATION" });
        expect((await s.repository.detail(incident.id)).followUps).toHaveLength(
          1,
        );
        const unknown = await s.service.community({
          id: randomUUID(),
          parkId: s.parkId,
          phone: sms.phone,
          description: "Crop damage",
          locationText: "Unknown field",
          type: "CROP_DAMAGE",
        });
        expect(unknown.location).toBeNull();
        const clarified = await s.service.location(s.liaison, unknown.id, {
          expectedRevision: 1,
          location: { latitude: 6.4, longitude: 81.3 },
          notes: "Caller confirmed",
        });
        expect(clarified.locationText).toBe("Unknown field");
        expect(
          (await s.repository.parks()).some((p) => p.id === s.parkId),
        ).toBe(true);
      });
    });
    it("keeps UNSURE reviewable and creates one camera incident across re-reviews", async () => {
      await transaction(async (s) => {
        const input = {
          id: randomUUID(),
          parkId: s.parkId,
          location: { latitude: 6.52, longitude: 81.42 },
          capturedAt: TEST_NOW,
          dataUrl: TEST_IMAGE,
          personFlag: true,
        };
        let camera = CameraImageSchema.parse(
          await s.service.createCamera(s.liaison, input),
        );
        await s.service.createCamera(s.liaison, input);
        await expect(
          s.service.createCamera(s.liaison, { ...input, personFlag: false }),
        ).rejects.toMatchObject({ code: "INCIDENT_DUPLICATE_OPERATION" });
        camera = await s.service.reviewCamera(s.liaison, camera.id, {
          classification: "UNSURE",
          expectedRevision: 1,
          notes: "Need further review",
        });
        expect(camera.resultingIncidentId).toBeNull();
        camera = await s.service.reviewCamera(s.liaison, camera.id, {
          classification: "SUSPICIOUS_ACTIVITY",
          expectedRevision: camera.revision,
          notes: "Explicit human assessment",
        });
        camera = await s.service.reviewCamera(s.liaison, camera.id, {
          classification: "SUSPICIOUS_ACTIVITY",
          expectedRevision: camera.revision,
          notes: "Repeated human review",
        });
        expect(
          (await s.repository.list(s.parkId)).filter(
            (i) => i.source === "CAMERA_TRAP",
          ),
        ).toHaveLength(1);
        expect(
          (await s.repository.detail(camera.resultingIncidentId!)).history,
        ).toHaveLength(3);
        await expect(
          s.repository.reviewCamera(
            camera.id,
            1,
            "WILDLIFE",
            s.liaison.id,
            "Stale",
          ),
        ).rejects.toMatchObject({ code: "INCIDENT_REVISION_CONFLICT" });
        expect(await s.repository.cameras(s.parkId)).toHaveLength(1);
        expect(await s.repository.camera(randomUUID())).toBeNull();
      });
    });
  },
);
