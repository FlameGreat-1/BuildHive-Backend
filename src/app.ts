// src/app.ts 

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { logger, createLogContext } from '@/utils/logger';
import { ERROR_CODES, HTTP_STATUS_CODES } from '@/utils/constants';
import { connectDatabase } from '@/config/database';
import { connectRedis } from '@/config/redis';
import { getApiConfig } from '@/config/api';
import { discoverRoutes, getApiDocumentation } from '@/utils/routeDiscovery';
import { 
  initializeRequest,
  securityHeaders,
  requestLogger,
  errorHandler,
  healthCheckBypass,
  requestTimeout
} from '@/middleware/AuthMiddleware';
import authRoutes from '@/routes/authRoutes';
import { ApiResponse } from '@/types/common.types';

export class App {
  private app: Application;
  private server: any;
  private config: ReturnType<typeof getApiConfig>;

  constructor() {
    this.config = getApiConfig();
    this.app = express();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddleware(): void {
    const logContext = createLogContext()
      .withMetadata({ phase: 'middleware_initialization' })
      .build();

    logger.info('Initializing production middleware stack', logContext);

    // Trust proxy for production load balancers
    this.app.set('trust proxy', this.config.security.trustProxy);

    // Health check bypass (must be first)
    this.app.use(healthCheckBypass);

    // Request initialization
    this.app.use(initializeRequest);

    // Production security middleware
    this.app.use(helmet({
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
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }));

    // Custom security headers
    this.app.use(securityHeaders);

    // Production CORS configuration
    this.app.use(cors({
      origin: (origin, callback) => {
        if (!origin || this.config.corsOrigins.includes(origin)) {
          callback(null, true);
        } else {
          logger.warn('CORS origin rejected', 
            createLogContext()
              .withMetadata({ 
                rejectedOrigin: origin,
                allowedOrigins: this.config.corsOrigins 
              })
              .build()
          );
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: this.config.allowedMethods,
      allowedHeaders: this.config.allowedHeaders,
      maxAge: 86400,
    }));

    // Production compression
    this.app.use(compression({
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      },
      level: 6,
      threshold: 1024,
    }));

    // Body parsing middleware
    this.app.use(express.json({ 
      limit: this.config.maxRequestSize,
      verify: (req: any, res, buf) => {
        req.rawBody = buf;
      }
    }));
    this.app.use(express.urlencoded({ 
      extended: true, 
      limit: this.config.maxRequestSize 
    }));

    // Cookie parser with production secret
    this.app.use(cookieParser(this.config.security.cookieSecret));

    // Production rate limiting
    this.app.use(rateLimit({
      windowMs: this.config.rateLimiting.windowMs,
      max: this.config.rateLimiting.maxRequests,
      message: {
        success: false,
        message: 'Too many requests from this IP, please try again later',
        timestamp: new Date(),
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        logger.warn('Rate limit exceeded', 
          createLogContext()
            .withRequest(req)
            .withMetadata({ 
              ip: req.ip,
              userAgent: req.headers['user-agent']
            })
            .build()
        );

        const errorResponse: ApiResponse<null> = {
          success: false,
          message: 'Rate limit exceeded',
          timestamp: new Date(),
          requestId: req.headers['x-request-id'] as string,
        };
        res.status(HTTP_STATUS_CODES.TOO_MANY_REQUESTS).json(errorResponse);
      },
    }));

    // Request timeout
    this.app.use(requestTimeout(this.config.requestTimeout));

    // Request logging
    this.app.use(requestLogger);

    logger.info('Production middleware stack initialized', logContext);
  }

  private initializeRoutes(): void {
    const logContext = createLogContext()
      .withMetadata({ phase: 'routes_initialization' })
      .build();

    logger.info('Initializing production routes', logContext);

    // API routes
    this.app.use('/api/auth', authRoutes);

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      const response: ApiResponse<any> = {
        success: true,
        message: 'TradeConnect API is running',
        data: {
          service: 'TradeConnect API',
          version: this.config.version,
          environment: this.config.environment,
          timestamp: new Date(),
        },
        timestamp: new Date(),
        requestId: req.requestId,
      };

      res.status(HTTP_STATUS_CODES.OK).json(response);
    });

    // API documentation endpoint (auto-generated from routes)
    this.app.get('/api/docs', (req: Request, res: Response) => {
      try {
        // Discover routes from the actual Express app
        discoverRoutes(this.app);
        const documentation = getApiDocumentation();

        const response: ApiResponse<any> = {
          success: true,
          message: 'API Documentation',
          data: documentation,
          timestamp: new Date(),
          requestId: req.requestId,
        };

        res.status(HTTP_STATUS_CODES.OK).json(response);

      } catch (error) {
        logger.error('API documentation generation failed', 
          createLogContext()
            .withRequest(req)
            .withMetadata({ 
              errorMessage: error instanceof Error ? error.message : 'Unknown error'
            })
            .build()
        );

        const errorResponse: ApiResponse<null> = {
          success: false,
          message: 'Documentation generation failed',
          timestamp: new Date(),
          requestId: req.requestId,
        };

        res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(errorResponse);
      }
    });

    // Health check endpoint
    this.app.get('/api/health', (req: Request, res: Response) => {
      const response: ApiResponse<any> = {
        success: true,
        message: 'Service is healthy',
        data: {
          status: 'healthy',
          uptime: process.uptime(),
          timestamp: new Date(),
          version: this.config.version,
          environment: this.config.environment,
          memory: process.memoryUsage(),
          baseUrl: this.config.baseUrl,
        },
        timestamp: new Date(),
        requestId: req.requestId,
      };

      res.status(HTTP_STATUS_CODES.OK).json(response);
    });

    // 404 handler for undefined routes
    this.app.use('*', (req: Request, res: Response) => {
      const errorResponse: ApiResponse<null> = {
        success: false,
        message: `Route ${req.method} ${req.originalUrl} not found`,
        timestamp: new Date(),
        requestId: req.requestId,
      };

      logger.warn('Route not found', 
        createLogContext()
          .withRequest(req)
          .withMetadata({ 
            method: req.method,
            url: req.originalUrl,
            requestId: req.requestId 
          })
          .build()
      );

      res.status(HTTP_STATUS_CODES.NOT_FOUND).json(errorResponse);
    });

    logger.info('Production routes initialized', logContext);
  }

