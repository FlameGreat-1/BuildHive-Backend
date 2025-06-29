import { buildHiveLogger } from './logger.util';

interface ErrorDetails {
  code: string;
  message: string;
  statusCode: number;
  isOperational: boolean;
  context?: Record<string, any>;
  timestamp: Date;
}

export class BuildHiveAuthError extends Error implements ErrorDetails {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, any>;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    context?: Record<string, any>
  ) {
    super(message);
    
    this.name = 'BuildHiveAuthError';
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.context = context;
    this.timestamp = new Date();

    Error.captureStackTrace(this, BuildHiveAuthError);
  }

  toJSON(): ErrorDetails {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      isOperational: this.isOperational,
      context: this.context,
      timestamp: this.timestamp,
    };
  }
}

export const AUTH_ERROR_CODES = {
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  USER_SUSPENDED: 'USER_SUSPENDED',
  USER_NOT_VERIFIED: 'USER_NOT_VERIFIED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_MALFORMED: 'TOKEN_MALFORMED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  ACCESS_DENIED: 'ACCESS_DENIED',
  ROLE_NOT_AUTHORIZED: 'ROLE_NOT_AUTHORIZED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INVALID_EMAIL: 'INVALID_EMAIL',
  INVALID_PHONE: 'INVALID_PHONE',
  INVALID_ABN: 'INVALID_ABN',
  WEAK_PASSWORD: 'WEAK_PASSWORD',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_ATTEMPTS: 'TOO_MANY_ATTEMPTS',
  VERIFICATION_FAILED: 'VERIFICATION_FAILED',
  VERIFICATION_EXPIRED: 'VERIFICATION_EXPIRED',
  VERIFICATION_ALREADY_USED: 'VERIFICATION_ALREADY_USED',
  PROFILE_INCOMPLETE: 'PROFILE_INCOMPLETE',
  PROFILE_UPDATE_FAILED: 'PROFILE_UPDATE_FAILED',
  FILE_UPLOAD_FAILED: 'FILE_UPLOAD_FAILED',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  DATABASE_ERROR: 'DATABASE_ERROR',
  REDIS_ERROR: 'REDIS_ERROR',
  EMAIL_SERVICE_ERROR: 'EMAIL_SERVICE_ERROR',
  SMS_SERVICE_ERROR: 'SMS_SERVICE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

class AuthErrorFactory {
  static userNotFound(userId?: string, context?: Record<string, any>): BuildHiveAuthError {
    return new BuildHiveAuthError(
      'User not found',
      AUTH_ERROR_CODES.USER_NOT_FOUND,
      404,
      true,
      { userId, ...context }
    );
  }

  static userAlreadyExists(email: string, context?: Record<string, any>): BuildHiveAuthError {
    return new BuildHiveAuthError(
      'User with this email already exists',
      AUTH_ERROR_CODES.USER_ALREADY_EXISTS,
      409,
      true,
      { email, ...context }
    );
  }

  static userSuspended(userId: string, reason?: string, context?: Record<string, any>): BuildHiveAuthError {
    return new BuildHiveAuthError(
      'User account has been suspended',
      AUTH_ERROR_CODES.USER_SUSPENDED,
      403,
      true,
      { userId, reason, ...context }
    );
  }

  static userNotVerified(email: string, context?: Record<string, any>): BuildHiveAuthError {
    return new BuildHiveAuthError(
      'Email address not verified',
      AUTH_ERROR_CODES.USER_NOT_VERIFIED,
      403,
      true,
      { email, ...context }
    );
  }

  static invalidCredentials(email?: string, context?: Record<string, any>): BuildHiveAuthError {
    return new BuildHiveAuthError(
      'Invalid email or password',
      AUTH_ERROR_CODES.INVALID_CREDENTIALS,
      401,
      true,
      { email, ...context }
    );
  }

  static invalidToken(tokenType: string, context?: Record<string, any>): BuildHiveAuthError {
    return new BuildHiveAuthError(
      'Invalid or expired token',
      AUTH_ERROR_CODES.INVALID_TOKEN,
      401,
      true,
      { tokenType, ...context }
    );
  }

  static tokenExpired(tokenType: string, context?: Record<string, any>): BuildHiveAuthError {
    return new BuildHiveAuthError(
      'Token has expired',
      AUTH_ERROR_CODES.TOKEN_EXPIRED,
      401,
      true,
      { tokenType, ...context }
    );
  }

  static registrationFailed(message: string, error?: Error, context?: Record<string, any>): BuildHiveAuthError {
    return new BuildHiveAuthError(
      message || 'User registration failed',
      AUTH_ERROR_CODES.INTERNAL_ERROR,
      500,
      false,
      { originalError: error?.message, ...context }
    );
  }

  static loginFailed(message: string, error?: Error, context?: Record<string, any>): BuildHiveAuthError {
    return new BuildHiveAuthError(
      message || 'Login failed',
      AUTH_ERROR_CODES.INTERNAL_ERROR,
      500,
      false,
      { originalError: error?.message, ...context }
    );
  }

  static profileNotFound(userId?: string, context?: Record<string, any>): BuildHiveAuthError {
    return new BuildHiveAuthError(
      'User profile not found',
      AUTH_ERROR_CODES.USER_NOT_FOUND,
      404,
      true,
      { userId, ...context }
    );
  }

  static alreadyVerified(type: string, context?: Record<string, any>): BuildHiveAuthError {
    return new BuildHiveAuthError(
      `${type} is already verified`,
      AUTH_ERROR_CODES.VERIFICATION_ALREADY_USED,
      409,
      true,
      { verificationType: type, ...context }
    );
  }

  static tooManyAttempts(action: string, context?: Record<string, any>): BuildHiveAuthError {
    return new BuildHiveAuthError(
      'Too many attempts. Please try again later',
      AUTH_ERROR_CODES.TOO_MANY_ATTEMPTS,
      429,
      true,
      { action, ...context }
    );
  }

  static invalidVerificationCode(context?: Record<string, any>): BuildHiveAuthError {
    return new BuildHiveAuthError(
      'Invalid verification code',
      AUTH_ERROR_CODES.VERIFICATION_FAILED,
      400,
      true,
      context
    );
  }

  static verificationExpired(context?: Record<string, any>): BuildHiveAuthError {
    return new BuildHiveAuthError(
      'Verification code has expired',
      AUTH_ERROR_CODES.VERIFICATION_EXPIRED,
      400,
      true,
      context
    );
  }
  
static duplicateProfile(context?: Record<string, any>): BuildHiveAuthError {
  return new BuildHiveAuthError(
    'Profile already exists for this user',
    AUTH_ERROR_CODES.USER_ALREADY_EXISTS,
    409,
    true,
    context
  );
}

static invalidInput(message: string, context?: Record<string, any>): BuildHiveAuthError {
  return new BuildHiveAuthError(
    message || 'Invalid input provided',
    AUTH_ERROR_CODES.VALIDATION_FAILED,
    422,
    true,
    context
  );
}
 
 static duplicateUser(field: string, context?: Record<string, any>): BuildHiveAuthError {
  return new BuildHiveAuthError(
    `User with this ${field} already exists`,
    AUTH_ERROR_CODES.USER_ALREADY_EXISTS,
    409,
    true,
    { duplicateField: field, ...context }
  );
}

static accountLocked(context?: Record<string, any>): BuildHiveAuthError {
  return new BuildHiveAuthError(
    'Account is temporarily locked due to too many failed login attempts',
    AUTH_ERROR_CODES.TOO_MANY_ATTEMPTS,
    423,
    true,
    context
  );
}

  static verificationFailed(message: string, error?: Error, context?: Record<string, any>): BuildHiveAuthError {
    return new BuildHiveAuthError(
      message || 'Verification failed',
      AUTH_ERROR_CODES.VERIFICATION_FAILED,
      400,
      true,
      { originalError: error?.message, ...context }
    );
  }

  static passwordMismatch(context?: Record<string, any>): BuildHiveAuthError {
    return new BuildHiveAuthError(
      'Passwords do not match',
      AUTH_ERROR_CODES.VALIDATION_FAILED,
      422,
      true,
      context
    );
  }

  static passwordResetFailed(message: string, error?: Error, context?: Record<string, any>): BuildHiveAuthError {
    return new BuildHiveAuthError(
      message || 'Password reset failed',
      AUTH_ERROR_CODES.INTERNAL_ERROR,
      500,
      false,
      { originalError: error?.message, ...context }
    );
  }

  static passwordChangeFailed(message: string, error?: Error, context?: Record<string, any>): BuildHiveAuthError {
    return new BuildHiveAuthError(
      message || 'Password change failed',
      AUTH_ERROR_CODES.INTERNAL_ERROR,
      500,
      false,
      { originalError: error?.message, ...context }
    );
  }

  static tokenRefreshFailed(message: string, error?: Error, context?: Record<string, any>): BuildHiveAuthError {
    return new BuildHiveAuthError(
      message || 'Token refresh failed',
      AUTH_ERROR_CODES.TOKEN_EXPIRED,
      401,
      true,
      { originalError: error?.message, ...context }
    );
  }

  static logoutFailed(message: string, error?: Error, context?: Record<string, any>): BuildHiveAuthError {
    return new BuildHiveAuthError(
      message || 'Logout failed',
      AUTH_ERROR_CODES.INTERNAL_ERROR,
      500,
      false,
      { originalError: error?.message, ...context }
    );
  }

  static suspiciousActivity(message: string, context?: Record<string, any>): BuildHiveAuthError {
    return new BuildHiveAuthError(
      message || 'Suspicious activity detected',
      AUTH_ERROR_CODES.ACCESS_DENIED,
      403,
      true,
      context
    );
  }

  static sessionRevocationFailed(message: string, error?: Error, context?: Record<string, any>): BuildHiveAuthError {
    return new BuildHiveAuthError(
      message || 'Session revocation failed',
      AUTH_ERROR_CODES.INTERNAL_ERROR,
      500,
      false,
      { originalError: error?.message, ...context }
    );
  }

  static insufficientPermissions(requiredRole: string, userRole: string, context?: Record<string, any>): BuildHiveAuthError {
    return new BuildHiveAuthError(
      'Insufficient permissions for this action',
      AUTH_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
      403,
      true,
      { requiredRole, userRole, ...context }
    );
  }

  static validationFailed(errors: Record<string, string[]>, context?: Record<string, any>): BuildHiveAuthError {
    return new BuildHiveAuthError(
      'Validation failed',
      AUTH_ERROR_CODES.VALIDATION_FAILED,
      422,
      true,
      { validationErrors: errors, ...context }
    );
  }

  static weakPassword(requirements: string[], context?: Record<string, any>): BuildHiveAuthError {
    return new BuildHiveAuthError(
      'Password does not meet security requirements',
      AUTH_ERROR_CODES.WEAK_PASSWORD,
      422,
      true,
      { requirements, ...context }
    );
  }

  static rateLimitExceeded(endpoint: string, resetTime: Date, context?: Record<string, any>): BuildHiveAuthError {
    return new BuildHiveAuthError(
      'Rate limit exceeded. Please try again later',
      AUTH_ERROR_CODES.RATE_LIMIT_EXCEEDED,
      429,
      true,
      { endpoint, resetTime, ...context }
    );
  }

  static fileTooLarge(maxSize: number, actualSize: number, context?: Record<string, any>): BuildHiveAuthError {
    return new BuildHiveAuthError(
      'File size exceeds maximum allowed limit',
      AUTH_ERROR_CODES.FILE_TOO_LARGE,
      413,
      true,
      { maxSize, actualSize, ...context }
    );
  }

  static invalidFileType(allowedTypes: string[], actualType: string, context?: Record<string, any>): BuildHiveAuthError {
    return new BuildHiveAuthError(
      'File type not supported',
      AUTH_ERROR_CODES.INVALID_FILE_TYPE,
      422,
      true,
      { allowedTypes, actualType, ...context }
    );
  }

  static databaseError(operation: string, error: Error, context?: Record<string, any>): BuildHiveAuthError {
    return new BuildHiveAuthError(
      'Database operation failed',
      AUTH_ERROR_CODES.DATABASE_ERROR,
      500,
      false,
      { operation, originalError: error.message, ...context }
    );
  }

  static emailServiceError(operation: string, error: Error, context?: Record<string, any>): BuildHiveAuthError {
    return new BuildHiveAuthError(
      'Email service unavailable',
      AUTH_ERROR_CODES.EMAIL_SERVICE_ERROR,
      503,
      false,
      { operation, originalError: error.message, ...context }
    );
  }

  static internalError(message: string, error?: Error, context?: Record<string, any>): BuildHiveAuthError {
    return new BuildHiveAuthError(
      message,
      AUTH_ERROR_CODES.INTERNAL_ERROR,
      500,
      false,
      { originalError: error?.message, stack: error?.stack, ...context }
    );
  }
}

class AuthErrorHandler {
  static handle(error: Error, context?: Record<string, any>): BuildHiveAuthError {
    if (error instanceof BuildHiveAuthError) {
      this.logError(error, context);
      return error;
    }

    const authError = AuthErrorFactory.internalError(
      error.message || 'An unexpected error occurred',
      error,
      context
    );

    this.logError(authError, context);
    return authError;
  }

  private static logError(error: BuildHiveAuthError, context?: Record<string, any>): void {
    const logContext = {
      ...error.context,
      ...context,
      errorCode: error.code,
      statusCode: error.statusCode,
      isOperational: error.isOperational,
    };

    if (error.isOperational) {
      buildHiveLogger.warn(error.message, logContext);
    } else {
      buildHiveLogger.error(error.message, error, logContext);
    }
  }

  static isOperational(error: Error): boolean {
    if (error instanceof BuildHiveAuthError) {
      return error.isOperational;
    }
    return false;
  }

  static getSafeMessage(error: Error): string {
    if (error instanceof BuildHiveAuthError && error.isOperational) {
      return error.message;
    }
    return 'An internal error occurred';
  }

  static getErrorCode(error: Error): string {
    if (error instanceof BuildHiveAuthError) {
      return error.code;
    }
    return AUTH_ERROR_CODES.INTERNAL_ERROR;
  }
}

export { AuthErrorFactory, AuthErrorHandler };
export { AUTH_ERROR_CODES };
export default AuthErrorFactory;
