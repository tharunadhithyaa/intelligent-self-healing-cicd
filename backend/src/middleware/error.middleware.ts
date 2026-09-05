import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/api-error.util";
import { ErrorMessages } from "../constants/error-messages.constants";
import { logger } from "../utils/logger.util";
import config from "../config";

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (err instanceof ApiError) {
    logger.warn(`API Error: ${err.message}`, {
      statusCode: err.statusCode,
      errors: err.errors,
    });

    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.errors.length > 0 && { errors: err.errors }),
    });
    return;
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const mongooseError = err as Error & {
      errors: Record<string, { message: string }>;
    };
    const errors = Object.values(mongooseError.errors).map((e) => e.message);

    res.status(400).json({
      success: false,
      message: ErrorMessages.VALIDATION_ERROR,
      errors,
    });
    return;
  }

  // Mongoose duplicate key error
  if (
    err.name === "MongoServerError" &&
    (err as Error & { code: number }).code === 11000
  ) {
    res.status(409).json({
      success: false,
      message: ErrorMessages.EMAIL_ALREADY_EXISTS,
    });
    return;
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === "CastError") {
    res.status(400).json({
      success: false,
      message: ErrorMessages.NOT_FOUND,
    });
    return;
  }

  // Log unexpected errors
  logger.error("Unhandled error:", err);

  const message =
    config.nodeEnv === "production"
      ? ErrorMessages.INTERNAL_SERVER_ERROR
      : err.message;

  res.status(500).json({
    success: false,
    message,
    ...(config.nodeEnv !== "production" && { stack: err.stack }),
  });
};