  // Initialize production error handling
  private initializeErrorHandling(): void {
    const logContext = createLogContext()
      .withMetadata({ phase: 'error_handling_initialization' })
      .build();

    logger.info('Initializing production error handling', logContext);

    // Global error handler
    this.app.use(errorHandler);

    // Unhandled promise rejection handler
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      logger.error('Unhandled Promise Rejection - Production', 
        createLogContext()
          .withError(ERROR_CODES.SYS_UNHANDLED_REJECTION)
          .withMetadata({ 
            reason: reason?.message || reason,
            stack: reason?.stack,
            environment: this.config.environment
          })
          .build()
      );

      // In production, gracefully shutdown on unhandled rejections
      this.gracefulShutdown('UNHANDLED_REJECTION');
    });

    // Uncaught exception handler
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception - Production', 
        createLogContext()
          .withError(ERROR_CODES.SYS_UNCAUGHT_EXCEPTION)
          .withMetadata({ 
            errorMessage: error.message,
            stack: error.stack,
            environment: this.config.environment
          })
          .build()
      );

      // Force shutdown on uncaught exceptions in production
      this.gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    // Production shutdown handlers
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
    process.on('SIGUSR2', () => this.gracefulShutdown('SIGUSR2')); // PM2 reload

    logger.info('Production error handling initialized', logContext);
  }

  // Initialize production database connections
  private async initializeDatabase(): Promise<void> {
    const logContext = createLogContext()
      .withMetadata({ phase: 'database_initialization' })
      .build();

    try {
      logger.info('Initializing production database connections', logContext);

      // Connect to PostgreSQL with production settings
      await connectDatabase();
      logger.info('Production PostgreSQL connection established', logContext);

      // Connect to Redis with production settings
      await connectRedis();
      logger.info('Production Redis connection established', logContext);

      // Test database connections
      await this.testDatabaseConnections();

      logger.info('Production database connections initialized successfully', logContext);

    } catch (error) {
      logger.error('Production database initialization failed', 
        createLogContext()
          .withError(ERROR_CODES.SYS_DATABASE_CONNECTION_ERROR)
          .withMetadata({ 
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            environment: this.config.environment
          })
          .build()
      );
      throw error;
    }
  }

  // Test database connections
  private async testDatabaseConnections(): Promise<void> {
    try {
      // Test Prisma connection
      const { prisma } = await import('@/config/database');
      await prisma.$queryRaw`SELECT 1`;
      
      // Test Redis connection
      const { redis } = await import('@/config/redis');
      await redis.ping();

      logger.info('Database connection tests passed');

    } catch (error) {
      logger.error('Database connection test failed', {
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // Start the production application server
  public async start(): Promise<void> {
    const logContext = createLogContext()
      .withMetadata({ 
        phase: 'application_startup',
        port: this.config.port,
        environment: this.config.environment,
        baseUrl: this.config.baseUrl
      })
      .build();

    try {
      logger.info('Starting TradeConnect production application', logContext);

      // Initialize database connections
      await this.initializeDatabase();

      // Create HTTPS server for production
      this.server = createServer(this.app);

      // Configure server settings
      this.server.keepAliveTimeout = 65000;
      this.server.headersTimeout = 66000;
      this.server.maxHeadersCount = 1000;
      this.server.timeout = 120000;

      // Start listening
      this.server.listen(this.config.port, () => {
        logger.info('TradeConnect production application started successfully', {
          ...logContext,
          port: this.config.port,
          environment: this.config.environment,
          processId: process.pid,
          baseUrl: this.config.baseUrl,
          version: this.config.version
        });

        logger.business('PRODUCTION_APPLICATION_STARTED', {
          ...logContext,
          version: this.config.version,
          baseUrl: this.config.baseUrl
        });
      });

      // Production server error handling
      this.server.on('error', (error: any) => {
        logger.error('Production server error', 
          createLogContext()
            .withError(ERROR_CODES.SYS_SERVER_ERROR)
            .withMetadata({ 
              errorMessage: error.message,
              code: error.code,
              port: this.config.port,
              environment: this.config.environment
            })
            .build()
        );

        if (error.code === 'EADDRINUSE') {
          logger.error(`Production port ${this.config.port} is already in use`, logContext);
          process.exit(1);
        }
      });

      // Server listening event
      this.server.on('listening', () => {
        const address = this.server.address();
        logger.info('Production server is listening', {
          ...logContext,
          address: typeof address === 'string' ? address : address?.address,
          port: typeof address === 'string' ? this.config.port : address?.port,
        });
      });

      // Server connection handling
      this.server.on('connection', (socket: any) => {
        socket.setTimeout(120000); // 2 minutes timeout
      });

    } catch (error) {
      logger.error('Production application startup failed', 
        createLogContext()
          .withError(ERROR_CODES.SYS_STARTUP_ERROR)
          .withMetadata({ 
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            environment: this.config.environment
          })
          .build()
      );
      throw error;
    }
  }

  // Production graceful shutdown
  private gracefulShutdown(signal: string): void {
    const logContext = createLogContext()
      .withMetadata({ 
        phase: 'graceful_shutdown',
        signal,
        processId: process.pid,
        environment: this.config.environment
      })
      .build();

    logger.info(`Production received ${signal}, starting graceful shutdown`, logContext);

    // Set timeout for forceful shutdown (30 seconds in production)
    const shutdownTimeout = setTimeout(() => {
      logger.error('Production graceful shutdown timeout, forcing exit', logContext);
      process.exit(1);
    }, 30000);

    // Close server
    if (this.server) {
      this.server.close(async (error: any) => {
        if (error) {
          logger.error('Error closing production server', {
            ...logContext,
            errorMessage: error.message,
          });
        } else {
          logger.info('Production server closed successfully', logContext);
        }

        try {
          // Close database connections
          await this.closeDatabaseConnections();
          
          clearTimeout(shutdownTimeout);
          logger.info('Production graceful shutdown completed', logContext);
          
          logger.business('PRODUCTION_APPLICATION_SHUTDOWN', {
            ...logContext,
            signal,
            uptime: process.uptime()
          });
          
          process.exit(0);

        } catch (shutdownError) {
          logger.error('Error during production graceful shutdown', {
            ...logContext,
            errorMessage: shutdownError instanceof Error ? shutdownError.message : 'Unknown error',
          });
          clearTimeout(shutdownTimeout);
          process.exit(1);
        }
      });
    } else {
      clearTimeout(shutdownTimeout);
      process.exit(0);
    }
  }

  // Close production database connections
  private async closeDatabaseConnections(): Promise<void> {
    const logContext = createLogContext()
      .withMetadata({ 
        phase: 'database_cleanup',
        environment: this.config.environment
      })
      .build();

    try {
      logger.info('Closing production database connections', logContext);

      // Close Redis connection
      const { redis } = await import('@/config/redis');
      if (redis) {
        await redis.quit();
        logger.info('Production Redis connection closed', logContext);
      }

      // Close Prisma connection
      const { prisma } = await import('@/config/database');
      if (prisma) {
        await prisma.$disconnect();
        logger.info('Production Prisma connection closed', logContext);
      }

      logger.info('Production database connections closed successfully', logContext);

    } catch (error) {
      logger.error('Error closing production database connections', {
        ...logContext,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  // Get Express app instance
  public getApp(): Application {
    return this.app;
  }

  // Get server instance
  public getServer(): any {
    return this.server;
  }

  // Get production configuration
  public getConfig(): Readonly<ReturnType<typeof getApiConfig>> {
    return { ...this.config };
  }
}

// Create and export production application instance
const app = new App();

export default app;
export { App };

// Export for production deployment
export const createProductionApp = (): App => {
  return new App();
};
