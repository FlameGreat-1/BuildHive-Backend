import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, AuthenticatedRequest } from '../../auth/middleware';
import { ApplicationService, MarketplaceService } from '../services';
import { 
  validateApplicationData,
  sanitizeApplicationData as sanitizeAppData,
  canWithdrawApplication,
  canModifyApplication,
  validateApplicationStatusTransition
} from '../utils';
import { APPLICATION_STATUS, MARKETPLACE_LIMITS } from '../../config/feeds';
import { ValidationError } from '../../shared/types';
import { createErrorResponse, logger, AppError } from '../../shared/utils';
import { HTTP_STATUS_CODES } from '../../config/auth/constants';
import { MARKETPLACE_CONFIG } from '../../config/feeds/marketplace.config';

const sendValidationError = (res: Response, message: string, errors: ValidationError[]): void => {
  const error = new AppError(message, HTTP_STATUS_CODES.BAD_REQUEST, 'VALIDATION_ERROR');
  res.status(HTTP_STATUS_CODES.BAD_REQUEST).json(
    createErrorResponse(error, res.locals.requestId || 'unknown')
  );
};

export class ApplicationMiddleware {
  private applicationService: ApplicationService;
  private marketplaceService: MarketplaceService;

  constructor() {
    this.applicationService = new ApplicationService();
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

  authenticateApplicationUser = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await authenticate(req, res, next);
    } catch (error) {
      logger.error('Application authentication error', {
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

  validateApplicationCreation = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { body } = req;
      const userId = req.user?.id;
      const errors: ValidationError[] = [];

      if (!body || Object.keys(body).length === 0) {
        errors.push({
          field: 'body',
          message: 'Request body is required',
          code: 'REQUIRED_FIELD'
        });
        return sendValidationError(res, 'Request body is required', errors);
      }

      if (!userId) {
        return next(new AppError('Authentication required', HTTP_STATUS_CODES.UNAUTHORIZED));
      }

      const validationResult = validateApplicationData(body);
      if (!validationResult.isValid) {
        return sendValidationError(res, 'Validation failed', validationResult.errors);
      }

      const jobResult = await this.marketplaceService.getMarketplaceJob(body.marketplace_job_id);
      if (!jobResult.success || !jobResult.data) {
        return next(new AppError('Job not found', HTTP_STATUS_CODES.NOT_FOUND));
      }

      const job = jobResult.data;
      if (job.client_id === parseInt(userId)) {
        return next(new AppError('Cannot apply to your own job', HTTP_STATUS_CODES.BAD_REQUEST));
      }

      req.body = sanitizeAppData(body);
      next();
    } catch (error) {
      logger.error('Error in application creation validation middleware', { error, body: req.body });
      next(new AppError('Validation error', HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR));
    }
  };

  validateApplicationUpdate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { applicationId } = req.params;
      const { body } = req;
      const userId = req.user?.id;
      const errors: ValidationError[] = [];

      if (!applicationId || isNaN(parseInt(applicationId))) {
        errors.push({
          field: 'applicationId',
          message: 'Valid application ID is required',
          code: 'INVALID_VALUE'
        });
        return sendValidationError(res, 'Valid application ID is required', errors);
      }

      if (!body || Object.keys(body).length === 0) {
        errors.push({
          field: 'body',
          message: 'Update data is required',
          code: 'REQUIRED_FIELD'
        });
        return sendValidationError(res, 'Update data is required', errors);
      }

      const applicationResult = await this.applicationService.getApplication(parseInt(applicationId), userId);
      if (!applicationResult.success || !applicationResult.data) {
        return next(new AppError('Application not found', HTTP_STATUS_CODES.NOT_FOUND));
      }

      const application = applicationResult.data;
      if (application.tradie_id !== userId) {
        return next(new AppError('Unauthorized access', HTTP_STATUS_CODES.FORBIDDEN));
      }

      if (!canModifyApplication(application as any)) {
        return next(new AppError('Application cannot be modified in current status', HTTP_STATUS_CODES.BAD_REQUEST));
      }

      req.body = sanitizeAppData(body);
      next();
    } catch (error) {
      logger.error('Error in application update validation middleware', { error, applicationId: req.params.applicationId });
      next(new AppError('Validation error', HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR));
    }
  };

  validateApplicationSearch = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const searchParams = {
        ...req.query,
        page: parseInt(req.query.page as string) || 1,
        limit: Math.min(parseInt(req.query.limit as string) || 20, MARKETPLACE_CONFIG.SEARCH_AND_FILTERING.MAX_SEARCH_RESULTS)
      };
      const errors: ValidationError[] = [];

      if (searchParams.page < 1) {
        errors.push({
          field: 'page',
          message: 'Page must be greater than 0',
          code: 'INVALID_VALUE'
        });
      }

      if (searchParams.limit < 1 || searchParams.limit > MARKETPLACE_CONFIG.SEARCH_AND_FILTERING.MAX_SEARCH_RESULTS) {
        errors.push({
          field: 'limit',
          message: `Limit must be between 1 and ${MARKETPLACE_CONFIG.SEARCH_AND_FILTERING.MAX_SEARCH_RESULTS}`,
          code: 'INVALID_VALUE'
        });
      }

      if (errors.length > 0) {
        return sendValidationError(res, 'Search validation failed', errors);
      }

      req.query = searchParams as any;
      next();
    } catch (error) {
      logger.error('Error in application search validation middleware', { error, query: req.query });
      next(new AppError('Search validation error', HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR));
    }
  };

  validateApplicationStatusUpdate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { applicationId } = req.params;
      const { status, reason, feedback } = req.body;
      const userId = req.user?.id;
      const errors: ValidationError[] = [];

      if (!applicationId || isNaN(parseInt(applicationId))) {
        errors.push({
          field: 'applicationId',
          message: 'Valid application ID is required',
          code: 'INVALID_VALUE'
        });
        return sendValidationError(res, 'Valid application ID is required', errors);
      }

      if (!status || !Object.values(APPLICATION_STATUS).includes(status)) {
        errors.push({
          field: 'status',
          message: 'Valid status is required',
          code: 'INVALID_VALUE'
        });
        return sendValidationError(res, 'Valid status is required', errors);
      }

      const applicationResult = await this.applicationService.getApplication(parseInt(applicationId), userId);
      if (!applicationResult.success || !applicationResult.data) {
        return next(new AppError('Application not found', HTTP_STATUS_CODES.NOT_FOUND));
      }

      const application = applicationResult.data;
      const jobOwnership = await this.marketplaceService.getMarketplaceJob(application.marketplace_job_id, userId);
      
      if (!jobOwnership.success || !jobOwnership.data) {
        return next(new AppError('Unauthorized access', HTTP_STATUS_CODES.FORBIDDEN));
      }

      const transitionValidation = validateApplicationStatusTransition(application.status, status);
      if (!transitionValidation.isValid) {
        return next(new AppError(transitionValidation.error || 'Invalid status transition', HTTP_STATUS_CODES.BAD_REQUEST));
      }

      req.body = this.sanitizeData({ status, reason, feedback });
      next();
    } catch (error) {
      logger.error('Error in application status update validation middleware', { error, applicationId: req.params.applicationId });
      next(new AppError('Status update validation error', HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR));
    }
  };

  checkApplicationOwnership = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { applicationId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return next(new AppError('Authentication required', HTTP_STATUS_CODES.UNAUTHORIZED));
      }

      if (!applicationId || isNaN(parseInt(applicationId))) {
        return next(new AppError('Valid application ID is required', HTTP_STATUS_CODES.BAD_REQUEST));
      }

      const applicationResult = await this.applicationService.getApplication(parseInt(applicationId), userId);
      if (!applicationResult.success || !applicationResult.data) {
        return next(new AppError('Application not found', HTTP_STATUS_CODES.NOT_FOUND));
      }

      const application = applicationResult.data;
      if (application.tradie_id !== userId) {
        return next(new AppError('Unauthorized access', HTTP_STATUS_CODES.FORBIDDEN));
      }

      next();
    } catch (error) {
      logger.error('Error in application ownership check middleware', { error, applicationId: req.params.applicationId });
      next(new AppError('Ownership check error', HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR));
    }
  };

  checkApplicationWithdrawal = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { applicationId } = req.params;
      const userId = req.user?.id;

      if (!applicationId || isNaN(parseInt(applicationId))) {
        return next(new AppError('Valid application ID is required', HTTP_STATUS_CODES.BAD_REQUEST));
      }

      const applicationResult = await this.applicationService.getApplication(parseInt(applicationId), userId);
      if (!applicationResult.success || !applicationResult.data) {
        return next(new AppError('Application not found', HTTP_STATUS_CODES.NOT_FOUND));
      }

      const application = applicationResult.data;
      if (application.tradie_id !== userId) {
        return next(new AppError('Unauthorized access', HTTP_STATUS_CODES.FORBIDDEN));
      }

      if (!canWithdrawApplication(application as any)) {
        return next(new AppError('Application cannot be withdrawn at this time', HTTP_STATUS_CODES.BAD_REQUEST));
      }

      next();
    } catch (error) {
      logger.error('Error in application withdrawal check middleware', { error, applicationId: req.params.applicationId });
      next(new AppError('Withdrawal check error', HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR));
    }
  };

  rateLimitApplicationCreation = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: MARKETPLACE_CONFIG.APPLICATION_SETTINGS.MAX_APPLICATIONS_PER_HOUR,
    message: {
      success: false,
      message: 'Too many applications. Please try again later.',
      data: null
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => `application_creation_${(req as any).user?.id || req.ip}`,
    skip: (req: Request) => (req as any).user?.role === 'admin'
  });

  rateLimitApplicationSearch = rateLimit({
    windowMs: 60 * 1000,
    max: MARKETPLACE_CONFIG.SEARCH_AND_FILTERING.MAX_SEARCHES_PER_MINUTE,
    message: {
      success: false,
      message: 'Too many search requests. Please try again later.',
      data: null
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => `application_search_${(req as any).user?.id || req.ip}`
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
        return next(new AppError('Tradie role required', HTTP_STATUS_CODES.FORBIDDEN));
      }

      next();
    } catch (error) {
      logger.error('Error in tradie role validation middleware', { error, userId: req.user?.id });
      next(new AppError('Role validation error', HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR));
    }
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

  handleApplicationErrors = (error: any, req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    logger.error('Application error', {
      error: error.message,
      stack: error.stack,
      url: req.originalUrl,
      method: req.method,
      userId: req.user?.id,
      applicationId: req.params.applicationId
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

  sanitizeApplicationData = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      if (req.body) {
        req.body = this.sanitizeData(req.body);
      }
      
      if (req.query) {
        req.query = this.sanitizeData(req.query);
      }

      next();
    } catch (error) {
      logger.error('Error in application data sanitization middleware', { error });
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

      if (limit < 1 || limit > MARKETPLACE_CONFIG.SEARCH_AND_FILTERING.MAX_SEARCH_RESULTS) {
        errors.push({
          field: 'limit',
          message: `Limit must be between 1 and ${MARKETPLACE_CONFIG.SEARCH_AND_FILTERING.MAX_SEARCH_RESULTS}`,
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

  validateApplicationFilters = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { status, job_type, date_from, date_to } = req.query;
      const errors: ValidationError[] = [];

      if (status && typeof status === 'string') {
        const validStatuses = Object.values(APPLICATION_STATUS);
        if (!validStatuses.includes(status as any)) {
          errors.push({
            field: 'status',
            message: 'Invalid status filter',
            code: 'INVALID_VALUE'
          });
        }
      }

      if (date_from && typeof date_from === 'string') {
        const fromDate = new Date(date_from);
        if (isNaN(fromDate.getTime())) {
          errors.push({
            field: 'date_from',
            message: 'Invalid date_from format',
            code: 'INVALID_FORMAT'
          });
        }
      }

      if (date_to && typeof date_to === 'string') {
        const toDate = new Date(date_to);
        if (isNaN(toDate.getTime())) {
          errors.push({
            field: 'date_to',
            message: 'Invalid date_to format',
            code: 'INVALID_FORMAT'
          });
        }
      }

      if (date_from && date_to && typeof date_from === 'string' && typeof date_to === 'string') {
        const fromDate = new Date(date_from);
        const toDate = new Date(date_to);
        if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime()) && fromDate > toDate) {
          errors.push({
            field: 'date_range',
            message: 'date_from cannot be after date_to',
            code: 'INVALID_VALUE'
          });
        }
      }

      if (errors.length > 0) {
        return sendValidationError(res, 'Filter validation failed', errors);
      }

      next();
    } catch (error) {
      logger.error('Error in application filters validation middleware', { error, query: req.query });
      next(new AppError('Filter validation error', HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR));
    }
  };

  requireApplicationAccess = (accessType: 'read' | 'write' | 'delete') => {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        const { applicationId } = req.params;
        const userId = req.user?.id;
        const userRole = req.user?.role;

        if (!userId) {
          return next(new AppError('Authentication required', HTTP_STATUS_CODES.UNAUTHORIZED));
        }

        if (userRole === 'admin') {
          next();
          return;
        }

        if (!applicationId || isNaN(parseInt(applicationId))) {
          return next(new AppError('Valid application ID is required', HTTP_STATUS_CODES.BAD_REQUEST));
        }

        const applicationResult = await this.applicationService.getApplication(parseInt(applicationId), userId);
        if (!applicationResult.success || !applicationResult.data) {
          return next(new AppError('Application not found', HTTP_STATUS_CODES.NOT_FOUND));
        }

        const application = applicationResult.data;
        const isOwner = application.tradie_id === userId;
        const jobResult = await this.marketplaceService.getMarketplaceJob(application.marketplace_job_id);
        const isJobOwner = jobResult.success && jobResult.data && jobResult.data.client_id === userId;

        switch (accessType) {
          case 'read':
            if (!isOwner && !isJobOwner) {
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
        logger.error('Error in application access middleware', { error, applicationId: req.params.applicationId, accessType });
        next(new AppError('Access check error', HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR));
      }
    };
  };

  validateBulkOperations = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { applicationIds } = req.body;
      const errors: ValidationError[] = [];

      if (!Array.isArray(applicationIds)) {
        errors.push({
          field: 'applicationIds',
          message: 'Application IDs must be an array',
          code: 'INVALID_TYPE'
        });
      } else {
        if (applicationIds.length === 0) {
          errors.push({
            field: 'applicationIds',
            message: 'At least one application ID is required',
            code: 'REQUIRED_FIELD'
          });
        }
          if (applicationIds.length > MARKETPLACE_LIMITS.MAX_BULK_OPERATIONS) {
          errors.push({
            field: 'applicationIds',
            message: `Maximum ${MARKETPLACE_LIMITS.MAX_BULK_OPERATIONS} applications allowed per bulk operation`,
            code: 'FIELD_TOO_LARGE'
          });
        }

        const invalidIds = applicationIds.filter(id => isNaN(parseInt(id)));
        if (invalidIds.length > 0) {
          errors.push({
            field: 'applicationIds',
            message: 'All application IDs must be valid numbers',
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

  trackApplicationViews = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { applicationId } = req.params;
      const userId = (req as any).user?.id;

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
  authenticateApplicationUser,
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
  requireApplicationAccess,
  validateBulkOperations,
  trackApplicationViews
} = applicationMiddleware;

