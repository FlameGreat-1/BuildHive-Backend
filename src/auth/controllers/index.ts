export type { IAuthController } from './auth.controller';
export type { IProfileController } from './profile.controller';
export type { IValidationController } from './validation.controller';

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import Joi from 'joi';
import { buildHiveLogger, buildHiveResponse, AuthErrorFactory } from '../../shared';
import type { ServiceContainer } from '../services';
import type { AuthUser } from '../types/auth.types';

import { AuthController } from './auth.controller';
import { ProfileController } from './profile.controller';
import { ValidationController } from './validation.controller';

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  session?: {
    id: string;
    userId: string;
    deviceInfo: any;
    expiresAt: Date;
  };
}

export class ControllerContainer {
  private readonly serviceContainer: ServiceContainer;
  private readonly logger = buildHiveLogger;
  private authController?: AuthController;
  private profileController?: ProfileController;
  private validationController?: ValidationController;

  constructor(serviceContainer: ServiceContainer) {
    this.serviceContainer = serviceContainer;
    
    this.logger.info('ControllerContainer initialized', {
      container: 'ControllerContainer',
      timestamp: new Date().toISOString()
    });
  }

  getAuthController(): AuthController {
    if (!this.authController) {
      this.authController = new AuthController(this.serviceContainer);
      this.logger.debug('AuthController created');
    }
    return this.authController;
  }

  getProfileController(): ProfileController {
    if (!this.profileController) {
      this.profileController = new ProfileController(this.serviceContainer);
      this.logger.debug('ProfileController created');
    }
    return this.profileController;
  }

  getValidationController(): ValidationController {
    if (!this.validationController) {
      this.validationController = new ValidationController(this.serviceContainer);
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
      this.logger.error('AuthController health check failed', error as Error);
      results.auth = false;
    }

    try {
      this.getProfileController();
      results.profile = true;
    } catch (error) {
      this.logger.error('ProfileController health check failed', error as Error);
      results.profile = false;
    }

    try {
      this.getValidationController();
      results.validation = true;
    } catch (error) {
      this.logger.error('ValidationController health check failed', error as Error);
      results.validation = false;
    }

    return results;
  }
}

export function createAuthController(serviceContainer: ServiceContainer): AuthController {
  return new AuthController(serviceContainer);
}

export function createProfileController(serviceContainer: ServiceContainer): ProfileController {
  return new ProfileController(serviceContainer);
}

export function createValidationController(serviceContainer: ServiceContainer): ValidationController {
  return new ValidationController(serviceContainer);
}

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
          undefined,
          validationErrors
        ));
      }

      req.body = value;
      next();

    } catch (validationError) {
      logger.error('Request validation middleware error', validationError as Error, {
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
      return (req as any).user?.id || req.ip || 'unknown';
    }),
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    skipFailedRequests: options.skipFailedRequests || false,
    handler: (req: Request, res: Response) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userId: (req as any).user?.id,
        userAgent: req.get('User-Agent')
      });

      res.status(429).json(buildHiveResponse.error(
        options.message,
        'RATE_LIMIT_EXCEEDED'
      ));
    }
  });
}

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const logger = buildHiveLogger;
    
    Promise.resolve(fn(req, res, next)).catch((error) => {
      logger.error('Async handler caught error', error as Error, {
        path: req.path,
        method: req.method,
        userId: (req as any).user?.id,
        ip: req.ip
      });
      next(error);
    });
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!(req as any).user) {
    return res.status(401).json(buildHiveResponse.error(
      'Authentication required',
      'UNAUTHORIZED'
    ));
  }
  next();
}

export function requireRole(roles: string | string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json(buildHiveResponse.error(
        'Authentication required',
        'UNAUTHORIZED'
      ));
    }

    const userRoles = [user.role];
    const requiredRoles = Array.isArray(roles) ? roles : [roles];
    
    const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));
    
    if (!hasRequiredRole) {
      return res.status(403).json(buildHiveResponse.error(
        'Insufficient permissions',
        'FORBIDDEN'
      ));
    }

    next();
  };
}

export function requireEmailVerification(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user?.isEmailVerified) {
    return res.status(403).json(buildHiveResponse.error(
      'Email verification required',
      'EMAIL_NOT_VERIFIED'
    ));
  }
  next();
}

export const rateLimiters = {
  auth: createRateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many authentication attempts. Please try again in 15 minutes.'
  }),

  register: createRateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: 'Too many registration attempts. Please try again in 1 hour.'
  }),

  passwordReset: createRateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: 'Too many password reset attempts. Please try again in 1 hour.'
  }),

  verification: createRateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: 'Too many verification attempts. Please try again in 1 hour.'
  }),

  general: createRateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests. Please try again later.'
  })
};

export function createControllerContainer(serviceContainer: ServiceContainer): ControllerContainer {
  return new ControllerContainer(serviceContainer);
}

export { AuthController, ProfileController, ValidationController };

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
