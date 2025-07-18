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
          'comprehensive-logging',
          'job-management',
          'client-management',
          'material-tracking',
          'file-attachments',
          'quote-management',
          'ai-pricing',
          'payment-processing',
          'invoice-management',
          'refund-processing',
          'webhook-handling',
          'credit-system',
          'credit-purchases',
          'credit-transactions',
          'auto-topup',
          'trial-credits',
          'credit-notifications'
        ],
        endpoints: {
          total: 151,
          authentication: 12,
          profile: 13,
          validation: 12,
          jobs: 15,
          clients: 5,
          materials: 3,
          attachments: 2,
          quotes: 21,
          payments: 7,
          paymentMethods: 7,
          invoices: 7,
          refunds: 6,
          webhooks: 5,
          credits: 13,
          creditPurchases: 12,
          creditTransactions: 10,
          health: 1
        },
        routeGroups: {
          coreAuth: ['auth', 'profile', 'validation'],
          jobManagement: ['jobs', 'clients', 'materials', 'attachments'],
          quoteSystem: ['quotes'],
          paymentSystem: ['payments', 'payment-methods', 'invoices', 'refunds', 'webhooks'],
          creditSystem: ['credits', 'credit-purchases', 'credit-transactions'],
          monitoring: ['health']
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
