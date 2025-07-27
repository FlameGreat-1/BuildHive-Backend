import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, AuthenticatedRequest } from '../../auth/middleware';
import { MarketplaceService } from '../services';
import { 
  validateMarketplaceJobData,
  sanitizeMarketplaceJobData,
  validateJobSearchParams,
  canJobBeModified,
  isJobExpired
} from '../utils';
import {
  MARKETPLACE_JOB_STATUS,
  MARKETPLACE_LIMITS
} from '../../config/feeds';
import { ValidationError } from '../../shared/types';
import { createErrorResponse, logger, AppError } from '../../shared/utils';
import { HTTP_STATUS_CODES } from '../../config/auth/constants';

const sendValidationError = (res: Response, message: string, errors: ValidationError[]): void => {
  const error = new AppError(message, HTTP_STATUS_CODES.BAD_REQUEST, 'VALIDATION_ERROR');
  res.status(HTTP_STATUS_CODES.BAD_REQUEST).json(
    createErrorResponse(error, res.locals.requestId || 'unknown')
  );
};

export class MarketplaceMiddleware {
  private marketplaceService: MarketplaceService;

  constructor() {
    this.marketplaceService = new MarketplaceService();
  }

  private sanitizeData = (data: any): any => {
    if (typeof data === 'string') {
      return data.trim().replace(/[<>'"&]/g, '');
    }
    if (typeof data === 'object' && data !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitizeData(value);
      }
      return sanitized;
    }
    return data;
  };

  authenticateMarketplaceUser = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await authenticate(req, res, next);
    } catch (error) {
      logger.error('Marketplace authentication error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.requestId,
        ip: req.ip
      });

