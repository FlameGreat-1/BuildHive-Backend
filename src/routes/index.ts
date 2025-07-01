import { Router } from 'express';
import { logger, sendSuccess } from '../shared/utils';
import { environment } from '../config/auth';
import healthRoutes from './health.routes';

const router = Router();

router.use('/health', healthRoutes);

router.get('/', (req, res) => {
  const routeData = {
    service: 'BuildHive API Routes',
    version: '1.0.0',
    environment: environment.NODE_ENV,
    timestamp: new Date().toISOString(),
    availableRoutes: {
      health: '/health',
      api: '/api/v1'
    },
    features: {
      registration: 'enabled',
      emailVerification: 'enabled',
      socialAuth: 'enabled'
    }
  };

  return sendSuccess(res, 'BuildHive API Routes', routeData);
});

logger.info('Main routes initialized', {
  routes: ['health', 'api'],
  environment: environment.NODE_ENV
});

export default router;
