import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { JOB_CONSTANTS, CLIENT_CONSTANTS, MATERIAL_CONSTANTS } from '../../config/jobs';
import { ValidationAppError, sendValidationError } from '../../shared/utils';
import { logger } from '../../shared/utils';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export const updateJobValidationRules = () => {
  return [
    body('title')
      .optional()
      .trim()
      .isLength({ min: JOB_CONSTANTS.VALIDATION.TITLE_MIN_LENGTH })
      .withMessage(`Title must be at least ${JOB_CONSTANTS.VALIDATION.TITLE_MIN_LENGTH} characters long`)
      .isLength({ max: JOB_CONSTANTS.VALIDATION.TITLE_MAX_LENGTH })
      .withMessage(`Title cannot exceed ${JOB_CONSTANTS.VALIDATION.TITLE_MAX_LENGTH} characters`),

    body('description')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Description cannot be empty')
      .isLength({ max: JOB_CONSTANTS.VALIDATION.DESCRIPTION_MAX_LENGTH })
      .withMessage(`Description cannot exceed ${JOB_CONSTANTS.VALIDATION.DESCRIPTION_MAX_LENGTH} characters`),

    body('status')
      .optional()
      .isIn(Object.values(JOB_CONSTANTS.STATUS))
      .withMessage('Invalid job status'),

    body('priority')
      .optional()
      .isIn(Object.values(JOB_CONSTANTS.PRIORITY))
      .withMessage('Invalid priority level'),

    body('clientName')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Client name cannot be empty')
      .isLength({ min: CLIENT_CONSTANTS.VALIDATION.NAME_MIN_LENGTH })
      .withMessage(`Client name must be at least ${CLIENT_CONSTANTS.VALIDATION.NAME_MIN_LENGTH} characters`)
      .isLength({ max: CLIENT_CONSTANTS.VALIDATION.NAME_MAX_LENGTH })
      .withMessage(`Client name cannot exceed ${CLIENT_CONSTANTS.VALIDATION.NAME_MAX_LENGTH} characters`),

    body('clientEmail')
      .optional()
      .trim()
      .isEmail()
      .withMessage('Valid client email is required')
      .isLength({ max: CLIENT_CONSTANTS.VALIDATION.EMAIL_MAX_LENGTH })
      .withMessage(`Client email cannot exceed ${CLIENT_CONSTANTS.VALIDATION.EMAIL_MAX_LENGTH} characters`)
      .normalizeEmail(),

    body('clientPhone')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Client phone cannot be empty')
      .isLength({ min: CLIENT_CONSTANTS.VALIDATION.PHONE_MIN_LENGTH })
      .withMessage(`Client phone must be at least ${CLIENT_CONSTANTS.VALIDATION.PHONE_MIN_LENGTH} characters`)
      .isLength({ max: CLIENT_CONSTANTS.VALIDATION.PHONE_MAX_LENGTH })
      .withMessage(`Client phone cannot exceed ${CLIENT_CONSTANTS.VALIDATION.PHONE_MAX_LENGTH} characters`)
      .matches(/^[\d\s\-\+\(\)]+$/)
      .withMessage('Invalid phone number format'),

    body('clientCompany')
      .optional()
      .trim()
      .isLength({ max: CLIENT_CONSTANTS.VALIDATION.COMPANY_MAX_LENGTH })
      .withMessage(`Client company cannot exceed ${CLIENT_CONSTANTS.VALIDATION.COMPANY_MAX_LENGTH} characters`),

    body('siteAddress')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Site address cannot be empty')
      .isLength({ max: CLIENT_CONSTANTS.VALIDATION.ADDRESS_MAX_LENGTH })
      .withMessage(`Site address cannot exceed ${CLIENT_CONSTANTS.VALIDATION.ADDRESS_MAX_LENGTH} characters`),

    body('siteCity')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Site city cannot be empty')
      .isLength({ max: 100 })
      .withMessage('Site city cannot exceed 100 characters'),

    body('siteState')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Site state cannot be empty')
      .isLength({ max: 50 })
      .withMessage('Site state cannot exceed 50 characters'),

    body('sitePostcode')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Site postcode cannot be empty')
      .isLength({ max: 20 })
      .withMessage('Site postcode cannot exceed 20 characters')
      .matches(/^[A-Za-z0-9\s\-]+$/)
      .withMessage('Invalid postcode format'),

    body('siteAccessInstructions')
      .optional()
      .trim()
      .isLength({ max: CLIENT_CONSTANTS.VALIDATION.NOTES_MAX_LENGTH })
      .withMessage(`Site access instructions cannot exceed ${CLIENT_CONSTANTS.VALIDATION.NOTES_MAX_LENGTH} characters`),

    body('startDate')
      .optional()
      .isISO8601()
      .withMessage('Invalid start date format')
      .custom((value, { req }) => {
        if (req.body.dueDate) {
          const startDate = new Date(value);
          const dueDate = new Date(req.body.dueDate);
          
          if (startDate >= dueDate) {
            throw new Error('Start date must be before due date');
          }
        }
        return true;
      }),

    body('dueDate')
      .optional()
      .isISO8601()
      .withMessage('Invalid due date format')
      .custom((value, { req }) => {
        if (req.body.startDate) {
          const dueDate = new Date(value);
          const startDate = new Date(req.body.startDate);
          
          if (dueDate <= startDate) {
            throw new Error('Due date must be after start date');
          }
        }
        return true;
      }),

    body('estimatedDuration')
      .optional()
      .isFloat({ 
        min: JOB_CONSTANTS.VALIDATION.MIN_ESTIMATED_DURATION, 
        max: JOB_CONSTANTS.VALIDATION.MAX_ESTIMATED_DURATION 
      })
      .withMessage(`Estimated duration must be between ${JOB_CONSTANTS.VALIDATION.MIN_ESTIMATED_DURATION} and ${JOB_CONSTANTS.VALIDATION.MAX_ESTIMATED_DURATION} hours`),

    body('hoursWorked')
      .optional()
      .isFloat({ 
        min: JOB_CONSTANTS.VALIDATION.MIN_HOURS_WORKED, 
        max: JOB_CONSTANTS.VALIDATION.MAX_HOURS_WORKED 
      })
      .withMessage(`Hours worked must be between ${JOB_CONSTANTS.VALIDATION.MIN_HOURS_WORKED} and ${JOB_CONSTANTS.VALIDATION.MAX_HOURS_WORKED}`),

    body('notes')
      .optional()
      .isArray()
      .withMessage('Notes must be an array'),

    body('notes.*')
      .if(body('notes').exists())
      .trim()
      .isLength({ max: CLIENT_CONSTANTS.VALIDATION.NOTES_MAX_LENGTH })
      .withMessage(`Each note cannot exceed ${CLIENT_CONSTANTS.VALIDATION.NOTES_MAX_LENGTH} characters`),

    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array')
      .custom((tags) => {
        if (tags && tags.length > CLIENT_CONSTANTS.VALIDATION.MAX_TAGS) {
          throw new Error(`Maximum ${CLIENT_CONSTANTS.VALIDATION.MAX_TAGS} tags allowed`);
        }
        return true;
      }),

    body('tags.*')
      .if(body('tags').exists())
      .isIn(Object.values(JOB_CONSTANTS.TAGS))
      .withMessage('Invalid job tag')
  ];
};

