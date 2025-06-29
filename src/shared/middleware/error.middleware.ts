import { Request, Response, NextFunction } from 'express';
import { BuildHiveAuthError, AuthErrorHandler, AUTH_ERROR_CODES } from '../utils/error.util';
import { buildHiveResponse } from '../utils/response.util';
import { buildHiveLogger } from '../utils/logger.util';
import { isProduction } from '../../config/auth';

// Request interface with additional properties
interface BuildHiveRequest extends Request {
  requestId?: string;
  userId?: string;
  userRole?: string;
}

// Error middleware class implementing Single Responsibility Principle
class ErrorMiddleware {
  // Main error handler
  static handle(
    error: Error,
    req: BuildHiveRequest,
    res: Response,
    next: NextFunction
  ): Response | void {
    // Generate request ID if not present
    const requestId = req.requestId || this.generateRequestId();
    
    // Add request context
    const context = {
      requestId,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.userId,
      userRole: req.userRole,
    };

    // Handle the error using our error handler
    const handledError = AuthErrorHandler.handle(error, context);

    // Log the error with context
    this.logError(handledError, context);

    // Send appropriate response
    return this.sendErrorResponse(res, handledError, requestId);
  }

  // Handle async errors (wrapper for async route handlers)
  static asyncHandler(fn: Function) {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  // Handle 404 errors
  static notFound(req: BuildHiveRequest, res: Response, next: NextFunction): void {
    const error = new BuildHiveAuthError(
      `Route ${req.originalUrl} not found`,
      'ROUTE_NOT_FOUND',
      404,
      true,
      {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
      }
    );
    
    next(error);
  }

  // Handle validation errors from express-validator
  static validationError(errors: any[], req: BuildHiveRequest): BuildHiveAuthError {
    const validationErrors: Record<string, string[]> = {};
    
    errors.forEach((error) => {
      const field = error.param || error.path || 'unknown';
      if (!validationErrors[field]) {
        validationErrors[field] = [];
      }
      validationErrors[field].push(error.msg);
    });

    return new BuildHiveAuthError(
      'Validation failed',
      AUTH_ERROR_CODES.VALIDATION_FAILED,
      422,
      true,
      { validationErrors }
    );
  }

  // Handle MongoDB/Mongoose errors
  static handleDatabaseError(error: any): BuildHiveAuthError {
    // Duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      const value = error.keyValue[field];
      
      return new BuildHiveAuthError(
        `${field} '${value}' already exists`,
        AUTH_ERROR_CODES.USER_ALREADY_EXISTS,
        409,
        true,
        { field, value }
      );
    }

    // Validation error
    if (error.name === 'ValidationError') {
      const errors: Record<string, string[]> = {};
      
      Object.keys(error.errors).forEach((key) => {
        errors[key] = [error.errors[key].message];
      });

      return new BuildHiveAuthError(
        'Database validation failed',
        AUTH_ERROR_CODES.VALIDATION_FAILED,
        422,
        true,
        { validationErrors: errors }
      );
    }

    // Cast error (invalid ObjectId)
    if (error.name === 'CastError') {
      return new BuildHiveAuthError(
        'Invalid resource ID',
        'INVALID_RESOURCE_ID',
        400,
        true,
        { field: error.path, value: error.value }
      );
    }

    // Generic database error
    return new BuildHiveAuthError(
      'Database operation failed',
      AUTH_ERROR_CODES.DATABASE_ERROR,
      500,
      false,
      { originalError: error.message }
    );
  }

  // Handle JWT errors
  static handleJWTError(error: any): BuildHiveAuthError {
    if (error.name === 'JsonWebTokenError') {
      return new BuildHiveAuthError(
        'Invalid token',
        AUTH_ERROR_CODES.INVALID_TOKEN,
        401,
        true
      );
    }

    if (error.name === 'TokenExpiredError') {
      return new BuildHiveAuthError(
        'Token expired',
        AUTH_ERROR_CODES.TOKEN_EXPIRED,
        401,
        true,
        { expiredAt: error.expiredAt }
      );
    }

    return new BuildHiveAuthError(
      'Token verification failed',
      AUTH_ERROR_CODES.INVALID_TOKEN,
      401,
      true
    );
  }

  // Handle multer file upload errors
  static handleMulterError(error: any): BuildHiveAuthError {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return new BuildHiveAuthError(
        'File too large',
        AUTH_ERROR_CODES.FILE_TOO_LARGE,
        413,
        true,
        { limit: error.limit }
      );
    }

    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return new BuildHiveAuthError(
        'Unexpected file field',
        'UNEXPECTED_FILE_FIELD',
        400,
        true,
        { field: error.field }
      );
    }

    return new BuildHiveAuthError(
      'File upload failed',
      AUTH_ERROR_CODES.FILE_UPLOAD_FAILED,
      400,
      true,
      { originalError: error.message }
    );
  }

  // Send error response to client
  private static sendErrorResponse(
    res: Response,
    error: BuildHiveAuthError,
    requestId: string
  ): Response {
    // Determine if we should expose the error details
    const isOperational = AuthErrorHandler.isOperational(error);
    const message = AuthErrorHandler.getSafeMessage(error);
    const errorCode = AuthErrorHandler.getErrorCode(error);

    // Base response
    const response: any = {
      success: false,
      message,
      error: errorCode,
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
        version: 'v1',
      },
    };

    // Add validation errors if present
    if (error.context?.validationErrors) {
      response.errors = error.context.validationErrors;
    }

    // Add stack trace in development
    if (!isProduction() && error.stack) {
      response.stack = error.stack;
    }

    return res.status(error.statusCode).json(response);
  }

  // Log error with appropriate level
  private static logError(error: BuildHiveAuthError, context: any): void {
    const logContext = {
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

  // Generate unique request ID
  private static generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Handle specific error types
  static handleSpecificError(error: any): BuildHiveAuthError {
    // Database errors
    if (error.name === 'MongoError' || error.name === 'ValidationError' || error.name === 'CastError') {
      return this.handleDatabaseError(error);
    }

    // JWT errors
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return this.handleJWTError(error);
    }

    // Multer errors
    if (error.code && error.code.startsWith('LIMIT_')) {
      return this.handleMulterError(error);
    }

    // If it's already a BuildHiveAuthError, return as is
    if (error instanceof BuildHiveAuthError) {
      return error;
    }

    // Generic error
    return new BuildHiveAuthError(
      error.message || 'An unexpected error occurred',
      AUTH_ERROR_CODES.INTERNAL_ERROR,
      500,
      false,
      { originalError: error.message, stack: error.stack }
    );
  }
}

// Export middleware functions
export const errorHandler = ErrorMiddleware.handle;
export const asyncHandler = ErrorMiddleware.asyncHandler;
export const notFoundHandler = ErrorMiddleware.notFound;
export const validationErrorHandler = ErrorMiddleware.validationError;

// Export class for advanced usage
export { ErrorMiddleware };

export default ErrorMiddleware;
