import crypto from "node:crypto";
import { userRepository } from "../../repositories/user.repository";
import RefreshToken from "../../models/refresh-token.model";
import { hashPassword, comparePassword } from "../../utils/password.util";
import {
  generateTokenPair,
  verifyRefreshToken,
  getRefreshTokenExpiryDate,
  TokenPayload,
} from "../../utils/jwt.util";
import { ApiError } from "../../utils/api-error.util";
import { ErrorMessages } from "../../constants/error-messages.constants";
import { RegisterDto, LoginDto, ResetPasswordDto } from "./dtos/auth.dto";
import { IUserDocument } from "../../models/user.model";
import { logger } from "../../utils/logger.util";

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthResponse {
  user: IUserDocument;
  tokens: AuthTokens;
}

class AuthService {
  async register(data: RegisterDto): Promise<AuthResponse> {
    const existingUser = await userRepository.findByEmail(data.email);
    if (existingUser) {
      throw ApiError.conflict(ErrorMessages.EMAIL_ALREADY_EXISTS);
    }

    const hashedPassword = await hashPassword(data.password);

    const user = await userRepository.create({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email.toLowerCase(),
      password: hashedPassword,
      phone: data.phone,
      role: (data.role as IUserDocument["role"]) || "citizen",
    } as Partial<IUserDocument>);

    const tokenPayload: TokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    const tokens = generateTokenPair(tokenPayload);
    await this.saveRefreshToken(tokens.refreshToken, user._id.toString());

    logger.info(`New user registered: ${user.email}`);
    return { user, tokens };
  }

  async login(data: LoginDto): Promise<AuthResponse> {
    const user = await userRepository.findByEmail(data.email, true);
    if (!user) {
      throw ApiError.unauthorized(ErrorMessages.INVALID_CREDENTIALS);
    }

    if (!user.isActive) {
      throw ApiError.forbidden(ErrorMessages.ACCOUNT_INACTIVE);
    }

    const isPasswordValid = await comparePassword(data.password, user.password);
    if (!isPasswordValid) {
      throw ApiError.unauthorized(ErrorMessages.INVALID_CREDENTIALS);
    }

    const tokenPayload: TokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    const tokens = generateTokenPair(tokenPayload);
    await this.saveRefreshToken(tokens.refreshToken, user._id.toString());
    await userRepository.updateLastLogin(user._id.toString());

    logger.info(`User logged in: ${user.email}`);
    return { user, tokens };
  }

  async refreshToken(refreshTokenStr: string): Promise<AuthTokens> {
    const storedToken = await RefreshToken.findOne({
      token: refreshTokenStr,
      isRevoked: false,
    });

    if (!storedToken) {
      throw ApiError.unauthorized(ErrorMessages.REFRESH_TOKEN_INVALID);
    }

    if (storedToken.expiresAt < new Date()) {
      await RefreshToken.findByIdAndDelete(storedToken._id);
      throw ApiError.unauthorized(ErrorMessages.REFRESH_TOKEN_EXPIRED);
    }

    let payload: TokenPayload;
    try {
      payload = verifyRefreshToken(refreshTokenStr);
    } catch {
      await RefreshToken.findByIdAndUpdate(storedToken._id, {
        isRevoked: true,
      });
      throw ApiError.unauthorized(ErrorMessages.REFRESH_TOKEN_INVALID);
    }

    // Revoke old token and issue new pair (token rotation)
    await RefreshToken.findByIdAndUpdate(storedToken._id, { isRevoked: true });

    const user = await userRepository.findById(payload.userId);
    if (!user?.isActive) {
      throw ApiError.unauthorized(ErrorMessages.UNAUTHORIZED);
    }

    const newTokenPayload: TokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    const tokens = generateTokenPair(newTokenPayload);
    await this.saveRefreshToken(tokens.refreshToken, user._id.toString());

    return tokens;
  }

  async logout(refreshTokenStr: string): Promise<void> {
    await RefreshToken.findOneAndUpdate(
      { token: refreshTokenStr },
      { isRevoked: true },
    );
    logger.info("User logged out, refresh token revoked");
  }

  async logoutAll(userId: string): Promise<void> {
    await RefreshToken.updateMany(
      { userId, isRevoked: false },
      { isRevoked: true },
    );
    logger.info(`All sessions revoked for user: ${userId}`);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      // Don't reveal if email exists - return silently
      return;
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    await userRepository.updateById(user._id.toString(), {
      passwordResetToken: hashedToken,
      passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    });

    // In production, send email with resetToken
    logger.info(`Password reset requested for: ${email}, token: ${resetToken}`);
  }

  async resetPassword(data: ResetPasswordDto): Promise<void> {
    const hashedToken = crypto
      .createHash("sha256")
      .update(data.token)
      .digest("hex");

    const user = await userRepository.findByResetToken(hashedToken);
    if (!user) {
      throw ApiError.badRequest(ErrorMessages.PASSWORD_RESET_TOKEN_INVALID);
    }

    const hashedPassword = await hashPassword(data.password);

    await userRepository.updateById(user._id.toString(), {
      password: hashedPassword,
      passwordResetToken: undefined,
      passwordResetExpires: undefined,
    });

    // Revoke all refresh tokens for security
    await this.logoutAll(user._id.toString());

    logger.info(`Password reset completed for: ${user.email}`);
  }

  async getMe(userId: string): Promise<IUserDocument> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw ApiError.notFound(ErrorMessages.USER_NOT_FOUND);
    }
    return user;
  }

  private async saveRefreshToken(token: string, userId: string): Promise<void> {
    await RefreshToken.create({
      token,
      userId,
      expiresAt: getRefreshTokenExpiryDate(),
    });
  }
}

export const authService = new AuthService();
