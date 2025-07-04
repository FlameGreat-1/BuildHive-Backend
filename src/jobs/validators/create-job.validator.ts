import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { JOB_CONSTANTS, CLIENT_CONSTANTS, MATERIAL_CONSTANTS } from '../../config/jobs';
import { ValidationError, sendValidationError } from '../../shared/utils';
import { logger } from '../../shared/utils';

export const createJobValidationRules = () => {
  return [
    body('title')
      .trim()
      .isLength({ min: JOB_CONSTANTS.VALIDATION.TITLE_MIN_LENGTH })
      .withMessage(`Title must be at least ${JOB_CONSTANTS.VALIDATION.TITLE_MIN_LENGTH} characters long`)
      .isLength({ max: JOB_CONSTANTS.VALIDATION.TITLE_MAX_LENGTH })
      .withMessage(`Title cannot exceed ${JOB_CONSTANTS.VALIDATION.TITLE_MAX_LENGTH} characters`)
      .notEmpty()
      .withMessage('Title is required'),

    body('description')
      .trim()
      .notEmpty()
      .withMessage('Description is required')
      .isLength({ max: JOB_CONSTANTS.VALIDATION.DESCRIPTION_MAX_LENGTH })
      .withMessage(`Description cannot exceed ${JOB_CONSTANTS.VALIDATION.DESCRIPTION_MAX_LENGTH} characters`),

    body('jobType')
      .notEmpty()
      .withMessage('Job type is required')
      .isIn(Object.values(JOB_CONSTANTS.TYPES))
      .withMessage('Invalid job type'),

    body('priority')
      .notEmpty()
      .withMessage('Priority is required')
      .isIn(Object.values(JOB_CONSTANTS.PRIORITY))
      .withMessage('Invalid priority level'),

    body('clientName')
      .trim()
      .notEmpty()
      .withMessage('Client name is required')
      .isLength({ max: JOB_CONSTANTS.VALIDATION.CLIENT_NAME_MAX_LENGTH })
      .withMessage(`Client name cannot exceed ${JOB_CONSTANTS.VALIDATION.CLIENT_NAME_MAX_LENGTH} characters`),

    body('clientEmail')
      .trim()
      .notEmpty()
      .withMessage('Client email is required')
      .isEmail()
      .withMessage('Valid client email is required')
      .isLength({ max: JOB_CONSTANTS.VALIDATION.EMAIL_MAX_LENGTH })
      .withMessage(`Client email cannot exceed ${JOB_CONSTANTS.VALIDATION.EMAIL_MAX_LENGTH} characters`)
      .normalizeEmail(),

    body('clientPhone')
      .trim()
      .notEmpty()
      .withMessage('Client phone is required')
      .isLength({ max: JOB_CONSTANTS.VALIDATION.PHONE_MAX_LENGTH })
      .withMessage(`Client phone cannot exceed ${JOB_CONSTANTS.VALIDATION.PHONE_MAX_LENGTH} characters`)
      .matches(/^[\d\s\-\+\(\)]+$/)
      .withMessage('Invalid phone number format'),

    body('clientCompany')
      .optional()
      .trim()
      .isLength({ max: JOB_CONSTANTS.VALIDATION.COMPANY_NAME_MAX_LENGTH })
      .withMessage(`Client company cannot exceed ${JOB_CONSTANTS.VALIDATION.COMPANY_NAME_MAX_LENGTH} characters`),

    body('siteAddress')
      .trim()
      .notEmpty()
      .withMessage('Site address is required')
      .isLength({ max: JOB_CONSTANTS.VALIDATION.ADDRESS_MAX_LENGTH })
      .withMessage(`Site address cannot exceed ${JOB_CONSTANTS.VALIDATION.ADDRESS_MAX_LENGTH} characters`),

    body('siteCity')
      .trim()
      .notEmpty()
      .withMessage('Site city is required')
      .isLength({ max: JOB_CONSTANTS.VALIDATION.CITY_MAX_LENGTH })
      .withMessage(`Site city cannot exceed ${JOB_CONSTANTS.VALIDATION.CITY_MAX_LENGTH} characters`),

    body('siteState')
      .trim()
      .notEmpty()
      .withMessage('Site state is required')
      .isLength({ max: JOB_CONSTANTS.VALIDATION.STATE_MAX_LENGTH })
      .withMessage(`Site state cannot exceed ${JOB_CONSTANTS.VALIDATION.STATE_MAX_LENGTH} characters`),

    body('sitePostcode')
      .trim()
      .notEmpty()
      .withMessage('Site postcode is required')
      .isLength({ max: JOB_CONSTANTS.VALIDATION.POSTCODE_MAX_LENGTH })
      .withMessage(`Site postcode cannot exceed ${JOB_CONSTANTS.VALIDATION.POSTCODE_MAX_LENGTH} characters`)
      .matches(/^[A-Za-z0-9\s\-]+$/)
      .withMessage('Invalid postcode format'),

    body('siteAccessInstructions')
      .optional()
      .trim()
      .isLength({ max: JOB_CONSTANTS.VALIDATION.NOTES_MAX_LENGTH })
      .withMessage(`Site access instructions cannot exceed ${JOB_CONSTANTS.VALIDATION.NOTES_MAX_LENGTH} characters`),

    body('startDate')
      .notEmpty()
      .withMessage('Start date is required')
      .isISO8601()
      .withMessage('Invalid start date format')
      .custom((value) => {
        const startDate = new Date(value);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        
        if (startDate < now) {
          throw new Error('Start date cannot be in the past');
        }
        return true;
      }),

    body('dueDate')
      .notEmpty()
      .withMessage('Due date is required')
      .isISO8601()
      .withMessage('Invalid due date format')
      .custom((value, { req }) => {
        const dueDate = new Date(value);
        const startDate = new Date(req.body.startDate);
        
        if (dueDate <= startDate) {
          throw new Error('Due date must be after start date');
        }
        return true;
      }),

    body('estimatedDuration')
      .notEmpty()
      .withMessage('Estimated duration is required')
      .isFloat({ 
        min: JOB_CONSTANTS.VALIDATION.MIN_ESTIMATED_DURATION, 
        max: JOB_CONSTANTS.VALIDATION.MAX_ESTIMATED_DURATION 
      })
      .withMessage(`Estimated duration must be between ${JOB_CONSTANTS.VALIDATION.MIN_ESTIMATED_DURATION} and ${JOB_CONSTANTS.VALIDATION.MAX_ESTIMATED_DURATION} hours`),

    body('materials')
      .optional()
      .isArray()
      .withMessage('Materials must be an array')
      .custom((materials) => {
        if (materials && materials.length > JOB_CONSTANTS.VALIDATION.MAX_MATERIALS_PER_JOB) {
          throw new Error(`Maximum ${JOB_CONSTANTS.VALIDATION.MAX_MATERIALS_PER_JOB} materials allowed per job`);
        }
        return true;
      }),

    body('materials.*.name')
      .if(body('materials').exists())
      .trim()
      .notEmpty()
      .withMessage('Material name is required')
      .isLength({ 
        min: MATERIAL_CONSTANTS.VALIDATION.NAME_MIN_LENGTH,
        max: MATERIAL_CONSTANTS.VALIDATION.NAME_MAX_LENGTH 
      })
      .withMessage(`Material name must be between ${MATERIAL_CONSTANTS.VALIDATION.NAME_MIN_LENGTH} and ${MATERIAL_CONSTANTS.VALIDATION.NAME_MAX_LENGTH} characters`),

    body('materials.*.quantity')
      .if(body('materials').exists())
      .notEmpty()
      .withMessage('Material quantity is required')
      .isFloat({ 
        min: MATERIAL_CONSTANTS.VALIDATION.MIN_QUANTITY,
        max: MATERIAL_CONSTANTS.VALIDATION.MAX_QUANTITY 
      })
      .withMessage(`Material quantity must be between ${MATERIAL_CONSTANTS.VALIDATION.MIN_QUANTITY} and ${MATERIAL_CONSTANTS.VALIDATION.MAX_QUANTITY}`),

    body('materials.*.unit')
      .if(body('materials').exists())
      .notEmpty()
      .withMessage('Material unit is required')
      .isIn(Object.values(JOB_CONSTANTS.MATERIAL_UNITS))
      .withMessage('Invalid material unit'),

    body('materials.*.unitCost')
      .if(body('materials').exists())
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
      .isLength({ max: MATERIAL_CONSTANTS.VALIDATION.SUPPLIER_MAX_LENGTH })
      .withMessage(`Material supplier cannot exceed ${MATERIAL_CONSTANTS.VALIDATION.SUPPLIER_MAX_LENGTH} characters`),

    body('notes')
      .optional()
      .isArray()
      .withMessage('Notes must be an array'),

    body('notes.*')
      .if(body('notes').exists())
      .trim()
      .isLength({ max: JOB_CONSTANTS.VALIDATION.NOTES_MAX_LENGTH })
      .withMessage(`Each note cannot exceed ${JOB_CONSTANTS.VALIDATION.NOTES_MAX_LENGTH} characters`)
  ];
};

export const validateCreateJob = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const validationErrors: ValidationError[] = errors.array().map(error => ({
      field: error.param || error.type || 'unknown',
      message: error.msg,
      code: JOB_CONSTANTS.ERROR_CODES.INVALID_JOB_STATUS
    }));

    logger.warn('Job creation validation failed', {
      tradieId: req.user?.id,
      errors: validationErrors,
      requestBody: req.body
    });

    sendValidationError(res, 'Job validation failed', validationErrors);
    return;
  }

  logger.info('Job creation validation passed', {
    tradieId: req.user?.id,
    title: req.body.title
  });

  next();
};
