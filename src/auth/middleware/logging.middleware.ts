import { Request, Response, NextFunction } from 'express';
import { logger } from '../../shared/utils';

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
