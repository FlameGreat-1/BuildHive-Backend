import { createApp } from './app';
import { buildHiveLogger } from './shared';
import { gracefulShutdown } from './shared/utils';

const logger = buildHiveLogger;
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

async function startServer(): Promise<void> {
  try {
    logger.info('Starting BuildHive server...', {
      port: PORT,
      host: HOST,
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version
    });

    const app = await createApp();
    
    const server = app.listen(PORT, HOST, () => {
      logger.info('BuildHive server started successfully', {
        port: PORT,
        host: HOST,
        environment: process.env.NODE_ENV || 'development',
        processId: process.pid,
        uptime: process.uptime()
      });
    });

    // Graceful shutdown handlers
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);
      
      server.close(async (err) => {
        if (err) {
          logger.error('Error during server shutdown', err);
          process.exit(1);
        }

        try {
          await gracefulShutdown();
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
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

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
