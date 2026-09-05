import { environment } from '../../../environments/environment';

const BASE = environment.apiUrl;

export const API_ENDPOINTS = {
  auth: {
    login: `${BASE}/auth/login`,
    register: `${BASE}/auth/register`,
    refreshToken: `${BASE}/auth/refresh-token`,
    logout: `${BASE}/auth/logout`,
    forgotPassword: `${BASE}/auth/forgot-password`,
    resetPassword: `${BASE}/auth/reset-password`,
    me: `${BASE}/auth/me`,
  },
  citizen: {
    profile: `${BASE}/citizen/profile`,
    security: `${BASE}/citizen/security`,
    preferences: `${BASE}/citizen/preferences`,
  },
  complaints: {
    base: `${BASE}/complaints`,
    analyze: `${BASE}/complaints/analyze`,
    details: (id: string) => `${BASE}/complaints/${id}`,
  },
  admin: {
    overview: `${BASE}/admin/dashboard/overview`,
    analytics: `${BASE}/admin/dashboard/analytics`,
    users: `${BASE}/admin/users`,
    userStatus: (id: string) => `${BASE}/admin/users/${id}/status`,
    userLock: (id: string) => `${BASE}/admin/users/${id}/lock`,
    userResetPassword: (id: string) => `${BASE}/admin/users/${id}/reset-password`,
    departments: `${BASE}/admin/departments`,
    departmentDetails: (id: string) => `${BASE}/admin/departments/${id}`,
    departmentAssign: (id: string) => `${BASE}/admin/departments/${id}/assign`,
    departmentRemove: (id: string) => `${BASE}/admin/departments/${id}/remove`,
    reports: `${BASE}/admin/reports/generate`,
    export: `${BASE}/admin/reports/export`,
    auditLogs: `${BASE}/admin/audit-logs`,
    broadcast: `${BASE}/admin/notifications/broadcast`,
  },
} as const;
