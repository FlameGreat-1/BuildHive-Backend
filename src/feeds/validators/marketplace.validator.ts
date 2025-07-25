import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { 
  MarketplaceJobCreateData,
  MarketplaceJobUpdateData,
  MarketplaceJobSearchParams,
  MarketplaceJobFilters
} from '../types';
import {
  MARKETPLACE_JOB_TYPES,
  MARKETPLACE_JOB_STATUS,
  URGENCY_LEVEL,
  MARKETPLACE_LIMITS,
  MARKETPLACE_VALIDATION_RULES,
  MARKETPLACE_SORT_OPTIONS
} from '../../config/feeds';
import { 
  validateEmail, 
  validatePhone, 
  sanitizeString,
  createValidationError,
  handleValidationErrors
} from '../../shared/middleware';
import { 
  validateMarketplaceJobData,
  sanitizeMarketplaceJobData,
  validateJobFilters
} from '../utils';

export const validateCreateMarketplaceJob = [
  body('title')
    .trim()
    .isLength({ min: MARKETPLACE_LIMITS.JOB_TITLE_MIN_LENGTH, max: MARKETPLACE_LIMITS.JOB_TITLE_MAX_LENGTH })
    .withMessage(`Job title must be between ${MARKETPLACE_LIMITS.JOB_TITLE_MIN_LENGTH} and ${MARKETPLACE_LIMITS.JOB_TITLE_MAX_LENGTH} characters`)
    .matches(MARKETPLACE_VALIDATION_RULES.TITLE_REGEX)
    .withMessage('Job title contains invalid characters'),

  body('description')
    .trim()
    .isLength({ min: MARKETPLACE_LIMITS.JOB_DESCRIPTION_MIN_LENGTH, max: MARKETPLACE_LIMITS.JOB_DESCRIPTION_MAX_LENGTH })
    .withMessage(`Job description must be between ${MARKETPLACE_LIMITS.JOB_DESCRIPTION_MIN_LENGTH} and ${MARKETPLACE_LIMITS.JOB_DESCRIPTION_MAX_LENGTH} characters`),

  body('jobType')
    .isIn(Object.values(MARKETPLACE_JOB_TYPES))
    .withMessage('Invalid job type'),

  body('location')
    .trim()
    .isLength({ min: MARKETPLACE_LIMITS.LOCATION_MIN_LENGTH })
    .withMessage(`Location must be at least ${MARKETPLACE_LIMITS.LOCATION_MIN_LENGTH} characters long`)
    .matches(MARKETPLACE_VALIDATION_RULES.LOCATION_REGEX)
    .withMessage('Invalid location format'),

  body('estimatedBudget')
    .optional()
    .isFloat({ min: MARKETPLACE_LIMITS.MIN_ESTIMATED_BUDGET, max: MARKETPLACE_LIMITS.MAX_ESTIMATED_BUDGET })
    .withMessage(`Estimated budget must be between $${MARKETPLACE_LIMITS.MIN_ESTIMATED_BUDGET} and $${MARKETPLACE_LIMITS.MAX_ESTIMATED_BUDGET}`),

  body('dateRequired')
    .isISO8601()
    .withMessage('Invalid date format')
    .custom((value) => {
      const dateRequired = new Date(value);
      const now = new Date();
      if (dateRequired <= now) {
        throw new Error('Date required must be in the future');
      }
      return true;
    }),

  body('urgencyLevel')
    .isIn(Object.values(URGENCY_LEVEL))
    .withMessage('Invalid urgency level'),

  body('photos')
    .optional()
    .isArray({ max: MARKETPLACE_LIMITS.MAX_PHOTOS_PER_JOB })
    .withMessage(`Maximum ${MARKETPLACE_LIMITS.MAX_PHOTOS_PER_JOB} photos allowed`)
    .custom((photos) => {
      if (photos && photos.length > 0) {
        const validUrls = photos.every((photo: string) => 
          typeof photo === 'string' && MARKETPLACE_VALIDATION_RULES.PHOTO_URL_REGEX.test(photo)
        );
        if (!validUrls) {
          throw new Error('Invalid photo URLs provided');
        }
      }
      return true;
    }),

  body('clientName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Client name is required and must be less than 100 characters')
    .matches(MARKETPLACE_VALIDATION_RULES.NAME_REGEX)
    .withMessage('Client name contains invalid characters'),

  body('clientEmail')
    .isEmail()
    .withMessage('Valid client email is required')
    .normalizeEmail()
    .custom((email) => {
      if (!MARKETPLACE_VALIDATION_RULES.EMAIL_REGEX.test(email)) {
        throw new Error('Invalid email format');
      }
      return true;
    }),

  body('clientPhone')
    .optional()
    .matches(MARKETPLACE_VALIDATION_RULES.PHONE_REGEX)
    .withMessage('Invalid phone number format'),

  body('clientCompany')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Company name must be less than 100 characters'),

  handleValidationErrors
];