      next(new AppError(
        'Authentication service unavailable',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
      ));
    }
  };

  validateJobCreation = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { body } = req;
      const errors: ValidationError[] = [];
      
      if (!body || Object.keys(body).length === 0) {
        errors.push({
          field: 'body',
          message: 'Request body is required',
          code: 'REQUIRED_FIELD'
        });
        return sendValidationError(res, 'Request body is required', errors);
      }

      const validationResult = validateMarketplaceJobData(body);
      if (!validationResult.isValid) {
        return sendValidationError(res, 'Validation failed', validationResult.errors);
      }

      req.body = sanitizeMarketplaceJobData(body);
      next();
    } catch (error) {
      logger.error('Error in job creation validation middleware', { error, body: req.body });
      next(new AppError('Validation error', HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR));
    }
  };

  validateJobUpdate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { jobId } = req.params;
      const { body } = req;
      const userId = req.user?.id;
      const errors: ValidationError[] = [];

      if (!jobId || isNaN(parseInt(jobId))) {
        errors.push({
          field: 'jobId',
          message: 'Valid job ID is required',
          code: 'INVALID_VALUE'
        });
        return sendValidationError(res, 'Valid job ID is required', errors);
      }

      if (!body || Object.keys(body).length === 0) {
        errors.push({
          field: 'body',
          message: 'Update data is required',
          code: 'REQUIRED_FIELD'
        });
        return sendValidationError(res, 'Update data is required', errors);
      }

      const jobResult = await this.marketplaceService.getMarketplaceJob(parseInt(jobId));
      if (!jobResult.success || !jobResult.data) {
        return next(new AppError('Job not found', HTTP_STATUS_CODES.NOT_FOUND));
      }

      const job = jobResult.data;
      if (job.client_id !== userId) {
        return next(new AppError('Unauthorized access', HTTP_STATUS_CODES.FORBIDDEN));
      }

      if (!canJobBeModified(job as any)) {
        return next(new AppError('Job cannot be modified in current status', HTTP_STATUS_CODES.BAD_REQUEST));
      }

      req.body = this.sanitizeData(body);
      next();
    } catch (error) {
      logger.error('Error in job update validation middleware', { error, jobId: req.params.jobId });
      next(new AppError('Validation error', HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR));
    }
  };

  validateJobSearch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const searchParams = {
        ...req.query,
        page: parseInt(req.query.page as string) || 1,
        limit: Math.min(parseInt(req.query.limit as string) || 20, MARKETPLACE_LIMITS.MAX_SEARCH_RESULTS)
      };

      const validationResult = validateJobSearchParams(searchParams);
      if (!validationResult.isValid) {
        return sendValidationError(res, 'Invalid search parameters', validationResult.errors);
      }

      req.query = searchParams as any;
      next();
    } catch (error) {
      logger.error('Error in job search validation middleware', { error, query: req.query });
      next(new AppError('Search validation error', HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR));
    }
  };

  validateJobStatusUpdate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { jobId } = req.params;
      const { status, reason } = req.body;
      const userId = req.user?.id;
      const errors: ValidationError[] = [];

      if (!jobId || isNaN(parseInt(jobId))) {
        errors.push({
          field: 'jobId',
          message: 'Valid job ID is required',
          code: 'INVALID_VALUE'
        });
        return sendValidationError(res, 'Valid job ID is required', errors);
      }

      if (!status || !Object.values(MARKETPLACE_JOB_STATUS).includes(status)) {
        errors.push({
          field: 'status',
          message: 'Valid status is required',
          code: 'INVALID_VALUE'
        });
        return sendValidationError(res, 'Valid status is required', errors);
      }

      const jobResult = await this.marketplaceService.getMarketplaceJob(parseInt(jobId));
      if (!jobResult.success || !jobResult.data) {
        return next(new AppError('Job not found', HTTP_STATUS_CODES.NOT_FOUND));
      }

      const job = jobResult.data;
      if (job.client_id !== userId) {
        return next(new AppError('Unauthorized access', HTTP_STATUS_CODES.FORBIDDEN));
      }

      req.body = this.sanitizeData({ status, reason });
      next();
    } catch (error) {
      logger.error('Error in job status update validation middleware', { error, jobId: req.params.jobId });
      next(new AppError('Status update validation error', HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR));
    }
  };

  checkJobOwnership = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { jobId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return next(new AppError('Authentication required', HTTP_STATUS_CODES.UNAUTHORIZED));
      }

      if (!jobId || isNaN(parseInt(jobId))) {
        return next(new AppError('Valid job ID is required', HTTP_STATUS_CODES.BAD_REQUEST));
      }

      const jobResult = await this.marketplaceService.getMarketplaceJob(parseInt(jobId));
      if (!jobResult.success || !jobResult.data) {
        return next(new AppError('Job not found', HTTP_STATUS_CODES.NOT_FOUND));
      }

      const job = jobResult.data;
      if (job.client_id !== userId) {
        return next(new AppError('Unauthorized access', HTTP_STATUS_CODES.FORBIDDEN));
      }

      next();
    } catch (error) {
      logger.error('Error in job ownership check middleware', { error, jobId: req.params.jobId });
      next(new AppError('Ownership check error', HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR));
    }
  };

  checkJobAvailability = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { jobId } = req.params;

      if (!jobId || isNaN(parseInt(jobId))) {
        return next(new AppError('Valid job ID is required', HTTP_STATUS_CODES.BAD_REQUEST));
      }

      const jobResult = await this.marketplaceService.getMarketplaceJob(parseInt(jobId));
      if (!jobResult.success || !jobResult.data) {
        return next(new AppError('Job not found', HTTP_STATUS_CODES.NOT_FOUND));
      }

      const job = jobResult.data;
      if (job.status !== MARKETPLACE_JOB_STATUS.AVAILABLE) {
        return next(new AppError('Job is not available for applications', HTTP_STATUS_CODES.BAD_REQUEST));
      }

      if (isJobExpired(job as any)) {
        return next(new AppError('Job has expired', HTTP_STATUS_CODES.BAD_REQUEST));
      }

      next();
    } catch (error) {
      logger.error('Error in job availability check middleware', { error, jobId: req.params.jobId });
      next(new AppError('Availability check error', HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR));
    }
  };

  rateLimitJobCreation = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: MARKETPLACE_LIMITS.MAX_JOBS_PER_HOUR,
    message: {
      success: false,
      message: 'Too many job postings. Please try again later.',
      data: null
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => `job_creation_${(req as any).user?.id || req.ip}`,
    skip: (req: Request) => (req as any).user?.role === 'admin'
  });

  rateLimitJobSearch = rateLimit({
    windowMs: 60 * 1000,
    max: MARKETPLACE_LIMITS.MAX_SEARCHES_PER_MINUTE,
    message: {
      success: false,
      message: 'Too many search requests. Please try again later.',
      data: null
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => `job_search_${(req as any).user?.id || req.ip}`
  });

  logJobActivity = (action: string) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const originalSend = res.json;
      
      res.json = function(body: any) {
        const logData = {
          action,
          userId: (req as any).user?.id,
          jobId: req.params.jobId,
          method: req.method,
          url: req.originalUrl,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          success: body?.success || false,
          timestamp: new Date().toISOString()
        };

        logger.info('Marketplace job activity', logData);
        
        return originalSend.call(this, body);
      };

      next();
    };
  };

  validateClientRole = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userRole = req.user?.role;
      
      if (!userRole || !['client', 'admin'].includes(userRole)) {
        return next(new AppError('Client role required', HTTP_STATUS_CODES.FORBIDDEN));
      }

      next();
    } catch (error) {
      logger.error('Error in client role validation middleware', { error, userId: req.user?.id });
      next(new AppError('Role validation error', HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR));
    }
  };

  validateTradieRole = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userRole = req.user?.role;
      
      if (!userRole || !['tradie', 'admin'].includes(userRole)) {
        return next(new AppError('Tradie role required', HTTP_STATUS_CODES.FORBIDDEN));
      }

      next();
    } catch (error) {
      logger.error('Error in tradie role validation middleware', { error, userId: req.user?.id });
      next(new AppError('Role validation error', HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR));
    }
  };

  handleJobErrors = (error: any, req: Request, res: Response, next: NextFunction): void => {
    logger.error('Marketplace job error', {
      error: error.message,
      stack: error.stack,
      url: req.originalUrl,
      method: req.method,
      userId: (req as any).user?.id,
      jobId: req.params.jobId
    });

    if (error instanceof AppError) {
      const response = createErrorResponse(error, res.locals.requestId || 'unknown');
      res.status(error.statusCode).json(response);
      return;
    }

    const appError = new AppError('Internal server error', HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(
      createErrorResponse(appError, res.locals.requestId || 'unknown')
    );
  };

  sanitizeJobData = (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (req.body) {
        req.body = this.sanitizeData(req.body);
      }
      
      if (req.query) {
        req.query = this.sanitizeData(req.query);
      }

      next();
    } catch (error) {
      logger.error('Error in job data sanitization middleware', { error });
      next(new AppError('Data sanitization error', HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR));
    }
  };

  validatePagination = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const errors: ValidationError[] = [];

      if (page < 1) {
        errors.push({
          field: 'page',
          message: 'Page must be greater than 0',
          code: 'INVALID_VALUE'
        });
      }

      if (limit < 1 || limit > MARKETPLACE_LIMITS.MAX_SEARCH_RESULTS) {
        errors.push({
          field: 'limit',
          message: `Limit must be between 1 and ${MARKETPLACE_LIMITS.MAX_SEARCH_RESULTS}`,
          code: 'INVALID_VALUE'
        });
      }

      if (errors.length > 0) {
        return sendValidationError(res, 'Pagination validation failed', errors);
      }

      req.query.page = page.toString();
      req.query.limit = limit.toString();

      next();
    } catch (error) {
      logger.error('Error in pagination validation middleware', { error, query: req.query });
      next(new AppError('Pagination validation error', HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR));
    }
  };

  checkJobDeletion = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { jobId } = req.params;
      const userId = req.user?.id;

      if (!jobId || isNaN(parseInt(jobId))) {
        return next(new AppError('Valid job ID is required', HTTP_STATUS_CODES.BAD_REQUEST));
      }

      const jobResult = await this.marketplaceService.getMarketplaceJob(parseInt(jobId));
      if (!jobResult.success || !jobResult.data) {
        return next(new AppError('Job not found', HTTP_STATUS_CODES.NOT_FOUND));
      }

      const job = jobResult.data;
      if (job.client_id !== userId) {
        return next(new AppError('Unauthorized access', HTTP_STATUS_CODES.FORBIDDEN));
      }

      if (job.applicationCount > 0) {
        return next(new AppError('Cannot delete job with existing applications', HTTP_STATUS_CODES.BAD_REQUEST));
      }

      next();
    } catch (error) {
      logger.error('Error in job deletion check middleware', { error, jobId: req.params.jobId });
      next(new AppError('Deletion check error', HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR));
    }
  };

  validateJobFilters = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { job_type, location, urgency_level, minBudget, maxBudget } = req.query;
      const errors: ValidationError[] = [];

      if (job_type && typeof job_type === 'string') {
        const validjob_types = Object.values(MARKETPLACE_JOB_STATUS);
        if (!validjob_types.includes(job_type as any)) {
          errors.push({
            field: 'job_type',
            message: 'Invalid job type filter',
            code: 'INVALID_VALUE'
          });
        }
      }

      if (minBudget && isNaN(parseFloat(minBudget as string))) {
        errors.push({
          field: 'minBudget',
          message: 'Invalid minimum budget filter',
          code: 'INVALID_VALUE'
        });
      }

      if (maxBudget && isNaN(parseFloat(maxBudget as string))) {
        errors.push({
          field: 'maxBudget',
          message: 'Invalid maximum budget filter',
          code: 'INVALID_VALUE'
        });
      }

      if (minBudget && maxBudget && parseFloat(minBudget as string) > parseFloat(maxBudget as string)) {
        errors.push({
          field: 'budget',
          message: 'Minimum budget cannot be greater than maximum budget',
          code: 'INVALID_VALUE'
        });
      }

      if (errors.length > 0) {
        return sendValidationError(res, 'Filter validation failed', errors);
      }

      next();
    } catch (error) {
      logger.error('Error in job filters validation middleware', { error, query: req.query });
      next(new AppError('Filter validation error', HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR));
    }
  };

  cacheJobData = (cacheDuration: number = 300) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const cacheKey = `marketplace_job_${req.params.jobId || 'search'}_${JSON.stringify(req.query)}`;
      
      res.set('Cache-Control', `public, max-age=${cacheDuration}`);
      res.set('ETag', `"${Buffer.from(cacheKey).toString('base64')}"`);

      if (req.headers['if-none-match'] === res.get('ETag')) {
        res.status(304).end();
        return;
      }

      next();
    };
  };

  trackJobViews = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { jobId } = req.params;
      const userId = (req as any).user?.id;

      if (jobId && !isNaN(parseInt(jobId))) {
        const viewData = {
          jobId: parseInt(jobId),
          userId: userId || null,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString()
        };

        logger.info('Job view tracked', viewData);
      }

      next();
    } catch (error) {
      logger.error('Error in job view tracking middleware', { error, jobId: req.params.jobId });
      next();
    }
  };

  validateJobExpiry = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { jobId } = req.params;

      if (!jobId || isNaN(parseInt(jobId))) {
        next();
        return;
      }

      const jobResult = await this.marketplaceService.getMarketplaceJob(parseInt(jobId));
      if (jobResult.success && jobResult.data) {
        const job = jobResult.data;
        if (isJobExpired(job as any)) {
          return next(new AppError('Job has expired', HTTP_STATUS_CODES.BAD_REQUEST));
        }
      }

      next();
    } catch (error) {
      logger.error('Error in job expiry validation middleware', { error, jobId: req.params.jobId });
      next();
    }
  };

  requireJobAccess = (accessType: 'read' | 'write' | 'delete') => {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        const { jobId } = req.params;
        const userId = req.user?.id;
        const userRole = req.user?.role;

        if (!userId) {
          return next(new AppError('Authentication required', HTTP_STATUS_CODES.UNAUTHORIZED));
        }

        if (userRole === 'admin') {
          next();
          return;
        }

        if (!jobId || isNaN(parseInt(jobId))) {
          return next(new AppError('Valid job ID is required', HTTP_STATUS_CODES.BAD_REQUEST));
        }

        const jobResult = await this.marketplaceService.getMarketplaceJob(parseInt(jobId));
        if (!jobResult.success || !jobResult.data) {
          return next(new AppError('Job not found', HTTP_STATUS_CODES.NOT_FOUND));
        }

        const job = jobResult.data;
        const isOwner = job.client_id === userId;
        const isTradie = userRole === 'tradie';

        switch (accessType) {
          case 'read':
            if (!isOwner && !isTradie) {
              return next(new AppError('Unauthorized access', HTTP_STATUS_CODES.FORBIDDEN));
            }
            break;
          case 'write':
          case 'delete':
            if (!isOwner) {
              return next(new AppError('Unauthorized access', HTTP_STATUS_CODES.FORBIDDEN));
            }
            break;
        }

        next();
      } catch (error) {
        logger.error('Error in job access middleware', { error, jobId: req.params.jobId, accessType });
        next(new AppError('Access check error', HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR));
      }
    };
  };

  validateBulkOperations = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { jobIds } = req.body;
      const errors: ValidationError[] = [];

      if (!Array.isArray(jobIds)) {
        errors.push({
          field: 'jobIds',
          message: 'Job IDs must be an array',
          code: 'INVALID_TYPE'
        });
      } else {
        if (jobIds.length === 0) {
          errors.push({
            field: 'jobIds',
            message: 'At least one job ID is required',
            code: 'REQUIRED_FIELD'
          });
        }

        if (jobIds.length > MARKETPLACE_LIMITS.MAX_BULK_OPERATIONS) {
          errors.push({
            field: 'jobIds',
            message: `Maximum ${MARKETPLACE_LIMITS.MAX_BULK_OPERATIONS} jobs allowed per bulk operation`,
            code: 'FIELD_TOO_LARGE'
          });
        }

        const invalidIds = jobIds.filter(id => isNaN(parseInt(id)));
        if (invalidIds.length > 0) {
          errors.push({
            field: 'jobIds',
            message: 'All job IDs must be valid numbers',
            code: 'INVALID_VALUE'
          });
        }
      }

      if (errors.length > 0) {
        return sendValidationError(res, 'Bulk operations validation failed', errors);
      }

      next();
    } catch (error) {
      logger.error('Error in bulk operations validation middleware', { error, body: req.body });
      next(new AppError('Bulk operations validation error', HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR));
    }
  };

  async destroy(): Promise<void> {
    try {
      await this.marketplaceService.destroy();
      logger.info('MarketplaceMiddleware destroyed successfully');
    } catch (error) {
      logger.error('Error destroying MarketplaceMiddleware', { error });
    }
  }
}

export const marketplaceMiddleware = new MarketplaceMiddleware();

export const {
  authenticateMarketplaceUser,
  validateJobCreation,
  validateJobUpdate,
  validateJobSearch,
  validateJobStatusUpdate,
  checkJobOwnership,
  checkJobAvailability,
  rateLimitJobCreation,
  rateLimitJobSearch,
  logJobActivity,
  validateClientRole,
  validateTradieRole,
  handleJobErrors,
  sanitizeJobData,
  validatePagination,
  checkJobDeletion,
  validateJobFilters,
  cacheJobData,
  trackJobViews,
  validateJobExpiry,
  requireJobAccess,
  validateBulkOperations
} = marketplaceMiddleware;

