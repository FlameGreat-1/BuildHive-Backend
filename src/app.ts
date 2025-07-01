import express, { Application, Request, Response, NextFunction } from 'express';
import { connectDatabase } from './shared/database';
import { logger } from './shared/utils';
import { 
  errorHandler, 
  notFoundHandler,
  generalApiRateLimit,
  corsOptions,
  securityHeaders,
  addSecurityHeaders,
  validateOrigin
} from './shared/middleware';
import { 
  requestLogger,
  sensitiveDataFilter
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

    // Connect to database
    await connectDatabase();
    logger.info('Database connected successfully');

    // Security middleware
    app.use(securityHeaders);
    app.use(addSecurityHeaders);
    app.use(validateOrigin);
    app.use(corsOptions);

    // Body parsing middleware
    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: true, limit: '1mb' }));

    // Request logging and filtering
    app.use(requestLogger);
    app.use(sensitiveDataFilter);

    // Health check route
    app.get('/health', (req: Request, res: Response) => {
      res.json({
        success: true,
        message: 'BuildHive API is healthy',
        timestamp: new Date().toISOString(),
        environment: environment.NODE_ENV,
        version: '1.0.0'
      });
    });

    // API routes with rate limiting
    app.use('/api', generalApiRateLimit);
    app.use('/api/v1/auth', authRoutes);
    app.use('/api/v1/profile', profileRoutes);
    app.use('/api/v1/validation', validationRoutes);

    // Root endpoint
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
          registration: {
            local: '/api/v1/auth/register/local',
            social: '/api/v1/auth/register/social',
            verification: '/api/v1/auth/verify-email',
            resend: '/api/v1/auth/resend-verification'
          },
          validation: {
            email: '/api/v1/validation/email/availability',
            username: '/api/v1/validation/username/availability'
          }
        }
      });
    });

    // 404 handler
    app.use('*', notFoundHandler);

    // Global error handler
    app.use(errorHandler);

    logger.info('BuildHive application initialized successfully');
    return app;

  } catch (error) {
    logger.error('Failed to initialize application', error);
    throw error;
  }
}

export default createApp;