export const validateUpdateJob = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const validationErrors = errors.array().map(error => ({
      field: error.type === 'field' ? (error as any).path : 'unknown',
      message: error.msg,
      code: JOB_CONSTANTS.ERROR_CODES.INVALID_JOB_STATUS
    }));

    logger.warn('Job update validation failed', {
      tradieId: req.user?.id,
      jobId: req.params.id,
      errors: validationErrors,
      requestBody: {
        title: req.body.title,
        status: req.body.status,
        updatedFields: Object.keys(req.body)
      }
    });

    sendValidationError(res, 'Job validation failed', validationErrors);
    return;
  }

  logger.info('Job update validation passed', {
    tradieId: req.user?.id,
    jobId: req.params.id,
    updatedFields: Object.keys(req.body)
  });

  next();
};

export const updateJobStatusValidationRules = () => {
  return [
    body('status')
      .notEmpty()
      .withMessage('Status is required')
      .isIn(Object.values(JOB_CONSTANTS.STATUS))
      .withMessage('Invalid job status')
  ];
};

export const validateUpdateJobStatus = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const validationErrors = errors.array().map(error => ({
      field: error.type === 'field' ? (error as any).path : 'unknown',
      message: error.msg,
      code: JOB_CONSTANTS.ERROR_CODES.INVALID_JOB_STATUS
    }));

    logger.warn('Job status update validation failed', {
      tradieId: req.user?.id,
      jobId: req.params.id,
      errors: validationErrors,
      requestBody: req.body
    });

    sendValidationError(res, 'Status validation failed', validationErrors);
    return;
  }

  logger.info('Job status update validation passed', {
    tradieId: req.user?.id,
    jobId: req.params.id,
    newStatus: req.body.status
  });

  next();
};

