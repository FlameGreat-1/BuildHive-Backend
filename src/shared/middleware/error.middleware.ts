import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationAppError, createErrorResponse, isOperationalError } from '../utils';
import { HTTP_STATUS_CODES } from '../../config/auth';
import { logger } from '../utils';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  const requestId = res.locals.requestId || 'unknown';

  if (error instanceof ValidationAppError) {
    logger.warn('Validation error occurred', {
      requestId,
      path: req.path,
      method: req.method,
      errors: error.errors
    });

    const errorResponse = createErrorResponse(error, requestId);
    return res.status(error.statusCode).json(errorResponse);
  }

  if (error instanceof AppError) {
    logger.error('Application error occurred', {
      requestId,
      path: req.path,
      method: req.method,
      message: error.message,
      code: error.code,
      statusCode: error.statusCode
    });

    const errorResponse = createErrorResponse(error, requestId);
    return res.status(error.statusCode).json(errorResponse);
  }

  logger.error('Unexpected error occurred', {
    requestId,
    path: req.path,
    method: req.method,
    message: error.message,
    stack: error.stack
  });

  const genericError = new AppError(
    'Internal server error',
    HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
    'INTERNAL_ERROR',
    false,
    requestId
  );

  const errorResponse = createErrorResponse(genericError, requestId);
  return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(errorResponse);
};

export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): Response => {
  const requestId = res.locals.requestId || 'unknown';
  
  logger.warn('Route not found', {
    requestId,
    path: req.path,
    method: req.method
  });

  const error = new AppError(
    `Route ${req.method} ${req.path} not found`,
    HTTP_STATUS_CODES.NOT_FOUND,
    'ROUTE_NOT_FOUND',
    true,
    requestId
  );

  const errorResponse = createErrorResponse(error, requestId);
  return res.status(HTTP_STATUS_CODES.NOT_FOUND).json(errorResponse);
};

export const asyncErrorHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const jobErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  const requestId = res.locals.requestId || 'unknown';
  const userId = req.user?.id;

  if (error.message.includes('Job not found')) {
    logger.warn('Job not found error', {
      requestId,
      userId,
      path: req.path,
      method: req.method,
      jobId: req.params.jobId
    });

    const jobError = new AppError(
      'Job not found',
      HTTP_STATUS_CODES.NOT_FOUND,
      'JOB_NOT_FOUND',
      true,
      requestId
    );

    const errorResponse = createErrorResponse(jobError, requestId);
    return res.status(HTTP_STATUS_CODES.NOT_FOUND).json(errorResponse);
  }

  if (error.message.includes('Unauthorized access')) {
    logger.warn('Unauthorized job access attempt', {
      requestId,
      userId,
      path: req.path,
      method: req.method,
      jobId: req.params.jobId
    });

    const authError = new AppError(
      'Unauthorized access to job',
      HTTP_STATUS_CODES.FORBIDDEN,
      'UNAUTHORIZED_JOB_ACCESS',
      true,
      requestId
    );

    const errorResponse = createErrorResponse(authError, requestId);
    return res.status(HTTP_STATUS_CODES.FORBIDDEN).json(errorResponse);
  }

  return errorHandler(error, req, res, next);
};

export const clientErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  const requestId = res.locals.requestId || 'unknown';
  const userId = req.user?.id;

  if (error.message.includes('Client not found')) {
    logger.warn('Client not found error', {
      requestId,
      userId,
      path: req.path,
      method: req.method,
      clientId: req.params.clientId
    });

    const clientError = new AppError(
      'Client not found',
      HTTP_STATUS_CODES.NOT_FOUND,
      'CLIENT_NOT_FOUND',
      true,
      requestId
    );

    const errorResponse = createErrorResponse(clientError, requestId);
    return res.status(HTTP_STATUS_CODES.NOT_FOUND).json(errorResponse);
  }

  return errorHandler(error, req, res, next);
};

export const fileUploadErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  const requestId = res.locals.requestId || 'unknown';
  const userId = req.user?.id;

  if (error.message.includes('File too large')) {
    logger.warn('File upload size error', {
      requestId,
      userId,
      path: req.path,
      method: req.method,
      fileSize: req.file?.size
    });

    const fileError = new AppError(
      'File size exceeds maximum allowed limit',
      HTTP_STATUS_CODES.BAD_REQUEST,
      'FILE_TOO_LARGE',
      true,
      requestId
    );

    const errorResponse = createErrorResponse(fileError, requestId);
    return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json(errorResponse);
  }

  if (error.message.includes('Invalid file type')) {
    logger.warn('File upload type error', {
      requestId,
      userId,
      path: req.path,
      method: req.method,
      fileType: req.file?.mimetype
    });

    const fileError = new AppError(
      'Invalid file type. Only images and documents are allowed',
      HTTP_STATUS_CODES.BAD_REQUEST,
      'INVALID_FILE_TYPE',
      true,
      requestId
    );

    const errorResponse = createErrorResponse(fileError, requestId);
    return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json(errorResponse);
  }

  return errorHandler(error, req, res, next);
};
