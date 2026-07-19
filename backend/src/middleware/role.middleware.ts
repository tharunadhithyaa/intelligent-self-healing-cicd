import { Response, NextFunction } from 'express';
import { UserRole } from '../constants/roles.constants';
import { ApiError } from '../utils/api-error.util';
import { ErrorMessages } from '../constants/error-messages.constants';
import { AuthenticatedRequest } from '../interfaces/request.interface';

export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(ApiError.unauthorized(ErrorMessages.UNAUTHORIZED));
      return;
    }

    if (!allowedRoles.includes(req.user.role as UserRole)) {
      next(ApiError.forbidden(ErrorMessages.FORBIDDEN));
      return;
    }

    next();
  };
};
