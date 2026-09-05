import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAuditLog {
  actor?: mongoose.Types.ObjectId; // User performing the action, undefined for anonymous (failed login)
  actorEmail?: string; // Cache email in log
  actorRole?: string; // citizen, officer, admin
  action: string; // e.g. login_success, user_deactivated, password_changed
  target?: string; // e.g. User, Complaint, Department
  targetId?: string; // Id of the target entity
  details?: Record<string, any>; // Arbitrary metadata
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export interface IAuditLogDocument extends IAuditLog, Document {}

const auditLogSchema = new Schema<IAuditLogDocument>(
  {
    actor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    actorEmail: {
      type: String,
      trim: true,
    },
    actorRole: {
      type: String,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    target: {
      type: String,
      index: true,
    },
    targetId: {
      type: String,
      index: true,
    },
    details: {
      type: Schema.Types.Mixed,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },
  },
  {
    timestamps: false, // Action timestamp itself functions as standard createdAt
  },
);

// Compound index for querying log history
auditLogSchema.index({ timestamp: -1, action: 1 });

const AuditLog: Model<IAuditLogDocument> = mongoose.model<IAuditLogDocument>(
  "AuditLog",
  auditLogSchema,
);

export default AuditLog;
