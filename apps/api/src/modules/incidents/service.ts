import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  Role,
  IncidentCreateSchema,
  CommunityReportSchema,
  CommunitySmsSchema,
  CameraCreateSchema,
  IncidentStatusUpdateSchema,
  IncidentLocationUpdateSchema,
  IncidentAssignSchema,
  IncidentResponseSchema,
  CameraReviewUpdateSchema,
} from "@wr/shared";
import type { Incident, IncidentStatus } from "@wr/shared";
import { AppError } from "../../core/errors.js";
import type { Clock } from "../../core/clock.js";
import { systemClock } from "../../core/clock.js";
import { assertParkAccess } from "../auth/guard.js";
import type { SessionUser } from "../auth/guard.js";
import type { IncidentRepository } from "./repository.js";
import type { IncidentChanges, IncidentInsert } from "./types.js";

export const submissionHash = (input: unknown) =>
  createHash("sha256").update(JSON.stringify(input)).digest("hex");
function fail(message: string, code: string, status = 400): never {
  throw new AppError(message, status, code);
}
const operators: readonly string[] = [Role.PARK_MANAGER, Role.LIAISON_OFFICER];
const transitions: Record<IncidentStatus, readonly IncidentStatus[]> = {
  NEW: ["VERIFIED", "REJECTED"],
  VERIFIED: ["IN_PROGRESS", "REJECTED"],
  IN_PROGRESS: ["RESOLVED"],
  RESOLVED: [],
  REJECTED: [],
};
export function createIncidentService(
  repository: IncidentRepository,
  clock: Clock = systemClock,
) {
  const now = () => clock.now().toISOString();
  function role(user: SessionUser, operational = false) {
    if (
      !(operational ? operators : [...operators, Role.RANGER]).includes(
        user.role,
      )
    )
      fail("Your role does not allow this action.", "INCIDENT_FORBIDDEN", 403);
    if (!user.parkId)
      fail("A park assignment is required.", "PARK_FORBIDDEN", 403);
  }
  function access(user: SessionUser, record: { parkId: string }) {
    assertParkAccess(user, record.parkId);
  }
  async function load(user: SessionUser, id: string, operational = false) {
    const record = await repository.get(id);
    if (!record) fail("Incident not found.", "INCIDENT_NOT_FOUND", 404);
    role(user, operational);
    access(user, record);
    if (
      user.role === Role.RANGER &&
      record.reporterId !== user.id &&
      record.assignedTo !== user.id
    )
      fail(
        "You can only view your own or assigned reports.",
        "INCIDENT_FORBIDDEN",
        403,
      );
    return record;
  }
  function revision(record: { revision: number }, expected: number) {
    if (record.revision !== expected)
      fail(
        "This record changed. Reload before continuing.",
        "INCIDENT_REVISION_CONFLICT",
        409,
      );
  }
  async function change(
    user: SessionUser,
    record: Incident,
    expected: number,
    changes: IncidentChanges,
    eventType: string,
    notes: string | null = null,
  ) {
    revision(record, expected);
    return repository.mutate(record.id, expected, changes, {
      actorId: user.id,
      eventType,
      oldStatus: record.status,
      newStatus: changes.status ?? record.status,
      notes,
    });
  }
  async function setStatus(
    user: SessionUser,
    id: string,
    input: z.infer<typeof IncidentStatusUpdateSchema>,
  ) {
    const record = await load(user, id, true);
    revision(record, input.expectedRevision);
    if (!transitions[record.status].includes(input.status))
      fail(
        "This incident cannot move to that status.",
        "INCIDENT_INVALID_TRANSITION",
        409,
      );
    const changes: IncidentChanges = { status: input.status };
    if (input.status === "IN_PROGRESS") {
      if (!record.assignedTo)
        fail("Assign a responder first.", "INCIDENT_ASSIGNMENT_REQUIRED");
      if (!record.location)
        fail(
          "Confirm the location before starting response.",
          "INCIDENT_LOCATION_REQUIRED",
        );
      if (
        !(await repository.responders(record.parkId)).some(
          (r) => r.id === record.assignedTo,
        )
      )
        fail(
          "The assigned ranger is no longer available. Reassign this report.",
          "INCIDENT_RESPONDER_INVALID",
        );
      changes.firstResponseAt = now();
    }
    if (input.status === "RESOLVED") {
      if (!input.notes?.trim())
        fail("Enter outcome notes.", "INCIDENT_OUTCOME_REQUIRED");
      changes.outcomeNotes = input.notes.trim();
      changes.resolvedAt = now();
    }
    const eventType = {
      VERIFIED: "INCIDENT_VERIFIED",
      REJECTED: "INCIDENT_REJECTED",
      IN_PROGRESS: "RESPONSE_STARTED",
      RESOLVED: "INCIDENT_RESOLVED",
      NEW: "INCIDENT_CREATED",
    }[input.status];
    return change(
      user,
      record,
      input.expectedRevision,
      changes,
      eventType,
      input.notes ?? null,
    );
  }
  async function parkExists(parkId: string) {
    if (!(await repository.parks()).some((p) => p.id === parkId))
      fail("Select a valid park.", "PARK_NOT_FOUND", 400);
  }
  return {
    async listIncidents(user: SessionUser) {
      role(user);
      return repository.list(
        user.parkId!,
        user.role === Role.RANGER ? user.id : undefined,
      );
    },
    async detail(user: SessionUser, id: string) {
      await load(user, id);
      return repository.detail(id);
    },
    async reportIncident(
      user: SessionUser,
      input: z.infer<typeof IncidentCreateSchema>,
    ) {
      role(user);
      if (user.role !== Role.RANGER)
        fail(
          "Only rangers can submit field reports.",
          "INCIDENT_FORBIDDEN",
          403,
        );
      access(user, input);
      if (new Date(input.capturedAt).getTime() > clock.now().getTime() + 300000)
        fail("Incident time cannot be in the future.", "INCIDENT_TIME_INVALID");
      const result: IncidentInsert = {
        ...input,
        source: "RANGER",
        reporterId: user.id,
        status: "NEW",
        locationText: null,
        reporterPhone: null,
        creationHash: submissionHash({ ...input, reporterId: user.id }),
      };
      return repository.create(result, {
        actorId: user.id,
        eventType: "INCIDENT_CREATED",
        oldStatus: null,
        newStatus: "NEW",
        notes: null,
      });
    },
    updateStatus: setStatus,
    async location(
      user: SessionUser,
      id: string,
      input: z.infer<typeof IncidentLocationUpdateSchema>,
    ) {
      const record = await load(user, id, true);
      if (["RESOLVED", "REJECTED"].includes(record.status))
        fail(
          "Terminal incidents cannot be edited.",
          "INCIDENT_INVALID_TRANSITION",
          409,
        );
      return change(
        user,
        record,
        input.expectedRevision,
        { location: input.location, locationStatus: "MANUAL" },
        "LOCATION_UPDATED",
        input.notes,
      );
    },
    async assign(
      user: SessionUser,
      id: string,
      input: z.infer<typeof IncidentAssignSchema>,
    ) {
      const record = await load(user, id, true);
      if (record.status !== "VERIFIED")
        fail(
          "Verify the incident before assigning a responder.",
          "INCIDENT_INVALID_TRANSITION",
          409,
        );
      if (
        !(await repository.responders(record.parkId)).some(
          (r) => r.id === input.responderId,
        )
      )
        fail(
          "Select an active ranger in the same park.",
          "INCIDENT_RESPONDER_INVALID",
        );
      return change(
        user,
        record,
        input.expectedRevision,
        { assignedTo: input.responderId, assignedAt: now() },
        "RESPONDER_ASSIGNED",
        input.responderId,
      );
    },
    response(
      user: SessionUser,
      id: string,
      input: z.infer<typeof IncidentResponseSchema>,
    ) {
      return setStatus(user, id, {
        expectedRevision: input.expectedRevision,
        status: input.action === "START" ? "IN_PROGRESS" : "RESOLVED",
        notes: input.outcomeNotes,
      });
    },
    async media(
      user: SessionUser,
      id: string,
      input: { id: string; dataUrl: string },
    ) {
      const record = await load(user, id);
      if (user.role === Role.RANGER && record.reporterId !== user.id)
        fail(
          "Only the reporting ranger can attach evidence.",
          "INCIDENT_FORBIDDEN",
          403,
        );
      return repository.addMedia({ ...input, incidentId: id });
    },
    async reviewIncident(user: SessionUser, id: string, notes: string) {
      await load(user, id, true);
      await repository.addEvent(id, {
        actorId: user.id,
        eventType: "REVIEW_NOTE",
        oldStatus: null,
        newStatus: null,
        notes,
      });
      return { ok: true };
    },
    async responders(user: SessionUser) {
      role(user, true);
      return repository.responders(user.parkId!);
    },
    parks: () => repository.parks(),
    async community(
      input:
        | z.infer<typeof CommunityReportSchema>
        | z.infer<typeof CommunitySmsSchema>,
    ) {
      await parkExists(input.parkId);
      const sms = "rawText" in input;
      const rawText = sms ? input.rawText : input.description;
      const match = sms
        ? /^(ELEPHANT|POACHING|INJURED)\s+(.+?)(?:\s*@\s*(.*))?$/i.exec(
            rawText.trim(),
          )
        : null;
      const locationText = sms
        ? (match?.[3]?.trim() ?? "")
        : input.locationText;
      const location = locationText
        ? await repository.landmark(input.parkId, locationText)
        : null;
      const description = sms
        ? match?.[2]?.trim() || rawText
        : input.description;
      const type = sms
        ? ({
            ELEPHANT: "HUMAN_WILDLIFE_CONFLICT",
            POACHING: "POACHING",
            INJURED: "INJURED_ANIMAL",
          }[match?.[1]?.toUpperCase() ?? ""] ?? "OTHER")
        : input.type;
      const id = sms ? randomUUID() : input.id;
      const hash = submissionHash(input);
      return repository.create(
        {
          id,
          parkId: input.parkId,
          reporterId: null,
          reporterPhone: input.phone,
          source: "COMMUNITY",
          type,
          status: "NEW",
          description,
          capturedAt: now(),
          location,
          locationStatus: location ? "LANDMARK" : "UNRESOLVED",
          locationText,
          locationAccuracy: null,
          creationHash: hash,
        },
        {
          actorId: null,
          eventType: "INCIDENT_CREATED",
          oldStatus: null,
          newStatus: "NEW",
          notes: sms ? "Mock SMS received" : "Public form received",
        },
        {
          id,
          phone: input.phone,
          rawText,
          locationText,
          state: sms && (!match || !locationText) ? "NEEDS_INFO" : "RECEIVED",
          providerMessageId: sms ? input.providerMessageId : null,
          creationHash: hash,
        },
      );
    },
    async followUp(
      user: SessionUser,
      id: string,
      input: { id: string; text: string },
    ) {
      const message = await repository.message(id);
      if (!message)
        fail(
          "Community message not found.",
          "COMMUNITY_MESSAGE_NOT_FOUND",
          404,
        );
      await load(user, message.incidentId, true);
      return repository.followUp({ ...input, messageId: id, actorId: user.id });
    },
    async cameras(user: SessionUser) {
      role(user, true);
      return repository.cameras(user.parkId!);
    },
    async createCamera(
      user: SessionUser,
      input: z.infer<typeof CameraCreateSchema>,
    ) {
      role(user, true);
      access(user, input);
      return repository.createCamera({
        ...input,
        creationHash: submissionHash(input),
      });
    },
    async reviewCamera(
      user: SessionUser,
      id: string,
      input: z.infer<typeof CameraReviewUpdateSchema>,
    ) {
      const image = await repository.camera(id);
      if (!image) fail("Camera image not found.", "CAMERA_NOT_FOUND", 404);
      role(user, true);
      access(user, image);
      revision(image, input.expectedRevision);
      const incident: IncidentInsert | undefined =
        input.classification === "SUSPICIOUS_ACTIVITY" &&
        !image.resultingIncidentId
          ? {
              id: image.id,
              parkId: image.parkId,
              reporterId: user.id,
              reporterPhone: null,
              source: "CAMERA_TRAP",
              type: "POACHING",
              status: "NEW",
              description: input.notes,
              location: image.location,
              locationStatus: "MANUAL",
              locationText: "Camera-trap position",
              locationAccuracy: null,
              capturedAt: image.capturedAt,
              creationHash: submissionHash({ cameraId: image.id }),
            }
          : undefined;
      return repository.reviewCamera(
        id,
        input.expectedRevision,
        input.classification,
        user.id,
        input.notes,
        incident,
      );
    },
  };
}
