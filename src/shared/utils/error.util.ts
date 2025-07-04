import { Request, Response, NextFunction } from 'express';
import { ValidationError, ErrorResponse } from '../types';
import { ERROR_CODES, HTTP_STATUS_CODES } from '../../config/auth';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly timestamp: string;
  public readonly requestId?: string;

  constructor(
    message: string,
    statusCode: number = HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
    code: string = ERROR_CODES.INTERNAL_ERROR,
    isOperational: boolean = true,
    requestId?: string
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    this.requestId = requestId;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationAppError extends AppError {
  public readonly errors: ValidationError[];

  constructor(
    message: string,
    errors: ValidationError[],
    requestId?: string
  ) {
    super(
      message,
      HTTP_STATUS_CODES.UNPROCESSABLE_ENTITY,
      ERROR_CODES.VALIDATION_ERROR,
      true,
      requestId
    );
    this.errors = errors;
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code: string = ERROR_CODES.USER_EXISTS, requestId?: string) {
    super(message, HTTP_STATUS_CODES.CONFLICT, code, true, requestId);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests', requestId?: string) {
    super(
      message,
      HTTP_STATUS_CODES.TOO_MANY_REQUESTS,
      ERROR_CODES.RATE_LIMIT_EXCEEDED,
      true,
      requestId
    );
  }
}

export class JobNotFoundError extends AppError {
  constructor(message: string = 'Job not found', requestId?: string) {
    super(message, HTTP_STATUS_CODES.NOT_FOUND, 'JOB_NOT_FOUND', true, requestId);
  }
}

export class UnauthorizedJobAccessError extends AppError {
  constructor(message: string = 'Unauthorized access to job', requestId?: string) {
    super(message, HTTP_STATUS_CODES.FORBIDDEN, 'UNAUTHORIZED_JOB_ACCESS', true, requestId);
  }
}

export class JobValidationError extends ValidationAppError {
  constructor(message: string, errors: ValidationError[], requestId?: string) {
    super(message, errors, requestId);
  }
}

export class ClientNotFoundError extends AppError {
  constructor(message: string = 'Client not found', requestId?: string) {
    super(message, HTTP_STATUS_CODES.NOT_FOUND, 'CLIENT_NOT_FOUND', true, requestId);
  }
}

export class MaterialValidationError extends ValidationAppError {
  constructor(message: string, errors: ValidationError[], requestId?: string) {
    super(message, errors, requestId);
  }
}

export class FileUploadError extends AppError {
  constructor(message: string = 'File upload failed', requestId?: string) {
    super(message, HTTP_STATUS_CODES.BAD_REQUEST, 'FILE_UPLOAD_ERROR', true, requestId);
  }
}

export const createErrorResponse = (
  error: AppError,
  requestId: string
): ErrorResponse => {
  return {
    success: false,
    message: error.message,
    errors: error instanceof ValidationAppError ? error.errors : undefined,
    timestamp: error.timestamp,
    requestId: error.requestId || requestId,
    statusCode: error.statusCode
  };
};

export const isOperationalError = (error: Error): boolean => {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
};

export const handleAsyncError = (fn: Function) => {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const asyncErrorHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
