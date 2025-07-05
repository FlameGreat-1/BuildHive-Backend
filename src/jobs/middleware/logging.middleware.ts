import { Request, Response, NextFunction } from 'express';
import { logger } from '../../shared/utils';

export interface LoggingRequest extends Request {
  startTime?: number;
  user?: {
    id: string;
    email: string;
    role: string;
    emailVerified: boolean;
  };
}

export const requestLogger = (req: LoggingRequest, res: Response, next: NextFunction): void => {
  req.startTime = Date.now();

  const originalSend = res.send;
  res.send = function(body: any) {
    const duration = Date.now() - (req.startTime || 0);
    
    logger.info('Job API Request', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      tradieId: req.user?.id,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      jobId: req.params.id || req.params.jobId,
      clientId: req.params.clientId,
      materialId: req.params.materialId,
      attachmentId: req.params.attachmentId
    });

    return originalSend.call(this, body);
  };

  next();
};

export const auditLogger = (action: string) => {
  return (req: LoggingRequest, res: Response, next: NextFunction): void => {
    const originalSend = res.send;
    
    res.send = function(body: any) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        logger.info('Job Audit Log', {
          action,
          tradieId: req.user?.id,
          userEmail: req.user?.email,
          jobId: req.params.id || req.params.jobId,
          clientId: req.params.clientId,
          materialId: req.params.materialId,
          attachmentId: req.params.attachmentId,
          timestamp: new Date().toISOString(),
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          requestBody: req.method !== 'GET' ? req.body : undefined
        });
      }

      return originalSend.call(this, body);
    };

    next();
  };
};

export const sensitiveDataLogger = (req: LoggingRequest, res: Response, next: NextFunction): void => {
  if (req.body) {
    const sensitiveFields = ['password', 'token', 'secret', 'key'];
    const logBody = { ...req.body };
    
    sensitiveFields.forEach(field => {
      if (logBody[field]) {
        logBody[field] = '[REDACTED]';
      }
    });

    logger.info('Sensitive data request', {
      method: req.method,
      path: req.path,
      tradieId: req.user?.id,
      body: logBody,
      ip: req.ip
    });
  }

  next();
};
