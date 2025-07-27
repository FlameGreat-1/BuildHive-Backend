import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { 
  JobApplicationCreateData,
  JobApplicationUpdateData,
  JobApplicationSearchParams,
  JobApplicationFilters
} from '../types';
import {
  APPLICATION_STATUS,
  MARKETPLACE_LIMITS,
  MARKETPLACE_VALIDATION_RULES,
  MARKETPLACE_JOB_TYPES,
  URGENCY_LEVEL
} from '../../config/feeds';
import { 
  sanitizeString,
  createValidationError,
  handleValidationErrors
} from '../../shared/middleware';
import { 
  validateApplicationData,
  sanitizeApplicationData,
  canWithdrawApplication,
  canModifyApplication,
  validateApplicationStatusTransition
} from '../utils';

export const validateCreateJobApplication = [
  body('marketplace_job_id ')
    .isInt({ min: 1 })
    .withMessage('Invalid marketplace job ID'),

  body('custom_quote')
    .isFloat({ min: MARKETPLACE_LIMITS.MIN_CUSTOM_QUOTE, max: MARKETPLACE_LIMITS.MAX_CUSTOM_QUOTE })
    .withMessage(`Custom quote must be between $${MARKETPLACE_LIMITS.MIN_CUSTOM_QUOTE} and $${MARKETPLACE_LIMITS.MAX_CUSTOM_QUOTE}`),

  body('proposed_timeline')
    .trim()
    .isLength({ min: MARKETPLACE_LIMITS.APPLICATION_TIMELINE_MIN_LENGTH, max: MARKETPLACE_LIMITS.APPLICATION_TIMELINE_MAX_LENGTH })
    .withMessage(`Proposed timeline must be between ${MARKETPLACE_LIMITS.APPLICATION_TIMELINE_MIN_LENGTH} and ${MARKETPLACE_LIMITS.APPLICATION_TIMELINE_MAX_LENGTH} characters`),

  body('approachDescription')
    .trim()
    .isLength({ min: MARKETPLACE_LIMITS.APPLICATION_APPROACH_MIN_LENGTH, max: MARKETPLACE_LIMITS.APPLICATION_APPROACH_MAX_LENGTH })
    .withMessage(`Approach description must be between ${MARKETPLACE_LIMITS.APPLICATION_APPROACH_MIN_LENGTH} and ${MARKETPLACE_LIMITS.APPLICATION_APPROACH_MAX_LENGTH} characters`),

  body('materialsList')
    .optional()
    .trim()
    .isLength({ max: MARKETPLACE_LIMITS.MATERIALS_LIST_MAX_LENGTH })
    .withMessage(`Materials list must be less than ${MARKETPLACE_LIMITS.MATERIALS_LIST_MAX_LENGTH} characters`),

  body('availabilityDates')
    .isArray({ min: 1, max: MARKETPLACE_LIMITS.MAX_AVAILABILITY_DATES })
    .withMessage(`Must provide 1-${MARKETPLACE_LIMITS.MAX_AVAILABILITY_DATES} availability dates`)
    .custom((dates) => {
      const now = new Date();
      const validDates = dates.every((date: string) => {
        const availDate = new Date(date);
        return availDate > now && !isNaN(availDate.getTime());
      });
      if (!validDates) {
        throw new Error('All availability dates must be valid future dates');
      }
      return true;
    }),

  body('cover_message')
    .optional()
    .trim()
    .isLength({ max: MARKETPLACE_LIMITS.APPLICATION_COVER_MESSAGE_MAX_LENGTH })
    .withMessage(`Cover message must be less than ${MARKETPLACE_LIMITS.APPLICATION_COVER_MESSAGE_MAX_LENGTH} characters`),

  body('relevant_experience')
    .optional()
    .trim()
    .isLength({ max: MARKETPLACE_LIMITS.APPLICATION_EXPERIENCE_MAX_LENGTH })
    .withMessage(`Relevant experience must be less than ${MARKETPLACE_LIMITS.APPLICATION_EXPERIENCE_MAX_LENGTH} characters`),

  body('additional_photos')
    .optional()
    .isArray({ max: MARKETPLACE_LIMITS.MAX_ADDITIONAL_PHOTOS })
    .withMessage(`Maximum ${MARKETPLACE_LIMITS.MAX_ADDITIONAL_PHOTOS} additional photos allowed`)
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

  body('questionsForClient')
    .optional()
    .trim()
    .isLength({ max: MARKETPLACE_LIMITS.APPLICATION_QUESTIONS_MAX_LENGTH })
    .withMessage(`Questions for client must be less than ${MARKETPLACE_LIMITS.APPLICATION_QUESTIONS_MAX_LENGTH} characters`),

  body('specialOffers')
    .optional()
    .trim()
    .isLength({ max: MARKETPLACE_LIMITS.APPLICATION_OFFERS_MAX_LENGTH })
    .withMessage(`Special offers must be less than ${MARKETPLACE_LIMITS.APPLICATION_OFFERS_MAX_LENGTH} characters`),

  handleValidationErrors
];

