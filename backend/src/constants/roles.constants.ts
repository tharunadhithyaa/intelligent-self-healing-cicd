export const Roles = {
  CITIZEN: "citizen",
  OFFICER: "officer",
  FIELD_WORKER: "field_worker",
  ADMIN: "admin",
} as const;

export type UserRole = (typeof Roles)[keyof typeof Roles];

export const ALL_ROLES: UserRole[] = [
  Roles.CITIZEN,
  Roles.OFFICER,
  Roles.FIELD_WORKER,
  Roles.ADMIN,
];