export const validateUpdateMarketplaceJob = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid job ID'),

  body('title')
    .optional()
    .trim()
    .isLength({ min: MARKETPLACE_LIMITS.JOB_TITLE_MIN_LENGTH, max: MARKETPLACE_LIMITS.JOB_TITLE_MAX_LENGTH })
    .withMessage(`Job title must be between ${MARKETPLACE_LIMITS.JOB_TITLE_MIN_LENGTH} and ${MARKETPLACE_LIMITS.JOB_TITLE_MAX_LENGTH} characters`)
    .matches(MARKETPLACE_VALIDATION_RULES.TITLE_REGEX)
    .withMessage('Job title contains invalid characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ min: MARKETPLACE_LIMITS.JOB_DESCRIPTION_MIN_LENGTH, max: MARKETPLACE_LIMITS.JOB_DESCRIPTION_MAX_LENGTH })
    .withMessage(`Job description must be between ${MARKETPLACE_LIMITS.JOB_DESCRIPTION_MIN_LENGTH} and ${MARKETPLACE_LIMITS.JOB_DESCRIPTION_MAX_LENGTH} characters`),

  body('estimatedBudget')
    .optional()
    .isFloat({ min: MARKETPLACE_LIMITS.MIN_ESTIMATED_BUDGET, max: MARKETPLACE_LIMITS.MAX_ESTIMATED_BUDGET })
    .withMessage(`Estimated budget must be between $${MARKETPLACE_LIMITS.MIN_ESTIMATED_BUDGET} and $${MARKETPLACE_LIMITS.MAX_ESTIMATED_BUDGET}`),

  body('dateRequired')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format')
    .custom((value) => {
      if (value) {
        const dateRequired = new Date(value);
        const now = new Date();
        if (dateRequired <= now) {
          throw new Error('Date required must be in the future');
        }
      }
      return true;
    }),

  body('urgencyLevel')
    .optional()
    .isIn(Object.values(URGENCY_LEVEL))
    .withMessage('Invalid urgency level'),

  body('photos')
    .optional()
    .isArray({ max: MARKETPLACE_LIMITS.MAX_PHOTOS_PER_JOB })
    .withMessage(`Maximum ${MARKETPLACE_LIMITS.MAX_PHOTOS_PER_JOB} photos allowed`),

  body('status')
    .optional()
    .isIn(Object.values(MARKETPLACE_JOB_STATUS))
    .withMessage('Invalid job status'),

  handleValidationErrors
];

export const validateMarketplaceJobId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid job ID'),

  handleValidationErrors
];

export const validateMarketplaceJobSearch = [
  query('query')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Search query must be less than 200 characters'),

  query('jobType')
    .optional()
    .isIn(Object.values(MARKETPLACE_JOB_TYPES))
    .withMessage('Invalid job type'),

  query('location')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Location must be less than 100 characters'),

  query('urgencyLevel')
    .optional()
    .isIn(Object.values(URGENCY_LEVEL))
    .withMessage('Invalid urgency level'),

  query('minBudget')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum budget must be a positive number'),

  query('maxBudget')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Maximum budget must be a positive number'),

  query('sortBy')
    .optional()
    .isIn(Object.values(MARKETPLACE_SORT_OPTIONS))
    .withMessage('Invalid sort option'),

  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  query('radius')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Radius must be between 1 and 100 km'),

  handleValidationErrors
];

export const validateMarketplaceJobStatus = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid job ID'),

  body('status')
    .isIn(Object.values(MARKETPLACE_JOB_STATUS))
    .withMessage('Invalid job status'),

  handleValidationErrors
];

export const validateTradieSelection = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid job ID'),

  body('selectedApplicationId')
    .isInt({ min: 1 })
    .withMessage('Invalid application ID'),

  body('selectionReason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Selection reason must be less than 500 characters'),

  body('negotiatedQuote')
    .optional()
    .isFloat({ min: MARKETPLACE_LIMITS.MIN_CUSTOM_QUOTE, max: MARKETPLACE_LIMITS.MAX_CUSTOM_QUOTE })
    .withMessage(`Negotiated quote must be between $${MARKETPLACE_LIMITS.MIN_CUSTOM_QUOTE} and $${MARKETPLACE_LIMITS.MAX_CUSTOM_QUOTE}`),

  body('projectStartDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid project start date format')
    .custom((value) => {
      if (value) {
        const startDate = new Date(value);
        const now = new Date();
        if (startDate <= now) {
          throw new Error('Project start date must be in the future');
        }
      }
      return true;
    }),

  handleValidationErrors
];

