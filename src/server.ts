import { createApp } from './app';
import { logger } from './shared/utils';
import { database } from './shared/database';
import { environment } from './config/auth';

const PORT = environment.PORT;
const HOST = environment.HOST;

async function startServer(): Promise<void> {
  try {
    logger.info('Starting BuildHive server...', {
      port: PORT,
      host: HOST,
      environment: environment.NODE_ENV,
      nodeVersion: process.version
    });

    const app = await createApp();
    
    const server = app.listen(PORT, HOST, () => {
      logger.info('BuildHive server started successfully', {
        port: PORT,
        host: HOST,
        environment: environment.NODE_ENV,
        processId: process.pid,
        uptime: process.uptime(),
        features: ['registration', 'email-verification', 'profile-creation']
      });
    });

    // Graceful shutdown handler
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);
      
      server.close(async (err) => {
        if (err) {
          logger.error('Error during server shutdown', err);
          process.exit(1);
        }

        try {
          // Close database connections
          await database.disconnect();
          logger.info('Database connections closed');

          logger.info('Graceful shutdown completed');
          process.exit(0);
        } catch (shutdownError) {
          logger.error('Error during graceful shutdown', shutdownError);
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', error);
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled promise rejection', {
        reason,
        promise
      });
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Start the server
startServer().catch((error) => {
  logger.error('Server startup failed', error);
  process.exit(1);
});
