export const ErrorMessages = {
  // General
  INTERNAL_SERVER_ERROR: 'An unexpected error occurred. Please try again later.',
  VALIDATION_ERROR: 'Validation failed. Please check your input.',
  NOT_FOUND: 'The requested resource was not found.',
  TOO_MANY_REQUESTS: 'Too many requests. Please try again later.',

  // Authentication
  INVALID_CREDENTIALS: 'Invalid email or password.',
  EMAIL_ALREADY_EXISTS: 'An account with this email already exists.',
  USER_NOT_FOUND: 'User not found.',
  UNAUTHORIZED: 'You are not authorized to access this resource.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  TOKEN_EXPIRED: 'Your session has expired. Please log in again.',
  TOKEN_INVALID: 'Invalid authentication token.',
  TOKEN_REQUIRED: 'Authentication token is required.',
  REFRESH_TOKEN_INVALID: 'Invalid refresh token.',
  REFRESH_TOKEN_EXPIRED: 'Refresh token has expired. Please log in again.',
  REFRESH_TOKEN_REVOKED: 'Refresh token has been revoked.',

  // Password
  PASSWORD_MISMATCH: 'Passwords do not match.',
  PASSWORD_RESET_TOKEN_INVALID: 'Password reset token is invalid or has expired.',
  PASSWORD_RESET_EMAIL_SENT: 'If an account with that email exists, a password reset link has been sent.',

  // Account
  ACCOUNT_INACTIVE: 'Your account has been deactivated. Please contact support.',
  ACCOUNT_NOT_VERIFIED: 'Please verify your email address before logging in.',
} as const;

export const SuccessMessages = {
  REGISTERED: 'Account created successfully.',
  LOGGED_IN: 'Logged in successfully.',
  LOGGED_OUT: 'Logged out successfully.',
  TOKEN_REFRESHED: 'Token refreshed successfully.',
  PASSWORD_RESET_REQUESTED: 'If an account with that email exists, a password reset link has been sent.',
  PASSWORD_RESET_SUCCESS: 'Password has been reset successfully.',
  PROFILE_UPDATED: 'Profile updated successfully.',
  USER_FETCHED: 'User details retrieved successfully.',
} as const;