export const validateUpdateJobApplication = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid application ID'),

  body('custom_quote')
    .optional()
    .isFloat({ min: MARKETPLACE_LIMITS.MIN_CUSTOM_QUOTE, max: MARKETPLACE_LIMITS.MAX_CUSTOM_QUOTE })
    .withMessage(`Custom quote must be between $${MARKETPLACE_LIMITS.MIN_CUSTOM_QUOTE} and $${MARKETPLACE_LIMITS.MAX_CUSTOM_QUOTE}`),

  body('proposed_timeline')
    .optional()
    .trim()
    .isLength({ min: MARKETPLACE_LIMITS.APPLICATION_TIMELINE_MIN_LENGTH, max: MARKETPLACE_LIMITS.APPLICATION_TIMELINE_MAX_LENGTH })
    .withMessage(`Proposed timeline must be between ${MARKETPLACE_LIMITS.APPLICATION_TIMELINE_MIN_LENGTH} and ${MARKETPLACE_LIMITS.APPLICATION_TIMELINE_MAX_LENGTH} characters`),

  body('approachDescription')
    .optional()
    .trim()
    .isLength({ min: MARKETPLACE_LIMITS.APPLICATION_APPROACH_MIN_LENGTH, max: MARKETPLACE_LIMITS.APPLICATION_APPROACH_MAX_LENGTH })
    .withMessage(`Approach description must be between ${MARKETPLACE_LIMITS.APPLICATION_APPROACH_MIN_LENGTH} and ${MARKETPLACE_LIMITS.APPLICATION_APPROACH_MAX_LENGTH} characters`),

  body('materialsList')
    .optional()
    .trim()
    .isLength({ max: MARKETPLACE_LIMITS.MATERIALS_LIST_MAX_LENGTH })
    .withMessage(`Materials list must be less than ${MARKETPLACE_LIMITS.MATERIALS_LIST_MAX_LENGTH} characters`),

  body('availabilityDates')
    .optional()
    .isArray({ min: 1, max: MARKETPLACE_LIMITS.MAX_AVAILABILITY_DATES })
    .withMessage(`Must provide 1-${MARKETPLACE_LIMITS.MAX_AVAILABILITY_DATES} availability dates`)
    .custom((dates) => {
      if (dates) {
        const now = new Date();
        const validDates = dates.every((date: string) => {
          const availDate = new Date(date);
          return availDate > now && !isNaN(availDate.getTime());
        });
        if (!validDates) {
          throw new Error('All availability dates must be valid future dates');
        }
      }
      return true;
    }),

  body('cover_message')
    .optional()
    .trim()
    .isLength({ max: MARKETPLACE_LIMITS.APPLICATION_COVER_MESSAGE_MAX_LENGTH })
    .withMessage(`Cover message must be less than ${MARKETPLACE_LIMITS.APPLICATION_COVER_MESSAGE_MAX_LENGTH} characters`),

  body('relevant_experience')
    .optional()
    .trim()
    .isLength({ max: MARKETPLACE_LIMITS.APPLICATION_EXPERIENCE_MAX_LENGTH })
    .withMessage(`Relevant experience must be less than ${MARKETPLACE_LIMITS.APPLICATION_EXPERIENCE_MAX_LENGTH} characters`),

  body('additional_photos')
    .optional()
    .isArray({ max: MARKETPLACE_LIMITS.MAX_ADDITIONAL_PHOTOS })
    .withMessage(`Maximum ${MARKETPLACE_LIMITS.MAX_ADDITIONAL_PHOTOS} additional photos allowed`),

  body('questionsForClient')
    .optional()
    .trim()
    .isLength({ max: MARKETPLACE_LIMITS.APPLICATION_QUESTIONS_MAX_LENGTH })
    .withMessage(`Questions for client must be less than ${MARKETPLACE_LIMITS.APPLICATION_QUESTIONS_MAX_LENGTH} characters`),

  body('specialOffers')
    .optional()
    .trim()
    .isLength({ max: MARKETPLACE_LIMITS.APPLICATION_OFFERS_MAX_LENGTH })
    .withMessage(`Special offers must be less than ${MARKETPLACE_LIMITS.APPLICATION_OFFERS_MAX_LENGTH} characters`),

  handleValidationErrors
];

