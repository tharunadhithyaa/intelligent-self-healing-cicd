import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ApiError } from '../utils/api-error.util';
import { ErrorMessages } from '../constants/error-messages.constants';

type ValidationSource = 'body' | 'params' | 'query';

export const validate = (
  schema: Joi.ObjectSchema,
  source: ValidationSource = 'body'
) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: false,
    });

    if (error) {
      const errors = error.details.map((detail) => detail.message);
      next(ApiError.badRequest(ErrorMessages.VALIDATION_ERROR, errors));
      return;
    }

    req[source] = value;
    next();
  };
};
