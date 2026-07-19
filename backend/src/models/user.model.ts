import mongoose, { Schema, Document, Model } from 'mongoose';
import { UserRole, Roles } from '../constants/roles.constants';

export interface IUser {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: UserRole;
  phone?: string;
  avatar?: string;
  address?: string;
  bio?: string;
  settings?: {
    appearance?: { theme: string; compactMode: boolean };
    notifications?: { email: boolean; sms: boolean; complaints: boolean; system: boolean };
    privacy?: { showProfile: boolean; showContact: boolean };
    language?: { language: string };
    accessibility?: { highContrast: boolean; reducedMotion: boolean; largerText: boolean };
  };
  isActive: boolean;
  isEmailVerified: boolean;
  isLocked?: boolean;
  lastLogin?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
}

export interface IUserDocument extends IUser, Document {
  fullName: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUserDocument>(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      minlength: [2, 'First name must be at least 2 characters'],
      maxlength: [50, 'First name must be at most 50 characters'],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      minlength: [2, 'Last name must be at least 2 characters'],
      maxlength: [50, 'Last name must be at most 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(Roles),
      default: Roles.CITIZEN,
    },
    phone: {
      type: String,
      trim: true,
      match: [/^\+?[\d\s-]{10,15}$/, 'Please provide a valid phone number'],
    },
    avatar: {
      type: String,
    },
    address: {
      type: String,
      trim: true,
    },
    bio: {
      type: String,
      trim: true,
    },
    settings: {
      appearance: {
        theme: { type: String, default: 'system' },
        compactMode: { type: Boolean, default: false }
      },
      notifications: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        complaints: { type: Boolean, default: true },
        system: { type: Boolean, default: true }
      },
      privacy: {
        showProfile: { type: Boolean, default: true },
        showContact: { type: Boolean, default: false }
      },
      language: {
        language: { type: String, default: 'en' }
      },
      accessibility: {
        highContrast: { type: Boolean, default: false },
        reducedMotion: { type: Boolean, default: false },
        largerText: { type: Boolean, default: false }
      }
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isLocked: {
      type: Boolean,
      default: false,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    lastLogin: {
      type: Date,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        const r = ret as Record<string, any>;
        delete r.password;
        delete r.passwordResetToken;
        delete r.passwordResetExpires;
        delete r.__v;
        return r;
      },
    },
    toObject: {
      transform(_doc, ret) {
        const r = ret as Record<string, any>;
        delete r.password;
        delete r.passwordResetToken;
        delete r.passwordResetExpires;
        delete r.__v;
        return r;
      },
    },
  }
);

userSchema.virtual('fullName').get(function (this: IUserDocument) {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.index({ role: 1, isActive: 1 });

const User: Model<IUserDocument> = mongoose.model<IUserDocument>('User', userSchema);

export default User;
