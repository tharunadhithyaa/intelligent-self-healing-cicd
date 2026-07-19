import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRefreshToken {
  token: string;
  userId: mongoose.Types.ObjectId;
  expiresAt: Date;
  isRevoked: boolean;
}

export interface IRefreshTokenDocument extends IRefreshToken, Document {
  createdAt: Date;
}

const refreshTokenSchema = new Schema<IRefreshTokenDocument>(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    isRevoked: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// TTL index: automatically delete expired tokens
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for efficient lookups
refreshTokenSchema.index({ userId: 1, isRevoked: 1 });

const RefreshToken: Model<IRefreshTokenDocument> = mongoose.model<IRefreshTokenDocument>(
  'RefreshToken',
  refreshTokenSchema
);

export default RefreshToken;