export const validateApplicationId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid application ID'),

  handleValidationErrors
];

export const validateApplicationSearch = [
  query('query')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Search query must be less than 200 characters'),

  query('status')
    .optional()
    .isIn(Object.values(APPLICATION_STATUS))
    .withMessage('Invalid application status'),

  query('marketplace_job_id ')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid marketplace job ID'),

  query('tradie_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid tradie ID'),

  query('job_type')
    .optional()
    .isIn(Object.values(MARKETPLACE_JOB_TYPES))
    .withMessage('Invalid job type'),

  query('minQuote')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum quote must be a positive number'),

  query('maxQuote')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Maximum quote must be a positive number'),

  query('location')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Location must be less than 100 characters'),

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

  query('sortBy')
    .optional()
    .isIn(['application_timestamp', 'custom_quote', 'tradie_rating', 'status'])
    .withMessage('Invalid sort field'),

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

  handleValidationErrors
];

export const validateApplicationStatusUpdate = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid application ID'),

  body('status')
    .isIn(Object.values(APPLICATION_STATUS))
    .withMessage('Invalid application status'),

  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason must be less than 500 characters'),

  body('feedback')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Feedback must be less than 1000 characters'),

  handleValidationErrors
];

export const validateApplicationWithdrawal = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid application ID'),

  body('reason')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Withdrawal reason must be between 10 and 500 characters'),

  body('refundCredits')
    .optional()
    .isBoolean()
    .withMessage('refundCredits must be a boolean'),

  handleValidationErrors
];

