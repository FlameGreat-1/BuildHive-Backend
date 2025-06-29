export type { AuthenticatedUser, AuthenticatedRequest } from './auth.middleware';
export type { ValidationOptions } from './validation.middleware';
export type { LoggingOptions } from './logging.middleware';

export { AuthMiddleware, createAuthMiddleware, createAuthMiddlewareFunctions } from './auth.middleware';
export { SecurityMiddleware, createSecurityMiddleware, createSecurityMiddlewareFunctions } from './security.middleware';
export { LoggingMiddleware, createLoggingMiddleware, createLoggingMiddlewareFunctions } from './logging.middleware';
export { ValidationMiddleware, createValidationMiddleware, createValidationMiddlewareFunctions } from './validation.middleware';

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import type { ServiceContainer } from '../services';
import { AuthMiddleware } from './auth.middleware';
import { SecurityMiddleware } from './security.middleware';
import { LoggingMiddleware } from './logging.middleware';
import { ValidationMiddleware } from './validation.middleware';

let globalAuthMiddleware: AuthMiddleware;
let globalSecurityMiddleware: SecurityMiddleware;
let globalLoggingMiddleware: LoggingMiddleware;
let globalValidationMiddleware: ValidationMiddleware;

export function initializeMiddleware(serviceContainer: ServiceContainer): void {
  globalAuthMiddleware = new AuthMiddleware(serviceContainer);
  globalSecurityMiddleware = new SecurityMiddleware();
  globalLoggingMiddleware = new LoggingMiddleware();
  globalValidationMiddleware = new ValidationMiddleware();
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!globalAuthMiddleware) {
    throw new Error('Middleware not initialized. Call initializeMiddleware() first.');
  }
  return globalAuthMiddleware.authenticate(req, res, next);
};

export const sessionMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!globalAuthMiddleware) {
    throw new Error('Middleware not initialized. Call initializeMiddleware() first.');
  }
  return globalAuthMiddleware.validateSession(req, res, next);
};

export const profileOwnershipMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!globalAuthMiddleware) {
    throw new Error('Middleware not initialized. Call initializeMiddleware() first.');
  }
  return globalAuthMiddleware.validateProfileOwnership(req, res, next);
};

export const corsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!globalSecurityMiddleware) {
    globalSecurityMiddleware = new SecurityMiddleware();
  }
  return globalSecurityMiddleware.corsMiddleware(req, res, next);
};

export const securityMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!globalSecurityMiddleware) {
    globalSecurityMiddleware = new SecurityMiddleware();
  }
  return globalSecurityMiddleware.helmetMiddleware(req, res, next);
};

export const loggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!globalLoggingMiddleware) {
    globalLoggingMiddleware = new LoggingMiddleware();
  }
  return globalLoggingMiddleware.requestLogger()(req, res, next);
};

export const imageUploadMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!globalValidationMiddleware) {
    globalValidationMiddleware = new ValidationMiddleware();
  }
  return globalValidationMiddleware.validateFileUpload({
    maxSize: 5 * 1024 * 1024,
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    required: true
  })(req, res, next);
};

export const requireAuth = authMiddleware;

export const requireRole = (roles: string | string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!globalAuthMiddleware) {
      throw new Error('Middleware not initialized. Call initializeMiddleware() first.');
    }
    return globalAuthMiddleware.requireRole(roles)(req, res, next);
  };
};

export const requireEmailVerification = (req: Request, res: Response, next: NextFunction) => {
  if (!globalAuthMiddleware) {
    throw new Error('Middleware not initialized. Call initializeMiddleware() first.');
  }
  return globalAuthMiddleware.requireEmailVerification(req, res, next);
};

export const requirePhoneVerification = (req: Request, res: Response, next: NextFunction) => {
  if (!globalAuthMiddleware) {
    throw new Error('Middleware not initialized. Call initializeMiddleware() first.');
  }
  return globalAuthMiddleware.requirePhoneVerification(req, res, next);
};

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many authentication attempts' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const profileRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many profile requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const strictRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Rate limit exceeded' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const dynamicRateLimit = (windowMs: number, max: number) => rateLimit({
  windowMs,
  max,
  message: { error: 'Rate limit exceeded' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const customRateLimit = (options: any) => rateLimit(options);

export const skipRateLimitIf = (condition: (req: Request) => boolean) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (condition(req)) {
      return next();
    }
    return generalRateLimit(req, res, next);
  };
};

export const rateLimitHealthCheck = (req: Request, res: Response, next: NextFunction) => {
  next();
};

export const rateLimiters = {
  auth: authRateLimit,
  register: strictRateLimit,
  passwordReset: strictRateLimit,
  verification: strictRateLimit,
  general: generalRateLimit,
};

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function validateRequest(schema: any) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!globalValidationMiddleware) {
      globalValidationMiddleware = new ValidationMiddleware();
    }
    return globalValidationMiddleware.validateBody(schema)(req, res, next);
  };
}

export function errorHandler(error: any, req: Request, res: Response, next: NextFunction) {
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    success: false,
    message,
    error: error.code || 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    message: 'Resource not found',
    error: 'NOT_FOUND'
  });
}

export function validationErrorHandler(error: any, req: Request, res: Response, next: NextFunction) {
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      error: 'VALIDATION_ERROR',
      details: error.details
    });
  }
  next(error);
}

export class MiddlewareContainer {
  private readonly serviceContainer: ServiceContainer;
  private authMiddleware?: AuthMiddleware;
  private securityMiddleware?: SecurityMiddleware;
  private loggingMiddleware?: LoggingMiddleware;
  private validationMiddleware?: ValidationMiddleware;

  constructor(serviceContainer: ServiceContainer) {
    this.serviceContainer = serviceContainer;
  }

