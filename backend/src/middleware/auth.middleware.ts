import { Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../utils/jwt.util';
import { ApiError } from '../utils/api-error.util';
import { ErrorMessages } from '../constants/error-messages.constants';
import { AuthenticatedRequest } from '../interfaces/request.interface';

export const authenticate = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized(ErrorMessages.TOKEN_REQUIRED);
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      throw ApiError.unauthorized(ErrorMessages.TOKEN_REQUIRED);
    }

    const payload: TokenPayload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
      return;
    }

    const err = error as Error;
    if (err.name === 'TokenExpiredError') {
      next(ApiError.unauthorized(ErrorMessages.TOKEN_EXPIRED));
      return;
    }
    if (err.name === 'JsonWebTokenError') {
      next(ApiError.unauthorized(ErrorMessages.TOKEN_INVALID));
      return;
    }

    next(ApiError.unauthorized(ErrorMessages.UNAUTHORIZED));
  }
};
