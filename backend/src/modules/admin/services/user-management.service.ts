import User, { IUserDocument } from '../../../models/user.model';
import { ApiError } from '../../../utils/api-error.util';
import { hashPassword } from '../../../utils/password.util';
import { auditService } from './audit.service';
import { TokenPayload } from '../../../utils/jwt.util';

class UserManagementService {
  async getUsers(
    search?: string,
    role?: string,
    isActive?: boolean,
    isLocked?: boolean,
    page = 1,
    limit = 10,
    sortField = 'createdAt',
    sortOrder = 'desc'
  ): Promise<{ users: IUserDocument[]; total: number }> {
    const filter: Record<string, any> = {};

    if (role) {
      filter.role = role;
    }
    if (isActive !== undefined) {
      filter.isActive = isActive;
    }
    if (isLocked !== undefined) {
      filter.isLocked = isLocked;
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filter.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex }
      ];
    }

    const sort: Record<string, any> = { [sortField]: sortOrder === 'desc' ? -1 : 1 };
    const skip = (page - 1) * limit;

    const users = await User.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .exec();

    const total = await User.countDocuments(filter).exec();

    return { users, total };
  }

  async setUserActiveState(
    admin: TokenPayload,
    targetUserId: string,
    isActive: boolean,
    ipAddress?: string,
    userAgent?: string
  ): Promise<IUserDocument> {
    const user = await User.findById(targetUserId);
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    if (user._id.toString() === admin.userId) {
      throw ApiError.badRequest('You cannot deactivate your own account');
    }

    user.isActive = isActive;
    const updated = await user.save();

    await auditService.log({
      actorId: admin.userId,
      actorEmail: admin.email,
      actorRole: admin.role,
      action: isActive ? 'user_activated' : 'user_deactivated',
      target: 'User',
      targetId: targetUserId,
      details: { email: user.email, role: user.role },
      ipAddress,
      userAgent
    });

    return updated;
  }

  async setUserLockState(
    admin: TokenPayload,
    targetUserId: string,
    isLocked: boolean,
    ipAddress?: string,
    userAgent?: string
  ): Promise<IUserDocument> {
    const user = await User.findById(targetUserId);
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    if (user._id.toString() === admin.userId) {
      throw ApiError.badRequest('You cannot lock your own account');
    }

    user.isLocked = isLocked;
    const updated = await user.save();

    await auditService.log({
      actorId: admin.userId,
      actorEmail: admin.email,
      actorRole: admin.role,
      action: isLocked ? 'user_locked' : 'user_unlocked',
      target: 'User',
      targetId: targetUserId,
      details: { email: user.email, role: user.role },
      ipAddress,
      userAgent
    });

    return updated;
  }

  async resetUserPasswordByAdmin(
    admin: TokenPayload,
    targetUserId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<string> {
    const user = await User.findById(targetUserId);
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    // Default password generated
    const defaultPassword = 'CivicPulse@2026';
    user.password = await hashPassword(defaultPassword);
    await user.save();

    await auditService.log({
      actorId: admin.userId,
      actorEmail: admin.email,
      actorRole: admin.role,
      action: 'password_reset_by_admin',
      target: 'User',
      targetId: targetUserId,
      details: { email: user.email, role: user.role },
      ipAddress,
      userAgent
    });

    return defaultPassword;
  }
}

export const userManagementService = new UserManagementService();