  getAuthMiddleware(): AuthMiddleware {
    if (!this.authMiddleware) {
      this.authMiddleware = new AuthMiddleware(this.serviceContainer);
    }
    return this.authMiddleware;
  }

  getSecurityMiddleware(): SecurityMiddleware {
    if (!this.securityMiddleware) {
      this.securityMiddleware = new SecurityMiddleware();
    }
    return this.securityMiddleware;
  }

  getLoggingMiddleware(): LoggingMiddleware {
    if (!this.loggingMiddleware) {
      this.loggingMiddleware = new LoggingMiddleware();
    }
    return this.loggingMiddleware;
  }

  getValidationMiddleware(): ValidationMiddleware {
    if (!this.validationMiddleware) {
      this.validationMiddleware = new ValidationMiddleware();
    }
    return this.validationMiddleware;
  }

  getAllMiddleware() {
    return {
      auth: this.getAuthMiddleware(),
      security: this.getSecurityMiddleware(),
      logging: this.getLoggingMiddleware(),
      validation: this.getValidationMiddleware()
    };
  }

  getCommonMiddleware() {
    const auth = this.getAuthMiddleware();
    const security = this.getSecurityMiddleware();
    const logging = this.getLoggingMiddleware();
    const validation = this.getValidationMiddleware();

    return {
      authenticate: auth.authenticate,
      optionalAuthenticate: auth.optionalAuthenticate,
      requireRole: auth.requireRole,
      requireEmailVerification: auth.requireEmailVerification,
      requirePhoneVerification: auth.requirePhoneVerification,
      validateSession: auth.validateSession,
      validateProfileOwnership: auth.validateProfileOwnership,
      cors: security.corsMiddleware,
      helmet: security.helmetMiddleware,
      sanitizeRequest: security.sanitizeRequest,
      ipFilter: security.ipFilter,
      requestSizeLimiter: security.requestSizeLimiter,
      validateApiKey: security.validateApiKey,
      generateRequestId: security.generateRequestId,
      securityHeaders: security.securityHeaders,
      requestLogger: logging.requestLogger,
      errorLogger: logging.errorLogger,
      auditLogger: logging.auditLogger,
      performanceLogger: logging.performanceLogger,
      securityLogger: logging.securityLogger,
      dbOperationLogger: logging.dbOperationLogger,
      validateBody: validation.validateBody,
      validateQuery: validation.validateQuery,
      validateParams: validation.validateParams,
      validateHeaders: validation.validateHeaders,
      validateFileUpload: validation.validateFileUpload,
      validateAustralianPhone: validation.validateAustralianPhone,
      validateAustralianPostcode: validation.validateAustralianPostcode,
      validateABN: validation.validateABN,
      validateACN: validation.validateACN,
      validateEmailFormat: validation.validateEmailFormat,
      validatePasswordStrength: validation.validatePasswordStrength
    };
  }

  async healthCheck(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    try {
      this.getAuthMiddleware();
      results.auth = true;
    } catch (error) {
      results.auth = false;
    }

    try {
      this.getSecurityMiddleware();
      results.security = true;
    } catch (error) {
      results.security = false;
    }

    try {
      this.getLoggingMiddleware();
      results.logging = true;
    } catch (error) {
      results.logging = false;
    }

    try {
      this.getValidationMiddleware();
      results.validation = true;
    } catch (error) {
      results.validation = false;
    }

    return results;
  }
}

export function createMiddlewareContainer(serviceContainer: ServiceContainer): MiddlewareContainer {
  return new MiddlewareContainer(serviceContainer);
}

export function createAllMiddleware(serviceContainer: ServiceContainer) {
  initializeMiddleware(serviceContainer);
  
  const container = createMiddlewareContainer(serviceContainer);
  
  return {
    container,
    middleware: container.getCommonMiddleware(),
    auth: container.getAuthMiddleware(),
    security: container.getSecurityMiddleware(),
    logging: container.getLoggingMiddleware(),
    validation: container.getValidationMiddleware()
  };
}

export class ErrorMiddleware {
  static handle = errorHandler;
  static notFound = notFoundHandler;
  static validation = validationErrorHandler;
}

export class RateLimitMiddleware {
  static auth = authRateLimit;
  static profile = profileRateLimit;
  static general = generalRateLimit;
  static strict = strictRateLimit;
  static dynamic = dynamicRateLimit;
  static custom = customRateLimit;
  static skip = skipRateLimitIf;
  static healthCheck = rateLimitHealthCheck;
}

export const middleware = {
  auth: authMiddleware,
  session: sessionMiddleware,
  cors: corsMiddleware,
  security: securityMiddleware,
  logging: loggingMiddleware,
  validation: validateRequest,
  error: errorHandler,
  notFound: notFoundHandler,
  rateLimit: rateLimiters,
};

export default {
  AuthMiddleware,
  SecurityMiddleware,
  LoggingMiddleware,
  ValidationMiddleware,
  MiddlewareContainer,
  ErrorMiddleware,
  RateLimitMiddleware,
  createMiddlewareContainer,
  createAllMiddleware,
  initializeMiddleware,
  authMiddleware,
  sessionMiddleware,
  profileOwnershipMiddleware,
  corsMiddleware,
  securityMiddleware,
  loggingMiddleware,
  imageUploadMiddleware,
  requireAuth,
  requireRole,
  requireEmailVerification,
  requirePhoneVerification,
  rateLimiters,
  asyncHandler,
  validateRequest,
  errorHandler,
  notFoundHandler,
  validationErrorHandler,
  authRateLimit,
  profileRateLimit,
  generalRateLimit,
  strictRateLimit,
  dynamicRateLimit,
  customRateLimit,
  skipRateLimitIf,
  rateLimitHealthCheck,
  middleware,
};
