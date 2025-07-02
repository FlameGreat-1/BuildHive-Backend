import { createApp } from './app';
import { logger } from './shared/utils';
import { database, initializeDatabase } from './shared/database';
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

    logger.info('Initializing database...');
    await initializeDatabase();
    logger.info('Database initialization completed');

    const app = await createApp();
    
    const server = app.listen(PORT, HOST, () => {
      logger.info('BuildHive server started successfully', {
        port: PORT,
        host: HOST,
        environment: environment.NODE_ENV,
        processId: process.pid,
        uptime: process.uptime(),
        features: [
          'registration',
          'login',
          'logout', 
          'email-verification',
          'password-reset',
          'password-change',
          'token-refresh',
          'profile-management',
          'social-authentication',
          'input-validation',
          'rate-limiting',
          'security-headers',
          'comprehensive-logging'
        ],
        endpoints: {
          total: 25,
          authentication: 12,
          profile: 10,
          validation: 11,
          health: 4
        }
      });
    });

    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);
      
      server.close(async (err) => {
        if (err) {
          logger.error('Error during server shutdown', err);
          process.exit(1);
        }

        try {
          await database.end();
          logger.info('Database connections closed');

          logger.info('Graceful shutdown completed');
          process.exit(0);
        } catch (shutdownError) {
          logger.error('Error during graceful shutdown', shutdownError);
          process.exit(1);
        }
      });

      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', error);
      process.exit(1);
    });

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

startServer().catch((error) => {
  logger.error('Server startup failed', error);
  process.exit(1);
});

