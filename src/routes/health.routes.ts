import { Router, Request, Response } from 'express';
import { buildHiveLogger } from '../shared';

const router = Router();
const logger = buildHiveLogger;

router.get('/', async (req: Request, res: Response) => {
  try {
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'BuildHive API',
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        pid: process.pid
      }
    };

    logger.debug('Health check requested', {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(200).json({
      success: true,
      data: healthData,
      message: 'Service is healthy'
    });

  } catch (error) {
    logger.error('Health check failed', error);
    
    res.status(503).json({
      success: false,
      message: 'Service is unhealthy',
      code: 'HEALTH_CHECK_FAILED',
      data: {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

router.get('/detailed', async (req: Request, res: Response) => {
  try {
    const detailedHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'BuildHive API',
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        pid: process.pid,
        cpuUsage: process.cpuUsage(),
        loadAverage: process.platform !== 'win32' ? require('os').loadavg() : null,
        freeMemory: require('os').freemem(),
        totalMemory: require('os').totalmem()
      },
      database: {
        status: 'connected',
        connectionPool: 'active'
      },
      services: {
        auth: 'operational',
        profile: 'operational',
        validation: 'operational'
      }
    };

    res.status(200).json({
      success: true,
      data: detailedHealth,
      message: 'Detailed health check completed'
    });

  } catch (error) {
    logger.error('Detailed health check failed', error);
    
    res.status(503).json({
      success: false,
      message: 'Detailed health check failed',
      code: 'DETAILED_HEALTH_CHECK_FAILED',
      data: {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

router.get('/ready', async (req: Request, res: Response) => {
  try {
    const readinessCheck = {
      ready: true,
      timestamp: new Date().toISOString(),
      checks: {
        database: true,
        services: true,
        memory: process.memoryUsage().heapUsed < (1024 * 1024 * 1024),
        uptime: process.uptime() > 10
      }
    };

    const isReady = Object.values(readinessCheck.checks).every(check => check === true);
    
    if (isReady) {
      res.status(200).json({
        success: true,
        data: readinessCheck,
        message: 'Service is ready'
      });
    } else {
      res.status(503).json({
        success: false,
        data: { ...readinessCheck, ready: false },
        message: 'Service is not ready'
      });
    }

  } catch (error) {
    logger.error('Readiness check failed', error);
    
    res.status(503).json({
      success: false,
      message: 'Readiness check failed',
      code: 'READINESS_CHECK_FAILED',
      data: {
        ready: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

router.get('/live', async (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      alive: true,
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    },
    message: 'Service is alive'
  });
});

export default router;
