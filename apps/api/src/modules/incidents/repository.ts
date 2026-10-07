import postgres from "postgres";
import { randomUUID } from "node:crypto";
import type {
  Incident,
  IncidentDetail,
  IncidentMedia,
  CommunityMessage,
  CommunityFollowUp,
  CameraImage,
} from "@wr/shared";
import { AppError } from "../../core/errors.js";
import type {
  IncidentInsert,
  IncidentChanges,
  EventInput,
  MessageInsert,
  CameraInsert,
} from "./types.js";

export interface IncidentRepository {
  create(
    input: IncidentInsert,
    event: EventInput,
    message?: MessageInsert,
  ): Promise<Incident>;
  list(parkId: string, reporterId?: string): Promise<Incident[]>;
  get(id: string): Promise<Incident | null>;
  detail(id: string): Promise<IncidentDetail>;
  mutate(
    id: string,
    revision: number,
    changes: IncidentChanges,
    event: EventInput,
  ): Promise<Incident>;
  addEvent(id: string, event: EventInput): Promise<void>;
  addMedia(media: Omit<IncidentMedia, "createdAt">): Promise<IncidentMedia>;
  parks(): Promise<{ id: string; name: string }[]>;
  responders(parkId: string): Promise<{ id: string; name: string }[]>;
  landmark(
    parkId: string,
    text: string,
  ): Promise<{ latitude: number; longitude: number } | null>;
  message(id: string): Promise<CommunityMessage | null>;
  followUp(
    input: Omit<CommunityFollowUp, "sentAt" | "state">,
  ): Promise<CommunityFollowUp>;
  cameras(parkId: string): Promise<CameraImage[]>;
  camera(id: string): Promise<CameraImage | null>;
  createCamera(input: CameraInsert): Promise<CameraImage>;
  reviewCamera(
    id: string,
    revision: number,
    classification: CameraImage["classification"],
    actorId: string,
    notes: string,
    incident?: IncidentInsert,
  ): Promise<CameraImage>;
  close?(): Promise<void>;
}
const conflict = () =>
  new AppError(
    "This record changed. Reload it before continuing.",
    409,
    "INCIDENT_REVISION_CONFLICT",
  );
const duplicate = () =>
  new AppError(
    "This ID already belongs to a different submission.",
    409,
    "INCIDENT_DUPLICATE_OPERATION",
  );

