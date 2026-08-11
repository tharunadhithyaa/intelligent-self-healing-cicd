import mongoose from "mongoose";
import User, { IUserDocument } from "../../models/user.model";
import { ApiError } from "../../utils/api-error.util";
import { hashPassword, comparePassword } from "../../utils/password.util";
export interface UpdateProfileInput {
  firstName: string;
  lastName: string;
  phone?: string;
  address?: string;
  bio?: string;
}

export interface UpdateSettingsInput {
  appearance?: { theme: string; compactMode: boolean };
  notifications?: {
    email: boolean;
    sms: boolean;
    complaints: boolean;
    system: boolean;
  };
  privacy?: { showProfile: boolean; showContact: boolean };
  language?: { language: string };
  accessibility?: {
    highContrast: boolean;
    reducedMotion: boolean;
    largerText: boolean;
  };
}

class CitizenService {
  async updateProfile(
    userId: string,
    input: UpdateProfileInput,
  ): Promise<IUserDocument> {
    const user = await User.findById(userId);
    if (!user) {
      throw ApiError.notFound("User not found");
    }

    user.firstName = input.firstName;
    user.lastName = input.lastName;
    if (input.phone !== undefined) user.phone = input.phone;
    if (input.address !== undefined) user.address = input.address;
    if (input.bio !== undefined) user.bio = input.bio;

    return await user.save();
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    // Select password field explicitly since select: false in model
    const user = await User.findById(userId).select("+password");
    if (!user) {
      throw ApiError.notFound("User not found");
    }

    const isMatch = await comparePassword(currentPassword, user.password);
    if (!isMatch) {
      throw ApiError.badRequest("Incorrect current password");
    }

    user.password = await hashPassword(newPassword);
    await user.save();
  }

  async getSettings(userId: string): Promise<any> {
    const user = await User.findById(userId);
    if (!user) throw ApiError.notFound("User not found");
    return user.settings || {};
  }

  async updateSettings(
    userId: string,
    input: UpdateSettingsInput,
  ): Promise<IUserDocument> {
    const user = await User.findById(userId);
    if (!user) {
      throw ApiError.notFound("User not found");
    }

    user.settings ??= {};

    if (input.appearance) user.settings.appearance = input.appearance;
    if (input.notifications) user.settings.notifications = input.notifications;
    if (input.privacy) user.settings.privacy = input.privacy;
    if (input.language) user.settings.language = input.language;
    if (input.accessibility) user.settings.accessibility = input.accessibility;

    return await user.save();
  }

  async downloadData(userId: string): Promise<any> {
    const user = await User.findById(userId).lean();
    if (!user) throw ApiError.notFound("User not found");

    const [complaints, notifications, conversations] = await Promise.all([
      mongoose
        .model("Complaint")
        .find({ citizen: new mongoose.Types.ObjectId(userId) })
        .lean(),
      mongoose
        .model("Notification")
        .find({ recipient: new mongoose.Types.ObjectId(userId) })
        .lean(),
      mongoose
        .model("Conversation")
        .find({ userId: new mongoose.Types.ObjectId(userId) })
        .lean(),
    ]);

    return {
      profile: user,
      complaints,
      notifications,
      conversations,
    };
  }
}

export const citizenService = new CitizenService();
