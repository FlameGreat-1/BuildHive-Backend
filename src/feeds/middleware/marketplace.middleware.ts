import { Request, Response, NextFunction } from 'express';
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
  MARKETPLACE_LIMITS,
  MARKETPLACE_CREDIT_COSTS
} from '../../config/feeds';
import { authenticate } from '../../auth/middleware/auth.middleware';
import { 
  sanitizeMarketplaceJobInput,
  requestLogger,
  marketplaceJobErrorHandler
} from '../../shared/middleware';
import { logger, createResponse } from '../../shared/utils';
import { ApiError, ValidationError } from '../../shared/types';

export class MarketplaceMiddleware {
  private marketplaceService: MarketplaceService;

  constructor() {
    this.marketplaceService = new MarketplaceService();
  }

  validateJobCreation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { body } = req;
      
      if (!body || Object.keys(body).length === 0) {
        const response = createResponse(false, 'Request body is required', null);
        res.status(400).json(response);
        return;
      }

      const validationResult = validateMarketplaceJobData(body);
      if (!validationResult.isValid) {
        const response = createResponse(false, 'Validation failed', null, validationResult.errors);
        res.status(400).json(response);
        return;
      }

      req.body = sanitizeMarketplaceJobData(body);
      next();
    } catch (error) {
      logger.error('Error in job creation validation middleware', { error, body: req.body });
      const response = createResponse(false, 'Validation error', null, [error]);
      res.status(500).json(response);
    }
  };

  validateJobUpdate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { jobId } = req.params;
      const { body } = req;
      const userId = req.user?.id;

      if (!jobId || isNaN(parseInt(jobId))) {
        const response = createResponse(false, 'Valid job ID is required', null);
        res.status(400).json(response);
        return;
      }

      if (!body || Object.keys(body).length === 0) {
        const response = createResponse(false, 'Update data is required', null);
        res.status(400).json(response);
        return;
      }

      const jobResult = await this.marketplaceService.getMarketplaceJob(parseInt(jobId));
      if (!jobResult.success || !jobResult.data) {
        const response = createResponse(false, 'Job not found', null);
        res.status(404).json(response);
        return;
      }

      const job = jobResult.data;
      if (job.job.client_id !== userId) {
        const response = createResponse(false, 'Unauthorized access', null);
        res.status(403).json(response);
        return;
      }

      if (!canJobBeModified(job as any)) {
        const response = createResponse(false, 'Job cannot be modified in current status', null);
        res.status(400).json(response);
        return;
      }

      req.body = sanitizeInput(body);
      next();
    } catch (error) {
      logger.error('Error in job update validation middleware', { error, jobId: req.params.jobId });
      const response = createResponse(false, 'Validation error', null, [error]);
      res.status(500).json(response);
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
        const response = createResponse(false, 'Invalid search parameters', null, validationResult.errors);
        res.status(400).json(response);
        return;
      }

      req.query = searchParams as any;
      next();
    } catch (error) {
      logger.error('Error in job search validation middleware', { error, query: req.query });
      const response = createResponse(false, 'Search validation error', null, [error]);
      res.status(500).json(response);
    }
  };

  validateJobStatusUpdate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { jobId } = req.params;
      const { status, reason } = req.body;
      const userId = req.user?.id;

      if (!jobId || isNaN(parseInt(jobId))) {
        const response = createResponse(false, 'Valid job ID is required', null);
        res.status(400).json(response);
        return;
      }

      if (!status || !Object.values(MARKETPLACE_JOB_STATUS).includes(status)) {
        const response = createResponse(false, 'Valid status is required', null);
        res.status(400).json(response);
        return;
      }

      const jobResult = await this.marketplaceService.getMarketplaceJob(parseInt(jobId));
      if (!jobResult.success || !jobResult.data) {
        const response = createResponse(false, 'Job not found', null);
        res.status(404).json(response);
        return;
      }

      const job = jobResult.data;
      if (job.job.client_id !== userId) {
        const response = createResponse(false, 'Unauthorized access', null);
        res.status(403).json(response);
        return;
      }

      req.body = sanitizeInput({ status, reason });
      next();
    } catch (error) {
      logger.error('Error in job status update validation middleware', { error, jobId: req.params.jobId });
      const response = createResponse(false, 'Status update validation error', null, [error]);
      res.status(500).json(response);
    }
  };

  checkJobOwnership = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { jobId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        const response = createResponse(false, 'Authentication required', null);
        res.status(401).json(response);
        return;
      }

      if (!jobId || isNaN(parseInt(jobId))) {
        const response = createResponse(false, 'Valid job ID is required', null);
        res.status(400).json(response);
        return;
      }

      const jobResult = await this.marketplaceService.getMarketplaceJob(parseInt(jobId));
      if (!jobResult.success || !jobResult.data) {
        const response = createResponse(false, 'Job not found', null);
        res.status(404).json(response);
        return;
      }

      const job = jobResult.data;
      if (job.job.client_id !== userId) {
        const response = createResponse(false, 'Unauthorized access', null);
        res.status(403).json(response);
        return;
      }

      next();
    } catch (error) {
      logger.error('Error in job ownership check middleware', { error, jobId: req.params.jobId });
      const response = createResponse(false, 'Ownership check error', null, [error]);
      res.status(500).json(response);
    }
  };

  checkJobAvailability = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { jobId } = req.params;

      if (!jobId || isNaN(parseInt(jobId))) {
        const response = createResponse(false, 'Valid job ID is required', null);
        res.status(400).json(response);
        return;
      }

      const jobResult = await this.marketplaceService.getMarketplaceJob(parseInt(jobId));
      if (!jobResult.success || !jobResult.data) {
        const response = createResponse(false, 'Job not found', null);
        res.status(404).json(response);
        return;
      }

      const job = jobResult.data;
      if (job.job.status !== MARKETPLACE_JOB_STATUS.AVAILABLE) {
        const response = createResponse(false, 'Job is not available for applications', null);
        res.status(400).json(response);
        return;
      }

      if (isJobExpired(job as any)) {
        const response = createResponse(false, 'Job has expired', null);
        res.status(400).json(response);
        return;
      }

      next();
    } catch (error) {
      logger.error('Error in job availability check middleware', { error, jobId: req.params.jobId });
      const response = createResponse(false, 'Availability check error', null, [error]);
      res.status(500).json(response);
    }
  };

  rateLimitJobCreation = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: MARKETPLACE_LIMITS.MAX_JOBS_PER_HOUR,
    message: createResponse(false, 'Too many job postings. Please try again later.', null),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => `job_creation_${req.user?.id || req.ip}`,
    skip: (req: Request) => req.user?.role === 'admin'
  });

  rateLimitJobSearch = rateLimit({
    windowMs: 60 * 1000,
    max: MARKETPLACE_LIMITS.MAX_SEARCHES_PER_MINUTE,
    message: createResponse(false, 'Too many search requests. Please try again later.', null),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => `job_search_${req.user?.id || req.ip}`
  });

  logJobActivity = (action: string) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const originalSend = res.json;
      
      res.json = function(body: any) {
        const logData = {
          action,
          userId: req.user?.id,
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

  validateClientRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userRole = req.user?.role;
      
      if (!userRole || !['client', 'admin'].includes(userRole)) {
        const response = createResponse(false, 'Client role required', null);
        res.status(403).json(response);
        return;
      }

      next();
    } catch (error) {
      logger.error('Error in client role validation middleware', { error, userId: req.user?.id });
      const response = createResponse(false, 'Role validation error', null, [error]);
      res.status(500).json(response);
    }
  };

  validateTradieRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userRole = req.user?.role;
      
      if (!userRole || !['tradie', 'admin'].includes(userRole)) {
        const response = createResponse(false, 'Tradie role required', null);
        res.status(403).json(response);
        return;
      }

      next();
    } catch (error) {
      logger.error('Error in tradie role validation middleware', { error, userId: req.user?.id });
      const response = createResponse(false, 'Role validation error', null, [error]);
      res.status(500).json(response);
    }
  };

  handleJobErrors = (error: any, req: Request, res: Response, next: NextFunction): void => {
    logger.error('Marketplace job error', {
      error: error.message,
      stack: error.stack,
      url: req.originalUrl,
      method: req.method,
      userId: req.user?.id,
      jobId: req.params.jobId
    });

    if (error instanceof ValidationError) {
      const response = createResponse(false, error.message, null, error.details);
      res.status(400).json(response);
      return;
    }

    if (error instanceof ApiError) {
      const response = createResponse(false, error.message, null);
      res.status(error.statusCode).json(response);
      return;
    }

    const response = createResponse(false, 'Internal server error', null);
    res.status(500).json(response);
  };

    sanitizeJobData = (req: Request, res: Response, next: NextFunction): void => {
      try {
        if (req.body) {
          req.body = sanitizeInput(req.body);
        }
        
        if (req.query) {
          req.query = sanitizeInput(req.query);
        }
  
        next();
      } catch (error) {
        logger.error('Error in job data sanitization middleware', { error });
        const response = createResponse(false, 'Data sanitization error', null, [error]);
        res.status(500).json(response);
      }
    };
  
    validatePagination = (req: Request, res: Response, next: NextFunction): void => {
      try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
  
        if (page < 1) {
          const response = createResponse(false, 'Page must be greater than 0', null);
          res.status(400).json(response);
          return;
        }
  
        if (limit < 1 || limit > MARKETPLACE_LIMITS.MAX_SEARCH_RESULTS) {
          const response = createResponse(false, `Limit must be between 1 and ${MARKETPLACE_LIMITS.MAX_SEARCH_RESULTS}`, null);
          res.status(400).json(response);
          return;
        }
  
        req.query.page = page.toString();
        req.query.limit = limit.toString();
  
        next();
      } catch (error) {
        logger.error('Error in pagination validation middleware', { error, query: req.query });
        const response = createResponse(false, 'Pagination validation error', null, [error]);
        res.status(500).json(response);
      }
    };
  
    checkJobDeletion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const { jobId } = req.params;
        const userId = req.user?.id;
  
        if (!jobId || isNaN(parseInt(jobId))) {
          const response = createResponse(false, 'Valid job ID is required', null);
          res.status(400).json(response);
          return;
        }
  
        const jobResult = await this.marketplaceService.getMarketplaceJob(parseInt(jobId));
        if (!jobResult.success || !jobResult.data) {
          const response = createResponse(false, 'Job not found', null);
          res.status(404).json(response);
          return;
        }
  
        const job = jobResult.data;
        if (job.job.client_id !== userId) {
          const response = createResponse(false, 'Unauthorized access', null);
          res.status(403).json(response);
          return;
        }
  
        if (job.applicationCount > 0) {
          const response = createResponse(false, 'Cannot delete job with existing applications', null);
          res.status(400).json(response);
          return;
        }
  
        next();
      } catch (error) {
        logger.error('Error in job deletion check middleware', { error, jobId: req.params.jobId });
        const response = createResponse(false, 'Deletion check error', null, [error]);
        res.status(500).json(response);
      }
    };
  
    validateJobFilters = (req: Request, res: Response, next: NextFunction): void => {
      try {
        const { job_type, location, urgency_level, minBudget, maxBudget } = req.query;
  
        if (job_type && typeof job_type === 'string') {
          const validjob_types = Object.values(MARKETPLACE_JOB_STATUS);
          if (!validjob_types.includes(job_type as any)) {
            const response = createResponse(false, 'Invalid job type filter', null);
            res.status(400).json(response);
            return;
          }
        }
  
        if (minBudget && isNaN(parseFloat(minBudget as string))) {
          const response = createResponse(false, 'Invalid minimum budget filter', null);
          res.status(400).json(response);
          return;
        }
  
        if (maxBudget && isNaN(parseFloat(maxBudget as string))) {
          const response = createResponse(false, 'Invalid maximum budget filter', null);
          res.status(400).json(response);
          return;
        }
  
        if (minBudget && maxBudget && parseFloat(minBudget as string) > parseFloat(maxBudget as string)) {
          const response = createResponse(false, 'Minimum budget cannot be greater than maximum budget', null);
          res.status(400).json(response);
          return;
        }
  
        next();
      } catch (error) {
        logger.error('Error in job filters validation middleware', { error, query: req.query });
        const response = createResponse(false, 'Filter validation error', null, [error]);
        res.status(500).json(response);
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
        const userId = req.user?.id;
  
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
            const response = createResponse(false, 'Job has expired', null);
            res.status(400).json(response);
            return;
          }
        }
  
        next();
      } catch (error) {
        logger.error('Error in job expiry validation middleware', { error, jobId: req.params.jobId });
        next();
      }
    };
  
    requireJobAccess = (accessType: 'read' | 'write' | 'delete') => {
      return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
          const { jobId } = req.params;
          const userId = req.user?.id;
          const userRole = req.user?.role;
  
          if (!userId) {
            const response = createResponse(false, 'Authentication required', null);
            res.status(401).json(response);
            return;
          }
  
          if (userRole === 'admin') {
            next();
            return;
          }
  
          if (!jobId || isNaN(parseInt(jobId))) {
            const response = createResponse(false, 'Valid job ID is required', null);
            res.status(400).json(response);
            return;
          }
  
          const jobResult = await this.marketplaceService.getMarketplaceJob(parseInt(jobId));
          if (!jobResult.success || !jobResult.data) {
            const response = createResponse(false, 'Job not found', null);
            res.status(404).json(response);
            return;
          }
  
          const job = jobResult.data;
          const isOwner = job.job.client_id === userId;
          const isTradie = userRole === 'tradie';
  
          switch (accessType) {
            case 'read':
              if (!isOwner && !isTradie) {
                const response = createResponse(false, 'Unauthorized access', null);
                res.status(403).json(response);
                return;
              }
              break;
            case 'write':
            case 'delete':
              if (!isOwner) {
                const response = createResponse(false, 'Unauthorized access', null);
                res.status(403).json(response);
                return;
              }
              break;
          }
  
          next();
        } catch (error) {
          logger.error('Error in job access middleware', { error, jobId: req.params.jobId, accessType });
          const response = createResponse(false, 'Access check error', null, [error]);
          res.status(500).json(response);
        }
      };
    };
  
    validateBulkOperations = (req: Request, res: Response, next: NextFunction): void => {
      try {
        const { jobIds } = req.body;
  
        if (!Array.isArray(jobIds)) {
          const response = createResponse(false, 'Job IDs must be an array', null);
          res.status(400).json(response);
          return;
        }
  
        if (jobIds.length === 0) {
          const response = createResponse(false, 'At least one job ID is required', null);
          res.status(400).json(response);
          return;
        }
  
        if (jobIds.length > MARKETPLACE_LIMITS.MAX_BULK_OPERATIONS) {
          const response = createResponse(false, `Maximum ${MARKETPLACE_LIMITS.MAX_BULK_OPERATIONS} jobs allowed per bulk operation`, null);
          res.status(400).json(response);
          return;
        }
  
        const invalidIds = jobIds.filter(id => isNaN(parseInt(id)));
        if (invalidIds.length > 0) {
          const response = createResponse(false, 'All job IDs must be valid numbers', null);
          res.status(400).json(response);
          return;
        }
  
        next();
      } catch (error) {
        logger.error('Error in bulk operations validation middleware', { error, body: req.body });
        const response = createResponse(false, 'Bulk operations validation error', null, [error]);
        res.status(500).json(response);
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
  
