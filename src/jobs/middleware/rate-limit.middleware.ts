import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { JOB_CONSTANTS } from '../../config/jobs';
import { sendErrorResponse, logger } from '../../shared/utils';

const createRateLimitHandler = (operation: string) => {
  return (req: Request, res: Response) => {
    logger.warn('Rate limit exceeded', {
      operation,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      tradieId: (req as any).user?.id,
      path: req.path
    });

    sendErrorResponse(res, `Too many ${operation} requests. Please try again later.`, 429);
  };
};

export const jobCreationRateLimit = rateLimit({
  windowMs: JOB_CONSTANTS.RATE_LIMITS.JOB_CREATION.WINDOW_MS,
  max: JOB_CONSTANTS.RATE_LIMITS.JOB_CREATION.MAX_REQUESTS,
  message: 'Too many job creation requests',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return `job_creation_${(req as any).user?.id || req.ip}`;
  },
  handler: createRateLimitHandler('job creation')
});

export const fileUploadRateLimit = rateLimit({
  windowMs: JOB_CONSTANTS.RATE_LIMITS.FILE_UPLOAD.WINDOW_MS,
  max: JOB_CONSTANTS.RATE_LIMITS.FILE_UPLOAD.MAX_REQUESTS,
  message: 'Too many file upload requests',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return `file_upload_${(req as any).user?.id || req.ip}`;
  },
  handler: createRateLimitHandler('file upload')
});

export const jobUpdateRateLimit = rateLimit({
  windowMs: JOB_CONSTANTS.RATE_LIMITS.JOB_UPDATE.WINDOW_MS,
  max: JOB_CONSTANTS.RATE_LIMITS.JOB_UPDATE.MAX_REQUESTS,
  message: 'Too many job update requests',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return `job_update_${(req as any).user?.id || req.ip}`;
  },
  handler: createRateLimitHandler('job update')
});

export const generalJobRateLimit = rateLimit({
  windowMs: JOB_CONSTANTS.RATE_LIMITS.GENERAL.WINDOW_MS,
  max: JOB_CONSTANTS.RATE_LIMITS.GENERAL.MAX_REQUESTS,
  message: 'Too many requests',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return `general_${(req as any).user?.id || req.ip}`;
  },
  handler: createRateLimitHandler('general')
});
