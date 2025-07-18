import express, { Application, Request, Response, NextFunction } from 'express';
import swaggerUi from 'swagger-ui-express';
import swaggerDocument from './swagger-output.json';
import { initializeDatabase } from './shared/database';
import { logger } from './shared/utils';
import { 
  errorHandler, 
  notFoundHandler,
  corsOptions,
  securityHeaders,
  addSecurityHeaders,
  validateOrigin,
  requestLogger
} from './shared/middleware';
import routes from './routes';
import { environment } from './config/auth';

export async function createApp(): Promise<Application> {
  const app = express();

  try {
    logger.info('Initializing BuildHive application...');

    await initializeDatabase();
    logger.info('Database connected successfully');

    app.use(securityHeaders);
    app.use(addSecurityHeaders);
    app.use(validateOrigin);
    app.use(corsOptions);

    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    app.use(requestLogger);

    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
      explorer: true,
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'BuildHive API Documentation'
    }));

    app.get('/health', (req: Request, res: Response) => {
      res.json({
        success: true,
        message: 'BuildHive API is healthy',
        timestamp: new Date().toISOString(),
        environment: environment.NODE_ENV,
        version: '1.0.0'
      });
    });

    app.use('/', routes);

    app.get('/', (req: Request, res: Response) => {
      res.json({
        success: true,
        message: 'BuildHive API is running',
        version: '1.0.0',
        environment: environment.NODE_ENV,
        timestamp: new Date().toISOString(),
        documentation: {
          swagger: '/api-docs',
          description: 'Interactive API Documentation'
        },
        endpoints: {
          health: '/health',
          auth: '/api/v1/auth',
          profile: '/api/v1/profile',
          validation: '/api/v1/validation',
          jobs: '/api/v1/jobs',
          clients: '/api/v1/clients',
          materials: '/api/v1/materials',
          attachments: '/api/v1/attachments',
          quotes: '/api/v1/quotes',
          payments: '/api/v1/payments',
          paymentMethods: '/api/v1/payment-methods',
          invoices: '/api/v1/invoices',
          refunds: '/api/v1/refunds',
          webhooks: '/api/v1/webhooks',
          credits: '/api/v1/credits',
          creditPurchases: '/api/v1/credits/purchases',
          creditTransactions: '/api/v1/credits/transactions'
        },
        features: {
          authentication: {
            registration: {
              local: '/api/v1/auth/register/local',
              social: '/api/v1/auth/register/social'
            },
            login: '/api/v1/auth/login',
            logout: '/api/v1/auth/logout',
            tokenRefresh: '/api/v1/auth/refresh-token',
            passwordReset: {
              request: '/api/v1/auth/forgot-password',
              confirm: '/api/v1/auth/reset-password',
              change: '/api/v1/auth/change-password'
            },
            emailVerification: {
              verify: '/api/v1/auth/verify-email',
              resend: '/api/v1/auth/resend-verification'
            },
            session: {
              current: '/api/v1/auth/me',
              validate: '/api/v1/auth/validate-session'
            }
          },
          profile: {
            create: '/api/v1/profile/create',
            view: '/api/v1/profile/me',
            update: '/api/v1/profile/me',
            delete: '/api/v1/profile/me',
            completeness: '/api/v1/profile/completeness',
            summary: '/api/v1/profile/summary',
            preferences: '/api/v1/profile/preferences',
            avatar: '/api/v1/profile/avatar',
            metadata: '/api/v1/profile/metadata'
          },
          validation: {
            email: {
              availability: '/api/v1/validation/email/availability',
              format: '/api/v1/validation/email/format'
            },
            username: {
              availability: '/api/v1/validation/username/availability',
              format: '/api/v1/validation/username/format',
              generate: '/api/v1/validation/generate-username'
            },
            password: {
              strength: '/api/v1/validation/password/strength'
            },
            credentials: '/api/v1/validation/login/credentials',
            registration: '/api/v1/validation/registration-data',
            social: '/api/v1/validation/social/data',
            bulk: '/api/v1/validation/bulk-availability'
          },
          jobManagement: {
            jobs: {
              create: '/api/v1/jobs',
              list: '/api/v1/jobs',
              view: '/api/v1/jobs/:id',
              update: '/api/v1/jobs/:id',
              delete: '/api/v1/jobs/:id',
              updateStatus: '/api/v1/jobs/:id/status',
              summary: '/api/v1/jobs/summary',
              statistics: '/api/v1/jobs/statistics'
            },
            materials: {
              add: '/api/v1/jobs/:id/materials',
              list: '/api/v1/jobs/:id/materials',
              update: '/api/v1/jobs/:id/materials/:materialId',
              remove: '/api/v1/jobs/:id/materials/:materialId'
            },
            attachments: {
              upload: '/api/v1/jobs/:id/attachments',
              uploadMultiple: '/api/v1/jobs/:id/attachments/multiple',
              list: '/api/v1/jobs/:id/attachments',
              remove: '/api/v1/jobs/:id/attachments/:attachmentId'
            },
            clients: {
              create: '/api/v1/clients',
              list: '/api/v1/clients',
              view: '/api/v1/clients/:id',
              update: '/api/v1/clients/:id',
              delete: '/api/v1/clients/:id'
            }
          },
          quoteManagement: {
            quotes: {
              create: '/api/v1/quotes',
              list: '/api/v1/quotes',
              view: '/api/v1/quotes/:quoteId',
              update: '/api/v1/quotes/:quoteId',
              delete: '/api/v1/quotes/:quoteId',
              send: '/api/v1/quotes/:quoteId/send',
              duplicate: '/api/v1/quotes/:quoteId/duplicate',
              generateInvoice: '/api/v1/quotes/:quoteId/generate-invoice'
            },
            analytics: '/api/v1/quotes/analytics',
            calculate: '/api/v1/quotes/calculate',
            aiPricing: '/api/v1/quotes/ai-pricing',
            client: '/api/v1/quotes/client',
            accept: '/api/v1/quotes/accept/:quoteNumber',
            reject: '/api/v1/quotes/reject/:quoteNumber'
          },
          paymentProcessing: {
            payments: {
              createIntent: '/api/v1/payments/intent',
              confirm: '/api/v1/payments/confirm',
              createLink: '/api/v1/payments/links',
              history: '/api/v1/payments/history',
              status: '/api/v1/payments/:paymentId/status',
              cancel: '/api/v1/payments/:paymentId/cancel'
            },
            paymentMethods: {
              create: '/api/v1/payment-methods',
              attach: '/api/v1/payment-methods/attach',
              detach: '/api/v1/payment-methods/:paymentMethodId/detach',
              setDefault: '/api/v1/payment-methods/:paymentMethodId/set-default',
              list: '/api/v1/payment-methods',
              getDefault: '/api/v1/payment-methods/default',
              delete: '/api/v1/payment-methods/:paymentMethodId'
            },
            invoices: {
              create: '/api/v1/invoices',
              list: '/api/v1/invoices',
              view: '/api/v1/invoices/:invoiceId',
              updateStatus: '/api/v1/invoices/:invoiceId/status',
              send: '/api/v1/invoices/:invoiceId/send',
              cancel: '/api/v1/invoices/:invoiceId/cancel',
              delete: '/api/v1/invoices/:invoiceId'
            },
            refunds: {
              create: '/api/v1/refunds',
              list: '/api/v1/refunds',
              view: '/api/v1/refunds/:refundId',
              byPayment: '/api/v1/refunds/payment/:paymentId',
              updateStatus: '/api/v1/refunds/:refundId/status',
              cancel: '/api/v1/refunds/:refundId/cancel'
            },
            webhooks: {
              stripe: '/api/v1/webhooks/stripe',
              retry: '/api/v1/webhooks/retry/:eventId',
              health: '/api/v1/webhooks/health',
              validate: '/api/v1/webhooks/validate',
              config: '/api/v1/webhooks/config'
            }
          },
          creditSystem: {
            credits: {
              balance: '/api/v1/credits/balance',
              dashboard: '/api/v1/credits/dashboard',
              limits: '/api/v1/credits/limits',
              checkSufficiency: '/api/v1/credits/check-sufficiency',
              expiring: '/api/v1/credits/expiring',
              validateOperation: '/api/v1/credits/validate-operation',
              awardTrial: '/api/v1/credits/award-trial'
            },
            autoTopup: {
              setup: '/api/v1/credits/auto-topup/setup',
              settings: '/api/v1/credits/auto-topup/settings',
              enable: '/api/v1/credits/auto-topup/enable',
              disable: '/api/v1/credits/auto-topup/disable',
              updatePaymentMethod: '/api/v1/credits/auto-topup/payment-method',
              history: '/api/v1/credits/auto-topup/history'
            },
            purchases: {
              initiate: '/api/v1/credits/purchases/initiate',
              complete: '/api/v1/credits/purchases/:purchaseId/complete',
              cancel: '/api/v1/credits/purchases/:purchaseId/cancel',
              refund: '/api/v1/credits/purchases/:purchaseId/refund',
              view: '/api/v1/credits/purchases/:purchaseId',
              history: '/api/v1/credits/purchases/history',
              calculate: '/api/v1/credits/purchases/calculate',
              receipt: '/api/v1/credits/purchases/:purchaseId/receipt',
              applePay: '/api/v1/credits/purchases/apple-pay',
              googlePay: '/api/v1/credits/purchases/google-pay',
              availablePackages: '/api/v1/credits/purchases/packages/available',
              validatePromoCode: '/api/v1/credits/purchases/promo-code/validate'
            },
            transactions: {
              create: '/api/v1/credits/transactions/create',
              jobApplication: '/api/v1/credits/transactions/job-application',
              profileBoost: '/api/v1/credits/transactions/profile-boost',
              premiumJobUnlock: '/api/v1/credits/transactions/premium-job-unlock',
              view: '/api/v1/credits/transactions/:transactionId',
              history: '/api/v1/credits/transactions/history',
              summary: '/api/v1/credits/transactions/summary',
              cancel: '/api/v1/credits/transactions/:transactionId/cancel',
              refund: '/api/v1/credits/transactions/:transactionId/refund',
              validateRequest: '/api/v1/credits/transactions/validate-request'
            }
          }
        },
        security: {
          rateLimiting: 'enabled',
          inputValidation: 'enabled',
          authenticationRequired: 'selective',
          emailVerificationRequired: 'selective',
          passwordComplexity: 'enforced',
          tokenSecurity: 'jwt-based',
          jobOwnershipValidation: 'enforced',
          fileUploadSecurity: 'enforced',
          materialTracking: 'secured',
          clientDataProtection: 'enforced',
          paymentSecurity: 'pci-compliant',
          webhookSecurity: 'signature-verified',
          creditOwnershipValidation: 'enforced',
          creditUsageLimits: 'enforced',
          creditPurchaseLimits: 'enforced',
          autoTopupSecurity: 'enforced'
        },
        capabilities: {
          maxFileSize: '10MB',
          supportedFileTypes: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'gif'],
          maxFilesPerJob: 10,
          maxMaterialsPerJob: 100,
          jobStatusTracking: true,
          realTimeUpdates: true,
          auditLogging: true,
          dataExport: true,
          creditPackages: ['starter', 'professional', 'enterprise', 'premium'],
          paymentMethods: ['stripe', 'apple-pay', 'google-pay'],
          autoTopup: true,
          trialCredits: true,
          creditNotifications: true,
          creditExpiry: true,
          refundProcessing: true,
          promoCodeSupport: true,
          receiptGeneration: true,
          creditAnalytics: true
        }
      });
    });

    app.use('*', notFoundHandler);
    app.use(errorHandler);

    logger.info('BuildHive application initialized successfully', {
      features: [
        'authentication',
        'profile-management',
        'job-management',
        'client-management',
        'material-tracking',
        'file-attachments',
        'validation',
        'security',
        'rate-limiting',
        'audit-logging',
        'swagger-documentation',
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
      totalEndpoints: 133,
      version: '1.0.0',
      documentation: '/api-docs'
    });
    
    return app;

  } catch (error) {
    logger.error('Failed to initialize application', error);
    throw error;
  }
}

export default createApp;
