import { Router } from 'express';
import { buildHiveLogger } from '../shared';
import healthRoutes from './health.routes';

const router = Router();
const logger = buildHiveLogger;

router.use('/health', healthRoutes);

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'BuildHive API Routes',
    version: process.env.APP_VERSION || '1.0.0',
    timestamp: new Date().toISOString(),
    availableRoutes: {
      health: '/health',
      api: '/api/v1'
    }
  });
});

logger.info('Main routes initialized');

export default router;
