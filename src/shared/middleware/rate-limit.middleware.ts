import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { AUTH_CONSTANTS, HTTP_STATUS_CODES } from '../../config/auth';
import { sendRateLimitError } from '../utils';
import { logger } from '../utils';

const createRateLimitHandler = (message: string) => {
  return (req: Request, res: Response): Response => {
    const requestId = res.locals.requestId || 'unknown';
    
    logger.warn('Rate limit exceeded', {
      requestId,
      ip: req.ip,
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent')
    });

    return sendRateLimitError(res, message);
  };
};

export const registrationRateLimit = rateLimit({
  windowMs: AUTH_CONSTANTS.RATE_LIMITS.REGISTRATION.WINDOW_MS,
  max: AUTH_CONSTANTS.RATE_LIMITS.REGISTRATION.MAX_ATTEMPTS,
  message: 'Too many registration attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many registration attempts from this IP, please try again after 15 minutes'),
  keyGenerator: (req: Request): string => {
    return req.ip || 'unknown';
  },
  skip: (req: Request): boolean => {
    return req.ip === '127.0.0.1' || req.ip === '::1';
  }
});

export const loginRateLimit = rateLimit({
  windowMs: AUTH_CONSTANTS.RATE_LIMITS.LOGIN.WINDOW_MS,
  max: AUTH_CONSTANTS.RATE_LIMITS.LOGIN.MAX_ATTEMPTS,
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many login attempts from this IP, please try again after 15 minutes'),
  keyGenerator: (req: Request): string => {
    const email = req.body?.email;
    return email ? `${req.ip}-${email}` : req.ip || 'unknown';
  },
  skip: (req: Request): boolean => {
    return req.ip === '127.0.0.1' || req.ip === '::1';
  }
});

export const passwordResetRateLimit = rateLimit({
  windowMs: AUTH_CONSTANTS.RATE_LIMITS.PASSWORD_RESET.WINDOW_MS,
  max: AUTH_CONSTANTS.RATE_LIMITS.PASSWORD_RESET.MAX_ATTEMPTS,
  message: 'Too many password reset attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many password reset attempts from this IP, please try again after 1 hour'),
  keyGenerator: (req: Request): string => {
    const email = req.body?.email;
    return email ? `${req.ip}-${email}` : req.ip || 'unknown';
  },
  skip: (req: Request): boolean => {
    return req.ip === '127.0.0.1' || req.ip === '::1';
  }
});

export const changePasswordRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many password change attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many password change attempts, please try again after 15 minutes'),
  keyGenerator: (req: Request): string => {
    return req.ip || 'unknown';
  },
  skip: (req: Request): boolean => {
    return req.ip === '127.0.0.1' || req.ip === '::1';
  }
});

export const emailVerificationRateLimit = rateLimit({
  windowMs: AUTH_CONSTANTS.RATE_LIMITS.EMAIL_VERIFICATION.WINDOW_MS,
  max: AUTH_CONSTANTS.RATE_LIMITS.EMAIL_VERIFICATION.MAX_ATTEMPTS,
  message: 'Too many email verification attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many email verification attempts from this IP, please try again after 1 hour'),
  keyGenerator: (req: Request): string => {
    const email = req.body?.email || req.query?.email;
    return email ? `${req.ip}-${email}` : req.ip || 'unknown';
  }
});

export const refreshTokenRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: 'Too many token refresh attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many token refresh attempts, please try again after 5 minutes'),
  keyGenerator: (req: Request): string => {
    return req.ip || 'unknown';
  },
  skip: (req: Request): boolean => {
    return req.ip === '127.0.0.1' || req.ip === '::1';
  }
});

export const profileUpdateRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: 'Too many profile update attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many profile update attempts, please try again after 10 minutes'),
  keyGenerator: (req: Request): string => {
    return req.ip || 'unknown';
  },
  skip: (req: Request): boolean => {
    return req.ip === '127.0.0.1' || req.ip === '::1';
  }
});

export const generalApiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many requests from this IP, please try again after 15 minutes'),
  keyGenerator: (req: Request): string => {
    return req.ip || 'unknown';
  }
});

export const strictRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: 'Too many requests, please slow down',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many requests, please slow down and try again in 5 minutes')
});

export const validationRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 50,
  message: 'Too many validation requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many validation requests from this IP, please try again after 10 minutes'),
  keyGenerator: (req: Request): string => {
    return req.ip || 'unknown';
  },
  skip: (req: Request): boolean => {
    return req.ip === '127.0.0.1' || req.ip === '::1';
  }
});

export const logoutRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: 'Too many logout attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many logout attempts, please try again after 5 minutes'),
  keyGenerator: (req: Request): string => {
    return req.ip || 'unknown';
  },
  skip: (req: Request): boolean => {
    return req.ip === '127.0.0.1' || req.ip === '::1';
  }
});

export const jobCreationRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: 'Too many job creation attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many job creation attempts, please try again after 10 minutes'),
  keyGenerator: (req: Request): string => {
    const userId = req.user?.id;
    return userId ? `job-create-${userId}` : req.ip || 'unknown';
  }
});

export const jobUpdateRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 50,
  message: 'Too many job update attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many job update attempts, please try again after 5 minutes'),
  keyGenerator: (req: Request): string => {
    const userId = req.user?.id;
    return userId ? `job-update-${userId}` : req.ip || 'unknown';
  }
});

export const fileUploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many file upload attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many file upload attempts, please try again after 15 minutes'),
  keyGenerator: (req: Request): string => {
    const userId = req.user?.id;
    return userId ? `file-upload-${userId}` : req.ip || 'unknown';
  }
});

export const clientOperationRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 40,
  message: 'Too many client operations, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many client operations, please try again after 10 minutes'),
  keyGenerator: (req: Request): string => {
    const userId = req.user?.id;
    return userId ? `client-ops-${userId}` : req.ip || 'unknown';
  }
});

export const materialUpdateRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 60,
  message: 'Too many material updates, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many material updates, please try again after 5 minutes'),
  keyGenerator: (req: Request): string => {
    const userId = req.user?.id;
    return userId ? `material-update-${userId}` : req.ip || 'unknown';
  }
});

export const jobSearchRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: 'Too many search requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many search requests, please try again after 1 minute'),
  keyGenerator: (req: Request): string => {
    const userId = req.user?.id;
    return userId ? `job-search-${userId}` : req.ip || 'unknown';
  }
});
