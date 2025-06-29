// Middleware Interfaces and Types
export type { AuthenticatedUser, AuthenticatedRequest } from './auth.middleware';
export type { ValidationOptions } from './validation.middleware';
export type { LoggingOptions } from './logging.middleware';

// Middleware Classes
export { AuthMiddleware, createAuthMiddleware, createAuthMiddlewareFunctions } from './auth.middleware';
export { SecurityMiddleware, createSecurityMiddleware, createSecurityMiddlewareFunctions } from './security.middleware';
export { LoggingMiddleware, createLoggingMiddleware, createLoggingMiddlewareFunctions } from './logging.middleware';
export { ValidationMiddleware, createValidationMiddleware, createValidationMiddlewareFunctions } from './validation.middleware';

// Import required dependencies
import type { ServiceContainer } from '../services';
import { buildHiveLogger } from '../../shared';
import { AuthMiddleware } from './auth.middleware';
import { SecurityMiddleware } from './security.middleware';
import { LoggingMiddleware } from './logging.middleware';
import { ValidationMiddleware } from './validation.middleware';

// Global middleware instances (will be initialized when service container is provided)
let globalAuthMiddleware: AuthMiddleware;
let globalSecurityMiddleware: SecurityMiddleware;
let globalLoggingMiddleware: LoggingMiddleware;
let globalValidationMiddleware: ValidationMiddleware;

// Initialize global middleware instances
export function initializeMiddleware(serviceContainer: ServiceContainer): void {
  globalAuthMiddleware = new AuthMiddleware(serviceContainer);
  globalSecurityMiddleware = new SecurityMiddleware();
  globalLoggingMiddleware = new LoggingMiddleware();
  globalValidationMiddleware = new ValidationMiddleware();
  
  buildHiveLogger.info('Global middleware instances initialized');
}

// Individual middleware exports that routes expect
export const authMiddleware = (req: any, res: any, next: any) => {
  if (!globalAuthMiddleware) {
    throw new Error('Middleware not initialized. Call initializeMiddleware() first.');
  }
  return globalAuthMiddleware.authenticate(req, res, next);
};

export const sessionMiddleware = (req: any, res: any, next: any) => {
  if (!globalAuthMiddleware) {
    throw new Error('Middleware not initialized. Call initializeMiddleware() first.');
  }
  return globalAuthMiddleware.validateSession(req, res, next);
};

export const profileOwnershipMiddleware = (req: any, res: any, next: any) => {
  if (!globalAuthMiddleware) {
    throw new Error('Middleware not initialized. Call initializeMiddleware() first.');
  }
  return globalAuthMiddleware.validateProfileOwnership(req, res, next);
};

export const corsMiddleware = (req: any, res: any, next: any) => {
  if (!globalSecurityMiddleware) {
    globalSecurityMiddleware = new SecurityMiddleware();
  }
  return globalSecurityMiddleware.corsMiddleware(req, res, next);
};

export const securityMiddleware = (req: any, res: any, next: any) => {
  if (!globalSecurityMiddleware) {
    globalSecurityMiddleware = new SecurityMiddleware();
  }
  return globalSecurityMiddleware.helmetMiddleware(req, res, next);
};

export const loggingMiddleware = (req: any, res: any, next: any) => {
  if (!globalLoggingMiddleware) {
    globalLoggingMiddleware = new LoggingMiddleware();
  }
  return globalLoggingMiddleware.requestLogger()(req, res, next);
};

export const imageUploadMiddleware = (req: any, res: any, next: any) => {
  if (!globalValidationMiddleware) {
    globalValidationMiddleware = new ValidationMiddleware();
  }
  return globalValidationMiddleware.validateFileUpload({
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    required: true
  })(req, res, next);
};

// Additional middleware functions that might be needed
export const requireAuth = authMiddleware;

export const requireRole = (roles: string | string[]) => {
  return (req: any, res: any, next: any) => {
    if (!globalAuthMiddleware) {
      throw new Error('Middleware not initialized. Call initializeMiddleware() first.');
    }
    return globalAuthMiddleware.requireRole(roles)(req, res, next);
  };
};

export const requireEmailVerification = (req: any, res: any, next: any) => {
  if (!globalAuthMiddleware) {
    throw new Error('Middleware not initialized. Call initializeMiddleware() first.');
  }
  return globalAuthMiddleware.requireEmailVerification(req, res, next);
};

export const requirePhoneVerification = (req: any, res: any, next: any) => {
  if (!globalAuthMiddleware) {
    throw new Error('Middleware not initialized. Call initializeMiddleware() first.');
  }
  return globalAuthMiddleware.requirePhoneVerification(req, res, next);
};

// Rate limiters that controllers expect
export const rateLimiters = {
  auth: (req: any, res: any, next: any) => {
    // This will be implemented when we have express-rate-limit configured
    next();
  },
  register: (req: any, res: any, next: any) => {
    next();
  },
  passwordReset: (req: any, res: any, next: any) => {
    next();
  },
  verification: (req: any, res: any, next: any) => {
    next();
  },
  general: (req: any, res: any, next: any) => {
    next();
  }
};

