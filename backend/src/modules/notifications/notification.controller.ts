import { Response, NextFunction } from 'express';
import { notificationService } from '../admin/services/notification.service';
import { ApiResponse } from '../../utils/api-response.util';
import { AuthenticatedRequest } from '../../interfaces/request.interface';

class NotificationController {
  async getNotifications(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const notifications = await notificationService.getUserNotifications(userId);
      ApiResponse.success(res, 'Notifications fetched successfully', { notifications });
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id = req.params.id as string;
      const notification = await notificationService.markNotificationAsRead(userId, id);
      ApiResponse.success(res, 'Notification marked as read', { notification });
    } catch (error) {
      next(error);
    }
  }

  async markAllAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      await notificationService.markAllAsRead(userId);
      ApiResponse.success(res, 'All notifications marked as read');
    } catch (error) {
      next(error);
    }
  }

  async deleteNotification(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const id = req.params.id as string;
      await notificationService.deleteNotification(userId, id);
      ApiResponse.success(res, 'Notification deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const notificationController = new NotificationController();
