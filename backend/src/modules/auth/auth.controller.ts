import { Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { ApiResponse } from '../../utils/api-response.util';
import { SuccessMessages } from '../../constants/error-messages.constants';
import { AuthenticatedRequest } from '../../interfaces/request.interface';
import { RegisterDto, LoginDto, ForgotPasswordDto, ResetPasswordDto, RefreshTokenDto } from './dtos/auth.dto';

class AuthController {
  async register(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: RegisterDto = req.body;
      const result = await authService.register(data);
      ApiResponse.created(res, SuccessMessages.REGISTERED, {
        user: result.user,
        tokens: result.tokens,
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: LoginDto = req.body;
      const result = await authService.login(data);
      ApiResponse.success(res, SuccessMessages.LOGGED_IN, {
        user: result.user,
        tokens: result.tokens,
      });
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken }: RefreshTokenDto = req.body;
      const tokens = await authService.refreshToken(refreshToken);
      ApiResponse.success(res, SuccessMessages.TOKEN_REFRESHED, { tokens });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken }: RefreshTokenDto = req.body;
      await authService.logout(refreshToken);
      ApiResponse.success(res, SuccessMessages.LOGGED_OUT);
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email }: ForgotPasswordDto = req.body;
      await authService.forgotPassword(email);
      ApiResponse.success(res, SuccessMessages.PASSWORD_RESET_REQUESTED);
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: ResetPasswordDto = req.body;
      await authService.resetPassword(data);
      ApiResponse.success(res, SuccessMessages.PASSWORD_RESET_SUCCESS);
    } catch (error) {
      next(error);
    }
  }

  async getMe(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const user = await authService.getMe(userId);
      ApiResponse.success(res, SuccessMessages.USER_FETCHED, { user });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
