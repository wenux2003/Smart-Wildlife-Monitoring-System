import type { Role } from "@wr/shared";

export const ACCOUNT_EVENT_ACTIONS = [
  "CREATED",
  "DEACTIVATED",
  "REACTIVATED",
  "PASSWORD_RESET",
  "PASSWORD_CHANGED",
  "PARK_CHANGED",
  "ROLE_CHANGED",
  "RESEARCHER_ACCESS_GRANTED",
  "RESEARCHER_ACCESS_REMOVED",
  "PARK_CREATED",
] as const;

export type AccountEventAction = (typeof ACCOUNT_EVENT_ACTIONS)[number];
export type AccountEvent = {
  id: string;
  actorId: string;
  targetUserId: string | null;
  action: AccountEventAction;
  oldValue: unknown;
  newValue: unknown;
  createdAt?: Date;
};
export type Park = {
  id: string;
  code: string;
  name: string;
  terrain: string;
};
export type Account = {
  id: string;
  name: string;
  email: string;
  role: Role;
  parkId: string | null;
  parkName: string | null;
  disabledAt: Date | null;
  mustChangePassword: boolean;
  createdBy: string | null;
  createdAt: Date;
};
export type AccountRecord = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  park_id: string | null;
  park_name: string | null;
  disabled_at: Date | null;
  must_change_password: boolean;
  created_by: string | null;
  created_at: Date;
};
