import { Router } from 'express';
import { logger, sendSuccess } from '../shared/utils';
import { environment } from '../config/auth';
import healthRoutes from './health.routes';
import { authRoutes, profileRoutes, validationRoutes } from '../auth/routes'; 
import { jobRoutes, clientRoutes, materialRoutes, attachmentRoutes } from '../jobs/routes';
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
      attachments: '/api/v1/attachments'
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
        'POST /api/v1/jobs/:id/attachments/multiple',
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
      fileAttachments: 'enabled'
    },
    security: {
      rateLimiting: 'active',
      inputValidation: 'active',
      authenticationRequired: 'selective',
      emailVerificationRequired: 'selective',
      passwordComplexity: 'enforced',
      tokenSecurity: 'jwt-based',
      jobOwnershipValidation: 'enforced',
      fileUploadSecurity: 'enforced'
    }
  };

  return sendSuccess(res, 'BuildHive API Routes', routeData);
});

logger.info('Main routes initialized', {
  routes: ['health', 'auth', 'profile', 'validation', 'jobs', 'clients', 'materials', 'attachments'],
  environment: environment.NODE_ENV,
  authenticationEnabled: true,
  rateLimitingEnabled: true,
  jobManagementEnabled: true,
  totalEndpoints: 44
});

export default router;