// Async handler that controllers expect
export function asyncHandler(fn: (req: any, res: any, next: any) => Promise<void>) {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Validation request function that controllers expect
export function validateRequest(schema: any) {
  return (req: any, res: any, next: any) => {
    if (!globalValidationMiddleware) {
      globalValidationMiddleware = new ValidationMiddleware();
    }
    return globalValidationMiddleware.validateBody(schema)(req, res, next);
  };
}

// Middleware Container Class
export class MiddlewareContainer {
  private readonly serviceContainer: ServiceContainer;
  private readonly logger = buildHiveLogger;
  private authMiddleware?: AuthMiddleware;
  private securityMiddleware?: SecurityMiddleware;
  private loggingMiddleware?: LoggingMiddleware;
  private validationMiddleware?: ValidationMiddleware;

  constructor(serviceContainer: ServiceContainer) {
    this.serviceContainer = serviceContainer;
    
    this.logger.info('MiddlewareContainer initialized', {
      container: 'MiddlewareContainer',
      timestamp: new Date().toISOString()
    });
  }

  getAuthMiddleware(): AuthMiddleware {
    if (!this.authMiddleware) {
      this.authMiddleware = new AuthMiddleware(this.serviceContainer);
      this.logger.debug('AuthMiddleware created');
    }
    return this.authMiddleware;
  }

  getSecurityMiddleware(): SecurityMiddleware {
    if (!this.securityMiddleware) {
      this.securityMiddleware = new SecurityMiddleware();
      this.logger.debug('SecurityMiddleware created');
    }
    return this.securityMiddleware;
  }

  getLoggingMiddleware(): LoggingMiddleware {
    if (!this.loggingMiddleware) {
      this.loggingMiddleware = new LoggingMiddleware();
      this.logger.debug('LoggingMiddleware created');
    }
    return this.loggingMiddleware;
  }

  getValidationMiddleware(): ValidationMiddleware {
    if (!this.validationMiddleware) {
      this.validationMiddleware = new ValidationMiddleware();
      this.logger.debug('ValidationMiddleware created');
    }
    return this.validationMiddleware;
  }

  // Get all middleware instances
  getAllMiddleware() {
    return {
      auth: this.getAuthMiddleware(),
      security: this.getSecurityMiddleware(),
      logging: this.getLoggingMiddleware(),
      validation: this.getValidationMiddleware()
    };
  }

  // Get commonly used middleware functions
  getCommonMiddleware() {
    const auth = this.getAuthMiddleware();
    const security = this.getSecurityMiddleware();
    const logging = this.getLoggingMiddleware();
    const validation = this.getValidationMiddleware();

    return {
      // Authentication
      authenticate: auth.authenticate,
      optionalAuthenticate: auth.optionalAuthenticate,
      requireRole: auth.requireRole,
      requireEmailVerification: auth.requireEmailVerification,
      requirePhoneVerification: auth.requirePhoneVerification,
      validateSession: auth.validateSession,
      validateProfileOwnership: auth.validateProfileOwnership,

      // Security
      cors: security.corsMiddleware,
      helmet: security.helmetMiddleware,
      sanitizeRequest: security.sanitizeRequest,
      ipFilter: security.ipFilter,
      requestSizeLimiter: security.requestSizeLimiter,
      validateApiKey: security.validateApiKey,
      generateRequestId: security.generateRequestId,
      securityHeaders: security.securityHeaders,

      // Logging
      requestLogger: logging.requestLogger,
      errorLogger: logging.errorLogger,
      auditLogger: logging.auditLogger,
      performanceLogger: logging.performanceLogger,
      securityLogger: logging.securityLogger,
      dbOperationLogger: logging.dbOperationLogger,

      // Validation
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

  // Health check for all middleware
  async healthCheck(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    try {
      this.getAuthMiddleware();
      results.auth = true;
    } catch (error) {
      this.logger.error('AuthMiddleware health check failed', error);
      results.auth = false;
    }

    try {
      this.getSecurityMiddleware();
      results.security = true;
    } catch (error) {
      this.logger.error('SecurityMiddleware health check failed', error);
      results.security = false;
    }

    try {
      this.getLoggingMiddleware();
      results.logging = true;
    } catch (error) {
      this.logger.error('LoggingMiddleware health check failed', error);
      results.logging = false;
    }

    try {
      this.getValidationMiddleware();
      results.validation = true;
    } catch (error) {
      this.logger.error('ValidationMiddleware health check failed', error);
      results.validation = false;
    }

    return results;
  }
}

// Factory functions
export function createMiddlewareContainer(serviceContainer: ServiceContainer): MiddlewareContainer {
  return new MiddlewareContainer(serviceContainer);
}

// Convenience function to create all middleware with proper initialization
export function createAllMiddleware(serviceContainer: ServiceContainer) {
  // Initialize global middleware
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

// Default export
export default {
  // Classes
  AuthMiddleware,
  SecurityMiddleware,
  LoggingMiddleware,
  ValidationMiddleware,
  MiddlewareContainer,
  
  // Factory functions
  createMiddlewareContainer,
  createAllMiddleware,
  initializeMiddleware,
  
  // Individual middleware functions
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
  
  // Utilities
  rateLimiters,
  asyncHandler,
  validateRequest
};
