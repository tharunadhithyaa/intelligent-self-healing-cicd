export const APP_CONSTANTS = {
  appName: 'CivicPulse AI Assistant',
  appShortName: 'CivicPulse',
  appDescription: 'AI-powered Community Issue Reporting & Resolution Management System',
  tokenKey: 'cp_access_token',
  refreshTokenKey: 'cp_refresh_token',
  userKey: 'cp_user',
  rememberMeKey: 'cp_remember_me',
  defaultPageSize: 10,
  maxPageSize: 100,
  snackbarDuration: 4000,
  debounceTime: 300,
} as const;

export const ROLES = {
  CITIZEN: 'citizen',
  OFFICER: 'officer',
  FIELD_WORKER: 'field_worker',
  ADMIN: 'admin',
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];
