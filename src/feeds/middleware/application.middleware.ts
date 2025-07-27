import { Request, Response, NextFunction } from 'express';
import { ApplicationService, MarketplaceService } from '../services';
import { 
  validateApplicationData,
  sanitizeApplicationData as sanitizeAppData,
  validateApplicationSearchParams,
  canWithdrawApplication,
  canModifyApplication,
  validateApplicationStatusTransition
} from '../utils';
import {
  APPLICATION_STATUS,
  MARKETPLACE_LIMITS,
  MARKETPLACE_CREDIT_COSTS
} from '../../config/feeds';
import { rateLimit } from '../../shared/middleware';
import { logger, createResponse } from '../../shared/utils';
import { ApiError, ValidationError } from '../../shared/types';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    emailVerified: boolean;
  };
}
export class ApplicationMiddleware {
  private applicationService: ApplicationService;
  private marketplaceService: MarketplaceService;

  constructor() {
    this.applicationService = new ApplicationService();
    this.marketplaceService = new MarketplaceService();
  }

  validateApplicationCreation = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { body } = req;
      const userId = req.user?.id;

      if (!body || Object.keys(body).length === 0) {
        const response = createResponse(false, 'Request body is required', null);
        res.status(400).json(response);
        return;
      }

      if (!userId) {
        const response = createResponse(false, 'Authentication required', null);
        res.status(401).json(response);
        return;
      }

      const validationResult = validateApplicationData(body);
      if (!validationResult.isValid) {
        const response = createResponse(false, 'Validation failed', null, validationResult.errors);
        res.status(400).json(response);
        return;
      }

      const jobResult = await this.marketplaceService.getMarketplaceJob(body.marketplaceJobId);
      if (!jobResult.success || !jobResult.data) {
        const response = createResponse(false, 'Job not found', null);
        res.status(404).json(response);
        return;
      }

      const job = jobResult.data;
      if (job.job.clientId === userId) {
        const response = createResponse(false, 'Cannot apply to your own job', null);
        res.status(400).json(response);
        return;
      }

