import { Router } from 'express';
import { adminController } from './admin.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { checkPermission } from '../../middleware/permission.middleware';
import { validate } from '../../middleware/validation.middleware';
import { Permissions } from '../../constants/permissions.constants';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  assignOfficerSchema,
  broadcastNotificationSchema
} from './admin.validation';

const router = Router();

// Protect all routes with authentication
router.use(authenticate);

// ─── Dashboard Stats ───
router.get('/dashboard/overview', checkPermission(Permissions.ANALYTICS_VIEW), adminController.getOverviewStats.bind(adminController));
router.get('/dashboard/analytics', checkPermission(Permissions.ANALYTICS_VIEW), adminController.getAnalyticsOverview.bind(adminController));

// ─── User Management ───
router.get('/users', checkPermission(Permissions.USERS_VIEW), adminController.getUsers.bind(adminController));
router.put('/users/:id/status', checkPermission(Permissions.USERS_MANAGE), adminController.setUserActiveState.bind(adminController));
router.put('/users/:id/lock', checkPermission(Permissions.USERS_MANAGE), adminController.setUserLockState.bind(adminController));
router.put('/users/:id/reset-password', checkPermission(Permissions.USERS_MANAGE), adminController.resetUserPassword.bind(adminController));

// ─── Department Management ───
router.post('/departments', checkPermission(Permissions.DEPTS_MANAGE), validate(createDepartmentSchema), adminController.createDepartment.bind(adminController));
router.get('/departments', checkPermission(Permissions.DEPTS_MANAGE), adminController.getDepartments.bind(adminController));
router.put('/departments/:id', checkPermission(Permissions.DEPTS_MANAGE), validate(updateDepartmentSchema), adminController.updateDepartment.bind(adminController));
router.delete('/departments/:id', checkPermission(Permissions.DEPTS_MANAGE), adminController.deleteDepartment.bind(adminController));
router.post('/departments/:id/assign', checkPermission(Permissions.DEPTS_MANAGE), validate(assignOfficerSchema), adminController.assignOfficer.bind(adminController));
router.post('/departments/:id/remove', checkPermission(Permissions.DEPTS_MANAGE), validate(assignOfficerSchema), adminController.removeOfficer.bind(adminController));

// ─── Reports & Export ───
router.get('/reports/generate', checkPermission(Permissions.REPORTS_GENERATE), adminController.generateReport.bind(adminController));
router.get('/reports/export', checkPermission(Permissions.REPORTS_GENERATE), adminController.exportReportCSV.bind(adminController));

// ─── Audit Logs ───
router.get('/audit-logs', checkPermission(Permissions.AUDIT_VIEW), adminController.getAuditLogs.bind(adminController));

// ─── Notifications Broadcasts ───
router.post('/notifications/broadcast', checkPermission(Permissions.USERS_MANAGE), validate(broadcastNotificationSchema), adminController.broadcastNotification.bind(adminController));
router.get('/notifications', adminController.getNotifications.bind(adminController));
router.put('/notifications/:id/read', adminController.markNotificationRead.bind(adminController));

export default router;
