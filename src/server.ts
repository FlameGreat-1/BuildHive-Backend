// src/server.ts - BuildHive Main Server Entry Point

import 'dotenv/config';
import { logger, createLogContext } from '@/utils/logger';
import { ERROR_CODES } from '@/utils/constants';
import app from './app';

// Enterprise server configuration
interface ServerConfig {
  port: number;
  host: string;
  environment: string;
  processId: number;
  startTime: Date;
}

class BuildHiveServer {
  private config: ServerConfig;
  private isShuttingDown: boolean = false;

  constructor() {
    this.config = {
      port: parseInt(process.env.PORT || '3000'),
      host: process.env.HOST || '0.0.0.0',
      environment: process.env.NODE_ENV || 'production',
      processId: process.pid,
      startTime: new Date(),
    };

    this.setupProcessHandlers();
  }

  // Setup process event handlers
  private setupProcessHandlers(): void {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception - Server will shutdown', 
        createLogContext()
          .withError(ERROR_CODES.SYS_UNCAUGHT_EXCEPTION)
          .withMetadata({
            errorMessage: error.message,
            stack: error.stack,
            processId: this.config.processId,
          })
          .build()
      );
      
      this.gracefulShutdown('UNCAUGHT_EXCEPTION', 1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      logger.error('Unhandled Promise Rejection - Server will shutdown', 
        createLogContext()
          .withError(ERROR_CODES.SYS_UNHANDLED_REJECTION)
          .withMetadata({
            reason: reason?.message || reason,
            stack: reason?.stack,
            processId: this.config.processId,
          })
          .build()
      );
      
      this.gracefulShutdown('UNHANDLED_REJECTION', 1);
    });

    // Handle graceful shutdown signals
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM', 0));
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT', 0));
    process.on('SIGUSR2', () => this.gracefulShutdown('SIGUSR2', 0)); // PM2 reload

    // Handle memory warnings
    process.on('warning', (warning) => {
      logger.warn('Process warning', 
        createLogContext()
          .withMetadata({
            warningName: warning.name,
            warningMessage: warning.message,
            stack: warning.stack,
            processId: this.config.processId,
          })
          .build()
      );
    });
  }

  // Start the BuildHive server
  public async start(): Promise<void> {
    const startTime = Date.now();
    const logContext = createLogContext()
      .withMetadata({
        port: this.config.port,
        host: this.config.host,
        environment: this.config.environment,
        processId: this.config.processId,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      })
      .build();

    try {
      logger.info('Starting BuildHive server...', logContext);

      // Validate environment
      this.validateEnvironment();

      // Start the application
      await app.start();

      const startupTime = Date.now() - startTime;
      
      logger.info('BuildHive server started successfully', {
        ...logContext,
        startupTime,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
      });

      // Log business event
      logger.business('BUILDHIVE_SERVER_STARTED', {
        ...logContext,
        startupTime,
        version: process.env.npm_package_version || '1.0.0',
      });

      // Log server URLs
      this.logServerUrls();

    } catch (error) {
      const startupTime = Date.now() - startTime;
      
      logger.error('BuildHive server startup failed', {
        ...logContext,
        startupTime,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        errorCode: ERROR_CODES.SYS_STARTUP_ERROR,
      });

      // Exit with error code
      process.exit(1);
    }
  }

  // Validate required environment variables
  private validateEnvironment(): void {
    const requiredEnvVars = [
      'DATABASE_URL',
      'REDIS_URL',
      'JWT_SECRET',
      'COOKIE_SECRET',
    ];

    const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    
    if (missingVars.length > 0) {
      const errorMessage = `Missing required environment variables: ${missingVars.join(', ')}`;
      
      logger.error('Environment validation failed', 
        createLogContext()
          .withError(ERROR_CODES.SYS_CONFIGURATION_ERROR)
          .withMetadata({
            missingVariables: missingVars,
            environment: this.config.environment,
          })
          .build()
      );
      
      throw new Error(errorMessage);
    }

    // Validate port
    if (this.config.port < 1 || this.config.port > 65535) {
      throw new Error(`Invalid port number: ${this.config.port}`);
    }

    logger.info('Environment validation passed', 
      createLogContext()
        .withMetadata({
          environment: this.config.environment,
          port: this.config.port,
          requiredVarsCount: requiredEnvVars.length,
        })
        .build()
    );
  }

  // Log server access URLs
  private logServerUrls(): void {
    const baseUrl = `http://${this.config.host === '0.0.0.0' ? 'localhost' : this.config.host}:${this.config.port}`;
    
    logger.info('BuildHive server URLs:', {
      metadata: {
        baseUrl,
        healthCheck: `${baseUrl}/api/health`,
        apiDocs: `${baseUrl}/api/docs`,
        authEndpoint: `${baseUrl}/api/auth`,
      }
    });

    // Log in development mode
    if (this.config.environment === 'development') {
      console.log('\n🚀 BuildHive Server Running:');
      console.log(`   ➜ Local:    ${baseUrl}`);
      console.log(`   ➜ Health:   ${baseUrl}/api/health`);
      console.log(`   ➜ API Docs: ${baseUrl}/api/docs`);
      console.log(`   ➜ Auth:     ${baseUrl}/api/auth`);
      console.log('');
    }
  }

  // Graceful shutdown handler
  private gracefulShutdown(signal: string, exitCode: number): void {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress, forcing exit', {
        metadata: { signal, exitCode, processId: this.config.processId }
      });
      process.exit(exitCode);
      return;
    }

    this.isShuttingDown = true;
    const shutdownStartTime = Date.now();
    
    const logContext = createLogContext()
      .withMetadata({
        signal,
        exitCode,
        processId: this.config.processId,
        uptime: process.uptime(),
      })
      .build();

    logger.info(`BuildHive server received ${signal}, starting graceful shutdown...`, logContext);

    // Set shutdown timeout (30 seconds)
    const shutdownTimeout = setTimeout(() => {
      logger.error('Graceful shutdown timeout, forcing exit', {
        ...logContext,
        shutdownDuration: Date.now() - shutdownStartTime,
      });
      process.exit(1);
    }, 30000);

    // Perform graceful shutdown
    Promise.resolve()
      .then(async () => {
        // Get the server instance and close it
        const server = app.getServer();
        if (server) {
          await new Promise<void>((resolve, reject) => {
            server.close((error: any) => {
              if (error) {
                logger.error('Error closing server', {
                  ...logContext,
                  errorMessage: error.message,
                });
                reject(error);
              } else {
                logger.info('Server closed successfully', logContext);
                resolve();
              }
            });
          });
        }

        // Close database connections (handled by app.ts)
        // This is already handled in app.ts graceful shutdown

        clearTimeout(shutdownTimeout);
        
        const shutdownDuration = Date.now() - shutdownStartTime;
        logger.info('BuildHive server shutdown completed', {
          ...logContext,
          shutdownDuration,
        });

        logger.business('BUILDHIVE_SERVER_SHUTDOWN', {
          ...logContext,
          shutdownDuration,
          uptime: process.uptime(),
        });

        process.exit(exitCode);
      })
      .catch((error) => {
        clearTimeout(shutdownTimeout);
        
        logger.error('Error during graceful shutdown', {
          ...logContext,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          shutdownDuration: Date.now() - shutdownStartTime,
        });
        
        process.exit(1);
      });
  }

  // Get server configuration
  public getConfig(): Readonly<ServerConfig> {
    return { ...this.config };
  }
}

// Create and start the BuildHive server
const buildHiveServer = new BuildHiveServer();

// Start the server
buildHiveServer.start().catch((error) => {
  console.error('Failed to start BuildHive server:', error);
  process.exit(1);
});

// Export for testing
export default buildHiveServer;
export { BuildHiveServer };
