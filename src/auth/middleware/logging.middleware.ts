import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../shared/utils';
import { attachRequestId } from '../../shared/utils';

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = uuidv4();
  const startTime = Date.now();

  attachRequestId(res, requestId);

  const logData = {
    requestId,
    method: req.method,
    url: req.url,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  };

  logger.info('Incoming request', logData);

  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    
    logger.info('Request completed', {
      ...logData,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      responseSize: data ? Buffer.byteLength(data, 'utf8') : 0
    });

    return originalSend.call(this, data);
  };

  next();
};

export const registrationLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = res.locals.requestId || 'unknown';

  if (req.path.includes('/register')) {
    logger.info('Registration attempt started', {
      requestId,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      authProvider: req.body?.authProvider || 'local',
      role: req.body?.role,
      timestamp: new Date().toISOString()
    });
  }

  if (req.path.includes('/verify-email')) {
    logger.info('Email verification attempt', {
      requestId,
      method: req.method,
      path: req.path,
      ip: req.ip,
      email: req.body?.email,
      timestamp: new Date().toISOString()
    });
  }

  next();
};

export const sensitiveDataFilter = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const originalBody = req.body;
  
  if (originalBody) {
    const filteredBody = { ...originalBody };
    
    if (filteredBody.password) {
      filteredBody.password = '[FILTERED]';
    }
    
    if (filteredBody.confirmPassword) {
      filteredBody.confirmPassword = '[FILTERED]';
    }
    
    if (filteredBody.socialData?.accessToken) {
      filteredBody.socialData.accessToken = '[FILTERED]';
    }

    req.body = filteredBody;
  }

  next();
};

export const errorLogger = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = res.locals.requestId || 'unknown';

  logger.error('Request error occurred', {
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });

  next(error);
};
