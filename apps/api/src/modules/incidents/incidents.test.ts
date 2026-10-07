import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { Role } from "@wr/shared";
import { createServer } from "../../server.js";
import { memoryRepository } from "../auth/testing.js";
import { tokenHash } from "../auth/security.js";
import {
  incidentMemoryRepository,
  TEST_PARK,
  OTHER_PARK,
  TEST_RANGER,
  TEST_NOW,
  TEST_IMAGE,
} from "./testing.js";
const servers: ReturnType<typeof createServer>[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => s.close()));
});
function setup() {
  const auth = memoryRepository();
  const state = incidentMemoryRepository();
  const server = createServer({
    repository: auth.repository,
    incidentRepository: state.repository,
    clock: { now: () => new Date(TEST_NOW) },
  });
  servers.push(server);
  function session(
    role: Role,
    parkId: string | null = TEST_PARK,
    id = randomUUID(),
  ) {
    auth.users.set(id, {
      id,
      name: "Test",
      email: `${id}@example.org`,
      password_hash: "unused",
      role,
      park_id: parkId,
      park_name: null,
      disabled_at: null,
      must_change_password: false,
    });
    const token = randomUUID().replaceAll("-", "").repeat(2);
    auth.sessions.set(tokenHash(token), {
      id,
      expires: new Date(new Date(TEST_NOW).getTime() + 60000),
    });
    return { cookie: `wr_session=${token}`, id };
  }
  const ranger = session(Role.RANGER, TEST_PARK, TEST_RANGER);
  const liaison = session(Role.LIAISON_OFFICER);
  const input = () => ({
    id: randomUUID(),
    parkId: TEST_PARK,
    type: "POACHING",
    description: "Snare found near entrance",
    capturedAt: TEST_NOW,
    location: { latitude: 6.52, longitude: 81.42 },
    locationStatus: "GPS",
    locationAccuracy: 12,
  });
  const call = (
    method: "GET" | "POST" | "PATCH",
    url: string,
    payload?: object,
    cookie = liaison.cookie,
  ) =>
    server.inject({
      method,
      url: `/api${url}`,
      payload,
      headers: cookie ? { cookie } : {},
    });
  const create = async (payload = input()) => {
    const response = await call("POST", "/incidents", payload, ranger.cookie);
    expect(response.statusCode).toBe(200);
    return response.json();
  };
  return { ...state, server, session, ranger, liaison, input, call, create };
}
describe("M1 incident API", () => {
  it("creates a no-photo report with correct coordinates and filters ranger ownership", async () => {
    const s = setup();
    const r = await s.create();
    expect(r.location).toEqual({ latitude: 6.52, longitude: 81.42 });
    expect(r.photoUrl).toBeNull();
    expect(
      (await s.call("GET", "/incidents", undefined, s.ranger.cookie)).json(),
    ).toHaveLength(1);
    const other = s.session(Role.RANGER);
    expect(
      (await s.call("GET", "/incidents", undefined, other.cookie)).json(),
    ).toHaveLength(0);
    expect(
      (await s.call("GET", `/incidents/${r.id}`, undefined, other.cookie))
        .statusCode,
    ).toBe(403);
    expect(
      (await s.call("GET", `/incidents/${r.id}/history`)).json()[0].eventType,
    ).toBe("INCIDENT_CREATED");
  });
  it.each([
    { description: " " },
    { type: "INVALID" },
    { capturedAt: "invalid" },
    { capturedAt: "2026-10-08T10:00:00Z" },
    { location: { latitude: 91, longitude: 81 } },
    { location: { latitude: 6, longitude: -181 } },
    { location: null },
    { photoUrl: "https://example.com/fake.jpg" },
  ])("rejects invalid intake %j", async (change) => {
    const s = setup();
    expect(
      (
        await s.call(
          "POST",
          "/incidents",
          { ...s.input(), ...change },
          s.ranger.cookie,
        )
      ).statusCode,
    ).toBe(400);
    expect(s.incidents.size).toBe(0);
  });
  it("blocks other parks on intake and ID reads/mutations, including review/history/media", async () => {
    const s = setup();
    expect(
      (
        await s.call(
          "POST",
          "/incidents",
          { ...s.input(), parkId: OTHER_PARK },
          s.ranger.cookie,
        )
      ).statusCode,
    ).toBe(403);
    const r = await s.create();
    for (const role of [Role.PARK_MANAGER, Role.LIAISON_OFFICER]) {
      const other = s.session(role, OTHER_PARK);
      for (const suffix of ["", "/history", "/reviews"])
        expect(
          (
            await s.call(
              "GET",
              `/incidents/${r.id}${suffix}`,
              undefined,
              other.cookie,
            )
          ).statusCode,
        ).toBe(403);
      for (const [suffix, payload] of [
        ["status", { status: "VERIFIED", expectedRevision: 1 }],
        ["reviews", { notes: "Cross park note" }],
        ["media", { id: randomUUID(), dataUrl: TEST_IMAGE }],
        ["assign", { responderId: TEST_RANGER, expectedRevision: 1 }],
        ["response", { action: "START", expectedRevision: 1 }],
      ] as const)
        expect(
          (
            await s.call(
              "POST",
              `/incidents/${r.id}/${suffix}`,
              payload,
              other.cookie,
            )
          ).statusCode,
        ).toBe(403);
      expect(
        (
          await s.call(
            "PATCH",
            `/incidents/${r.id}/location`,
            {
              expectedRevision: 1,
              location: { latitude: 6, longitude: 81 },
              notes: "Confirmed",
            },
            other.cookie,
          )
        ).statusCode,
      ).toBe(403);
    }
  });
  it("rejects unauthenticated, researcher, super admin and ranger operational changes", async () => {
    const s = setup();
    const r = await s.create();
    expect((await s.call("GET", "/incidents", undefined, "")).statusCode).toBe(
      401,
    );
    for (const role of [Role.RESEARCHER, Role.SUPER_ADMIN, Role.RANGER]) {
      const actor = s.session(
        role,
        role === Role.SUPER_ADMIN ? null : TEST_PARK,
      );
      expect(
        (
          await s.call(
            "POST",
            `/incidents/${r.id}/status`,
            { expectedRevision: 1, status: "VERIFIED" },
            actor.cookie,
          )
        ).statusCode,
      ).toBe(403);
      if (role !== Role.RANGER)
        expect(
          (await s.call("GET", "/incidents", undefined, actor.cookie))
            .statusCode,
        ).toBe(403);
    }
  });
  it("enforces lifecycle, assignment, outcome, revisions and writes the complete history", async () => {
    const s = setup();
    let r = await s.create();
    const status = (next: string, notes?: string) =>
      s.call("PATCH", `/incidents/${r.id}/status`, {
        status: next,
        expectedRevision: r.revision,
        notes,
      });
    expect((await status("RESOLVED")).statusCode).toBe(409);
    expect((await status("IN_PROGRESS")).statusCode).toBe(409);
    r = (await status("VERIFIED")).json();
    expect((await status("IN_PROGRESS")).json().code).toBe(
      "INCIDENT_ASSIGNMENT_REQUIRED",
    );
    expect(
      (
        await s.call("POST", `/incidents/${r.id}/assign`, {
          expectedRevision: r.revision,
          responderId: randomUUID(),
        })
      ).statusCode,
    ).toBe(400);
    r = (
      await s.call("POST", `/incidents/${r.id}/assign`, {
        expectedRevision: r.revision,
        responderId: TEST_RANGER,
      })
    ).json();
    r = (
      await s.call("POST", `/incidents/${r.id}/response`, {
        expectedRevision: r.revision,
        action: "START",
      })
    ).json();
    expect(r.firstResponseAt).toBe(TEST_NOW);
    expect((await status("RESOLVED")).json().code).toBe(
      "INCIDENT_OUTCOME_REQUIRED",
    );
    r = (
      await s.call("POST", `/incidents/${r.id}/response`, {
        expectedRevision: r.revision,
        action: "RESOLVE",
        outcomeNotes: "Team removed the snare.",
      })
    ).json();
    expect(r.resolvedAt).toBe(TEST_NOW);
    expect(r.outcomeNotes).toBe("Team removed the snare.");
    expect((await status("IN_PROGRESS")).statusCode).toBe(409);
    expect(
      (await s.call("GET", `/incidents/${r.id}/history`))
        .json()
        .map((e: { eventType: string }) => e.eventType),
    ).toEqual([
      "INCIDENT_CREATED",
      "INCIDENT_VERIFIED",
      "RESPONDER_ASSIGNED",
      "RESPONSE_STARTED",
      "INCIDENT_RESOLVED",
    ]);
  });
  it("rejects a new report or verified report and never reopens rejected work", async () => {
    const s = setup();
    for (const verified of [false, true]) {
      let r = await s.create();
      if (verified)
        r = (
          await s.call("POST", `/incidents/${r.id}/status`, {
            expectedRevision: r.revision,
            status: "VERIFIED",
          })
        ).json();
      r = (
        await s.call("POST", `/incidents/${r.id}/status`, {
          expectedRevision: r.revision,
          status: "REJECTED",
        })
      ).json();
      expect(r.status).toBe("REJECTED");
      expect(
        (
          await s.call("POST", `/incidents/${r.id}/status`, {
            expectedRevision: r.revision,
            status: "VERIFIED",
          })
        ).statusCode,
      ).toBe(409);
    }
  });
  it("deduplicates create/media, preserves newer status, and rejects changed-payload reuse", async () => {
    const s = setup();
    const input = s.input();
    const r = await s.create(input);
    await s.call("POST", `/incidents/${r.id}/status`, {
      status: "VERIFIED",
      expectedRevision: 1,
    });
    expect((await s.create(input)).status).toBe("VERIFIED");
    expect(s.incidents.size).toBe(1);
    expect(
      (
        await s.call(
          "POST",
          "/incidents",
          { ...input, description: "Different" },
          s.ranger.cookie,
        )
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await s.call("POST", `/incidents/${r.id}/status`, {
          status: "REJECTED",
          expectedRevision: 1,
        })
      ).statusCode,
    ).toBe(409);
    const photo = { id: randomUUID(), dataUrl: TEST_IMAGE };
    for (let i = 0; i < 2; i++)
      expect(
        (
          await s.call(
            "POST",
            `/incidents/${r.id}/media`,
            photo,
            s.ranger.cookie,
          )
        ).statusCode,
      ).toBe(200);
    expect(s.media.size).toBe(1);
    expect(
      (
        await s.call(
          "POST",
          `/incidents/${r.id}/media`,
          { ...photo, dataUrl: "data:image/png;base64,invalid" },
          s.ranger.cookie,
        )
      ).statusCode,
    ).toBe(400);
  });
  it("returns not-found and blocks cross-origin requests", async () => {
    const s = setup();
    expect((await s.call("GET", `/incidents/${randomUUID()}`)).statusCode).toBe(
      404,
    );
    expect(
      (
        await s.server.inject({
          method: "POST",
          url: "/api/incidents",
          headers: {
            cookie: s.ranger.cookie,
            origin: "https://attacker.invalid",
          },
          payload: s.input(),
        })
      ).statusCode,
    ).toBe(403);
  });
});
describe("M1 community and camera", () => {
  it("accepts public forms, keeps unknown landmarks unresolved and hides contact details in receipts", async () => {
    const s = setup();
    const input = {
      id: randomUUID(),
      parkId: TEST_PARK,
      phone: "+94771234567",
      description: "Elephant near crops",
      locationText: "Unknown field",
    };
    const receipt = (
      await s.call("POST", "/community/reports", input, "")
    ).json();
    expect(receipt.locationStatus).toBe("UNRESOLVED");
    expect(receipt.reporterPhone).toBeUndefined();
    expect(
      (await s.call("POST", "/community/reports", input, "")).json().id,
    ).toBe(receipt.id);
    const detail = (await s.call("GET", `/incidents/${receipt.id}`)).json();
    expect(detail.incident.location).toBeNull();
    expect(detail.messages[0].phone).toBe(input.phone);
    expect(
      (
        await s.call(
          "POST",
          "/community/reports",
          { ...input, id: randomUUID(), parkId: randomUUID() },
          "",
        )
      ).statusCode,
    ).toBe(400);
  });
  it.each([
    "ELEPHANT crop damage @ Galge entrance",
    "ELEPHANT crop damage @ Unknown field",
    "POACHING suspicious activity",
    "noise ?!?!",
  ])(
    "preserves and processes SMS %s without losing incomplete reports",
    async (rawText) => {
      const s = setup();
      const input = {
        providerMessageId: "gateway-1",
        parkId: TEST_PARK,
        phone: "0771234567",
        rawText,
      };
      const r = (await s.call("POST", "/community/sms", input, "")).json();
      const detail = (await s.call("GET", `/incidents/${r.id}`)).json();
      expect(detail.messages[0].rawText).toBe(rawText);
      expect(r.locationStatus).toBe(
        rawText.includes("Galge") ? "LANDMARK" : "UNRESOLVED",
      );
      expect(
        (await s.call("POST", "/community/sms", input, "")).json().id,
      ).toBe(r.id);
      expect(s.incidents.size).toBe(1);
      expect(
        (
          await s.call(
            "POST",
            "/community/sms",
            { ...input, rawText: "changed" },
            "",
          )
        ).statusCode,
      ).toBe(409);
    },
  );
  it("follows up, clarifies location with original landmark preserved, then completes response", async () => {
    const s = setup();
    const r = (
      await s.call(
        "POST",
        "/community/sms",
        {
          providerMessageId: "sms-follow",
          parkId: TEST_PARK,
          phone: "0771234567",
          rawText: "ELEPHANT crop damage @ Unknown field",
        },
        "",
      )
    ).json();
    let detail = (await s.call("GET", `/incidents/${r.id}`)).json();
    const message = detail.messages[0];
    const other = s.session(Role.LIAISON_OFFICER, OTHER_PARK);
    expect(
      (
        await s.call(
          "POST",
          `/community/messages/${message.id}/follow-up`,
          { id: randomUUID(), text: "Where is the field?" },
          other.cookie,
        )
      ).statusCode,
    ).toBe(403);
    const followUp = {
      id: randomUUID(),
      text: "Please confirm your nearest entrance.",
    };
    for (let i = 0; i < 2; i++)
      expect(
        (
          await s.call(
            "POST",
            `/community/messages/${message.id}/follow-up`,
            followUp,
          )
        ).statusCode,
      ).toBe(200);
    let incident = (
      await s.call("POST", `/incidents/${r.id}/status`, {
        expectedRevision: 1,
        status: "VERIFIED",
      })
    ).json();
    incident = (
      await s.call("POST", `/incidents/${r.id}/assign`, {
        expectedRevision: incident.revision,
        responderId: TEST_RANGER,
      })
    ).json();
    expect(
      (
        await s.call("POST", `/incidents/${r.id}/response`, {
          expectedRevision: incident.revision,
          action: "START",
        })
      ).json().code,
    ).toBe("INCIDENT_LOCATION_REQUIRED");
    incident = (
      await s.call("PATCH", `/incidents/${r.id}/location`, {
        expectedRevision: incident.revision,
        location: { latitude: 6.5, longitude: 81.4 },
        notes: "Confirmed by caller",
      })
    ).json();
    expect(incident.locationText).toBe("Unknown field");
    expect(incident.locationStatus).toBe("MANUAL");
    incident = (
      await s.call("POST", `/incidents/${r.id}/response`, {
        expectedRevision: incident.revision,
        action: "START",
      })
    ).json();
    expect(
      (
        await s.call("POST", `/incidents/${r.id}/response`, {
          expectedRevision: incident.revision,
          action: "RESOLVE",
          outcomeNotes: "Elephant returned to forest.",
        })
      ).json().status,
    ).toBe("RESOLVED");
    detail = (await s.call("GET", `/incidents/${r.id}`)).json();
    expect(detail.followUps).toHaveLength(1);
    expect(
      detail.history.some(
        (e: { eventType: string }) => e.eventType === "LOCATION_UPDATED",
      ),
    ).toBe(true);
  });
  it.each(["WILDLIFE", "AUTHORIZED_PERSON", "UNSURE", "SUSPICIOUS_ACTIVITY"])(
    "reviews %s with park isolation and no automatic person accusation",
    async (classification) => {
      const s = setup();
      const input = {
        id: randomUUID(),
        parkId: TEST_PARK,
        capturedAt: TEST_NOW,
        location: { latitude: 6.52, longitude: 81.42 },
        dataUrl: TEST_IMAGE,
        personFlag: true,
      };
      let camera = (await s.call("POST", "/camera-images", input)).json();
      expect(camera.classification).toBe("PENDING");
      expect(s.incidents.size).toBe(0);
      const other = s.session(Role.PARK_MANAGER, OTHER_PARK);
      expect(
        (
          await s.call(
            "PATCH",
            `/camera-images/${camera.id}/review`,
            { classification, expectedRevision: 1, notes: "Review image" },
            other.cookie,
          )
        ).statusCode,
      ).toBe(403);
      camera = (
        await s.call("PATCH", `/camera-images/${camera.id}/review`, {
          classification,
          expectedRevision: camera.revision,
          notes: "Human reviewed image",
        })
      ).json();
      expect(s.incidents.size).toBe(
        classification === "SUSPICIOUS_ACTIVITY" ? 1 : 0,
      );
      camera = (
        await s.call("PATCH", `/camera-images/${camera.id}/review`, {
          classification: "SUSPICIOUS_ACTIVITY",
          expectedRevision: camera.revision,
          notes: "Explicit suspicious activity",
        })
      ).json();
      camera = (
        await s.call("PATCH", `/camera-images/${camera.id}/review`, {
          classification: "SUSPICIOUS_ACTIVITY",
          expectedRevision: camera.revision,
          notes: "Retry review",
        })
      ).json();
      expect(s.incidents.size).toBe(1);
      expect(s.incidents.get(camera.resultingIncidentId)?.parkId).toBe(
        TEST_PARK,
      );
      expect(
        (await s.call("GET", "/camera-images", undefined, other.cookie)).json(),
      ).toHaveLength(0);
    },
  );
});
