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
