import { UserRole } from '../constants/app.constants';

export interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  phone?: string;
  avatar?: string;
  address?: string;
  bio?: string;
  notificationPreferences?: {
    email: boolean;
    statusUpdates: boolean;
    alerts: boolean;
  };
  isActive: boolean;
  isEmailVerified: boolean;
  isLocked?: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}
