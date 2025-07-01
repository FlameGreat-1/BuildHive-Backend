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