      req.body = sanitizeAppData(body);
      next();
    } catch (error) {
      logger.error('Error in application creation validation middleware', { error, body: req.body });
      const response = createResponse(false, 'Validation error', null, [error]);
      res.status(500).json(response);
    }
  };

  validateApplicationUpdate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { applicationId } = req.params;
      const { body } = req;
      const userId = req.user?.id;

      if (!applicationId || isNaN(parseInt(applicationId))) {
        const response = createResponse(false, 'Valid application ID is required', null);
        res.status(400).json(response);
        return;
      }

      if (!body || Object.keys(body).length === 0) {
        const response = createResponse(false, 'Update data is required', null);
        res.status(400).json(response);
        return;
      }

      const applicationResult = await this.applicationService.getApplication(parseInt(applicationId), userId);
      if (!applicationResult.success || !applicationResult.data) {
        const response = createResponse(false, 'Application not found', null);
        res.status(404).json(response);
        return;
      }

      const application = applicationResult.data;
      if (application.tradieId !== userId) {
        const response = createResponse(false, 'Unauthorized access', null);
        res.status(403).json(response);
        return;
      }

      if (!canModifyApplication(application as any)) {
        const response = createResponse(false, 'Application cannot be modified in current status', null);
        res.status(400).json(response);
        return;
      }


      req.body = sanitizeAppData(body);
      next();
    } catch (error) {
      logger.error('Error in application update validation middleware', { error, applicationId: req.params.applicationId });
      const response = createResponse(false, 'Validation error', null, [error]);
      res.status(500).json(response);
    }
  };

  validateApplicationSearch = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const searchParams = {
        ...req.query,
        page: parseInt(req.query.page as string) || 1,
        limit: Math.min(parseInt(req.query.limit as string) || 20, MARKETPLACE_LIMITS.MAX_SEARCH_RESULTS)
      };

      const validationResult = validateApplicationSearchParams(searchParams);
      if (!validationResult.isValid) {
        const response = createResponse(false, 'Invalid search parameters', null, validationResult.errors);
        res.status(400).json(response);
        return;
      }

      req.query = searchParams as any;
      next();
    } catch (error) {
      logger.error('Error in application search validation middleware', { error, query: req.query });
      const response = createResponse(false, 'Search validation error', null, [error]);
      res.status(500).json(response);
    }
  };

  validateApplicationStatusUpdate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { applicationId } = req.params;
      const { status, reason, feedback } = req.body;
      const userId = req.user?.id;

      if (!applicationId || isNaN(parseInt(applicationId))) {
        const response = createResponse(false, 'Valid application ID is required', null);
        res.status(400).json(response);
        return;
      }

      if (!status || !Object.values(APPLICATION_STATUS).includes(status)) {
        const response = createResponse(false, 'Valid status is required', null);
        res.status(400).json(response);
        return;
      }

      const applicationResult = await this.applicationService.getApplication(parseInt(applicationId), userId);
      if (!applicationResult.success || !applicationResult.data) {
        const response = createResponse(false, 'Application not found', null);
        res.status(404).json(response);
        return;
      }

      const application = applicationResult.data;
      const jobOwnership = await this.marketplaceService.getMarketplaceJob(application.job.id, userId);
      
      if (!jobOwnership.success || !jobOwnership.data) {
        const response = createResponse(false, 'Unauthorized access', null);
        res.status(403).json(response);
        return;
      }

      const transitionValidation = validateApplicationStatusTransition(application.status, status);
      if (!transitionValidation.isValid) {
        const response = createResponse(false, transitionValidation.error || 'Invalid status transition', null);
        res.status(400).json(response);
        return;
      }

      req.body = sanitizeAppData({ status, reason, feedback });
      next();
    } catch (error) {
      logger.error('Error in application status update validation middleware', { error, applicationId: req.params.applicationId });
      const response = createResponse(false, 'Status update validation error', null, [error]);
      res.status(500).json(response);
    }
  };

  checkApplicationOwnership = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { applicationId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        const response = createResponse(false, 'Authentication required', null);
        res.status(401).json(response);
        return;
      }

      if (!applicationId || isNaN(parseInt(applicationId))) {
        const response = createResponse(false, 'Valid application ID is required', null);
        res.status(400).json(response);
        return;
      }

      const applicationResult = await this.applicationService.getApplication(parseInt(applicationId), userId);
      if (!applicationResult.success || !applicationResult.data) {
        const response = createResponse(false, 'Application not found', null);
        res.status(404).json(response);
        return;
      }

      const application = applicationResult.data;
      if (application.tradieId !== userId) {
        const response = createResponse(false, 'Unauthorized access', null);
        res.status(403).json(response);
        return;
      }

      next();
    } catch (error) {
      logger.error('Error in application ownership check middleware', { error, applicationId: req.params.applicationId });
      const response = createResponse(false, 'Ownership check error', null, [error]);
      res.status(500).json(response);
    }
  };

  checkApplicationWithdrawal = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { applicationId } = req.params;
      const userId = req.user?.id;

      if (!applicationId || isNaN(parseInt(applicationId))) {
        const response = createResponse(false, 'Valid application ID is required', null);
        res.status(400).json(response);
        return;
      }

      const applicationResult = await this.applicationService.getApplication(parseInt(applicationId), userId);
      if (!applicationResult.success || !applicationResult.data) {
        const response = createResponse(false, 'Application not found', null);
        res.status(404).json(response);
        return;
      }

      const application = applicationResult.data;
      if (application.tradieId !== userId) {
        const response = createResponse(false, 'Unauthorized access', null);
        res.status(403).json(response);
        return;
      }

      if (!canWithdrawApplication(application as any)) {
        const response = createResponse(false, 'Application cannot be withdrawn at this time', null);
        res.status(400).json(response);
        return;
      }

      next();
    } catch (error) {
      logger.error('Error in application withdrawal check middleware', { error, applicationId: req.params.applicationId });
      const response = createResponse(false, 'Withdrawal check error', null, [error]);
      res.status(500).json(response);
    }
  };

  rateLimitApplicationCreation = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: MARKETPLACE_LIMITS.MAX_APPLICATIONS_PER_HOUR,
    message: createResponse(false, 'Too many applications. Please try again later.', null),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: AuthenticatedRequest) => `application_creation_${req.user?.id || req.ip}`,
    skip: (req: AuthenticatedRequest) => req.user?.role === 'admin'
  });

  rateLimitApplicationSearch = rateLimit({
    windowMs: 60 * 1000,
    max: MARKETPLACE_LIMITS.MAX_SEARCHES_PER_MINUTE,
    message: createResponse(false, 'Too many search requests. Please try again later.', null),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: AuthenticatedRequest) => `application_search_${req.user?.id || req.ip}`
  });

  logApplicationActivity = (action: string) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      const originalSend = res.json;
      
      res.json = function(body: any) {
        const logData = {
          action,
          userId: req.user?.id,
          applicationId: req.params.applicationId,
          jobId: req.params.jobId,
          method: req.method,
          url: req.originalUrl,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          success: body?.success || false,
          timestamp: new Date().toISOString()
        };

        logger.info('Application activity', logData);
        
        return originalSend.call(this, body);
      };

      next();
    };
  };

  validateTradieRole = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
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

  validateClientRole = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
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

  handleApplicationErrors = (error: any, req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    logger.error('Application error', {
      error: error.message,
      stack: error.stack,
      url: req.originalUrl,
      method: req.method,
      userId: req.user?.id,
      applicationId: req.params.applicationId
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

    sanitizeApplicationData = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      try {
        if (req.body) {
          req.body = sanitizeAppData(req.body);
        }
        
        if (req.query) {
          req.query = sanitizeAppData(req.query as any) as any;  
        }
  
        next();
      } catch (error) {
        logger.error('Error in application data sanitization middleware', { error });
        const response = createResponse(false, 'Data sanitization error', null, [error]);
        res.status(500).json(response);
      }
    };
  
    validatePagination = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
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
  
    validateApplicationFilters = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      try {
        const { status, minQuote, maxQuote, dateRange } = req.query;
  
        if (status && typeof status === 'string') {
          const validStatuses = Object.values(APPLICATION_STATUS);
          if (!validStatuses.includes(status as any)) {
            const response = createResponse(false, 'Invalid status filter', null);
            res.status(400).json(response);
            return;
          }
        }
  
        if (minQuote && isNaN(parseFloat(minQuote as string))) {
          const response = createResponse(false, 'Invalid minimum quote filter', null);
          res.status(400).json(response);
          return;
        }
  
        if (maxQuote && isNaN(parseFloat(maxQuote as string))) {
          const response = createResponse(false, 'Invalid maximum quote filter', null);
          res.status(400).json(response);
          return;
        }
  
        if (minQuote && maxQuote && parseFloat(minQuote as string) > parseFloat(maxQuote as string)) {
          const response = createResponse(false, 'Minimum quote cannot be greater than maximum quote', null);
          res.status(400).json(response);
          return;
        }
  
        next();
      } catch (error) {
        logger.error('Error in application filters validation middleware', { error, query: req.query });
        const response = createResponse(false, 'Filter validation error', null, [error]);
        res.status(500).json(response);
      }
    };
  
    checkDuplicateApplication = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        const { marketplaceJobId } = req.body;
        const userId = req.user?.id;
  
        if (!marketplaceJobId || !userId) {
          next();
          return;
        }
  
        const existingApplications = await this.applicationService.getTradieApplications(userId, {
          page: 1,
          limit: 1000
        });
  
        if (existingApplications.success && existingApplications.data) {
          const duplicateApplication = existingApplications.data.applications.find(
            app => app.marketplaceJobId === marketplaceJobId && 
                   app.status !== APPLICATION_STATUS.WITHDRAWN
          );
  
          if (duplicateApplication) {
            const response = createResponse(false, 'You have already applied to this job', null);
            res.status(400).json(response);
            return;
          }
        }
  
        next();
      } catch (error) {
        logger.error('Error in duplicate application check middleware', { error, userId: req.user?.id });
        next();
      }
    };
  
    validateJobApplicationAccess = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        const { jobId } = req.params;
        const userId = req.user?.id;
        const userRole = req.user?.role;
  
        if (!jobId || isNaN(parseInt(jobId))) {
          const response = createResponse(false, 'Valid job ID is required', null);
          res.status(400).json(response);
          return;
        }
  
        if (userRole === 'admin') {
          next();
          return;
        }
  
        const jobResult = await this.marketplaceService.getMarketplaceJob(parseInt(jobId));
        if (!jobResult.success || !jobResult.data) {
          const response = createResponse(false, 'Job not found', null);
          res.status(404).json(response);
          return;
        }
  
        const job = jobResult.data;
        if (job.job.clientId !== userId) {
          const response = createResponse(false, 'Unauthorized access', null);
          res.status(403).json(response);
          return;
        }
  
        next();
      } catch (error) {
        logger.error('Error in job application access validation middleware', { error, jobId: req.params.jobId });
        const response = createResponse(false, 'Access validation error', null, [error]);
        res.status(500).json(response);
      }
    };
  
    cacheApplicationData = (cacheDuration: number = 300) => {
      return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
        const cacheKey = `application_${req.params.applicationId || 'search'}_${JSON.stringify(req.query)}`;
        
        res.set('Cache-Control', `public, max-age=${cacheDuration}`);
        res.set('ETag', `"${Buffer.from(cacheKey).toString('base64')}"`);
  
        if (req.headers['if-none-match'] === res.get('ETag')) {
          res.status(304).end();
          return;
        }
  
        next();
      };
    };
  
    trackApplicationViews = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        const { applicationId } = req.params;
        const userId = req.user?.id;
  
        if (applicationId && !isNaN(parseInt(applicationId))) {
          const viewData = {
            applicationId: parseInt(applicationId),
            userId: userId || null,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString()
          };
  
          logger.info('Application view tracked', viewData);
        }
  
        next();
      } catch (error) {
        logger.error('Error in application view tracking middleware', { error, applicationId: req.params.applicationId });
        next();
      }
    };
  
    requireApplicationAccess = (accessType: 'read' | 'write' | 'delete') => {
      return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
          const { applicationId } = req.params;
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
  
          if (!applicationId || isNaN(parseInt(applicationId))) {
            const response = createResponse(false, 'Valid application ID is required', null);
            res.status(400).json(response);
            return;
          }
  
          const applicationResult = await this.applicationService.getApplication(parseInt(applicationId), userId);
          if (!applicationResult.success || !applicationResult.data) {
            const response = createResponse(false, 'Application not found', null);
            res.status(404).json(response);
            return;
          }
  
          const application = applicationResult.data;
          const isOwner = application.tradieId === userId;
          const isJobOwner = application.job.clientId === userId;
  
          switch (accessType) {
            case 'read':
              if (!isOwner && !isJobOwner) {
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
          logger.error('Error in application access middleware', { error, applicationId: req.params.applicationId, accessType });
          const response = createResponse(false, 'Access check error', null, [error]);
          res.status(500).json(response);
        }
      };
    };
  
    validateBulkApplicationOperations = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      try {
        const { applicationIds } = req.body;
  
        if (!Array.isArray(applicationIds)) {
          const response = createResponse(false, 'Application IDs must be an array', null);
          res.status(400).json(response);
          return;
        }
  
        if (applicationIds.length === 0) {
          const response = createResponse(false, 'At least one application ID is required', null);
          res.status(400).json(response);
          return;
        }
  
        if (applicationIds.length > MARKETPLACE_LIMITS.MAX_BULK_OPERATIONS) {
          const response = createResponse(false, `Maximum ${MARKETPLACE_LIMITS.MAX_BULK_OPERATIONS} applications allowed per bulk operation`, null);
          res.status(400).json(response);
          return;
        }
  
        const invalidIds = applicationIds.filter(id => isNaN(parseInt(id)));
        if (invalidIds.length > 0) {
          const response = createResponse(false, 'All application IDs must be valid numbers', null);
          res.status(400).json(response);
          return;
        }
  
        next();
      } catch (error) {
        logger.error('Error in bulk application operations validation middleware', { error, body: req.body });
        const response = createResponse(false, 'Bulk operations validation error', null, [error]);
        res.status(500).json(response);
      }
    };
  
    validateWithdrawalData = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      try {
        const { reason, refundCredits } = req.body;
  
        if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
          const response = createResponse(false, 'Withdrawal reason is required', null);
          res.status(400).json(response);
          return;
        }
  
        if (reason.length > 500) {
          const response = createResponse(false, 'Withdrawal reason cannot exceed 500 characters', null);
          res.status(400).json(response);
          return;
        }
  
        if (refundCredits !== undefined && typeof refundCredits !== 'boolean') {
          const response = createResponse(false, 'Refund credits must be a boolean value', null);
          res.status(400).json(response);
          return;
        }

        req.body = sanitizeAppData({ reason, refundCredits: refundCredits || false });
        next();
      } catch (error) {
        logger.error('Error in withdrawal data validation middleware', { error, body: req.body });
        const response = createResponse(false, 'Withdrawal validation error', null, [error]);
        res.status(500).json(response);
      }
    };
  
    checkApplicationLimit = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = req.user?.id;
  
        if (!userId) {
          next();
          return;
        }
  
        const today = new Date();
        today.setHours(0, 0, 0, 0);
  
        const todayApplications = await this.applicationService.getTradieApplications(userId, {
          page: 1,
          limit: 1000
        });
  
        if (todayApplications.success && todayApplications.data) {
          const todayCount = todayApplications.data.applications.filter(
            app => new Date(app.applicationTimestamp) >= today
          ).length;
  
          if (todayCount >= MARKETPLACE_LIMITS.MAX_APPLICATIONS_PER_DAY) {
            const response = createResponse(false, 'Daily application limit reached', null);
            res.status(429).json(response);
            return;
          }
        }
  
        next();
      } catch (error) {
        logger.error('Error in application limit check middleware', { error, userId: req.user?.id });
        next();
      }
    };
  
    async destroy(): Promise<void> {
      try {
        await this.applicationService.destroy();
        await this.marketplaceService.destroy();
        logger.info('ApplicationMiddleware destroyed successfully');
      } catch (error) {
        logger.error('Error destroying ApplicationMiddleware', { error });
      }
    }
  }
  
  export const applicationMiddleware = new ApplicationMiddleware();
  
  export const {
    validateApplicationCreation,
    validateApplicationUpdate,
    validateApplicationSearch,
    validateApplicationStatusUpdate,
    checkApplicationOwnership,
    checkApplicationWithdrawal,
    rateLimitApplicationCreation,
    rateLimitApplicationSearch,
    logApplicationActivity,
    validateTradieRole,
    validateClientRole,
    handleApplicationErrors,
    sanitizeApplicationData,
    validatePagination,
    validateApplicationFilters,
    checkDuplicateApplication,
    validateJobApplicationAccess,
    cacheApplicationData,
    trackApplicationViews,
    requireApplicationAccess,
    validateBulkApplicationOperations,
    validateWithdrawalData,
    checkApplicationLimit
  } = applicationMiddleware;
  