import { Response, NextFunction } from 'express';
import { adminDashboardService } from './services/admin-dashboard.service';
import { userManagementService } from './services/user-management.service';
import { departmentService } from './services/department.service';
import { reportService } from './services/report.service';
import { auditService } from './services/audit.service';
import { notificationService } from './services/notification.service';
import { ApiResponse } from '../../utils/api-response.util';
import { AuthenticatedRequest } from '../../interfaces/request.interface';

class AdminController {
  // ─── Dashboard overview ───
  async getOverviewStats(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await adminDashboardService.getOverviewStats();
      ApiResponse.success(res, 'Overview statistics fetched successfully', { stats });
    } catch (error) {
      next(error);
    }
  }

  async getAnalyticsOverview(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const analytics = await adminDashboardService.getAnalyticsOverview();
      ApiResponse.success(res, 'Analytics overview data fetched successfully', { analytics });
    } catch (error) {
      next(error);
    }
  }

  // ─── User Management ───
  async getUsers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const search = req.query['search'] as string;
      const role = req.query['role'] as string;
      const isActive = req.query['isActive'] ? req.query['isActive'] === 'true' : undefined;
      const isLocked = req.query['isLocked'] ? req.query['isLocked'] === 'true' : undefined;
      const page = req.query['page'] ? parseInt(req.query['page'] as string, 10) : 1;
      const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : 10;
      const sortField = (req.query['sortField'] as string) || 'createdAt';
      const sortOrder = (req.query['sortOrder'] as string) || 'desc';

      const data = await userManagementService.getUsers(
        search,
        role,
        isActive,
        isLocked,
        page,
        limit,
        sortField,
        sortOrder
      );
      ApiResponse.success(res, 'Users fetched successfully', data);
    } catch (error) {
      next(error);
    }
  }

  async setUserActiveState(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const targetUserId = req.params['id'] as string;
      const { isActive } = req.body;
      const user = await userManagementService.setUserActiveState(
        req.user!,
        targetUserId,
        isActive,
        req.ip,
        req.headers['user-agent']
      );
      ApiResponse.success(res, `User account ${isActive ? 'activated' : 'deactivated'} successfully`, { user });
    } catch (error) {
      next(error);
    }
  }

  async setUserLockState(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const targetUserId = req.params['id'] as string;
      const { isLocked } = req.body;
      const user = await userManagementService.setUserLockState(
        req.user!,
        targetUserId,
        isLocked,
        req.ip,
        req.headers['user-agent']
      );
      ApiResponse.success(res, `User account ${isLocked ? 'locked' : 'unlocked'} successfully`, { user });
    } catch (error) {
      next(error);
    }
  }

  async resetUserPassword(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const targetUserId = req.params['id'] as string;
      const defaultPassword = await userManagementService.resetUserPasswordByAdmin(
        req.user!,
        targetUserId,
        req.ip,
        req.headers['user-agent']
      );
      ApiResponse.success(res, 'User password reset completed', { defaultPassword });
    } catch (error) {
      next(error);
    }
  }

  // ─── Department Management ───
  async createDepartment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, description, contactInfo } = req.body;
      const dept = await departmentService.createDepartment(
        req.user!,
        name,
        description,
        contactInfo,
        req.ip,
        req.headers['user-agent']
      );
      ApiResponse.created(res, 'Department created successfully', { department: dept });
    } catch (error) {
      next(error);
    }
  }

  async getDepartments(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const departments = await departmentService.getDepartments();
      ApiResponse.success(res, 'Departments fetched successfully', { departments });
    } catch (error) {
      next(error);
    }
  }

  async updateDepartment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const deptId = req.params['id'] as string;
      const dept = await departmentService.updateDepartment(
        req.user!,
        deptId,
        req.body,
        req.ip,
        req.headers['user-agent']
      );
      ApiResponse.success(res, 'Department details updated successfully', { department: dept });
    } catch (error) {
      next(error);
    }
  }

  async deleteDepartment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const deptId = req.params['id'] as string;
      await departmentService.deleteDepartment(req.user!, deptId, req.ip, req.headers['user-agent']);
      ApiResponse.success(res, 'Department deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async assignOfficer(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const deptId = req.params['id'] as string;
      const { officerId } = req.body;
      const dept = await departmentService.assignOfficer(
        req.user!,
        deptId,
        officerId,
        req.ip,
        req.headers['user-agent']
      );
      ApiResponse.success(res, 'Officer assigned to department successfully', { department: dept });
    } catch (error) {
      next(error);
    }
  }

  async removeOfficer(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const deptId = req.params['id'] as string;
      const { officerId } = req.body;
      const dept = await departmentService.removeOfficer(
        req.user!,
        deptId,
        officerId,
        req.ip,
        req.headers['user-agent']
      );
      ApiResponse.success(res, 'Officer removed from department successfully', { department: dept });
    } catch (error) {
      next(error);
    }
  }

  // ─── Reports & Export ───
  async generateReport(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const timeframe = (req.query['timeframe'] as 'daily' | 'weekly' | 'monthly' | 'yearly') || 'monthly';
      const report = await reportService.generateReport(timeframe);
      ApiResponse.success(res, 'Report details generated successfully', { report });
    } catch (error) {
      next(error);
    }
  }

  async exportReportCSV(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const timeframe = (req.query['timeframe'] as 'daily' | 'weekly' | 'monthly' | 'yearly') || 'monthly';
      const report = await reportService.generateReport(timeframe);
      const csvContent = reportService.convertToCSV(report);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=civicpulse-report-${timeframe}.csv`);
      res.status(200).send(csvContent);
    } catch (error) {
      next(error);
    }
  }

  // ─── Audit Logs ───
  async getAuditLogs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const search = req.query['search'] as string;
      const action = req.query['action'] as string;
      const role = req.query['role'] as string;
      const target = req.query['target'] as string;
      const startDate = req.query['startDate'] as string;
      const endDate = req.query['endDate'] as string;
      const sortField = (req.query['sortField'] as string) || 'timestamp';
      const sortOrder = (req.query['sortOrder'] as string) || 'desc';
      const page = req.query['page'] ? parseInt(req.query['page'] as string, 10) : 1;
      const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : 10;

      const data = await auditService.getAuditLogs(
        search,
        action,
        role,
        target,
        startDate,
        endDate,
        sortField,
        sortOrder,
        page,
        limit
      );
      ApiResponse.success(res, 'Audit logs fetched successfully', data);
    } catch (error) {
      next(error);
    }
  }

  // ─── In-App Notifications Broadcasts ───
  async broadcastNotification(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { targetRoles, title, message } = req.body;
      await notificationService.broadcastAnnouncement(
        req.user!,
        targetRoles || [],
        title,
        message,
        req.ip,
        req.headers['user-agent']
      );
      ApiResponse.success(res, 'Global alert announcement broadcast completed successfully');
    } catch (error) {
      next(error);
    }
  }

  async getNotifications(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const notifications = await notificationService.getUserNotifications(userId);
      ApiResponse.success(res, 'Notifications fetched successfully', { notifications });
    } catch (error) {
      next(error);
    }
  }

  async markNotificationRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const notifId = req.params['id'] as string;
      const notification = await notificationService.markNotificationAsRead(userId, notifId);
      ApiResponse.success(res, 'Notification marked as read', { notification });
    } catch (error) {
      next(error);
    }
  }
}

export const adminController = new AdminController();
