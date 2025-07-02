import { Router } from 'express';
import { logger, sendSuccess } from '../shared/utils';
import { environment } from '../config/auth';
import healthRoutes from './health.routes';
import authRoutes from '../auth/routes';
import { generalApiRateLimit } from '../shared/middleware';

const router = Router();

router.use(generalApiRateLimit);

router.use('/health', healthRoutes);
router.use('/api/v1', authRoutes);

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
      validation: '/api/v1/validation'
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
        'DELETE /api/v1/profile/avatar'
      ],
      validation: [
        'POST /api/v1/validation/email/availability',
        'POST /api/v1/validation/username/availability',
        'POST /api/v1/validation/email/format',
        'POST /api/v1/validation/username/format',
        'POST /api/v1/validation/password/strength',
        'POST /api/v1/validation/registration-data',
        'POST /api/v1/validation/generate-username',
        'POST /api/v1/validation/bulk-availability'
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
      validation: 'enabled'
    },
    security: {
      rateLimiting: 'active',
      inputValidation: 'active',
      authenticationRequired: 'selective',
      emailVerificationRequired: 'selective'
    }
  };

  return sendSuccess(res, 'BuildHive API Routes', routeData);
});

logger.info('Main routes initialized', {
  routes: ['health', 'auth', 'profile', 'validation'],
  environment: environment.NODE_ENV,
  authenticationEnabled: true,
  rateLimitingEnabled: true
});

export default router;

