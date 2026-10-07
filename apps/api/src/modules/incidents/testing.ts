import { randomUUID } from "node:crypto";
import type {
  Incident,
  IncidentEvent,
  IncidentMedia,
  CommunityMessage,
  CommunityFollowUp,
  CameraImage,
} from "@wr/shared";
import { CameraImageSchema } from "@wr/shared";
import { AppError } from "../../core/errors.js";
import type { IncidentRepository } from "./repository.js";
import type { EventInput } from "./types.js";
export const TEST_PARK = "11111111-1111-4111-8111-111111111111";
export const OTHER_PARK = "22222222-2222-4222-8222-222222222222";
export const TEST_RANGER = "33333333-3333-4333-8333-333333333333";
export const TEST_NOW = "2026-10-07T10:00:00.000Z";
export const TEST_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7N8AAAAASUVORK5CYII=";
export function incidentMemoryRepository() {
  const incidents = new Map<string, Incident>();
  const hashes = new Map<string, string>();
  const history: IncidentEvent[] = [];
  const media = new Map<string, IncidentMedia>();
  const messages = new Map<
    string,
    CommunityMessage & { creationHash: string }
  >();
  const followUps = new Map<string, CommunityFollowUp>();
  const cameras = new Map<string, CameraImage>();
  const responderList = [{ id: TEST_RANGER, name: "Test ranger" }];
  const copy = <T>(value: T): T => structuredClone(value);
  const error = (code: string) => {
    throw new AppError(code, 409, code);
  };
  function addEvent(id: string, event: EventInput) {
    history.push({
      ...event,
      id: randomUUID(),
      incidentId: id,
      createdAt: TEST_NOW,
    });
  }
  const repository: IncidentRepository = {
    async create(input, event, message) {
      if (message) {
        const existing = [...messages.values()].find(
          (m) =>
            m.id === message.id ||
            (m.providerMessageId &&
              m.providerMessageId === message.providerMessageId),
        );
        if (existing) {
          if (existing.creationHash !== message.creationHash)
            error("INCIDENT_DUPLICATE_OPERATION");
          return copy(incidents.get(existing.incidentId)!);
        }
      }
      if (incidents.has(input.id)) {
        if (hashes.get(input.id) !== input.creationHash)
          error("INCIDENT_DUPLICATE_OPERATION");
        return copy(incidents.get(input.id)!);
      }
      const record: Incident = {
        ...input,
        revision: 1,
        photoUrl: null,
        receivedAt: TEST_NOW,
        reportedAt: TEST_NOW,
        createdAt: TEST_NOW,
        updatedAt: TEST_NOW,
        assignedTo: null,
        assignedAt: null,
        firstResponseAt: null,
        resolvedAt: null,
        outcomeNotes: null,
      };
      incidents.set(input.id, record);
      hashes.set(input.id, input.creationHash);
      addEvent(input.id, event);
      if (message)
        messages.set(message.id, {
          ...message,
          incidentId: input.id,
          createdAt: TEST_NOW,
        });
      return copy(record);
    },
    async list(parkId, reporterId) {
      return copy(
        [...incidents.values()].filter(
          (i) =>
            i.parkId === parkId &&
            (!reporterId ||
              i.reporterId === reporterId ||
              i.assignedTo === reporterId),
        ),
      );
    },
    async get(id) {
      return copy(incidents.get(id) ?? null);
    },
    async detail(id) {
      return copy({
        incident: incidents.get(id)!,
        history: history.filter((e) => e.incidentId === id),
        media: [...media.values()].filter((m) => m.incidentId === id),
        messages: [...messages.values()].filter((m) => m.incidentId === id),
        followUps: [...followUps.values()].filter(
          (f) => messages.get(f.messageId)?.incidentId === id,
        ),
      });
    },
    async mutate(id, revision, changes, event) {
      const record = incidents.get(id)!;
      if (record.revision !== revision) error("INCIDENT_REVISION_CONFLICT");
      Object.assign(record, changes, {
        revision: revision + 1,
        updatedAt: TEST_NOW,
      });
      addEvent(id, event);
      return copy(record);
    },
    async addEvent(id, event) {
      addEvent(id, event);
    },
    async addMedia(input) {
      const existing = media.get(input.id);
      if (
        existing &&
        (existing.incidentId !== input.incidentId ||
          existing.dataUrl !== input.dataUrl)
      )
        error("INCIDENT_DUPLICATE_OPERATION");
      if (!existing) media.set(input.id, { ...input, createdAt: TEST_NOW });
      return copy(media.get(input.id)!);
    },
    async parks() {
      return [
        { id: TEST_PARK, name: "Yala" },
        { id: OTHER_PARK, name: "Wilpattu" },
      ];
    },
    async responders(parkId) {
      return parkId === TEST_PARK ? responderList : [];
    },
    async landmark(parkId, text) {
      return parkId === TEST_PARK &&
        text.toLowerCase().replace(/^near\s+/, "") === "galge entrance"
        ? { latitude: 6.52, longitude: 81.42 }
        : null;
    },
    async message(id) {
      return copy(messages.get(id) ?? null);
    },
    async followUp(input) {
      const existing = followUps.get(input.id);
      if (
        existing &&
        (existing.messageId !== input.messageId || existing.text !== input.text)
      )
        error("INCIDENT_DUPLICATE_OPERATION");
      if (!existing) {
        followUps.set(input.id, { ...input, sentAt: TEST_NOW, state: "SENT" });
        messages.get(input.messageId)!.state = "FOLLOW_UP_SENT";
        addEvent(messages.get(input.messageId)!.incidentId, {
          actorId: input.actorId,
          eventType: "COMMUNITY_FOLLOW_UP_SENT",
          notes: input.text,
          oldStatus: null,
          newStatus: null,
        });
      }
      return copy(followUps.get(input.id)!);
    },
    async cameras(parkId) {
      return copy([...cameras.values()].filter((c) => c.parkId === parkId));
    },
    async camera(id) {
      return copy(cameras.get(id) ?? null);
    },
    async createCamera(input) {
      const existing = cameras.get(input.id);
      if (!existing)
        cameras.set(
          input.id,
          CameraImageSchema.strip().parse({
            ...input,
            classification: "PENDING",
            revision: 1,
            reviewerId: null,
            reviewedAt: null,
            resultingIncidentId: null,
          }),
        );
      else if (hashes.get(`camera:${input.id}`) !== input.creationHash)
        error("INCIDENT_DUPLICATE_OPERATION");
      hashes.set(`camera:${input.id}`, input.creationHash);
      return copy(cameras.get(input.id)!);
    },
    async reviewCamera(id, revision, classification, actorId, notes, incident) {
      const camera = cameras.get(id)!;
      if (camera.revision !== revision) error("INCIDENT_REVISION_CONFLICT");
      if (incident && !camera.resultingIncidentId)
        camera.resultingIncidentId = (
          await repository.create(incident, {
            actorId,
            eventType: "INCIDENT_CREATED",
            oldStatus: null,
            newStatus: "NEW",
            notes,
          })
        ).id;
      Object.assign(camera, {
        classification,
        revision: revision + 1,
        reviewerId: actorId,
        reviewedAt: TEST_NOW,
      });
      if (camera.resultingIncidentId)
        addEvent(camera.resultingIncidentId, {
          actorId,
          eventType: "CAMERA_REVIEWED",
          oldStatus: null,
          newStatus: null,
          notes,
        });
      return copy(camera);
    },
  };
  return {
    repository,
    incidents,
    history,
    media,
    messages,
    cameras,
    responderList,
  };
}
