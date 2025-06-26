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
import { 
  initializeRequest,
  securityHeaders,
  corsHandler,
  requestLogger,
  errorHandler,
  healthCheckBypass,
  requestTimeout
} from '@/middleware/AuthMiddleware';
import authRoutes from '@/routes/authRoutes';
import { ApiResponse } from '@/types/common.types';

// Enterprise application configuration
interface AppConfig {
  port: number;
  nodeEnv: string;
  corsOrigins: string[];
  enableCompression: boolean;
  enableHelmet: boolean;
  enableRateLimit: boolean;
  rateLimitMax: number;
  rateLimitWindow: number;
  requestTimeout: number;
  maxRequestSize: string;
}

// Enterprise Express application class
export class App {
  private app: Application;
  private server: any;
  private config: AppConfig;

  constructor() {
    this.app = express();
    this.config = this.loadConfiguration();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  // Load application configuration
  private loadConfiguration(): AppConfig {
    return {
      port: parseInt(process.env.PORT || '3000'),
      nodeEnv: process.env.NODE_ENV || 'development',
      corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
      enableCompression: process.env.ENABLE_COMPRESSION !== 'false',
      enableHelmet: process.env.ENABLE_HELMET !== 'false',
      enableRateLimit: process.env.ENABLE_RATE_LIMIT !== 'false',
      rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100'),
      rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15 minutes
      requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000'), // 30 seconds
      maxRequestSize: process.env.MAX_REQUEST_SIZE || '10mb',
    };
  }

  // Initialize enterprise middleware stack
  private initializeMiddleware(): void {
    const logContext = createLogContext()
      .withMetadata({ phase: 'middleware_initialization' })
      .build();

    logger.info('Initializing middleware stack', logContext);

    // Trust proxy for load balancers
    this.app.set('trust proxy', 1);

    // Health check bypass (must be first)
    this.app.use(healthCheckBypass);

    // Request initialization
    this.app.use(initializeRequest);

    // Security middleware
    if (this.config.enableHelmet) {
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
      }));
    }

    // Custom security headers
    this.app.use(securityHeaders);

    // CORS configuration
    this.app.use(cors({
      origin: (origin, callback) => {
        if (!origin || this.config.corsOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Access-Token', 'X-Device-Fingerprint'],
      maxAge: 86400, // 24 hours
    }));

    // Compression middleware
    if (this.config.enableCompression) {
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
    }

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

    // Cookie parser
    this.app.use(cookieParser(process.env.COOKIE_SECRET || 'default-secret'));

    // Global rate limiting
    if (this.config.enableRateLimit) {
      this.app.use(rateLimit({
        windowMs: this.config.rateLimitWindow,
        max: this.config.rateLimitMax,
        message: {
          success: false,
          message: 'Too many requests from this IP, please try again later',
          timestamp: new Date(),
        },
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
          const errorResponse: ApiResponse<null> = {
            success: false,
            message: 'Rate limit exceeded',
            timestamp: new Date(),
            requestId: req.headers['x-request-id'] as string,
          };
          res.status(HTTP_STATUS_CODES.TOO_MANY_REQUESTS).json(errorResponse);
        },
      }));
    }

    // Request timeout
    this.app.use(requestTimeout(this.config.requestTimeout));

    // Request logging
    this.app.use(requestLogger);

    logger.info('Middleware stack initialized successfully', logContext);
  }

  // Initialize application routes
  private initializeRoutes(): void {
    const logContext = createLogContext()
      .withMetadata({ phase: 'routes_initialization' })
      .build();

    logger.info('Initializing application routes', logContext);

    // API routes
    this.app.use('/api/auth', authRoutes);

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      const response: ApiResponse<any> = {
        success: true,
        message: 'TradeConnect API is running',
        data: {
          service: 'TradeConnect API',
          version: process.env.APP_VERSION || '1.0.0',
          environment: this.config.nodeEnv,
          timestamp: new Date(),
        },
        timestamp: new Date(),
        requestId: req.requestId,
      };

      res.status(HTTP_STATUS_CODES.OK).json(response);
    });

    // API documentation endpoint
    this.app.get('/api', (req: Request, res: Response) => {
      const response: ApiResponse<any> = {
        success: true,
        message: 'TradeConnect API Documentation',
        data: {
          endpoints: {
            auth: '/api/auth',
            health: '/api/health',
          },
          version: process.env.APP_VERSION || '1.0.0',
          documentation: process.env.API_DOCS_URL || 'https://docs.tradeconnect.com',
        },
        timestamp: new Date(),
        requestId: req.requestId,
      };

      res.status(HTTP_STATUS_CODES.OK).json(response);
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
          version: process.env.APP_VERSION || '1.0.0',
          environment: this.config.nodeEnv,
          memory: process.memoryUsage(),
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

    logger.info('Application routes initialized successfully', logContext);
  }

  // Initialize error handling
  private initializeErrorHandling(): void {
    const logContext = createLogContext()
      .withMetadata({ phase: 'error_handling_initialization' })
      .build();

    logger.info('Initializing error handling', logContext);

    // Global error handler
    this.app.use(errorHandler);

    // Unhandled promise rejection handler
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      logger.error('Unhandled Promise Rejection', 
        createLogContext()
          .withError(ERROR_CODES.SYS_UNHANDLED_REJECTION)
          .withMetadata({ 
            reason: reason?.message || reason,
            stack: reason?.stack 
          })
          .build()
      );
    });

    // Uncaught exception handler
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception', 
        createLogContext()
          .withError(ERROR_CODES.SYS_UNCAUGHT_EXCEPTION)
          .withMetadata({ 
            errorMessage: error.message,
            stack: error.stack 
          })
          .build()
      );

      // Graceful shutdown
      this.gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    // Graceful shutdown handlers
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));

    logger.info('Error handling initialized successfully', logContext);
  }

  // Initialize database connections
  private async initializeDatabase(): Promise<void> {
    const logContext = createLogContext()
      .withMetadata({ phase: 'database_initialization' })
      .build();

    try {
      logger.info('Initializing database connections', logContext);

      // Connect to PostgreSQL
      await connectDatabase();
      logger.info('PostgreSQL connection established', logContext);

      // Connect to Redis
      await connectRedis();
      logger.info('Redis connection established', logContext);

      logger.info('Database connections initialized successfully', logContext);

    } catch (error) {
      logger.error('Database initialization failed', 
        createLogContext()
          .withError(ERROR_CODES.SYS_DATABASE_CONNECTION_ERROR)
          .withMetadata({ 
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined 
          })
          .build()
      );
      throw error;
    }
  }

  // Start the application server
  public async start(): Promise<void> {
    const logContext = createLogContext()
      .withMetadata({ 
        phase: 'application_startup',
        port: this.config.port,
        environment: this.config.nodeEnv 
      })
      .build();

    try {
      logger.info('Starting TradeConnect application', logContext);

      // Initialize database connections
      await this.initializeDatabase();

      // Create HTTP server
      this.server = createServer(this.app);

      // Start listening
      this.server.listen(this.config.port, () => {
        logger.info('TradeConnect application started successfully', {
          ...logContext,
          port: this.config.port,
          environment: this.config.nodeEnv,
          processId: process.pid,
        });

        logger.business('APPLICATION_STARTED', {
          ...logContext,
          version: process.env.APP_VERSION || '1.0.0',
        });
      });

      // Server error handling
      this.server.on('error', (error: any) => {
        logger.error('Server error', 
          createLogContext()
            .withError(ERROR_CODES.SYS_SERVER_ERROR)
            .withMetadata({ 
              errorMessage: error.message,
              code: error.code,
              port: this.config.port 
            })
            .build()
        );

        if (error.code === 'EADDRINUSE') {
          logger.error(`Port ${this.config.port} is already in use`, logContext);
          process.exit(1);
        }
      });

      // Server listening event
      this.server.on('listening', () => {
        const address = this.server.address();
        logger.info('Server is listening', {
          ...logContext,
          address: typeof address === 'string' ? address : address?.address,
          port: typeof address === 'string' ? this.config.port : address?.port,
        });
      });

    } catch (error) {
      logger.error('Application startup failed', 
        createLogContext()
          .withError(ERROR_CODES.SYS_STARTUP_ERROR)
          .withMetadata({ 
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined 
          })
          .build()
      );
      throw error;
    }
  }

  // Graceful shutdown
  private gracefulShutdown(signal: string): void {
    const logContext = createLogContext()
      .withMetadata({ 
        phase: 'graceful_shutdown',
        signal,
        processId: process.pid 
      })
      .build();

    logger.info(`Received ${signal}, starting graceful shutdown`, logContext);

    // Set a timeout for forceful shutdown
    const shutdownTimeout = setTimeout(() => {
      logger.error('Graceful shutdown timeout, forcing exit', logContext);
      process.exit(1);
    }, 30000); // 30 seconds

    // Close server
    if (this.server) {
      this.server.close(async (error: any) => {
        if (error) {
          logger.error('Error closing server', {
            ...logContext,
            errorMessage: error.message,
          });
        } else {
          logger.info('Server closed successfully', logContext);
        }

        try {
          // Close database connections
          await this.closeDatabaseConnections();
          
          clearTimeout(shutdownTimeout);
          logger.info('Graceful shutdown completed', logContext);
          process.exit(0);

        } catch (shutdownError) {
          logger.error('Error during graceful shutdown', {
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

  // Close database connections
  private async closeDatabaseConnections(): Promise<void> {
    const logContext = createLogContext()
      .withMetadata({ phase: 'database_cleanup' })
      .build();

    try {
      logger.info('Closing database connections', logContext);

      // Close Redis connection
      const { redis } = await import('@/config/redis');
      if (redis) {
        await redis.quit();
        logger.info('Redis connection closed', logContext);
      }

      // Close Prisma connection
      const { prisma } = await import('@/config/database');
      if (prisma) {
        await prisma.$disconnect();
        logger.info('Prisma connection closed', logContext);
      }

      logger.info('Database connections closed successfully', logContext);

    } catch (error) {
      logger.error('Error closing database connections', {
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

  // Get application configuration
  public getConfig(): Readonly<AppConfig> {
    return { ...this.config };
  }
}

// Create and export application instance
const app = new App();

export default app;
export { App };

// Export for testing
export const createApp = (): App => {
  return new App();
};
