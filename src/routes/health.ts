// src/routes/health.ts
import { Router } from 'express';
import { checkDatabaseHealth } from '@/config/database';

const router = Router();

router.get('/health', async (req, res) => {
  try {
    const dbHealth = await checkDatabaseHealth();
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealth.status,
        api: 'healthy'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Service unavailable'
    });
  }
});

export default router;
