import express, { Application, Request, Response } from 'express';
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
} from '@/middleware/auth.middleware';
import authRoutes from '@/routes/auth.routes';
import { ApiResponse } from '@/types/common.types';

export class BuildHiveApp {
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

    this.app.set('trust proxy', this.config.security.trustProxy);

    this.app.use(healthCheckBypass);
    this.app.use(initializeRequest);

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

    this.app.use(securityHeaders);

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

    this.app.use(compression({
      filter: (req, _res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, _res);
      },
      level: 6,
      threshold: 1024,
    }));

    this.app.use(express.json({ 
      limit: this.config.maxRequestSize,
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      }
    }));
    this.app.use(express.urlencoded({ 
      extended: true, 
      limit: this.config.maxRequestSize 
    }));

    this.app.use(cookieParser(this.config.security.cookieSecret));

    this.app.use(rateLimit({
      windowMs: this.config.rateLimiting.windowMs,
      max: this.config.rateLimiting.maxRequests,
      message: {
        success: false,
        message: 'Too many requests from this IP, please try again later',
        timestamp: new Date().toISOString(),
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        logger.warn('Rate limit exceeded', 
          createLogContext()
            .withMetadata({ 
              ip: req.ip,
              userAgent: req.headers['user-agent']
            })
            .build()
        );

        const errorResponse: ApiResponse<null> = {
          success: false,
          message: 'Rate limit exceeded',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] as string || '',
        };
        res.status(HTTP_STATUS_CODES.TOO_MANY_REQUESTS).json(errorResponse);
      },
    }));

    this.app.use(requestTimeout(this.config.requestTimeout));
    this.app.use(requestLogger);

    logger.info('Production middleware stack initialized', logContext);
  }

  private initializeRoutes(): void {
    const logContext = createLogContext()
      .withMetadata({ phase: 'routes_initialization' })
      .build();

    logger.info('Initializing production routes', logContext);

    this.app.use('/api/auth', authRoutes);

    this.app.get('/', (req: Request, res: Response) => {
      const response: ApiResponse<any> = {
        success: true,
        message: 'BuildHive API is running',
        data: {
          service: 'BuildHive API',
          version: this.config.version,
          environment: this.config.environment,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
        requestId: (req as any).requestId || '',
      };

      res.status(HTTP_STATUS_CODES.OK).json(response);
    });

    this.app.get('/api/docs', (req: Request, res: Response) => {
      try {
        discoverRoutes(this.app);
        const documentation = getApiDocumentation();

        const response: ApiResponse<any> = {
          success: true,
          message: 'API Documentation',
          data: documentation,
          timestamp: new Date().toISOString(),
          requestId: (req as any).requestId || '',
        };

        res.status(HTTP_STATUS_CODES.OK).json(response);

      } catch (error) {
        logger.error('API documentation generation failed', 
          createLogContext()
            .withMetadata({ 
              errorMessage: error instanceof Error ? error.message : 'Unknown error'
            })
            .build()
        );

        const errorResponse: ApiResponse<null> = {
          success: false,
          message: 'Documentation generation failed',
          timestamp: new Date().toISOString(),
          requestId: (req as any).requestId || '',
        };

        res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(errorResponse);
      }
    });

    this.app.get('/api/health', (req: Request, res: Response) => {
      const response: ApiResponse<any> = {
        success: true,
        message: 'Service is healthy',
        data: {
          status: 'healthy',
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
          version: this.config.version,
          environment: this.config.environment,
          memory: process.memoryUsage(),
          baseUrl: this.config.baseUrl,
        },
        timestamp: new Date().toISOString(),
        requestId: (req as any).requestId || '',
      };

      res.status(HTTP_STATUS_CODES.OK).json(response);
    });

    this.app.use('*', (req: Request, res: Response) => {
      const errorResponse: ApiResponse<null> = {
        success: false,
        message: `Route ${req.method} ${req.originalUrl} not found`,
        timestamp: new Date().toISOString(),
        requestId: (req as any).requestId || '',
      };

      logger.warn('Route not found', 
        createLogContext()
          .withMetadata({ 
            method: req.method,
            url: req.originalUrl,
            requestId: (req as any).requestId 
          })
          .build()
      );

      res.status(HTTP_STATUS_CODES.NOT_FOUND).json(errorResponse);
    });

    logger.info('Production routes initialized', logContext);
  }

  private initializeErrorHandling(): void {
    const logContext = createLogContext()
      .withMetadata({ phase: 'error_handling_initialization' })
      .build();

    logger.info('Initializing production error handling', logContext);

    this.app.use(errorHandler);

    process.on('unhandledRejection', (reason: any, _promise: Promise<any>) => {
      logger.error('Unhandled Promise Rejection - Production', 
        createLogContext()
          .withMetadata({ 
            errorCode: ERROR_CODES.SYS_UNHANDLED_REJECTION,
            reason: reason?.message || reason,
            stack: reason?.stack,
            environment: this.config.environment
          })
          .build()
      );

      this.gracefulShutdown('UNHANDLED_REJECTION');
    });

    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception - Production', 
        createLogContext()
          .withMetadata({ 
            errorCode: ERROR_CODES.SYS_UNCAUGHT_EXCEPTION,
            errorMessage: error.message,
            stack: error.stack,
            environment: this.config.environment
          })
          .build()
      );

      this.gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
    process.on('SIGUSR2', () => this.gracefulShutdown('SIGUSR2'));

    logger.info('Production error handling initialized', logContext);
  }

  private async initializeDatabase(): Promise<void> {
    const logContext = createLogContext()
      .withMetadata({ phase: 'database_initialization' })
      .build();

    try {
      logger.info('Initializing production database connections', logContext);

      await connectDatabase();
      logger.info('Production PostgreSQL connection established', logContext);

      await connectRedis();
      logger.info('Production Redis connection established', logContext);

      await this.testDatabaseConnections();

      logger.info('Production database connections initialized successfully', logContext);

    } catch (error) {
      logger.error('Production database initialization failed', 
        createLogContext()
          .withMetadata({ 
            errorCode: ERROR_CODES.SYS_DATABASE_CONNECTION_ERROR,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            environment: this.config.environment
          })
          .build()
      );
      throw error;
    }
  }

  private async testDatabaseConnections(): Promise<void> {
    try {
      const { databaseManager } = await import('@/config/database');
      const client = databaseManager.getClient();
      await client.$queryRaw`SELECT 1`;
      
      const { redisManager } = await import('@/config/redis');
      await redisManager.ping();

      logger.info('Database connection tests passed');

    } catch (error) {
      logger.error('Database connection test failed', {
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

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
      logger.info('Starting BuildHive production application', logContext);

      await this.initializeDatabase();

      this.server = createServer(this.app);

      this.server.keepAliveTimeout = 65000;
      this.server.headersTimeout = 66000;
      this.server.maxHeadersCount = 1000;
      this.server.timeout = 120000;

      this.server.listen(this.config.port, () => {
        const startupTime = Date.now();
        logger.info('BuildHive production application started successfully', {
          ...logContext,
          port: this.config.port,
          environment: this.config.environment,
          processId: process.pid,
          baseUrl: this.config.baseUrl,
          version: this.config.version,
          startupTime
        });

        logger.business('PRODUCTION_APPLICATION_STARTED', {
          ...logContext,
          version: this.config.version,
          baseUrl: this.config.baseUrl
        });
      });

      this.server.on('error', (error: NodeJS.ErrnoException) => {
        logger.error('Production server error', 
          createLogContext()
            .withMetadata({ 
              errorCode: ERROR_CODES.SYS_SERVER_ERROR,
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

      this.server.on('listening', () => {
        const address = this.server.address();
        logger.info('Production server is listening', {
          ...logContext,
          address: typeof address === 'string' ? address : address?.address,
          port: typeof address === 'string' ? this.config.port : address?.port,
        });
      });

      this.server.on('connection', (socket) => {
        socket.setTimeout(120000);
      });

    } catch (error) {
      logger.error('Production application startup failed', 
        createLogContext()
          .withMetadata({ 
            errorCode: ERROR_CODES.SYS_STARTUP_ERROR,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            environment: this.config.environment
          })
          .build()
      );
      throw error;
    }
  }

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

    const shutdownTimeout = setTimeout(() => {
      logger.error('Production graceful shutdown timeout, forcing exit', logContext);
      process.exit(1);
    }, 30000);

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
          await this.closeDatabaseConnections();
          
          clearTimeout(shutdownTimeout);
          const shutdownDuration = Date.now();
          logger.info('Production graceful shutdown completed', {
            ...logContext,
            shutdownDuration
          });
          
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

  private async closeDatabaseConnections(): Promise<void> {
    const logContext = createLogContext()
      .withMetadata({ 
        phase: 'database_cleanup',
        environment: this.config.environment
      })
      .build();

    try {
      logger.info('Closing production database connections', logContext);

      const { redisManager } = await import('@/config/redis');
      if (redisManager) {
        await redisManager.disconnect();
        logger.info('Production Redis connection closed', logContext);
      }

      const { databaseManager } = await import('@/config/database');
      if (databaseManager) {
        await databaseManager.disconnect();
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

  public getApp(): Application {
    return this.app;
  }

  public getServer(): any {
    return this.server;
  }

  public getConfig(): Readonly<ReturnType<typeof getApiConfig>> {
    return { ...this.config };
  }
}

export default BuildHiveApp;

export const createProductionApp = (): BuildHiveApp => {
  return new BuildHiveApp();
};
