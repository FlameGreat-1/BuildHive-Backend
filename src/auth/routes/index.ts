import { Router } from 'express';
import { createAuthRoutes } from './auth.routes';
import { createProfileRoutes } from './profile.routes';
import { createValidationRoutes } from './validation.routes';
import type { ControllerContainer } from '../controllers';
import { buildHiveLogger } from '../../shared';
import { corsMiddleware, securityMiddleware, loggingMiddleware } from '../middleware';

export { createAuthRoutes } from './auth.routes';
export { createProfileRoutes } from './profile.routes';
export { createValidationRoutes } from './validation.routes';

export function createAuthModuleRoutes(controllerContainer: ControllerContainer): Router {
  const router = Router();
  const logger = buildHiveLogger;

  router.use(corsMiddleware);
  router.use(securityMiddleware);
  router.use(loggingMiddleware);

  const authController = controllerContainer.getAuthController();
  const profileController = controllerContainer.getProfileController();
  const validationController = controllerContainer.getValidationController();

  router.use('/auth', createAuthRoutes(authController));
  router.use('/profiles', createProfileRoutes(profileController));
  router.use('/validation', createValidationRoutes(validationController));

  router.get('/health', async (req, res, next) => {
    try {
      const healthStatus = await controllerContainer.healthCheck();
      
      const overallHealth = {
        status: Object.values(healthStatus).every(status => status) ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        module: 'auth',
        version: process.env.APP_VERSION || '1.0.0',
        controllers: healthStatus,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: process.env.NODE_ENV || 'development'
      };

      logger.info('Auth module health check completed', {
        status: overallHealth.status,
        controllers: healthStatus
      });

      const statusCode = overallHealth.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json({
        success: true,
        data: overallHealth,
        message: `Auth module is ${overallHealth.status}`
      });

    } catch (error) {
      logger.error('Auth module health check failed', error);
      next(error);
    }
  });

  router.get('/docs', (req, res) => {
    const apiDocs = {
      module: 'BuildHive Auth Module',
      version: process.env.APP_VERSION || '1.0.0',
      description: 'Authentication, authorization, and profile management for BuildHive marketplace',
      baseUrl: '/api/v1',
      endpoints: {
        authentication: {
          baseUrl: '/auth',
          endpoints: [
            'POST /auth/register - User registration',
            'POST /auth/login - User login',
            'POST /auth/logout - User logout',
            'POST /auth/refresh-token - Refresh access token',
            'POST /auth/forgot-password - Request password reset',
            'POST /auth/reset-password - Reset password with token',
            'POST /auth/change-password - Change password (authenticated)',
            'GET /auth/me - Get current user profile',
            'PUT /auth/me - Update current user profile',
            'GET /auth/health - Auth service health check',
            'GET /auth/rate-limit-info - Get rate limit information'
          ]
        },
        profiles: {
          baseUrl: '/profiles',
          endpoints: [
            'GET /profiles/search - Search profiles with filters',
            'GET /profiles/role/:role - Get profiles by role',
            'GET /profiles/:id - Get specific profile',
            'POST /profiles - Create new profile (authenticated)',
            'PUT /profiles/:id - Update profile (owner/admin)',
            'DELETE /profiles/:id - Delete profile (owner/admin)',
            'POST /profiles/:id/images - Upload profile image',
            'PUT /profiles/:id/services - Update tradie services',
            'PUT /profiles/:id/availability - Update tradie availability',
            'POST /profiles/:id/qualifications - Add tradie qualification',
            'PUT /profiles/:id/insurance - Update tradie insurance',
            'POST /profiles/:id/portfolio - Add portfolio item',
            'GET /profiles/:id/completion - Get profile completion score',
            'GET /profiles/:id/quality-score - Get profile quality score',
            'POST /profiles/:id/verify - Verify profile (admin)',
            'POST /profiles/:id/deactivate - Deactivate profile',
            'GET /profiles/health - Profile service health check'
          ]
        },
        validation: {
          baseUrl: '/validation',
          endpoints: [
            'POST /validation/email/send - Send email verification',
            'POST /validation/email/verify - Verify email with token',
            'POST /validation/email/resend - Resend email verification',
            'POST /validation/phone/send - Send phone verification',
            'POST /validation/phone/verify - Verify phone with code',
            'POST /validation/phone/resend - Resend phone verification',
            'POST /validation/business/validate - Validate ABN/ACN',
            'POST /validation/trade-license/validate - Validate trade license',
            'GET /validation/email/availability - Check email availability',
            'GET /validation/phone/availability - Check phone availability',
            'GET /validation/postcode/validate - Validate Australian postcode',
            'GET /validation/status - Get user verification status (authenticated)',
            'GET /validation/health - Validation service health check'
          ]
        }
      },
      rateLimits: {
        authentication: '5 requests per 15 minutes',
        registration: '3 requests per hour',
        passwordReset: '3 requests per hour',
        verification: '5 requests per hour',
        general: '100 requests per 15 minutes'
      },
      authentication: {
        type: 'Bearer Token',
        description: 'Include JWT token in Authorization header: Bearer <token>',
        cookieAuth: 'HTTP-only cookies are also supported for web clients'
      },
      errors: {
        format: 'All errors follow consistent format with success, message, code, and data fields',
        codes: [
          'VALIDATION_ERROR - Request validation failed',
          'UNAUTHORIZED - Authentication required',
          'FORBIDDEN - Insufficient permissions',
          'RATE_LIMIT_EXCEEDED - Too many requests',
          'RESOURCE_NOT_FOUND - Requested resource not found',
          'INTERNAL_ERROR - Server error occurred'
        ]
      }
    };

    res.json({
      success: true,
      data: apiDocs,
      message: 'Auth module API documentation'
    });
  });

  router.use('*', (req, res) => {
    logger.warn('Route not found', {
      path: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(404).json({
      success: false,
      message: 'Route not found',
      code: 'ROUTE_NOT_FOUND',
      data: {
        path: req.originalUrl,
        method: req.method,
        availableRoutes: ['/auth', '/profiles', '/validation', '/health', '/docs']
      }
    });
  });

  logger.info('Auth module routes initialized', {
    routes: ['auth', 'profiles', 'validation'],
    middleware: ['cors', 'security', 'logging'],
    timestamp: new Date().toISOString()
  });

  return router;
}

export interface RouteConfig {
  prefix?: string;
  enableCors?: boolean;
  enableSecurity?: boolean;
  enableLogging?: boolean;
  customMiddleware?: any[];
}

export function createConfiguredAuthRoutes(
  controllerContainer: ControllerContainer,
  config: RouteConfig = {}
): Router {
  const router = Router();
  const logger = buildHiveLogger;

  if (config.enableCors !== false) {
    router.use(corsMiddleware);
  }

  if (config.enableSecurity !== false) {
    router.use(securityMiddleware);
  }

  if (config.enableLogging !== false) {
    router.use(loggingMiddleware);
  }

  if (config.customMiddleware && config.customMiddleware.length > 0) {
    config.customMiddleware.forEach(middleware => {
      router.use(middleware);
    });
  }

  const authRoutes = createAuthModuleRoutes(controllerContainer);
  
  if (config.prefix) {
    router.use(config.prefix, authRoutes);
  } else {
    router.use(authRoutes);
  }

  logger.info('Configured auth routes created', {
    config,
    timestamp: new Date().toISOString()
  });

  return router;
}

export default {
  createAuthRoutes,
  createProfileRoutes,
  createValidationRoutes,
  createAuthModuleRoutes,
  createConfiguredAuthRoutes
};
