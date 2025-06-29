import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { buildHiveLogger, buildHiveResponse, AuthErrorFactory } from '../../shared';

export interface ValidationOptions {
  abortEarly?: boolean;
  allowUnknown?: boolean;
  stripUnknown?: boolean;
  skipOnError?: boolean;
}

interface ExtendedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    role?: string;
  };
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        role?: string;
      };
    }
  }
}

export class ValidationMiddleware {
  private readonly logger = buildHiveLogger;
  private readonly defaultOptions: ValidationOptions = {
    abortEarly: false,
    allowUnknown: false,
    stripUnknown: true,
    skipOnError: false
  };

  validateBody = (schema: Joi.ObjectSchema, options: ValidationOptions = {}) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const config = { ...this.defaultOptions, ...options };

      try {
        const { error, value } = schema.validate(req.body, config);

        if (error) {
          const validationErrors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value,
            type: detail.type
          }));

          this.logger.warn('Request body validation failed', {
            path: req.path,
            method: req.method,
            errors: validationErrors,
            ip: req.ip,
            userId: (req as ExtendedRequest).user?.id
          });

          return res.status(400).json(buildHiveResponse.error(
            'Request body validation failed',
            'VALIDATION_ERROR',
            { errors: validationErrors }
          ));
        }

        req.body = value;
        next();

      } catch (validationError) {
        this.logger.error('Body validation middleware error', validationError as Error, {
          path: req.path,
          method: req.method,
          ip: req.ip
        });

        return res.status(500).json(buildHiveResponse.error(
          'Internal validation error',
          'INTERNAL_ERROR'
        ));
      }
    };
  };

  validateQuery = (schema: Joi.ObjectSchema, options: ValidationOptions = {}) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const config = { ...this.defaultOptions, ...options };

      try {
        const { error, value } = schema.validate(req.query, config);

        if (error) {
          const validationErrors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value,
            type: detail.type
          }));

          this.logger.warn('Query parameters validation failed', {
            path: req.path,
            method: req.method,
            errors: validationErrors,
            ip: req.ip,
            userId: (req as ExtendedRequest).user?.id
          });

          return res.status(400).json(buildHiveResponse.error(
            'Query parameters validation failed',
            'VALIDATION_ERROR',
            { errors: validationErrors }
          ));
        }

        req.query = value;
        next();

      } catch (validationError) {
        this.logger.error('Query validation middleware error', validationError as Error, {
          path: req.path,
          method: req.method,
          ip: req.ip
        });

        return res.status(500).json(buildHiveResponse.error(
          'Internal validation error',
          'INTERNAL_ERROR'
        ));
      }
    };
  };

  validateParams = (schema: Joi.ObjectSchema, options: ValidationOptions = {}) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const config = { ...this.defaultOptions, ...options };

      try {
        const { error, value } = schema.validate(req.params, config);

        if (error) {
          const validationErrors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value,
            type: detail.type
          }));

          this.logger.warn('URL parameters validation failed', {
            path: req.path,
            method: req.method,
            errors: validationErrors,
            ip: req.ip,
            userId: (req as ExtendedRequest).user?.id
          });

          return res.status(400).json(buildHiveResponse.error(
            'URL parameters validation failed',
            'VALIDATION_ERROR',
            { errors: validationErrors }
          ));
        }

        req.params = value;
        next();

      } catch (validationError) {
        this.logger.error('Params validation middleware error', validationError as Error, {
          path: req.path,
          method: req.method,
          ip: req.ip
        });

        return res.status(500).json(buildHiveResponse.error(
          'Internal validation error',
          'INTERNAL_ERROR'
        ));
      }
    };
  };

  validateHeaders = (schema: Joi.ObjectSchema, options: ValidationOptions = {}) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const config = { ...this.defaultOptions, ...options };

      try {
        const { error, value } = schema.validate(req.headers, config);

        if (error) {
          const validationErrors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value,
            type: detail.type
          }));

          this.logger.warn('Headers validation failed', {
            path: req.path,
            method: req.method,
            errors: validationErrors,
            ip: req.ip,
            userId: (req as ExtendedRequest).user?.id
          });

          return res.status(400).json(buildHiveResponse.error(
            'Headers validation failed',
            'VALIDATION_ERROR',
            { errors: validationErrors }
          ));
        }

        next();

      } catch (validationError) {
        this.logger.error('Headers validation middleware error', validationError as Error, {
          path: req.path,
          method: req.method,
          ip: req.ip
        });

        return res.status(500).json(buildHiveResponse.error(
          'Internal validation error',
          'INTERNAL_ERROR'
        ));
      }
    };
  };

  validateFileUpload = (options: {
    maxSize?: number;
    allowedTypes?: string[];
    required?: boolean;
    maxFiles?: number;
  } = {}) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const {
        maxSize = 5 * 1024 * 1024,
        allowedTypes = ['image/jpeg', 'image/png', 'image/webp'],
        required = false,
        maxFiles = 1
      } = options;

      try {
        const files = req.files as Express.Multer.File[] || [];
        const singleFile = req.file as Express.Multer.File;

        if (required && !singleFile && files.length === 0) {
          return res.status(400).json(buildHiveResponse.error(
            'File upload is required',
            'FILE_REQUIRED'
          ));
        }

        if (singleFile) {
          const validation = this.validateSingleFile(singleFile, maxSize, allowedTypes);
          if (!validation.isValid) {
            return res.status(400).json(buildHiveResponse.error(
              validation.error!,
              'FILE_VALIDATION_ERROR'
            ));
          }
        }

        if (files.length > 0) {
          if (files.length > maxFiles) {
            return res.status(400).json(buildHiveResponse.error(
              `Too many files. Maximum ${maxFiles} files allowed`,
              'TOO_MANY_FILES'
            ));
          }

          for (const file of files) {
            const validation = this.validateSingleFile(file, maxSize, allowedTypes);
            if (!validation.isValid) {
              return res.status(400).json(buildHiveResponse.error(
                validation.error!,
                'FILE_VALIDATION_ERROR'
              ));
            }
          }
        }

        this.logger.debug('File upload validation passed', {
          path: req.path,
          method: req.method,
          fileCount: singleFile ? 1 : files.length,
          userId: (req as ExtendedRequest).user?.id,
          ip: req.ip
        });

        next();

      } catch (error) {
        this.logger.error('File validation middleware error', error as Error, {
          path: req.path,
          method: req.method,
          ip: req.ip
        });

        return res.status(500).json(buildHiveResponse.error(
          'File validation error',
          'INTERNAL_ERROR'
        ));
      }
    };
  };

  validateAustralianPhone = (req: Request, res: Response, next: NextFunction): void => {
    const phone = req.body.phone || req.query.phone;

    if (phone) {
      const australianPhoneRegex = /^(\+61|0)[2-9]\d{8}$/;
      const cleanPhone = phone.replace(/\s/g, '');

      if (!australianPhoneRegex.test(cleanPhone)) {
        this.logger.warn('Invalid Australian phone number', {
          phone: this.maskPhone(phone),
          path: req.path,
          ip: req.ip,
          userId: (req as ExtendedRequest).user?.id
        });

        return res.status(400).json(buildHiveResponse.error(
          'Invalid Australian phone number format',
          'INVALID_PHONE_FORMAT'
        ));
      }

      if (req.body.phone) req.body.phone = cleanPhone;
      if (req.query.phone) req.query.phone = cleanPhone;
    }

    next();
  };

  validateAustralianPostcode = (req: Request, res: Response, next: NextFunction): void => {
    const postcode = req.body.postcode || req.query.postcode;

    if (postcode) {
      const postcodeRegex = /^\d{4}$/;
      const postcodeNum = parseInt(postcode);

      if (!postcodeRegex.test(postcode) || postcodeNum < 1000 || postcodeNum > 9999) {
        this.logger.warn('Invalid Australian postcode', {
          postcode,
          path: req.path,
          ip: req.ip,
          userId: (req as ExtendedRequest).user?.id
        });

        return res.status(400).json(buildHiveResponse.error(
          'Invalid Australian postcode format',
          'INVALID_POSTCODE_FORMAT'
        ));
      }
    }

    next();
  };

  validateABN = (req: Request, res: Response, next: NextFunction): void => {
    const abn = req.body.abn || req.query.abn;

    if (abn) {
      const cleanABN = abn.replace(/\s/g, '');
      const abnRegex = /^\d{11}$/;

      if (!abnRegex.test(cleanABN)) {
        return res.status(400).json(buildHiveResponse.error(
          'ABN must be 11 digits',
          'INVALID_ABN_FORMAT'
        ));
      }

      const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
      const digits = cleanABN.split('').map(Number);
      digits[0] -= 1;

      const sum = digits.reduce((acc, digit, index) => acc + (digit * weights[index]), 0);
      const isValid = sum % 89 === 0;

      if (!isValid) {
        this.logger.warn('Invalid ABN checksum', {
          abn: this.maskABN(abn),
          path: req.path,
          ip: req.ip,
          userId: (req as ExtendedRequest).user?.id
        });

        return res.status(400).json(buildHiveResponse.error(
          'Invalid ABN checksum',
          'INVALID_ABN_CHECKSUM'
        ));
      }

      if (req.body.abn) req.body.abn = cleanABN;
      if (req.query.abn) req.query.abn = cleanABN;
    }

    next();
  };

  validateACN = (req: Request, res: Response, next: NextFunction): void => {
    const acn = req.body.acn || req.query.acn;

    if (acn) {
      const cleanACN = acn.replace(/\s/g, '');
      const acnRegex = /^\d{9}$/;

      if (!acnRegex.test(cleanACN)) {
        return res.status(400).json(buildHiveResponse.error(
          'ACN must be 9 digits',
          'INVALID_ACN_FORMAT'
        ));
      }

      const weights = [8, 7, 6, 5, 4, 3, 2, 1];
      const digits = cleanACN.substring(0, 8).split('').map(Number);
      
      const sum = digits.reduce((acc, digit, index) => acc + (digit * weights[index]), 0);
      const remainder = sum % 10;
      const checkDigit = remainder === 0 ? 0 : 10 - remainder;
      const isValid = checkDigit === parseInt(cleanACN[8]);

      if (!isValid) {
        this.logger.warn('Invalid ACN checksum', {
          acn: this.maskACN(acn),
          path: req.path,
          ip: req.ip,
          userId: (req as ExtendedRequest).user?.id
        });

        return res.status(400).json(buildHiveResponse.error(
          'Invalid ACN checksum',
          'INVALID_ACN_CHECKSUM'
        ));
      }

      if (req.body.acn) req.body.acn = cleanACN;
      if (req.query.acn) req.query.acn = cleanACN;
    }

    next();
  };

  validateEmailFormat = (req: Request, res: Response, next: NextFunction): void => {
    const email = req.body.email || req.query.email;

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      if (!emailRegex.test(email)) {
        this.logger.warn('Invalid email format', {
          email: this.maskEmail(email),
          path: req.path,
          ip: req.ip,
          userId: (req as ExtendedRequest).user?.id
        });

        return res.status(400).json(buildHiveResponse.error(
          'Invalid email format',
          'INVALID_EMAIL_FORMAT'
        ));
      }

      const normalizedEmail = email.toLowerCase().trim();
      if (req.body.email) req.body.email = normalizedEmail;
      if (req.query.email) req.query.email = normalizedEmail;
    }

    next();
  };

  validatePasswordStrength = (req: Request, res: Response, next: NextFunction): void => {
    const password = req.body.password || req.body.newPassword;

    if (password) {
      const minLength = 8;
      const hasUpperCase = /[A-Z]/.test(password);
      const hasLowerCase = /[a-z]/.test(password);
      const hasNumbers = /\d/.test(password);
      const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

      const errors = [];

      if (password.length < minLength) {
        errors.push(`Password must be at least ${minLength} characters long`);
      }
      if (!hasUpperCase) {
        errors.push('Password must contain at least one uppercase letter');
      }
      if (!hasLowerCase) {
        errors.push('Password must contain at least one lowercase letter');
      }
      if (!hasNumbers) {
        errors.push('Password must contain at least one number');
      }
      if (!hasSpecialChar) {
        errors.push('Password must contain at least one special character');
      }

      if (errors.length > 0) {
        this.logger.warn('Password strength validation failed', {
          path: req.path,
          ip: req.ip,
          userId: (req as ExtendedRequest).user?.id,
          errors
        });

        return res.status(400).json(buildHiveResponse.error(
          'Password does not meet strength requirements',
          'WEAK_PASSWORD',
          { requirements: errors }
        ));
      }
    }

    next();
  };

  private validateSingleFile(
    file: Express.Multer.File,
    maxSize: number,
    allowedTypes: string[]
  ): { isValid: boolean; error?: string } {
    if (file.size > maxSize) {
      return {
        isValid: false,
        error: `File size exceeds maximum allowed size of ${this.formatBytes(maxSize)}`
      };
    }

    if (!allowedTypes.includes(file.mimetype)) {
      return {
        isValid: false,
        error: `File type ${file.mimetype} is not allowed. Allowed types: ${allowedTypes.join(', ')}`
      };
    }

    if (this.hasMaliciousFileName(file.originalname)) {
      return {
        isValid: false,
        error: 'File name contains invalid characters'
      };
    }

    return { isValid: true };
  }

  private hasMaliciousFileName(filename: string): boolean {
    const maliciousPatterns = [
      /\.\./,
      /[<>:"|?*]/,
      /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i,
      /\.(exe|bat|cmd|scr|pif|com)$/i
    ];

    return maliciousPatterns.some(pattern => pattern.test(filename));
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private maskPhone(phone: string): string {
    if (!phone || phone.length < 4) return phone;
    return phone.substring(0, 3) + '*'.repeat(phone.length - 5) + phone.substring(phone.length - 2);
  }

  private maskEmail(email: string): string {
    if (!email || !email.includes('@')) return email;
    const [username, domain] = email.split('@');
    const maskedUsername = username.length > 2 
      ? username.substring(0, 2) + '*'.repeat(username.length - 2)
      : username;
    return `${maskedUsername}@${domain}`;
  }

  private maskABN(abn: string): string {
    if (!abn || abn.length < 4) return abn;
    return abn.substring(0, 2) + '*'.repeat(abn.length - 4) + abn.substring(abn.length - 2);
  }

  private maskACN(acn: string): string {
    if (!acn || acn.length < 4) return acn;
    return acn.substring(0, 2) + '*'.repeat(acn.length - 4) + acn.substring(acn.length - 2);
  }
}

export function createValidationMiddleware(): ValidationMiddleware {
  return new ValidationMiddleware();
}

export function createValidationMiddlewareFunctions() {
  const validationMiddleware = new ValidationMiddleware();
  
  return {
    validateBody: validationMiddleware.validateBody,
    validateQuery: validationMiddleware.validateQuery,
    validateParams: validationMiddleware.validateParams,
    validateHeaders: validationMiddleware.validateHeaders,
    validateFileUpload: validationMiddleware.validateFileUpload,
    validateAustralianPhone: validationMiddleware.validateAustralianPhone,
    validateAustralianPostcode: validationMiddleware.validateAustralianPostcode,
    validateABN: validationMiddleware.validateABN,
    validateACN: validationMiddleware.validateACN,
    validateEmailFormat: validationMiddleware.validateEmailFormat,
    validatePasswordStrength: validationMiddleware.validatePasswordStrength
  };
}

export default ValidationMiddleware;
