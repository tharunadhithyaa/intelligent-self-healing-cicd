import { Response, NextFunction } from 'express';
import Role from '../models/role.model';
import { ApiError } from '../utils/api-error.util';
import { AuthenticatedRequest } from '../interfaces/request.interface';
import { Permission } from '../constants/permissions.constants';

export const checkPermission = (requiredPermission: Permission) => {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        next(ApiError.unauthorized('Authentication is required'));
        return;
      }

      const userRole = req.user.role;
      const roleDoc = await Role.findOne({ name: userRole.toLowerCase() });

      if (!roleDoc) {
        next(ApiError.forbidden('Your account role does not have configured permissions'));
        return;
      }

      if (!roleDoc.permissions.includes(requiredPermission)) {
        next(ApiError.forbidden('You do not have the required permissions to perform this action'));
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
