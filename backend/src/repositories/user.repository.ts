import { BaseRepository } from './base.repository';
import User, { IUserDocument } from '../models/user.model';

export class UserRepository extends BaseRepository<IUserDocument> {
  constructor() {
    super(User);
  }

  async findByEmail(email: string, includePassword = false): Promise<IUserDocument | null> {
    const query = this.model.findOne({ email: email.toLowerCase() });
    if (includePassword) {
      query.select('+password');
    }
    return query.exec();
  }

  async findByResetToken(token: string): Promise<IUserDocument | null> {
    return this.model
      .findOne({
        passwordResetToken: token,
        passwordResetExpires: { $gt: new Date() },
      })
      .select('+passwordResetToken +passwordResetExpires')
      .exec();
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.model.findByIdAndUpdate(userId, { lastLogin: new Date() }).exec();
  }

  async findActiveUsers(role?: string): Promise<IUserDocument[]> {
    const filter: Record<string, unknown> = { isActive: true };
    if (role) {
      filter['role'] = role;
    }
    return this.model.find(filter).exec();
  }
}

export const userRepository = new UserRepository();