export const validateBulkApplicationOperation = [
    body('operation')
      .isIn(['approve', 'reject', 'withdraw'])
      .withMessage('Invalid bulk operation'),
  
    body('applicationIds')
      .isArray({ min: 1, max: 50 })
      .withMessage('Application IDs array must contain 1-50 items')
      .custom((applicationIds) => {
        const validIds = applicationIds.every((id: any) => Number.isInteger(id) && id > 0);
        if (!validIds) {
          throw new Error('All application IDs must be positive integers');
        }
        return true;
      }),
  
    body('reason')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Reason must be less than 500 characters'),
  
    body('feedback')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Feedback must be less than 1000 characters'),
  
    body('notifyTradies')
      .optional()
      .isBoolean()
      .withMessage('notifyTradies must be a boolean'),
  
    handleValidationErrors
  ];
  
  export const validateApplicationAnalytics = [
    query('period')
      .optional()
      .isIn(['week', 'month', 'quarter', 'year'])
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
  
    query('tradie_id')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Invalid tradie ID'),
  
    query('job_type')
      .optional()
      .isIn(Object.values(MARKETPLACE_JOB_TYPES))
      .withMessage('Invalid job type'),
  
    handleValidationErrors
  ];
  
  export const validateTradieApplicationAccess = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const applicationId = parseInt(req.params.id);
      const tradie_id = req.user?.id;
      const userRole = req.user?.role;
  
      if (!tradie_id) {
        return res.status(401).json(createValidationError('Authentication required'));
      }
  
      if (userRole !== 'tradie' && userRole !== 'admin') {
        return res.status(403).json(createValidationError('Access denied'));
      }
  
      if (!applicationId || applicationId <= 0) {
        return res.status(400).json(createValidationError('Invalid application ID'));
      }
  
      req.applicationId = applicationId;
      req.tradie_id = tradie_id;
      next();
    } catch (error) {
      return res.status(500).json(createValidationError('Server error during validation'));
    }
  };
  
  export const validateClientApplicationAccess = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const applicationId = parseInt(req.params.id);
      const client_id = req.user?.id;
      const userRole = req.user?.role;
  
      if (!client_id) {
        return res.status(401).json(createValidationError('Authentication required'));
      }
  
      if (userRole !== 'client' && userRole !== 'admin') {
        return res.status(403).json(createValidationError('Access denied'));
      }
  
      if (!applicationId || applicationId <= 0) {
        return res.status(400).json(createValidationError('Invalid application ID'));
      }
  
      req.applicationId = applicationId;
      req.client_id = client_id;
      next();
    } catch (error) {
      return res.status(500).json(createValidationError('Server error during validation'));
    }
  };
  
  export const validateApplicationModificationPermissions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const applicationId = parseInt(req.params.id);
      const userId = req.user?.id;
      const userRole = req.user?.role;
  
      if (!userId) {
        return res.status(401).json(createValidationError('Authentication required'));
      }
  
      if (userRole !== 'tradie' && userRole !== 'admin') {
        return res.status(403).json(createValidationError('Only tradies can modify applications'));
      }
  
      req.applicationId = applicationId;
      req.userId = userId;
      next();
    } catch (error) {
      return res.status(500).json(createValidationError('Server error during permission validation'));
    }
  };
  
  export const sanitizeApplicationInput = (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.body.proposed_timeline) {
        req.body.proposed_timeline = sanitizeString(req.body.proposed_timeline.trim());
      }
  
      if (req.body.approachDescription) {
        req.body.approachDescription = sanitizeString(req.body.approachDescription.trim());
      }
  
      if (req.body.materialsList) {
        req.body.materialsList = sanitizeString(req.body.materialsList.trim());
      }
  
      if (req.body.cover_message) {
        req.body.cover_message = sanitizeString(req.body.cover_message.trim());
      }
  
      if (req.body.relevant_experience) {
        req.body.relevant_experience = sanitizeString(req.body.relevant_experience.trim());
      }
  
      if (req.body.questionsForClient) {
        req.body.questionsForClient = sanitizeString(req.body.questionsForClient.trim());
      }
  
      if (req.body.specialOffers) {
        req.body.specialOffers = sanitizeString(req.body.specialOffers.trim());
      }
  
      if (req.body.reason) {
        req.body.reason = sanitizeString(req.body.reason.trim());
      }
  
      if (req.body.feedback) {
        req.body.feedback = sanitizeString(req.body.feedback.trim());
      }
  
      next();
    } catch (error) {
      return res.status(500).json(createValidationError('Error sanitizing input data'));
    }
  };
  
  export const validateApplicationBusinessRules = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const applicationData = req.body as JobApplicationCreateData;
      const validationResult = validateApplicationData(applicationData);
  
      if (!validationResult.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationResult.errors,
          warnings: validationResult.warnings
        });
      }
  
      if (!validationResult.creditCheck.hasEnoughCredits) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient credits',
          error: 'INSUFFICIENT_CREDITS',
          required: validationResult.creditCheck.requiredCredits,
          current: validationResult.creditCheck.currentBalance,
          shortfall: validationResult.creditCheck.shortfall
        });
      }
  
      if (!validationResult.eligibilityCheck.canApply) {
        return res.status(400).json({
          success: false,
          message: 'Application not allowed',
          error: 'APPLICATION_NOT_ALLOWED',
          reasons: validationResult.eligibilityCheck.reasons
        });
      }
  
      if (validationResult.warnings.length > 0) {
        req.validationWarnings = validationResult.warnings;
      }
  
      req.body = sanitizeApplicationData(applicationData);
      next();
    } catch (error) {
      return res.status(500).json(createValidationError('Error validating business rules'));
    }
  };
  
  export const validateApplicationStatusTransitionRules = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const applicationId = parseInt(req.params.id);
      const newStatus = req.body.status;
      const currentStatus = req.currentApplicationStatus;
  
      if (!currentStatus) {
        return res.status(400).json(createValidationError('Current application status not found'));
      }
  
      const transitionValidation = validateApplicationStatusTransition(currentStatus, newStatus);
      
      if (!transitionValidation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status transition',
          error: transitionValidation.error,
          currentStatus,
          requestedStatus: newStatus
        });
      }
  
      next();
    } catch (error) {
      return res.status(500).json(createValidationError('Error validating status transition'));
    }
  };
  
  export const validateApplicationFilters = (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters: JobApplicationFilters = {
        status: req.query.status as any,
        marketplace_job_id : req.query.marketplace_job_id  ? parseInt(req.query.marketplace_job_id  as string) : undefined,
        tradie_id: req.query.tradie_id ? parseInt(req.query.tradie_id as string) : undefined,
        job_type: req.query.job_type as any,
        dateRange: req.query.startDate && req.query.endDate ? {
          startDate: new Date(req.query.startDate as string),
          endDate: new Date(req.query.endDate as string)
        } : undefined,
        minQuote: req.query.minQuote ? parseFloat(req.query.minQuote as string) : undefined,
        maxQuote: req.query.maxQuote ? parseFloat(req.query.maxQuote as string) : undefined,
        location: req.query.location as string
      };
  
      if (filters.minQuote !== undefined && filters.maxQuote !== undefined && filters.minQuote > filters.maxQuote) {
        return res.status(400).json(createValidationError('Minimum quote cannot be greater than maximum quote'));
      }
  
      if (filters.dateRange && filters.dateRange.startDate > filters.dateRange.endDate) {
        return res.status(400).json(createValidationError('Start date cannot be after end date'));
      }
  
      req.applicationFilters = filters;
      next();
    } catch (error) {
      return res.status(500).json(createValidationError('Error validating application filters'));
    }
  };
  
  export const validateApplicationOwnership = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const applicationId = parseInt(req.params.id);
      const userId = req.user?.id;
      const userRole = req.user?.role;
  
      if (userRole === 'admin') {
        return next();
      }
  
      if (userRole === 'tradie') {
        req.ownershipValidated = true;
        return next();
      }
  
      if (userRole === 'client') {
        req.ownershipValidated = true;
        return next();
      }
  
      return res.status(403).json(createValidationError('Access denied'));
    } catch (error) {
      return res.status(500).json(createValidationError('Error validating application ownership'));
    }
  };
  
  export const validateCreditBalance = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tradie_id = req.user?.id;
      const marketplace_job_id  = req.body.marketplace_job_id ;
  
      if (!tradie_id) {
        return res.status(401).json(createValidationError('Authentication required'));
      }
  
      req.creditValidationRequired = {
        tradie_id,
        marketplace_job_id 
      };
  
      next();
    } catch (error) {
      return res.status(500).json(createValidationError('Error validating credit balance'));
    }
  };
  
  export const validateDuplicateApplication = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tradie_id = req.user?.id;
      const marketplace_job_id  = req.body.marketplace_job_id ;
  
      if (!tradie_id || !marketplace_job_id ) {
        return res.status(400).json(createValidationError('Missing required data for duplicate check'));
      }
  
      req.duplicateCheckRequired = {
        tradie_id,
        marketplace_job_id 
      };
  
      next();
    } catch (error) {
      return res.status(500).json(createValidationError('Error validating duplicate application'));
    }
  };
  
  export const validateApplicationDeadlines = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const applicationId = parseInt(req.params.id);
      const operation = req.body.operation || req.method.toLowerCase();
  
      req.deadlineValidationRequired = {
        applicationId,
        operation
      };
  
      next();
    } catch (error) {
      return res.status(500).json(createValidationError('Error validating application deadlines'));
    }
  };
  