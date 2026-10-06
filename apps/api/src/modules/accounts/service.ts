import { randomUUID } from "node:crypto";
import { Role } from "@wr/shared";
import { AppError } from "../../core/errors.js";
import type { SessionUser } from "../auth/guard.js";
import { hashPassword } from "../auth/security.js";
import type { AccountRepository } from "./repository.js";
import type { Account, AccountEvent, AccountRecord, Park } from "./types.js";

function bad(code: string, message: string, status = 400): never {
  throw new AppError(message, status, code);
}
const publicAccount = (account: AccountRecord): Account => ({
  id: account.id,
  name: account.name,
  email: account.email,
  role: account.role,
  parkId: account.park_id,
  parkName: account.park_name,
  disabledAt: account.disabled_at,
  mustChangePassword: account.must_change_password,
  createdBy: account.created_by,
  createdAt: account.created_at,
});
const MANAGER_MANAGED_ROLES: Role[] = [Role.RANGER, Role.LIAISON_OFFICER];
const MANAGER_VISIBLE_ROLES: Role[] = [
  ...MANAGER_MANAGED_ROLES,
  Role.RESEARCHER,
];
const PARK_REQUIRED_ROLES: Role[] = [
  Role.RANGER,
  Role.PARK_MANAGER,
  Role.LIAISON_OFFICER,
];

