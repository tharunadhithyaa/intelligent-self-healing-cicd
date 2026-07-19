import mongoose from 'mongoose';
import Notification, { INotificationDocument } from '../../../models/notification.model';
import User from '../../../models/user.model';
import { ApiError } from '../../../utils/api-error.util';
import { auditService } from './audit.service';
import { TokenPayload } from '../../../utils/jwt.util';

class NotificationService {
  async sendNotification(
    recipientId: string,
    type: 'status_update' | 'assignment' | 'escalation' | 'job_alert' | 'announcement' | 'system_alert',
    title: string,
    message: string,
    relatedEntityId?: string
  ): Promise<INotificationDocument | null> {
    const user = await User.findById(recipientId);
    if (!user) return null;

    // Verify user preferences
    const prefs = user.settings?.notifications;
    if (prefs) {
      if (type === 'status_update' && !prefs.complaints) return null;
      if (['system_alert', 'announcement'].includes(type) && !prefs.system) return null;
    }

    const notif = new Notification({
      recipient: new mongoose.Types.ObjectId(recipientId),
      type,
      title,
      message,
      isRead: false,
      relatedEntityId
    });

    return await notif.save();
  }

  async broadcastAnnouncement(
    admin: TokenPayload,
    targetRoles: string[], // empty array means broadcast to all users
    title: string,
    message: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const filter: Record<string, any> = { isActive: true };
    if (targetRoles.length > 0) {
      filter.role = { $in: targetRoles };
    }

    const users = await User.find(filter).select('_id email settings.notifications').exec();

    const notificationsToInsert = users
      .filter(u => {
        // Respect alerts preference
        return u.settings?.notifications?.system !== false;
      })
      .map(u => ({
        recipient: u._id,
        type: 'announcement' as const,
        title,
        message,
        isRead: false
      }));

    if (notificationsToInsert.length > 0) {
      await Notification.insertMany(notificationsToInsert);
    }

    await auditService.log({
      actorId: admin.userId,
      actorEmail: admin.email,
      actorRole: admin.role,
      action: 'notification_broadcasted',
      target: 'Notification',
      details: { title, targetRoles, recipientCount: notificationsToInsert.length },
      ipAddress,
      userAgent
    });
  }

  async getUserNotifications(userId: string): Promise<INotificationDocument[]> {
    return await Notification.find({ recipient: new mongoose.Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
  }

  async markNotificationAsRead(userId: string, notificationId: string): Promise<INotificationDocument> {
    const notif = await Notification.findOne({
      _id: new mongoose.Types.ObjectId(notificationId),
      recipient: new mongoose.Types.ObjectId(userId)
    });

    if (!notif) {
      throw ApiError.notFound('Notification not found');
    }

    notif.isRead = true;
    return await notif.save();
  }

  async markAllAsRead(userId: string): Promise<void> {
    await Notification.updateMany(
      { recipient: new mongoose.Types.ObjectId(userId), isRead: false },
      { $set: { isRead: true } }
    );
  }

  async deleteNotification(userId: string, notificationId: string): Promise<void> {
    const result = await Notification.deleteOne({
      _id: new mongoose.Types.ObjectId(notificationId),
      recipient: new mongoose.Types.ObjectId(userId)
    });

    if (result.deletedCount === 0) {
      throw ApiError.notFound('Notification not found');
    }
  }
}

export const notificationService = new NotificationService();
