import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationError as ExpressValidationError } from 'express-validator';
import { ValidationAppError } from '../../shared/utils';
import { ValidationError } from '../../shared/types';

export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const requestId = res.locals.requestId || 'unknown';
    
    const validationErrors: ValidationError[] = errors.array().map((error: ExpressValidationError) => ({
      field: error.type === 'field' ? error.path : 'unknown',
      message: error.msg,
      code: 'VALIDATION_ERROR'
    }));

    const validationError = new ValidationAppError(
      'Validation failed',
      validationErrors,
      requestId
    );

    throw validationError;
  }

  next();
};

export const sanitizeRegistrationInput = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.body.email) {
    req.body.email = req.body.email.trim().toLowerCase();
  }

  if (req.body.username) {
    req.body.username = req.body.username.trim().toLowerCase();
  }

  if (req.body.socialData?.email) {
    req.body.socialData.email = req.body.socialData.email.trim().toLowerCase();
  }

  if (req.body.socialData?.name) {
    req.body.socialData.name = req.body.socialData.name.trim();
  }

  next();
};

export const validateContentType = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    const contentType = req.headers['content-type'];
    
    if (!contentType || !contentType.includes('application/json')) {
      const requestId = res.locals.requestId || 'unknown';
      
      const validationError = new ValidationAppError(
        'Content-Type must be application/json',
        [{
          field: 'content-type',
          message: 'Content-Type header must be application/json',
          code: 'INVALID_CONTENT_TYPE'
        }],
        requestId
      );

      throw validationError;
    }
  }

  next();
};

export const validateRequestSize = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const contentLength = req.headers['content-length'];
  const maxSize = 1024 * 1024; // 1MB

  if (contentLength && parseInt(contentLength) > maxSize) {
    const requestId = res.locals.requestId || 'unknown';
    
    const validationError = new ValidationAppError(
      'Request payload too large',
      [{
        field: 'content-length',
        message: 'Request payload must not exceed 1MB',
        code: 'PAYLOAD_TOO_LARGE'
      }],
      requestId
    );

    throw validationError;
  }

  next();
};