export function createAccountService(
  repository: AccountRepository,
  now: () => Date = () => new Date(),
) {
  function managerPark(actor: SessionUser) {
    if (!actor.parkId)
      bad("PARK_FORBIDDEN", "This account is not assigned to a park.", 403);
    return actor.parkId;
  }
  function event(
    actor: SessionUser,
    targetUserId: string | null,
    action: AccountEvent["action"],
    oldValue: unknown,
    newValue: unknown,
  ): AccountEvent {
    return {
      id: randomUUID(),
      actorId: actor.id,
      targetUserId,
      action,
      oldValue,
      newValue,
      createdAt: now(),
    };
  }
  async function requirePark(parkId: string) {
    const park = await repository.findPark(parkId);
    if (!park) bad("NOT_FOUND", "Park not found.", 404);
    return park;
  }
  function assertParkManagerTarget(actor: SessionUser, target: AccountRecord) {
    if (target.park_id !== managerPark(actor))
      bad("PARK_FORBIDDEN", "You can only manage accounts in your own park.", 403);
    if (!MANAGER_MANAGED_ROLES.includes(target.role))
      bad("FORBIDDEN", "You cannot manage this account.", 403);
  }

  return {
    async listParks(actor: SessionUser) {
      return repository.listParks(
        actor.role === Role.PARK_MANAGER ? managerPark(actor) : undefined,
      );
    },
    async createPark(
      actor: SessionUser,
      input: { id: string; code: string; name: string; terrain: string },
    ) {
      const park: Park = input;
      const created = await repository.createPark(
        park,
        event(actor, null, "PARK_CREATED", null, park),
      );
      if (!created) bad("PARK_CODE_TAKEN", "A park with this code already exists.", 409);
      return park;
    },
    async listAccounts(actor: SessionUser, requestedParkId?: string) {
      const parkId =
        actor.role === Role.PARK_MANAGER
          ? managerPark(actor)
          : requestedParkId;
      if (parkId) await requirePark(parkId);
      return (await repository.listAccounts(parkId)).map(publicAccount);
    },
    async createAccount(
      actor: SessionUser,
      input: {
        id: string;
        name: string;
        email: string;
        role: AccountRecord["role"];
        parkId: string;
        temporaryPassword: string;
      },
    ) {
      if (input.role === Role.SUPER_ADMIN || input.role === Role.RESEARCHER)
        bad("FORBIDDEN", "This role cannot be created through account management.", 403);
      if (
        actor.role === Role.PARK_MANAGER &&
        !MANAGER_MANAGED_ROLES.includes(input.role)
      )
        bad("FORBIDDEN", "Park Managers can create only Rangers and Liaison Officers.", 403);
      const parkId =
        actor.role === Role.PARK_MANAGER ? managerPark(actor) : input.parkId;
      if (!parkId) bad("PARK_FORBIDDEN", "An account must belong to a park.", 403);
      await requirePark(parkId);
      const email = input.email.trim().toLowerCase();
      if (await repository.findAccountByEmail(email))
        bad("EMAIL_TAKEN", "An account with this email already exists.", 409);
      const user = {
        id: input.id,
        name: input.name.trim(),
        email,
        password_hash: await hashPassword(input.temporaryPassword),
        role: input.role,
        park_id: parkId,
        disabled_at: null,
        must_change_password: true,
      };
      const created = await repository.createAccount(
        user,
        event(actor, user.id, "CREATED", null, {
          name: user.name,
          email,
          role: user.role,
          parkId,
          mustChangePassword: true,
        }),
      );
      if (!created) bad("EMAIL_TAKEN", "An account with this email already exists.", 409);
      const account = await repository.findAccount(user.id);
      if (!account) bad("INTERNAL_ERROR", "The account could not be loaded.", 500);
      return publicAccount(account);
    },
    async setAccountStatus(
      actor: SessionUser,
      id: string,
      active: boolean,
    ) {
      const target = await repository.findAccount(id);
      if (!target) bad("NOT_FOUND", "Account not found.", 404);
      if (actor.role === Role.SUPER_ADMIN) {
        if (!active && target.id === actor.id)
          bad("CANNOT_MODIFY_SELF", "You cannot deactivate your own account.", 409);
      } else {
        assertParkManagerTarget(actor, target);
      }
      const currentDisabled = target.disabled_at !== null;
      if (currentDisabled === !active) return publicAccount(target);
      const updated = await repository.setDisabled(
        id,
        active ? null : now(),
        event(
          actor,
          id,
          active ? "REACTIVATED" : "DEACTIVATED",
          { disabled: currentDisabled },
          { disabled: !active },
        ),
      );
      if (!updated) bad("NOT_FOUND", "Account not found.", 404);
      return publicAccount(updated);
    },
    async resetPassword(
      actor: SessionUser,
      id: string,
      temporaryPassword: string,
    ) {
      const target = await repository.findAccount(id);
      if (!target) bad("NOT_FOUND", "Account not found.", 404);
      if (actor.role === Role.PARK_MANAGER) assertParkManagerTarget(actor, target);
      const updated = await repository.resetPassword(
        id,
        await hashPassword(temporaryPassword),
        event(
          actor,
          id,
          "PASSWORD_RESET",
          { mustChangePassword: target.must_change_password },
          { mustChangePassword: true },
        ),
      );
      if (!updated) bad("NOT_FOUND", "Account not found.", 404);
      return publicAccount(updated);
    },
    async updateAccount(
      actor: SessionUser,
      id: string,
      changes: { role?: AccountRecord["role"]; parkId?: string | null },
    ) {
      const target = await repository.findAccount(id);
      if (!target) bad("NOT_FOUND", "Account not found.", 404);
      if (target.role === Role.SUPER_ADMIN || changes.role === Role.SUPER_ADMIN)
        bad("FORBIDDEN", "Super Admin accounts cannot be changed here.", 403);
      if (target.id === actor.id)
        bad("CANNOT_MODIFY_SELF", "You cannot change your own role or park.", 409);
      const role = changes.role ?? target.role;
      const parkId =
        changes.parkId === undefined ? target.park_id : changes.parkId;
      if (
        PARK_REQUIRED_ROLES.includes(role) &&
        !parkId
      )
        bad("VALIDATION_FAILED", "This role must be assigned to a park.");
      if (parkId) await requirePark(parkId);
      if (role === target.role && parkId === target.park_id)
        return publicAccount(target);
      const events: AccountEvent[] = [];
      if (role !== target.role)
        events.push(
          event(actor, id, "ROLE_CHANGED", { role: target.role }, { role }),
        );
      if (parkId !== target.park_id)
        events.push(
          event(
            actor,
            id,
            "PARK_CHANGED",
            { parkId: target.park_id },
            { parkId },
          ),
        );
      const updated = await repository.updateAccount(id, role, parkId, events);
      if (!updated) bad("NOT_FOUND", "Account not found.", 404);
      return publicAccount(updated);
    },
    async researcherAccess(
      actor: SessionUser,
      email: string,
      parkId: string,
      grant: boolean,
    ) {
      const park = await requirePark(parkId);
      const target = await repository.findAccountByEmail(email.trim().toLowerCase());
      if (!target) bad("NOT_FOUND", "Researcher account not found.", 404);
      if (target.role !== Role.RESEARCHER)
        bad("VALIDATION_FAILED", "Park access can only be changed for a Researcher.");
      if (
        actor.role === Role.PARK_MANAGER &&
        managerPark(actor) !== parkId
      )
        bad("PARK_FORBIDDEN", "You can only manage access to your own park.", 403);
      if (!grant && target.park_id === null) return publicAccount(target);
      if (actor.role === Role.PARK_MANAGER && target.park_id && target.park_id !== parkId)
        bad("PARK_FORBIDDEN", "This Researcher already has access to another park.", 403);
      if (grant && target.park_id === parkId) return publicAccount(target);
      if (!grant && target.park_id !== parkId)
        bad("PARK_FORBIDDEN", "This Researcher does not have access to that park.", 403);
      const updated = await repository.setResearcherPark(
        target.id,
        grant ? park.id : null,
        event(
          actor,
          target.id,
          grant ? "RESEARCHER_ACCESS_GRANTED" : "RESEARCHER_ACCESS_REMOVED",
          { parkId: target.park_id },
          { parkId: grant ? park.id : null },
        ),
      );
      if (!updated) bad("NOT_FOUND", "Researcher account not found.", 404);
      return publicAccount(updated);
    },
    async accountEvents(actor: SessionUser, id: string) {
      const target = await repository.findAccount(id);
      if (!target) bad("NOT_FOUND", "Account not found.", 404);
      if (
        actor.role === Role.PARK_MANAGER &&
        (target.park_id !== managerPark(actor) ||
          !MANAGER_VISIBLE_ROLES.includes(target.role))
      )
        bad("PARK_FORBIDDEN", "You can only view account history in your own park.", 403);
      return repository.listEvents(id);
    },
  };
}
