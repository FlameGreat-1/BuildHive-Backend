import { Router } from 'express';
import { logger, sendSuccess } from '../shared/utils';
import { environment } from '../config/auth';
import healthRoutes from './health.routes';
import { authRoutes, profileRoutes, validationRoutes } from '../auth/routes'; 
import { jobRoutes, clientRoutes, materialRoutes, attachmentRoutes } from '../jobs/routes';
import { quoteRoutes } from '../quotes/routes';
import { paymentRoutes, paymentMethodRoutes, invoiceRoutes, refundRoutes, webhookRoutes } from '../payment/routes';
import { creditRoutes, creditPurchaseRoutes, creditTransactionRoutes } from '../credits/routes';
import feedsRoutes from '../feeds/routes';
import { generalApiRateLimit } from '../shared/middleware';

const router = Router();

router.use(generalApiRateLimit);

router.use('/health', healthRoutes);
router.use('/api/v1/auth', authRoutes);     
router.use('/api/v1/profile', profileRoutes);
router.use('/api/v1/validation', validationRoutes);
router.use('/api/v1/jobs', jobRoutes);
router.use('/api/v1/clients', clientRoutes);
router.use('/api/v1/materials', materialRoutes);
router.use('/api/v1/attachments', attachmentRoutes);
router.use('/api/v1/quotes', quoteRoutes);
router.use('/api/v1/payments', paymentRoutes);
router.use('/api/v1/payment-methods', paymentMethodRoutes);
router.use('/api/v1/invoices', invoiceRoutes);
router.use('/api/v1/refunds', refundRoutes);
router.use('/api/v1/webhooks', webhookRoutes);
router.use('/api/v1/credits', creditRoutes);
router.use('/api/v1/credits/purchases', creditPurchaseRoutes);
router.use('/api/v1/credits/transactions', creditTransactionRoutes);
router.use('/api/v1/feeds', feedsRoutes);

