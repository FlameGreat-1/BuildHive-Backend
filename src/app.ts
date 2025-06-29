import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { buildHiveLogger, errorMiddleware, rateLimitMiddleware } from './shared';
import { createAuthModuleRoutes } from './auth/routes';
import { createServiceContainer } from './auth/services';
import { createControllerContainer } from './auth/controllers';
import { initializeMiddleware } from './auth/middleware';
import { connectDatabase } from './shared/database';
import healthRoutes from './routes/health.routes';

export async function createApp(): Promise<Application> {
  const app = express();
  const logger = buildHiveLogger;

  try {
    logger.info('Initializing BuildHive application...');

    // Database connection
    await connectDatabase();
    logger.info('Database connected successfully');

    // Service container setup
    const serviceContainer = createServiceContainer();
    const controllerContainer = createControllerContainer(serviceContainer);
    
    // Initialize middleware
    initializeMiddleware(serviceContainer);
    logger.info('Middleware initialized');

    // Security middleware
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false
    }));

    // CORS configuration
    app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['X-RateLimit-Remaining', 'X-RateLimit-Limit', 'X-RateLimit-Reset']
    }));

    // Body parsing middleware
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    app.use(cookieParser());

    // Compression middleware
    app.use(compression());

    // Request logging
    app.use((req: Request, res: Response, next: NextFunction) => {
      logger.info('Incoming request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });

    // Rate limiting
    app.use('/api', rateLimitMiddleware);

    // Health check routes (before auth routes)
    app.use('/health', healthRoutes);

    // API routes
    app.use('/api/v1', createAuthModuleRoutes(controllerContainer));

    // Root endpoint
    app.get('/', (req: Request, res: Response) => {
      res.json({
        success: true,
        message: 'BuildHive API is running',
        version: process.env.APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/health',
          api: '/api/v1',
          docs: '/api/v1/docs'
        }
      });
    });

    // 404 handler
    app.use('*', (req: Request, res: Response) => {
      logger.warn('Route not found', {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip
      });

      res.status(404).json({
        success: false,
        message: 'Route not found',
        code: 'ROUTE_NOT_FOUND',
        data: {
          method: req.method,
          path: req.originalUrl,
          availableEndpoints: ['/health', '/api/v1']
        }
      });
    });

    // Global error handler
    app.use(errorMiddleware);

    logger.info('BuildHive application initialized successfully');
    return app;

  } catch (error) {
    logger.error('Failed to initialize application', error);
    throw error;
  }
}

export default createApp;