export function createIncidentRepository(
  url: string,
  testTransaction?: postgres.TransactionSql,
): IncidentRepository {
  const owned = testTransaction
    ? undefined
    : postgres(url, { max: 5, prepare: false, connect_timeout: 15 });
  const sql = testTransaction ?? owned!;
  function transact<T>(
    work: (tx: postgres.TransactionSql) => Promise<T>,
  ): Promise<T> {
    return (
      testTransaction ? testTransaction.savepoint(work) : owned!.begin(work)
    ) as Promise<T>;
  }
  type DB = postgres.Sql | postgres.TransactionSql;
  const projection = sql`id, park_id AS "parkId", reporter_id AS "reporterId", source, type, status, description,
    CASE WHEN location IS NULL THEN NULL ELSE json_build_object('latitude', ST_Y(location), 'longitude', ST_X(location)) END AS location,
    location_status AS "locationStatus", location_text AS "locationText", location_accuracy AS "locationAccuracy",
    photo_url AS "photoUrl", captured_at AS "capturedAt", reported_at AS "receivedAt", reported_at AS "reportedAt", reporter_phone AS "reporterPhone",
    revision, assigned_to AS "assignedTo", assigned_at AS "assignedAt", first_response_at AS "firstResponseAt", resolved_at AS "resolvedAt", outcome_notes AS "outcomeNotes",
    created_at AS "createdAt", updated_at AS "updatedAt"`;
  const cameraProjection = sql`id, park_id AS "parkId", captured_at AS "capturedAt", json_build_object('latitude', latitude, 'longitude', longitude) AS location,
    data_url AS "dataUrl", person_flag AS "personFlag", classification, reviewer_id AS "reviewerId", reviewed_at AS "reviewedAt", resulting_incident_id AS "resultingIncidentId", revision`;
  const normalize = <T>(row: unknown): T =>
    JSON.parse(JSON.stringify(row)) as T;
  async function get(db: DB, id: string) {
    const [row] =
      await db`SELECT ${projection} FROM incidents WHERE id = ${id}`;
    return row ? normalize<Incident>(row) : null;
  }
  async function event(db: DB, id: string, e: EventInput) {
    await db`INSERT INTO incident_events(id, incident_id, actor_id, event_type, old_status, new_status, notes)
      VALUES(${randomUUID()}, ${id}, ${e.actorId}, ${e.eventType}, ${e.oldStatus}, ${e.newStatus}, ${e.notes})`;
  }
  async function insert(db: DB, input: IncidentInsert, e: EventInput) {
    const point = input.location
      ? sql`ST_SetSRID(ST_MakePoint(${input.location.longitude}, ${input.location.latitude}),4326)`
      : null;
    const inserted =
      await db`INSERT INTO incidents(id, park_id, reporter_id, source, type, status, description, location, location_status, location_text, location_accuracy, captured_at, reporter_phone, creation_hash)
      VALUES(${input.id}, ${input.parkId}, ${input.reporterId}, ${input.source}, ${input.type}, ${input.status}, ${input.description}, ${point}, ${input.locationStatus}, ${input.locationText}, ${input.locationAccuracy}, ${input.capturedAt}, ${input.reporterPhone}, ${input.creationHash})
      ON CONFLICT(id) DO NOTHING RETURNING id`;
    if (!inserted.length) {
      const [existing] =
        await db`SELECT creation_hash FROM incidents WHERE id = ${input.id}`;
      if (existing.creation_hash !== input.creationHash) throw duplicate();
    } else await event(db, input.id, e);
    return (await get(db, input.id))!;
  }
  const repository: IncidentRepository = {
    async create(input, e, message) {
      return transact(async (tx) => {
        if (message) {
          await tx`SELECT pg_advisory_xact_lock(hashtextextended(${message.providerMessageId ?? message.id}, 37002))`;
          const [existing] =
            await tx`SELECT incident_id, creation_hash FROM community_messages WHERE id = ${message.id} OR provider_message_id = ${message.providerMessageId}`;
          if (existing) {
            if (existing.creation_hash !== message.creationHash)
              throw duplicate();
            return (await get(tx, existing.incident_id))!;
          }
        }
        const result = await insert(tx, input, e);
        if (message)
          await tx`INSERT INTO community_messages(id, incident_id, provider_message_id, phone, raw_text, location_text, state, creation_hash)
          VALUES(${message.id}, ${result.id}, ${message.providerMessageId}, ${message.phone}, ${message.rawText}, ${message.locationText}, ${message.state}, ${message.creationHash})`;
        return result;
      });
    },
    async list(parkId, reporterId) {
      return normalize<Incident[]>(
        await sql`SELECT ${projection} FROM incidents WHERE park_id = ${parkId} ${reporterId ? sql`AND (reporter_id = ${reporterId} OR assigned_to = ${reporterId})` : sql``} ORDER BY reported_at DESC LIMIT 500`,
      );
    },
    get: (id) => get(sql, id),
    async detail(id) {
      const incident = (await get(sql, id))!;
      const history =
        await sql`SELECT id, incident_id AS "incidentId", actor_id AS "actorId", event_type AS "eventType", old_status AS "oldStatus", new_status AS "newStatus", notes, created_at AS "createdAt"
          FROM (
            SELECT id, incident_id, actor_id, event_type, old_status, new_status, notes, created_at FROM incident_events WHERE incident_id = ${id}
            UNION ALL
            SELECT r.id, r.incident_id, r.reviewer_id, 'REVIEW_NOTE', NULL, NULL, r.notes, r.created_at FROM incident_reviews r
            WHERE r.incident_id = ${id} AND NOT EXISTS (SELECT 1 FROM incident_events e WHERE e.id = r.id)
          ) history ORDER BY created_at, id`;
      const media =
        await sql`SELECT id, incident_id AS "incidentId", data_url AS "dataUrl", created_at AS "createdAt" FROM incident_media WHERE incident_id = ${id}`;
      const messages =
        await sql`SELECT id, incident_id AS "incidentId", provider_message_id AS "providerMessageId", phone, raw_text AS "rawText", location_text AS "locationText", state, created_at AS "createdAt" FROM community_messages WHERE incident_id = ${id}`;
      const followUps =
        await sql`SELECT f.id, f.message_id AS "messageId", f.actor_id AS "actorId", f.text, f.sent_at AS "sentAt", f.state FROM community_follow_ups f JOIN community_messages m ON m.id = f.message_id WHERE m.incident_id = ${id} ORDER BY f.sent_at`;
      return normalize<IncidentDetail>({
        incident,
        history,
        media,
        messages,
        followUps,
      });
    },
    async mutate(id, revision, changes, e) {
      return transact(async (tx) => {
        const rows =
          await tx`SELECT revision FROM incidents WHERE id = ${id} FOR UPDATE`;
        if (!rows.length || rows[0].revision !== revision) throw conflict();
        if (changes.assignedTo) {
          const [valid] =
            await tx`SELECT u.id FROM auth_users u JOIN incidents i ON i.park_id = u.park_id WHERE i.id = ${id} AND u.id = ${changes.assignedTo} AND u.role = 'RANGER' AND u.disabled_at IS NULL FOR SHARE OF u`;
          if (!valid)
            throw new AppError(
              "Select an active ranger in this park.",
              400,
              "INCIDENT_RESPONDER_INVALID",
            );
        }
        await tx`UPDATE incidents SET status = ${changes.status ?? sql`status`},
          location = ${changes.location ? sql`ST_SetSRID(ST_MakePoint(${changes.location.longitude},${changes.location.latitude}),4326)` : sql`location`},
          location_status = ${changes.locationStatus ?? sql`location_status`}, assigned_to = ${changes.assignedTo ?? sql`assigned_to`}, assigned_at = ${changes.assignedAt ?? sql`assigned_at`},
          first_response_at = ${changes.firstResponseAt ?? sql`first_response_at`}, resolved_at = ${changes.resolvedAt ?? sql`resolved_at`}, outcome_notes = ${changes.outcomeNotes ?? sql`outcome_notes`}, revision = revision + 1, updated_at = now() WHERE id = ${id}`;
        await event(tx, id, e);
        return (await get(tx, id))!;
      });
    },
    addEvent: (id, e) => event(sql, id, e),
    async addMedia(input) {
      return transact(async (tx) => {
        const inserted =
          await tx`INSERT INTO incident_media(id, incident_id, data_url) VALUES(${input.id}, ${input.incidentId}, ${input.dataUrl}) ON CONFLICT(id) DO NOTHING RETURNING id`;
        const [row] =
          await tx`SELECT id, incident_id AS "incidentId", data_url AS "dataUrl", created_at AS "createdAt" FROM incident_media WHERE id = ${input.id}`;
        if (
          row.incidentId !== input.incidentId ||
          row.dataUrl !== input.dataUrl
        )
          throw duplicate();
        if (inserted.length)
          await event(tx, input.incidentId, {
            actorId: null,
            eventType: "MEDIA_ATTACHED",
            oldStatus: null,
            newStatus: null,
            notes: input.id,
          });
        return normalize<IncidentMedia>(row);
      });
    },
    async parks() {
      return sql`SELECT id, name FROM parks ORDER BY name`;
    },
    async responders(parkId) {
      return sql`SELECT id, name FROM auth_users WHERE park_id = ${parkId} AND role = 'RANGER' AND disabled_at IS NULL ORDER BY name`;
    },
    async landmark(parkId, text) {
      const [row] =
        await sql`SELECT latitude, longitude FROM incident_landmarks WHERE park_id = ${parkId} AND lower(name) = lower(${text.trim().replace(/^near\s+/i, "")})`;
      return row ? { latitude: row.latitude, longitude: row.longitude } : null;
    },
    async message(id) {
      const [row] =
        await sql`SELECT id, incident_id AS "incidentId", provider_message_id AS "providerMessageId", phone, raw_text AS "rawText", location_text AS "locationText", state, created_at AS "createdAt" FROM community_messages WHERE id = ${id}`;
      return row ? normalize<CommunityMessage>(row) : null;
    },
    async followUp(input) {
      return transact(async (tx) => {
        const inserted =
          await tx`INSERT INTO community_follow_ups(id, message_id, actor_id, text) VALUES(${input.id},${input.messageId},${input.actorId},${input.text}) ON CONFLICT(id) DO NOTHING RETURNING id`;
        const [row] =
          await tx`SELECT id, message_id AS "messageId", actor_id AS "actorId", text, sent_at AS "sentAt", state FROM community_follow_ups WHERE id = ${input.id}`;
        if (
          row.messageId !== input.messageId ||
          row.actorId !== input.actorId ||
          row.text !== input.text
        )
          throw duplicate();
        if (inserted.length) {
          const [message] =
            await tx`UPDATE community_messages SET state = 'FOLLOW_UP_SENT' WHERE id = ${input.messageId} RETURNING incident_id`;
          await event(tx, message.incident_id, {
            actorId: input.actorId,
            eventType: "COMMUNITY_FOLLOW_UP_SENT",
            oldStatus: null,
            newStatus: null,
            notes: input.text,
          });
        }
        return normalize<CommunityFollowUp>(row);
      });
    },
    async cameras(parkId) {
      return normalize<CameraImage[]>(
        await sql`SELECT ${cameraProjection} FROM camera_images WHERE park_id = ${parkId} ORDER BY captured_at DESC LIMIT 200`,
      );
    },
    async camera(id) {
      const [row] =
        await sql`SELECT ${cameraProjection} FROM camera_images WHERE id = ${id}`;
      return row ? normalize<CameraImage>(row) : null;
    },
    async createCamera(input) {
      await sql`INSERT INTO camera_images(id, park_id, captured_at, latitude, longitude, data_url, person_flag, creation_hash) VALUES(${input.id},${input.parkId},${input.capturedAt},${input.location.latitude},${input.location.longitude},${input.dataUrl},${input.personFlag},${input.creationHash}) ON CONFLICT(id) DO NOTHING`;
      const [row] =
        await sql`SELECT creation_hash FROM camera_images WHERE id = ${input.id}`;
      if (row.creation_hash !== input.creationHash) throw duplicate();
      return (await repository.camera(input.id))!;
    },
    async reviewCamera(id, revision, classification, actorId, notes, incident) {
      return transact(async (tx) => {
        const [row] =
          await tx`SELECT revision, resulting_incident_id FROM camera_images WHERE id = ${id} FOR UPDATE`;
        if (!row || row.revision !== revision) throw conflict();
        let incidentId = row.resulting_incident_id;
        if (incident && !incidentId) {
          const result = await insert(tx, incident, {
            actorId,
            eventType: "INCIDENT_CREATED",
            oldStatus: null,
            newStatus: "NEW",
            notes,
          });
          incidentId = result.id;
        }
        await tx`UPDATE camera_images SET classification = ${classification}, reviewer_id = ${actorId}, reviewed_at = now(), resulting_incident_id = ${incidentId}, revision = revision + 1 WHERE id = ${id}`;
        if (incidentId)
          await event(tx, incidentId, {
            actorId,
            eventType: "CAMERA_REVIEWED",
            oldStatus: null,
            newStatus: null,
            notes: `${classification}: ${notes}`,
          });
        const [updated] =
          await tx`SELECT ${cameraProjection} FROM camera_images WHERE id = ${id}`;
        return normalize<CameraImage>(updated);
      });
    },
    async close() {
      if (owned) await owned.end();
    },
  };
  return repository;
}
