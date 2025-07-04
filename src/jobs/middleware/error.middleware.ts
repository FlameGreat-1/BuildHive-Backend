import { Request, Response, NextFunction } from 'express';
import { 
  sendErrorResponse, 
  sendNotFoundResponse,
  sendValidationError,
  JobNotFoundError,
  UnauthorizedJobAccessError,
  ClientNotFoundError,
  JobValidationError,
  MaterialValidationError,
  FileUploadError,
  logger
} from '../../shared/utils';
import { JOB_CONSTANTS } from '../../config/jobs';

export const jobErrorHandler = (error: any, req: Request, res: Response, next: NextFunction): void => {
  const requestId = req.headers['x-request-id'] || 'unknown';
  
  logger.error('Job operation error', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    tradieId: (req as any).user?.id,
    requestId,
    jobId: req.params.id || req.params.jobId,
    clientId: req.params.clientId,
    body: req.body
  });

  if (error instanceof JobNotFoundError) {
    sendNotFoundResponse(res, error.message);
    return;
  }

  if (error instanceof UnauthorizedJobAccessError) {
    sendErrorResponse(res, error.message, 403);
    return;
  }

  if (error instanceof ClientNotFoundError) {
    sendNotFoundResponse(res, error.message);
    return;
  }

  if (error instanceof JobValidationError || error instanceof MaterialValidationError) {
    sendValidationError(res, error.message, error.errors);
    return;
  }

  if (error instanceof FileUploadError) {
    sendErrorResponse(res, error.message, 400);
    return;
  }

  if (error.name === 'ValidationError') {
    sendValidationError(res, 'Validation failed', [{
      field: 'general',
      message: error.message,
      code: JOB_CONSTANTS.ERROR_CODES.INVALID_JOB_STATUS
    }]);
    return;
  }

  if (error.code === 'ENOENT') {
    sendErrorResponse(res, 'File not found', 404);
    return;
  }

  if (error.code === 'EACCES') {
    sendErrorResponse(res, 'Permission denied', 403);
    return;
  }

  if (error.code === 'EMFILE' || error.code === 'ENFILE') {
    sendErrorResponse(res, 'Too many files open', 503);
    return;
  }

  sendErrorResponse(res, 'Internal server error', 500);
};

export const notFoundHandler = (req: Request, res: Response): void => {
  logger.warn('Job endpoint not found', {
    path: req.path,
    method: req.method,
    tradieId: (req as any).user?.id,
    ip: req.ip
  });

  sendNotFoundResponse(res, 'Job endpoint not found');
};

export const asyncErrorHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