export const validateMarketplaceJobFilters = [
    query('jobType')
      .optional()
      .isIn(Object.values(MARKETPLACE_JOB_TYPES))
      .withMessage('Invalid job type filter'),
  
    query('location')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Location filter must be less than 100 characters'),
  
    query('urgencyLevel')
      .optional()
      .isIn(Object.values(URGENCY_LEVEL))
      .withMessage('Invalid urgency level filter'),
  
    query('minBudget')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Minimum budget filter must be a positive number')
      .custom((value, { req }) => {
        if (value && req.query.maxBudget && parseFloat(value) > parseFloat(req.query.maxBudget)) {
          throw new Error('Minimum budget cannot be greater than maximum budget');
        }
        return true;
      }),
  
    query('maxBudget')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Maximum budget filter must be a positive number'),
  
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Invalid start date format'),
  
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('Invalid end date format')
      .custom((value, { req }) => {
        if (value && req.query.startDate && new Date(value) < new Date(req.query.startDate)) {
          throw new Error('End date cannot be before start date');
        }
        return true;
      }),
  
    query('excludeApplied')
      .optional()
      .isBoolean()
      .withMessage('excludeApplied must be a boolean'),
  
    handleValidationErrors
  ];
  
  export const validateBulkJobOperation = [
    body('operation')
      .isIn(['expire', 'activate', 'cancel'])
      .withMessage('Invalid bulk operation'),
  
    body('jobIds')
      .isArray({ min: 1, max: 50 })
      .withMessage('Job IDs array must contain 1-50 items')
      .custom((jobIds) => {
        const validIds = jobIds.every((id: any) => Number.isInteger(id) && id > 0);
        if (!validIds) {
          throw new Error('All job IDs must be positive integers');
        }
        return true;
      }),
  
    body('reason')
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Reason must be less than 200 characters'),
  
    handleValidationErrors
  ];
  
  export const validateMarketplaceAnalytics = [
    query('period')
      .optional()
      .isIn(['day', 'week', 'month', 'quarter', 'year'])
      .withMessage('Invalid analytics period'),
  
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Invalid start date format'),
  
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('Invalid end date format')
      .custom((value, { req }) => {
        if (value && req.query.startDate) {
          const endDate = new Date(value);
          const startDate = new Date(req.query.startDate);
          if (endDate <= startDate) {
            throw new Error('End date must be after start date');
          }
          const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
          if (daysDiff > 365) {
            throw new Error('Date range cannot exceed 365 days');
          }
        }
        return true;
      }),
  
    query('groupBy')
      .optional()
      .isIn(['day', 'week', 'month', 'jobType', 'location', 'urgency'])
      .withMessage('Invalid groupBy parameter'),
  
    handleValidationErrors
  ];
  
  export const validateJobExpiry = [
    param('id')
      .isInt({ min: 1 })
      .withMessage('Invalid job ID'),
  
    body('extendDays')
      .optional()
      .isInt({ min: 1, max: 90 })
      .withMessage('Extension days must be between 1 and 90'),
  
    handleValidationErrors
  ];
  
  export const validateClientJobAccess = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const jobId = parseInt(req.params.id);
      const clientId = req.user?.id;
  
      if (!clientId) {
        return res.status(401).json(createValidationError('Authentication required'));
      }
  
      if (!jobId || jobId <= 0) {
        return res.status(400).json(createValidationError('Invalid job ID'));
      }
  
      req.jobId = jobId;
      req.clientId = clientId;
      next();
    } catch (error) {
      return res.status(500).json(createValidationError('Server error during validation'));
    }
  };
  
  export const validateJobModificationPermissions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const jobId = parseInt(req.params.id);
      const userId = req.user?.id;
      const userRole = req.user?.role;
  
      if (!userId) {
        return res.status(401).json(createValidationError('Authentication required'));
      }
  
      if (userRole !== 'client' && userRole !== 'admin') {
        return res.status(403).json(createValidationError('Insufficient permissions'));
      }
  
      req.jobId = jobId;
      req.userId = userId;
      next();
    } catch (error) {
      return res.status(500).json(createValidationError('Server error during permission validation'));
    }
  };
  
  export const sanitizeMarketplaceJobInput = (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.body.title) {
        req.body.title = sanitizeString(req.body.title.trim());
      }
  
      if (req.body.description) {
        req.body.description = sanitizeString(req.body.description.trim());
      }
  
      if (req.body.location) {
        req.body.location = sanitizeString(req.body.location.trim());
      }
  
      if (req.body.clientName) {
        req.body.clientName = sanitizeString(req.body.clientName.trim());
      }
  
      if (req.body.clientEmail) {
        req.body.clientEmail = req.body.clientEmail.trim().toLowerCase();
      }
  
      if (req.body.clientPhone) {
        req.body.clientPhone = req.body.clientPhone.trim();
      }
  
      if (req.body.clientCompany) {
        req.body.clientCompany = sanitizeString(req.body.clientCompany.trim());
      }
  
      if (req.body.selectionReason) {
        req.body.selectionReason = sanitizeString(req.body.selectionReason.trim());
      }
  
      next();
    } catch (error) {
      return res.status(500).json(createValidationError('Error sanitizing input data'));
    }
  };
  
  export const validateBusinessRules = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const jobData = req.body as MarketplaceJobCreateData;
      const validationResult = validateMarketplaceJobData(jobData);
  
      if (!validationResult.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationResult.errors,
          warnings: validationResult.warnings
        });
      }
  
      if (validationResult.warnings.length > 0) {
        req.validationWarnings = validationResult.warnings;
      }
  
      req.body = sanitizeMarketplaceJobData(jobData);
      next();
    } catch (error) {
      return res.status(500).json(createValidationError('Error validating business rules'));
    }
  };
  
  export const validateSearchFilters = (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters: MarketplaceJobFilters = {
        jobType: req.query.jobType as any,
        location: req.query.location as string,
        urgencyLevel: req.query.urgencyLevel as any,
        minBudget: req.query.minBudget ? parseFloat(req.query.minBudget as string) : undefined,
        maxBudget: req.query.maxBudget ? parseFloat(req.query.maxBudget as string) : undefined,
        dateRange: req.query.startDate && req.query.endDate ? {
          startDate: new Date(req.query.startDate as string),
          endDate: new Date(req.query.endDate as string)
        } : undefined,
        excludeApplied: req.query.excludeApplied === 'true',
        tradieId: req.user?.role === 'tradie' ? req.user.id : undefined
      };
  
      const filterValidation = validateJobFilters(filters);
      if (!filterValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid search filters',
          errors: filterValidation.errors
        });
      }
  
      req.searchFilters = filters;
      next();
    } catch (error) {
      return res.status(500).json(createValidationError('Error validating search filters'));
    }
  };
  
  export const validatePaginationParams = (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
  
      if (page < 1) {
        return res.status(400).json(createValidationError('Page must be a positive integer'));
      }
  
      if (limit < 1 || limit > 100) {
        return res.status(400).json(createValidationError('Limit must be between 1 and 100'));
      }
  
      req.pagination = {
        page,
        limit,
        offset: (page - 1) * limit
      };
  
      next();
    } catch (error) {
      return res.status(500).json(createValidationError('Error validating pagination parameters'));
    }
  };
  
  export const validateSortParams = (req: Request, res: Response, next: NextFunction) => {
    try {
      const sortBy = req.query.sortBy as string || MARKETPLACE_SORT_OPTIONS.DATE_POSTED;
      const sortOrder = req.query.sortOrder as 'asc' | 'desc' || 'desc';
  
      if (!Object.values(MARKETPLACE_SORT_OPTIONS).includes(sortBy as any)) {
        return res.status(400).json(createValidationError('Invalid sort parameter'));
      }
  
      if (!['asc', 'desc'].includes(sortOrder)) {
        return res.status(400).json(createValidationError('Sort order must be asc or desc'));
      }
  
      req.sorting = {
        sortBy,
        sortOrder
      };
  
      next();
    } catch (error) {
      return res.status(500).json(createValidationError('Error validating sort parameters'));
    }
  };
  
  export const validateRateLimit = (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;
    const endpoint = req.route?.path;
  
    const rateLimits = {
      client: { requests: 100, window: 3600 },
      tradie: { requests: 200, window: 3600 },
      admin: { requests: 1000, window: 3600 }
    };
  
    const limit = rateLimits[userRole as keyof typeof rateLimits] || rateLimits.tradie;
    
    req.rateLimit = limit;
    next();
  };
  
  export const validateJobOwnership = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const jobId = parseInt(req.params.id);
      const userId = req.user?.id;
      const userRole = req.user?.role;
  
      if (userRole === 'admin') {
        return next();
      }
  
      if (userRole === 'client') {
        req.ownershipValidated = true;
        return next();
      }
  
      return res.status(403).json(createValidationError('Access denied'));
    } catch (error) {
      return res.status(500).json(createValidationError('Error validating job ownership'));
    }
  };
  