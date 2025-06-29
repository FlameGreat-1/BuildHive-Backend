// Controller Interfaces
export type { IAuthController } from './auth.controller';
export type { IProfileController } from './profile.controller';
export type { IValidationController } from './validation.controller';

// Controller Implementations
export { AuthController, createAuthController } from './auth.controller';
export { ProfileController, createProfileController } from './profile.controller';
export { ValidationController, createValidationController } from './validation.controller';

// Import required dependencies
import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import Joi from 'joi';
import { buildHiveLogger, buildHiveResponse, AuthErrorFactory } from '../../shared';
import type { ServiceContainer } from '../services';

// Extended Request interface
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    roles?: string[];
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
  };
  session?: {
    id: string;
    userId: string;
    deviceInfo: any;
  };
}

// Controller Factory Class
export class ControllerContainer {
  private readonly serviceContainer: ServiceContainer;
  private readonly logger = buildHiveLogger;
  private authController?: IAuthController;
  private profileController?: IProfileController;
  private validationController?: IValidationController;

  constructor(serviceContainer: ServiceContainer) {
    this.serviceContainer = serviceContainer;
    
    this.logger.info('ControllerContainer initialized', {
      container: 'ControllerContainer',
      timestamp: new Date().toISOString()
    });
  }

  getAuthController(): IAuthController {
    if (!this.authController) {
      this.authController = createAuthController(this.serviceContainer);
      this.logger.debug('AuthController created');
    }
    return this.authController;
  }

  getProfileController(): IProfileController {
    if (!this.profileController) {
      this.profileController = createProfileController(this.serviceContainer);
      this.logger.debug('ProfileController created');
    }
    return this.profileController;
  }

  getValidationController(): IValidationController {
    if (!this.validationController) {
      this.validationController = createValidationController(this.serviceContainer);
      this.logger.debug('ValidationController created');
    }
    return this.validationController;
  }

  getAllControllers() {
    return {
      auth: this.getAuthController(),
      profile: this.getProfileController(),
      validation: this.getValidationController()
    };
  }

  async healthCheck(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    try {
      this.getAuthController();
      results.auth = true;
    } catch (error) {
      this.logger.error('AuthController health check failed', error);
      results.auth = false;
    }

    try {
      this.getProfileController();
      results.profile = true;
    } catch (error) {
      this.logger.error('ProfileController health check failed', error);
      results.profile = false;
    }

    try {
      this.getValidationController();
      results.validation = true;
    } catch (error) {
      this.logger.error('ValidationController health check failed', error);
      results.validation = false;
    }

    return results;
  }
}

// COMPLETE Request validation middleware
export function validateRequest(schema: Joi.ObjectSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const logger = buildHiveLogger;
    
    try {
      const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
        allowUnknown: false
      });

      if (error) {
        const validationErrors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        }));

        logger.warn('Request validation failed', {
          path: req.path,
          method: req.method,
          errors: validationErrors,
          ip: req.ip
        });

        return res.status(400).json(buildHiveResponse.error(
          'Validation failed',
          'VALIDATION_ERROR',
          validationErrors
        ));
      }

      // Replace req.body with validated and sanitized data
      req.body = value;
      next();

    } catch (validationError) {
      logger.error('Request validation middleware error', validationError, {
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
}

// COMPLETE Rate limiting middleware factory
export function createRateLimit(options: {
  windowMs: number;
  max: number;
  message: string;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}) {
  const logger = buildHiveLogger;

  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: {
      success: false,
      message: options.message,
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil(options.windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: options.keyGenerator || ((req: Request) => {
      // Use user ID if authenticated, otherwise IP
      return req.user?.id || req.ip;
    }),
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    skipFailedRequests: options.skipFailedRequests || false,
    handler: (req: Request, res: Response) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userId: req.user?.id,
        userAgent: req.get('User-Agent')
      });

      res.status(429).json(buildHiveResponse.error(
        options.message,
        'RATE_LIMIT_EXCEEDED',
        {
          retryAfter: Math.ceil(options.windowMs / 1000),
          limit: options.max,
          windowMs: options.windowMs
        }
      ));
    },
    onLimitReached: (req: Request) => {
      logger.warn('Rate limit reached', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userId: req.user?.id
      });
    }
  });
}

// COMPLETE Async handler wrapper
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const logger = buildHiveLogger;
    
    Promise.resolve(fn(req, res, next)).catch((error) => {
      logger.error('Async handler caught error', error, {
        path: req.path,
        method: req.method,
        userId: req.user?.id,
        ip: req.ip
      });
      next(error);
    });
  };
}

// COMPLETE Authentication middleware
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json(buildHiveResponse.error(
      'Authentication required',
      'UNAUTHORIZED'
    ));
  }
  next();
}

// COMPLETE Role-based authorization middleware
export function requireRole(roles: string | string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json(buildHiveResponse.error(
        'Authentication required',
        'UNAUTHORIZED'
      ));
    }

    const userRoles = req.user.roles || [req.user.role];
    const requiredRoles = Array.isArray(roles) ? roles : [roles];
    
    const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));
    
    if (!hasRequiredRole) {
      return res.status(403).json(buildHiveResponse.error(
        'Insufficient permissions',
        'FORBIDDEN',
        { requiredRoles, userRoles }
      ));
    }

    next();
  };
}

// COMPLETE Email verification middleware
export function requireEmailVerification(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.isEmailVerified) {
    return res.status(403).json(buildHiveResponse.error(
      'Email verification required',
      'EMAIL_NOT_VERIFIED'
    ));
  }
  next();
}

// Pre-configured rate limiters
export const rateLimiters = {
  // Authentication endpoints
  auth: createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: 'Too many authentication attempts. Please try again in 15 minutes.'
  }),

  // Registration endpoint
  register: createRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 registrations per hour per IP
    message: 'Too many registration attempts. Please try again in 1 hour.'
  }),

  // Password reset
  passwordReset: createRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 password reset attempts per hour
    message: 'Too many password reset attempts. Please try again in 1 hour.'
  }),

  // Verification codes
  verification: createRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 verification attempts per hour
    message: 'Too many verification attempts. Please try again in 1 hour.'
  }),

  // General API
  general: createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: 'Too many requests. Please try again later.'
  })
};

// Factory function
export function createControllerContainer(serviceContainer: ServiceContainer): ControllerContainer {
  return new ControllerContainer(serviceContainer);
}

// Default export
export default {
  AuthController,
  ProfileController,
  ValidationController,
  ControllerContainer,
  createControllerContainer,
  createAuthController,
  createProfileController,
  createValidationController,
  asyncHandler,
  validateRequest,
  createRateLimit,
  requireAuth,
  requireRole,
  requireEmailVerification,
  rateLimiters
};
