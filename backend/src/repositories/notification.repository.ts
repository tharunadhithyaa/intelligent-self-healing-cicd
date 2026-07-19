import { BaseRepository } from './base.repository';
import Notification, { INotificationDocument } from '../models/notification.model';

export class NotificationRepository extends BaseRepository<INotificationDocument> {
  constructor() {
    super(Notification);
  }
}

export const notificationRepository = new NotificationRepository();
