import { Request, Response, NextFunction } from 'express';
import { logger } from '../../shared/utils';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    emailVerified: boolean;
  };
}

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

export const loginLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = res.locals.requestId || 'unknown';

  if (req.path.includes('/login')) {
    logger.info('Login attempt started', {
      requestId,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      email: req.body?.email,
      rememberMe: req.body?.rememberMe || false,
      timestamp: new Date().toISOString()
    });
  }

  next();
};

export const passwordResetLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = res.locals.requestId || 'unknown';

  if (req.path.includes('/forgot-password')) {
    logger.info('Password reset request', {
      requestId,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      email: req.body?.email,
      timestamp: new Date().toISOString()
    });
  }

  if (req.path.includes('/reset-password')) {
    logger.info('Password reset confirmation attempt', {
      requestId,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      hasToken: !!req.body?.token,
      timestamp: new Date().toISOString()
    });
  }

  if (req.path.includes('/change-password')) {
    logger.info('Password change attempt', {
      requestId,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: (req as AuthenticatedRequest).user?.id,
      timestamp: new Date().toISOString()
    });
  }

  next();
};

export const logoutLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = res.locals.requestId || 'unknown';

  if (req.path.includes('/logout')) {
    logger.info('Logout attempt', {
      requestId,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: (req as AuthenticatedRequest).user?.id,
      logoutAllDevices: req.body?.logoutAllDevices || false,
      timestamp: new Date().toISOString()
    });
  }

  next();
};

export const tokenLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = res.locals.requestId || 'unknown';

  if (req.path.includes('/refresh-token')) {
    logger.info('Token refresh attempt', {
      requestId,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      hasRefreshToken: !!req.body?.refreshToken,
      timestamp: new Date().toISOString()
    });
  }

  next();
};

export const profileLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = res.locals.requestId || 'unknown';

  if (req.path.includes('/profile')) {
    logger.info('Profile operation', {
      requestId,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: (req as AuthenticatedRequest).user?.id,
      operation: req.method === 'GET' ? 'view' : req.method === 'PUT' ? 'update' : 'other',
      timestamp: new Date().toISOString()
    });
  }

  next();
};

export const securityLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = res.locals.requestId || 'unknown';
  const authHeader = req.headers.authorization;

  if (authHeader && !authHeader.startsWith('Bearer ')) {
    logger.warn('Invalid authorization header format', {
      requestId,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      authHeader: authHeader.substring(0, 20) + '...',
      timestamp: new Date().toISOString()
    });
  }

  const suspiciousPatterns = [
    /script/i,
    /javascript/i,
    /vbscript/i,
    /onload/i,
    /onerror/i,
    /eval\(/i,
    /expression\(/i
  ];

  const checkForSuspiciousContent = (obj: any, path: string = ''): void => {
    if (typeof obj === 'string') {
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(obj)) {
          logger.warn('Suspicious content detected', {
            requestId,
            method: req.method,
            path: req.path,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            fieldPath: path,
            pattern: pattern.toString(),
            timestamp: new Date().toISOString()
          });
          break;
        }
      }
    } else if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          checkForSuspiciousContent(obj[key], path ? `${path}.${key}` : key);
        }
      }
    }
  };

  if (req.body) {
    checkForSuspiciousContent(req.body);
  }

  next();
};

export const authActivityLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = res.locals.requestId || 'unknown';
  const user = (req as AuthenticatedRequest).user;

  if (user) {
    logger.info('Authenticated request', {
      requestId,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: user.id,
      userRole: user.role,
      emailVerified: user.emailVerified,
      timestamp: new Date().toISOString()
    });
  }

  next();
};

export const errorLogger = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = res.locals.requestId || 'unknown';
  const user = (req as AuthenticatedRequest).user;

  logger.error('Authentication error occurred', {
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: user?.id,
    errorMessage: error.message,
    errorCode: error.code,
    statusCode: error.statusCode,
    timestamp: new Date().toISOString()
  });

  next(error);
};

export const comprehensiveAuthLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  registrationLogger(req, res, () => {
    loginLogger(req, res, () => {
      passwordResetLogger(req, res, () => {
        logoutLogger(req, res, () => {
          tokenLogger(req, res, () => {
            profileLogger(req, res, () => {
              securityLogger(req, res, () => {
                authActivityLogger(req, res, next);
              });
            });
          });
        });
      });
    });
  });
};
