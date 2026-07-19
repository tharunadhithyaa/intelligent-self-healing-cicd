import mongoose, { Schema, Document, Model } from 'mongoose';

export interface INotification {
  recipient: mongoose.Types.ObjectId;
  type: 'status_update' | 'assignment' | 'escalation' | 'job_alert' | 'announcement' | 'system_alert';
  title: string;
  message: string;
  isRead: boolean;
  relatedEntityId?: string; // Optional reference to complaint, user, etc.
}

export interface INotificationDocument extends INotification, Document {
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotificationDocument>(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['status_update', 'assignment', 'escalation', 'job_alert', 'announcement', 'system_alert'],
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    isRead: {
      type: Boolean,
      default: false,
      required: true,
      index: true
    },
    relatedEntityId: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

const Notification: Model<INotificationDocument> = mongoose.model<INotificationDocument>('Notification', notificationSchema);

export default Notification;
