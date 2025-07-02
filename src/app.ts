import express, { Application, Request, Response, NextFunction } from 'express';
import { initializeDatabase } from './shared/database';
import { logger } from './shared/utils';
import { 
  errorHandler, 
  notFoundHandler,
  generalApiRateLimit,
  corsOptions,
  securityHeaders,
  addSecurityHeaders,
  validateOrigin,
  requestLogger,
  sensitiveDataFilter
} from './shared/middleware';
import { 
  registrationLogger,
  loginLogger,
  passwordResetLogger,
  logoutLogger,
  tokenLogger,
  profileLogger
} from './auth/middleware';
import { 
  authRoutes, 
  profileRoutes, 
  validationRoutes 
} from './auth/routes';
import { environment } from './config/auth';

export async function createApp(): Promise<Application> {
  const app = express();

  try {
    logger.info('Initializing BuildHive application...');

    await initializeDatabase();
    logger.info('Database connected successfully');

    app.use(securityHeaders);
    app.use(addSecurityHeaders);
    app.use(validateOrigin);
    app.use(corsOptions);

    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: true, limit: '1mb' }));

    app.use(requestLogger);
    app.use(sensitiveDataFilter);

    app.get('/health', (req: Request, res: Response) => {
      res.json({
        success: true,
        message: 'BuildHive API is healthy',
        timestamp: new Date().toISOString(),
        environment: environment.NODE_ENV,
        version: '1.0.0'
      });
    });

    app.use('/api', generalApiRateLimit);
    app.use('/api/v1/auth', 
      registrationLogger, 
      loginLogger, 
      passwordResetLogger, 
      logoutLogger, 
      tokenLogger, 
      authRoutes
    );
    app.use('/api/v1/profile', profileLogger, profileRoutes);
    app.use('/api/v1/validation', validationRoutes);

    app.get('/', (req: Request, res: Response) => {
      res.json({
        success: true,
        message: 'BuildHive API is running',
        version: '1.0.0',
        environment: environment.NODE_ENV,
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/health',
          auth: '/api/v1/auth',
          profile: '/api/v1/profile',
          validation: '/api/v1/validation'
        },
        features: {
          authentication: {
            registration: {
              local: '/api/v1/auth/register/local',
              social: '/api/v1/auth/register/social'
            },
            login: '/api/v1/auth/login',
            logout: '/api/v1/auth/logout',
            tokenRefresh: '/api/v1/auth/refresh-token',
            passwordReset: {
              request: '/api/v1/auth/forgot-password',
              confirm: '/api/v1/auth/reset-password',
              change: '/api/v1/auth/change-password'
            },
            emailVerification: {
              verify: '/api/v1/auth/verify-email',
              resend: '/api/v1/auth/resend-verification'
            },
            session: {
              current: '/api/v1/auth/me',
              validate: '/api/v1/auth/validate-session'
            }
          },
          profile: {
            create: '/api/v1/profile/create',
            view: '/api/v1/profile/me',
            update: '/api/v1/profile/me',
            delete: '/api/v1/profile/me',
            completeness: '/api/v1/profile/completeness',
            summary: '/api/v1/profile/summary',
            preferences: '/api/v1/profile/preferences',
            avatar: '/api/v1/profile/avatar',
            metadata: '/api/v1/profile/metadata'
          },
          validation: {
            email: {
              availability: '/api/v1/validation/email/availability',
              format: '/api/v1/validation/email/format'
            },
            username: {
              availability: '/api/v1/validation/username/availability',
              format: '/api/v1/validation/username/format',
              generate: '/api/v1/validation/generate-username'
            },
            password: {
              strength: '/api/v1/validation/password/strength'
            },
            credentials: '/api/v1/validation/login/credentials',
            registration: '/api/v1/validation/registration-data',
            social: '/api/v1/validation/social/data',
            bulk: '/api/v1/validation/bulk-availability'
          }
        },
        security: {
          rateLimiting: 'enabled',
          inputValidation: 'enabled',
          authenticationRequired: 'selective',
          emailVerificationRequired: 'selective',
          passwordComplexity: 'enforced',
          tokenSecurity: 'jwt-based'
        }
      });
    });

    app.use('*', notFoundHandler);
    app.use(errorHandler);

    logger.info('BuildHive application initialized successfully');
    return app;

  } catch (error) {
    logger.error('Failed to initialize application', error);
    throw error;
  }
}

export default createApp;
