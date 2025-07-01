import { Router, Request, Response } from 'express';
import { logger, sendSuccess, sendError } from '../shared/utils';
import { database } from '../shared/database';
import { environment } from '../config/auth';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'BuildHive API',
      version: '1.0.0',
      environment: environment.NODE_ENV,
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
      userAgent: req.get('User-Agent'),
      requestId: res.locals.requestId
    });

    return sendSuccess(res, 'Service is healthy', healthData);

  } catch (error) {
    logger.error('Health check failed', { error, requestId: res.locals.requestId });
    
    return sendError(res, 'Service is unhealthy', 503);
  }
});

router.get('/detailed', async (req: Request, res: Response) => {
  try {
    const databaseStatus = await database.healthCheck();
    
    const detailedHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'BuildHive API',
      version: '1.0.0',
      environment: environment.NODE_ENV,
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
        status: databaseStatus ? 'connected' : 'disconnected',
        connectionPool: databaseStatus ? 'active' : 'inactive'
      },
      services: {
        auth: 'operational',
        profile: 'operational',
        validation: 'operational',
        email: 'operational'
      },
      features: {
        registration: 'enabled',
        emailVerification: 'enabled',
        socialAuth: 'enabled'
      }
    };

    return sendSuccess(res, 'Detailed health check completed', detailedHealth);

  } catch (error) {
    logger.error('Detailed health check failed', { error, requestId: res.locals.requestId });
    
    return sendError(res, 'Detailed health check failed', 503);
  }
});

router.get('/ready', async (req: Request, res: Response) => {
  try {
    const databaseReady = await database.healthCheck();
    const memoryUsage = process.memoryUsage();
    const memoryOk = memoryUsage.heapUsed < (1024 * 1024 * 1024);
    const uptimeOk = process.uptime() > 5;

    const readinessCheck = {
      ready: databaseReady && memoryOk && uptimeOk,
      timestamp: new Date().toISOString(),
      checks: {
        database: databaseReady,
        memory: memoryOk,
        uptime: uptimeOk,
        services: true
      },
      details: {
        memoryUsage: memoryUsage.heapUsed,
        uptime: process.uptime()
      }
    };

    const statusCode = readinessCheck.ready ? 200 : 503;
    const message = readinessCheck.ready ? 'Service is ready' : 'Service is not ready';
    
    return res.status(statusCode).json({
      success: readinessCheck.ready,
      message,
      data: readinessCheck,
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });

  } catch (error) {
    logger.error('Readiness check failed', { error, requestId: res.locals.requestId });
    
    return sendError(res, 'Readiness check failed', 503);
  }
});

router.get('/live', async (req: Request, res: Response) => {
  const liveData = {
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    pid: process.pid
  };

  return sendSuccess(res, 'Service is alive', liveData);
});

export default router;
