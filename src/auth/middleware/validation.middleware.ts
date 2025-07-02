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

export const sanitizeLoginInput = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.body.email) {
    req.body.email = req.body.email.trim().toLowerCase();
  }

  if (req.body.password) {
    req.body.password = req.body.password.trim();
  }

  next();
};

export const sanitizeProfileInput = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.body.firstName) {
    req.body.firstName = req.body.firstName.trim();
  }

  if (req.body.lastName) {
    req.body.lastName = req.body.lastName.trim();
  }

  if (req.body.phone) {
    req.body.phone = req.body.phone.trim();
  }

  if (req.body.bio) {
    req.body.bio = req.body.bio.trim();
  }

  if (req.body.location) {
    req.body.location = req.body.location.trim();
  }

  if (req.body.timezone) {
    req.body.timezone = req.body.timezone.trim();
  }

  if (req.body.companyName) {
    req.body.companyName = req.body.companyName.trim();
  }

  if (req.body.industry) {
    req.body.industry = req.body.industry.trim();
  }

  if (req.body.abn) {
    req.body.abn = req.body.abn.trim();
  }

  next();
};

export const sanitizePasswordInput = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.body.currentPassword) {
    req.body.currentPassword = req.body.currentPassword.trim();
  }

  if (req.body.newPassword) {
    req.body.newPassword = req.body.newPassword.trim();
  }

  if (req.body.confirmPassword) {
    req.body.confirmPassword = req.body.confirmPassword.trim();
  }

  if (req.body.password) {
    req.body.password = req.body.password.trim();
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
  const maxSize = 1024 * 1024;

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

export const validateJsonSyntax = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    const contentType = req.headers['content-type'];
    
    if (contentType && contentType.includes('application/json')) {
      try {
        if (typeof req.body === 'string') {
          JSON.parse(req.body);
        }
      } catch (error) {
        const requestId = res.locals.requestId || 'unknown';
        
        const validationError = new ValidationAppError(
          'Invalid JSON syntax',
          [{
            field: 'body',
            message: 'Request body contains invalid JSON',
            code: 'INVALID_JSON'
          }],
          requestId
        );

        throw validationError;
      }
    }
  }

  next();
};

export const preventXSS = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const sanitizeString = (str: string): string => {
    return str
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  };

  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      return sanitizeString(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          sanitized[key] = sanitizeObject(obj[key]);
        }
      }
      return sanitized;
    }
    
    return obj;
  };

  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  next();
};

export const validateRequiredFields = (requiredFields: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const missingFields: string[] = [];
    
    for (const field of requiredFields) {
      if (!req.body[field] || (typeof req.body[field] === 'string' && req.body[field].trim() === '')) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      const requestId = res.locals.requestId || 'unknown';
      
      const validationErrors: ValidationError[] = missingFields.map(field => ({
        field,
        message: `${field} is required`,
        code: 'FIELD_REQUIRED'
      }));

      const validationError = new ValidationAppError(
        'Required fields missing',
        validationErrors,
        requestId
      );

      throw validationError;
    }

    next();
  };
};

export const trimStringFields = (fields: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    for (const field of fields) {
      if (req.body[field] && typeof req.body[field] === 'string') {
        req.body[field] = req.body[field].trim();
      }
    }
    next();
  };
};

export const normalizeEmailFields = (fields: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    for (const field of fields) {
      if (req.body[field] && typeof req.body[field] === 'string') {
        req.body[field] = req.body[field].trim().toLowerCase();
      }
    }
    next();
  };
};