export const addMaterialValidationRules = () => {
  return [
    body('materials')
      .isArray({ min: 1 })
      .withMessage('At least one material is required')
      .custom((materials) => {
        if (materials.length > JOB_CONSTANTS.VALIDATION.MAX_MATERIALS_PER_JOB) {
          throw new Error(`Maximum ${JOB_CONSTANTS.VALIDATION.MAX_MATERIALS_PER_JOB} materials allowed per job`);
        }
        return true;
      }),

    body('materials.*.name')
      .trim()
      .notEmpty()
      .withMessage('Material name is required')
      .isLength({ 
        min: MATERIAL_CONSTANTS.VALIDATION.NAME_MIN_LENGTH,
        max: MATERIAL_CONSTANTS.VALIDATION.NAME_MAX_LENGTH 
      })
      .withMessage(`Material name must be between ${MATERIAL_CONSTANTS.VALIDATION.NAME_MIN_LENGTH} and ${MATERIAL_CONSTANTS.VALIDATION.NAME_MAX_LENGTH} characters`),

    body('materials.*.quantity')
      .notEmpty()
      .withMessage('Material quantity is required')
      .isFloat({ 
        min: MATERIAL_CONSTANTS.VALIDATION.MIN_QUANTITY,
        max: MATERIAL_CONSTANTS.VALIDATION.MAX_QUANTITY 
      })
      .withMessage(`Material quantity must be between ${MATERIAL_CONSTANTS.VALIDATION.MIN_QUANTITY} and ${MATERIAL_CONSTANTS.VALIDATION.MAX_QUANTITY}`),

    body('materials.*.unit')
      .notEmpty()
      .withMessage('Material unit is required')
      .isIn(Object.values(JOB_CONSTANTS.MATERIAL_UNITS))
      .withMessage('Invalid material unit'),

    body('materials.*.unitCost')
      .notEmpty()
      .withMessage('Material unit cost is required')
      .isFloat({ 
        min: MATERIAL_CONSTANTS.VALIDATION.MIN_UNIT_COST,
        max: MATERIAL_CONSTANTS.VALIDATION.MAX_UNIT_COST 
      })
      .withMessage(`Material unit cost must be between ${MATERIAL_CONSTANTS.VALIDATION.MIN_UNIT_COST} and ${MATERIAL_CONSTANTS.VALIDATION.MAX_UNIT_COST}`),

    body('materials.*.supplier')
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Material supplier cannot exceed 200 characters')
  ];
};

export const validateAddMaterial = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const validationErrors = errors.array().map(error => ({
      field: error.type === 'field' ? (error as any).path : 'unknown',
      message: error.msg,
      code: JOB_CONSTANTS.ERROR_CODES.INVALID_MATERIAL_UNIT
    }));

    logger.warn('Material validation failed', {
      tradieId: req.user?.id,
      jobId: req.params.id,
      errors: validationErrors,
      materialCount: req.body.materials?.length || 0
    });

    sendValidationError(res, 'Material validation failed', validationErrors);
    return;
  }

  logger.info('Material validation passed', {
    tradieId: req.user?.id,
    jobId: req.params.id,
    materialCount: req.body.materials?.length || 0
  });

  next();
};

export const updateMaterialValidationRules = () => {
  return [
    body('name')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Material name cannot be empty')
      .isLength({ 
        min: MATERIAL_CONSTANTS.VALIDATION.NAME_MIN_LENGTH,
        max: MATERIAL_CONSTANTS.VALIDATION.NAME_MAX_LENGTH 
      })
      .withMessage(`Material name must be between ${MATERIAL_CONSTANTS.VALIDATION.NAME_MIN_LENGTH} and ${MATERIAL_CONSTANTS.VALIDATION.NAME_MAX_LENGTH} characters`),

    body('quantity')
      .optional()
      .isFloat({ 
        min: MATERIAL_CONSTANTS.VALIDATION.MIN_QUANTITY,
        max: MATERIAL_CONSTANTS.VALIDATION.MAX_QUANTITY 
      })
      .withMessage(`Material quantity must be between ${MATERIAL_CONSTANTS.VALIDATION.MIN_QUANTITY} and ${MATERIAL_CONSTANTS.VALIDATION.MAX_QUANTITY}`),

    body('unit')
      .optional()
      .isIn(Object.values(JOB_CONSTANTS.MATERIAL_UNITS))
      .withMessage('Invalid material unit'),

    body('unitCost')
      .optional()
      .isFloat({ 
        min: MATERIAL_CONSTANTS.VALIDATION.MIN_UNIT_COST,
        max: MATERIAL_CONSTANTS.VALIDATION.MAX_UNIT_COST 
      })
      .withMessage(`Material unit cost must be between ${MATERIAL_CONSTANTS.VALIDATION.MIN_UNIT_COST} and ${MATERIAL_CONSTANTS.VALIDATION.MAX_UNIT_COST}`),

    body('supplier')
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Material supplier cannot exceed 200 characters')
  ];
};

export const validateUpdateMaterial = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const validationErrors = errors.array().map(error => ({
      field: error.type === 'field' ? (error as any).path : 'unknown',
      message: error.msg,
      code: JOB_CONSTANTS.ERROR_CODES.INVALID_MATERIAL_UNIT
    }));

    logger.warn('Material update validation failed', {
      tradieId: req.user?.id,
      jobId: req.params.id,
      materialId: req.params.materialId,
      errors: validationErrors,
      updatedFields: Object.keys(req.body)
    });

    sendValidationError(res, 'Material validation failed', validationErrors);
    return;
  }

  logger.info('Material update validation passed', {
    tradieId: req.user?.id,
    jobId: req.params.id,
    materialId: req.params.materialId,
    updatedFields: Object.keys(req.body)
  });

  next();
};
