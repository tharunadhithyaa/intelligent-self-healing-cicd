export const Permissions = {
  USERS_VIEW: "users:view",
  USERS_MANAGE: "users:manage",
  DEPTS_MANAGE: "depts:manage",
  REPORTS_GENERATE: "reports:generate",
  AUDIT_VIEW: "audit:view",
  ANALYTICS_VIEW: "analytics:view",
  COMPLAINTS_VIEW: "complaints:view",
  COMPLAINTS_MANAGE: "complaints:manage",
  PROFILE_MANAGE: "profile:manage",
  ROLES_MANAGE: "roles:manage",
} as const;

export type Permission = (typeof Permissions)[keyof typeof Permissions];
export const ALL_PERMISSIONS = Object.values(Permissions);