router.get('/', (req, res) => {
  const routeData = {
    service: 'BuildHive API Routes',
    version: '1.0.0',
    environment: environment.NODE_ENV,
    timestamp: new Date().toISOString(),
    availableRoutes: {
      health: '/health',
      api: '/api/v1',
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
      creditTransactions: '/api/v1/credits/transactions',
      marketplace: '/api/v1/feeds/marketplace',
      applications: '/api/v1/feeds/applications'
    },
    endpoints: {
      authentication: [
        'POST /api/v1/auth/register/local',
        'POST /api/v1/auth/register/social',
        'POST /api/v1/auth/login',
        'POST /api/v1/auth/logout',
        'POST /api/v1/auth/refresh-token',
        'POST /api/v1/auth/forgot-password',
        'POST /api/v1/auth/reset-password',
        'POST /api/v1/auth/change-password',
        'POST /api/v1/auth/verify-email',
        'POST /api/v1/auth/resend-verification',
        'GET /api/v1/auth/me',
        'GET /api/v1/auth/validate-session'
      ],
      profile: [
        'POST /api/v1/profile/create',
        'GET /api/v1/profile/me',
        'PUT /api/v1/profile/me',
        'DELETE /api/v1/profile/me',
        'GET /api/v1/profile/completeness',
        'GET /api/v1/profile/summary',
        'GET /api/v1/profile/preferences',
        'PUT /api/v1/profile/preferences',
        'PUT /api/v1/profile/avatar',
        'DELETE /api/v1/profile/avatar',
        'GET /api/v1/profile/metadata',
        'PUT /api/v1/profile/metadata',
        'PATCH /api/v1/profile/registration-source'
      ],
      validation: [
        'POST /api/v1/validation/email/availability',
        'POST /api/v1/validation/username/availability',
        'POST /api/v1/validation/email/format',
        'POST /api/v1/validation/username/format',
        'POST /api/v1/validation/password/strength',
        'POST /api/v1/validation/login/credentials',
        'POST /api/v1/validation/password-reset/data',
        'POST /api/v1/validation/change-password/data',
        'POST /api/v1/validation/registration-data',
        'POST /api/v1/validation/social/data',
        'POST /api/v1/validation/generate-username',
        'POST /api/v1/validation/bulk-availability'
      ],
      jobs: [
        'POST /api/v1/jobs',
        'GET /api/v1/jobs',
        'GET /api/v1/jobs/summary',
        'GET /api/v1/jobs/statistics',
        'GET /api/v1/jobs/:id',
        'PUT /api/v1/jobs/:id',
        'PATCH /api/v1/jobs/:id/status',
        'DELETE /api/v1/jobs/:id',
        'POST /api/v1/jobs/:id/materials',
        'GET /api/v1/jobs/:id/materials',
        'PUT /api/v1/jobs/:id/materials/:materialId',
        'DELETE /api/v1/jobs/:id/materials/:materialId',
        'POST /api/v1/jobs/:id/attachments',
        'GET /api/v1/jobs/:id/attachments',
        'DELETE /api/v1/jobs/:id/attachments/:attachmentId'
      ],
      clients: [
        'POST /api/v1/clients',
        'GET /api/v1/clients',
        'GET /api/v1/clients/:id',
        'PUT /api/v1/clients/:id',
        'DELETE /api/v1/clients/:id'
      ],
      materials: [
        'GET /api/v1/materials/jobs/:jobId/materials',
        'PUT /api/v1/materials/jobs/:jobId/materials/:id',
        'DELETE /api/v1/materials/jobs/:jobId/materials/:id'
      ],
      attachments: [
        'GET /api/v1/attachments/jobs/:jobId/attachments',
        'DELETE /api/v1/attachments/jobs/:jobId/attachments/:id'
      ],
      quotes: [
        'POST /api/v1/quotes',
        'GET /api/v1/quotes',
        'GET /api/v1/quotes/analytics',
        'GET /api/v1/quotes/generate-number',
        'POST /api/v1/quotes/calculate',
        'POST /api/v1/quotes/ai-pricing',
        'GET /api/v1/quotes/client',
        'GET /api/v1/quotes/number/:quoteNumber',
        'GET /api/v1/quotes/view/:quoteNumber',
        'POST /api/v1/quotes/accept/:quoteNumber',
        'POST /api/v1/quotes/reject/:quoteNumber',
        'POST /api/v1/quotes/:quoteNumber/accept-with-payment',
        'POST /api/v1/quotes/:quoteNumber/payment-intent',
        'GET /api/v1/quotes/:quoteId',
        'PUT /api/v1/quotes/:quoteId',
        'PATCH /api/v1/quotes/:quoteId/status',
        'DELETE /api/v1/quotes/:quoteId',
        'POST /api/v1/quotes/:quoteId/send',
        'POST /api/v1/quotes/:quoteId/duplicate',
        'POST /api/v1/quotes/:quoteId/generate-invoice',
        'POST /api/v1/quotes/:quoteId/refund'
      ],
      payments: [
        'POST /api/v1/payments/intent',
        'POST /api/v1/payments/confirm',
        'POST /api/v1/payments/links',
        'GET /api/v1/payments/methods',
        'GET /api/v1/payments/history',
        'GET /api/v1/payments/:paymentId/status',
        'POST /api/v1/payments/:paymentId/cancel'
      ],
      paymentMethods: [
        'POST /api/v1/payment-methods',
        'POST /api/v1/payment-methods/attach',
        'POST /api/v1/payment-methods/:paymentMethodId/detach',
        'POST /api/v1/payment-methods/:paymentMethodId/set-default',
        'GET /api/v1/payment-methods',
        'GET /api/v1/payment-methods/default',
        'DELETE /api/v1/payment-methods/:paymentMethodId'
      ],
      invoices: [
        'POST /api/v1/invoices',
        'GET /api/v1/invoices',
        'GET /api/v1/invoices/:invoiceId',
        'PATCH /api/v1/invoices/:invoiceId/status',
        'POST /api/v1/invoices/:invoiceId/send',
        'POST /api/v1/invoices/:invoiceId/cancel',
        'DELETE /api/v1/invoices/:invoiceId'
      ],
      refunds: [
        'POST /api/v1/refunds',
        'GET /api/v1/refunds',
        'GET /api/v1/refunds/:refundId',
        'GET /api/v1/refunds/payment/:paymentId',
        'PATCH /api/v1/refunds/:refundId/status',
        'POST /api/v1/refunds/:refundId/cancel'
      ],
      webhooks: [
        'POST /api/v1/webhooks/stripe',
        'POST /api/v1/webhooks/retry/:eventId',
        'GET /api/v1/webhooks/health',
        'GET /api/v1/webhooks/validate',
        'GET /api/v1/webhooks/config'
      ],
      credits: [
        'GET /api/v1/credits/balance',
        'GET /api/v1/credits/dashboard',
        'GET /api/v1/credits/limits',
        'POST /api/v1/credits/check-sufficiency',
        'GET /api/v1/credits/expiring',
        'POST /api/v1/credits/auto-topup/setup',
        'GET /api/v1/credits/auto-topup/settings',
        'PUT /api/v1/credits/auto-topup/enable',
        'PUT /api/v1/credits/auto-topup/disable',
        'PUT /api/v1/credits/auto-topup/payment-method',
        'GET /api/v1/credits/auto-topup/history',
        'POST /api/v1/credits/validate-operation',
        'POST /api/v1/credits/award-trial'
      ],
      creditPurchases: [
        'POST /api/v1/credits/purchases/initiate',
        'POST /api/v1/credits/purchases/:purchaseId/complete',
        'POST /api/v1/credits/purchases/:purchaseId/cancel',
        'POST /api/v1/credits/purchases/:purchaseId/refund',
        'GET /api/v1/credits/purchases/:purchaseId',
        'GET /api/v1/credits/purchases/history',
        'POST /api/v1/credits/purchases/calculate',
        'GET /api/v1/credits/purchases/:purchaseId/receipt',
        'POST /api/v1/credits/purchases/apple-pay',
        'POST /api/v1/credits/purchases/google-pay',
        'GET /api/v1/credits/purchases/packages/available',
        'POST /api/v1/credits/purchases/promo-code/validate'
      ],
      creditTransactions: [
        'POST /api/v1/credits/transactions/create',
        'POST /api/v1/credits/transactions/job-application',
        'POST /api/v1/credits/transactions/profile-boost',
        'POST /api/v1/credits/transactions/premium-job-unlock',
        'GET /api/v1/credits/transactions/:transactionId',
        'GET /api/v1/credits/transactions/history',
        'GET /api/v1/credits/transactions/summary',
        'POST /api/v1/credits/transactions/:transactionId/cancel',
        'POST /api/v1/credits/transactions/:transactionId/refund',
        'POST /api/v1/credits/transactions/validate-request'
      ],
      marketplace: [
        'POST /api/v1/feeds/marketplace',
        'POST /api/v1/feeds/marketplace/authenticated',
        'GET /api/v1/feeds/marketplace/search',
        'GET /api/v1/feeds/marketplace/stats',
        'GET /api/v1/feeds/marketplace/recommended',
        'GET /api/v1/feeds/marketplace/client/jobs',
        'POST /api/v1/feeds/marketplace/process-expired',
        'POST /api/v1/feeds/marketplace/bulk/status',
        'GET /api/v1/feeds/marketplace/:jobId',
        'PUT /api/v1/feeds/marketplace/:jobId',
        'PATCH /api/v1/feeds/marketplace/:jobId/status',
        'DELETE /api/v1/feeds/marketplace/:jobId',
        'GET /api/v1/feeds/marketplace/:jobId/credit-cost',
        'GET /api/v1/feeds/marketplace/:jobId/applications',
        'GET /api/v1/feeds/marketplace/:jobId/analytics'
      ],
      applications: [
        'POST /api/v1/feeds/applications',
        'GET /api/v1/feeds/applications/search',
        'GET /api/v1/feeds/applications/tradie/history',
        'GET /api/v1/feeds/applications/tradie/applications',
        'GET /api/v1/feeds/applications/analytics',
        'GET /api/v1/feeds/applications/status/:status',
        'POST /api/v1/feeds/applications/bulk/status',
        'GET /api/v1/feeds/applications/job/:jobId',
        'GET /api/v1/feeds/applications/:applicationId',
        'PUT /api/v1/feeds/applications/:applicationId',
        'PATCH /api/v1/feeds/applications/:applicationId/status',
        'POST /api/v1/feeds/applications/:applicationId/withdraw',
        'GET /api/v1/feeds/applications/:applicationId/metrics'
      ]
    },
    features: {
      registration: 'enabled',
      emailVerification: 'enabled',
      socialAuth: 'enabled',
      passwordReset: 'enabled',
      profileManagement: 'enabled',
      tokenRefresh: 'enabled',
      rateLimiting: 'enabled',
      validation: 'enabled',
      jobManagement: 'enabled',
      clientManagement: 'enabled',
      materialTracking: 'enabled',
      fileAttachments: 'enabled',
      quoteManagement: 'enabled',
      aiPricing: 'enabled',
      paymentProcessing: 'enabled',
      invoiceManagement: 'enabled',
      refundProcessing: 'enabled',
      webhookHandling: 'enabled',
      creditSystem: 'enabled',
      creditPurchases: 'enabled',
      creditTransactions: 'enabled',
      autoTopup: 'enabled',
      trialCredits: 'enabled',
      creditNotifications: 'enabled',
      multiplePaymentMethods: 'enabled',
      leadsMarketplace: 'enabled',
      jobApplications: 'enabled',
      marketplaceSearch: 'enabled',
      applicationTracking: 'enabled',
      creditBasedApplications: 'enabled',
      realTimeNotifications: 'enabled'
    },
    security: {
      rateLimiting: 'active',
      inputValidation: 'active',
      authenticationRequired: 'selective',
      emailVerificationRequired: 'selective',
      passwordComplexity: 'enforced',
      tokenSecurity: 'jwt-based',
      jobOwnershipValidation: 'enforced',
      fileUploadSecurity: 'enforced',
      paymentSecurity: 'pci-compliant',
      webhookSecurity: 'signature-verified',
      creditOwnershipValidation: 'enforced',
      creditUsageLimits: 'enforced',
      creditPurchaseLimits: 'enforced',
      autoTopupSecurity: 'enforced',
      marketplaceJobValidation: 'enforced',
      applicationOwnershipValidation: 'enforced',
      duplicateApplicationPrevention: 'enforced',
      marketplaceRateLimiting: 'enforced'
    }
  };

  return sendSuccess(res, 'BuildHive API Routes', routeData);
});

logger.info('Main routes initialized', {
  routes: ['health', 'auth', 'profile', 'validation', 'jobs', 'clients', 'materials', 'attachments', 'quotes', 'payments', 'payment-methods', 'invoices', 'refunds', 'webhooks', 'credits', 'credit-purchases', 'credit-transactions', 'feeds-marketplace', 'feeds-applications'],
  environment: environment.NODE_ENV,
  authenticationEnabled: true,
  rateLimitingEnabled: true,
  jobManagementEnabled: true,
  quoteManagementEnabled: true,
  paymentProcessingEnabled: true,
  creditSystemEnabled: true,
  autoTopupEnabled: true,
  leadsMarketplaceEnabled: true,
  jobApplicationsEnabled: true,
  totalEndpoints: 159
});

export default router;
