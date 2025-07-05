import { Router, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { clientController } from '../controllers';
import {
  requireTradieRole,
  validateClientId,
  validatePaginationParams,
  generalJobRateLimit,
  requestLogger,
  auditLogger,
  asyncErrorHandler,
  handleValidationErrors
} from '../middleware';
import { body, ValidationChain } from 'express-validator';
import { CLIENT_CONSTANTS } from '../../config/jobs';

const router = Router();

// Global middleware
router.use(requireTradieRole);
router.use(requestLogger);
router.use(generalJobRateLimit);

// Client validation rules
const createClientValidationRules = (): ValidationChain[] => [
  body('name')
    .trim()
    .isLength({ min: CLIENT_CONSTANTS.VALIDATION.NAME_MIN_LENGTH })
    .withMessage(`Name must be at least ${CLIENT_CONSTANTS.VALIDATION.NAME_MIN_LENGTH} characters long`)
    .isLength({ max: CLIENT_CONSTANTS.VALIDATION.NAME_MAX_LENGTH })
    .withMessage(`Name cannot exceed ${CLIENT_CONSTANTS.VALIDATION.NAME_MAX_LENGTH} characters`),

  body('email')
    .trim()
    .isEmail()
    .withMessage('Valid email is required')
    .isLength({ max: CLIENT_CONSTANTS.VALIDATION.EMAIL_MAX_LENGTH })
    .withMessage(`Email cannot exceed ${CLIENT_CONSTANTS.VALIDATION.EMAIL_MAX_LENGTH} characters`)
    .normalizeEmail(),

  body('phone')
    .trim()
    .isLength({ min: CLIENT_CONSTANTS.VALIDATION.PHONE_MIN_LENGTH })
    .withMessage(`Phone must be at least ${CLIENT_CONSTANTS.VALIDATION.PHONE_MIN_LENGTH} characters long`)
    .isLength({ max: CLIENT_CONSTANTS.VALIDATION.PHONE_MAX_LENGTH })
    .withMessage(`Phone cannot exceed ${CLIENT_CONSTANTS.VALIDATION.PHONE_MAX_LENGTH} characters`),

  body('company')
    .optional()
    .trim()
    .isLength({ max: CLIENT_CONSTANTS.VALIDATION.COMPANY_MAX_LENGTH })
    .withMessage(`Company cannot exceed ${CLIENT_CONSTANTS.VALIDATION.COMPANY_MAX_LENGTH} characters`),

  body('address')
    .optional()
    .trim()
    .isLength({ max: CLIENT_CONSTANTS.VALIDATION.ADDRESS_MAX_LENGTH })
    .withMessage(`Address cannot exceed ${CLIENT_CONSTANTS.VALIDATION.ADDRESS_MAX_LENGTH} characters`),

  body('city')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('City cannot exceed 100 characters'),

  body('state')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('State cannot exceed 50 characters'),

  body('postcode')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Postcode cannot exceed 20 characters'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: CLIENT_CONSTANTS.VALIDATION.NOTES_MAX_LENGTH })
    .withMessage(`Notes cannot exceed ${CLIENT_CONSTANTS.VALIDATION.NOTES_MAX_LENGTH} characters`),

  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array')
    .custom((tags: any[]) => {
      if (tags && tags.length > CLIENT_CONSTANTS.VALIDATION.MAX_TAGS) {
        throw new Error(`Maximum ${CLIENT_CONSTANTS.VALIDATION.MAX_TAGS} tags allowed`);
      }
      return true;
    })
];

const updateClientValidationRules = (): ValidationChain[] => [
  body('name')
    .optional()
    .trim()
    .isLength({ min: CLIENT_CONSTANTS.VALIDATION.NAME_MIN_LENGTH })
    .withMessage(`Name must be at least ${CLIENT_CONSTANTS.VALIDATION.NAME_MIN_LENGTH} characters long`)
    .isLength({ max: CLIENT_CONSTANTS.VALIDATION.NAME_MAX_LENGTH })
    .withMessage(`Name cannot exceed ${CLIENT_CONSTANTS.VALIDATION.NAME_MAX_LENGTH} characters`),

  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Valid email is required')
    .isLength({ max: CLIENT_CONSTANTS.VALIDATION.EMAIL_MAX_LENGTH })
    .withMessage(`Email cannot exceed ${CLIENT_CONSTANTS.VALIDATION.EMAIL_MAX_LENGTH} characters`)
    .normalizeEmail(),

  body('phone')
    .optional()
    .trim()
    .isLength({ min: CLIENT_CONSTANTS.VALIDATION.PHONE_MIN_LENGTH })
    .withMessage(`Phone must be at least ${CLIENT_CONSTANTS.VALIDATION.PHONE_MIN_LENGTH} characters long`)
    .isLength({ max: CLIENT_CONSTANTS.VALIDATION.PHONE_MAX_LENGTH })
    .withMessage(`Phone cannot exceed ${CLIENT_CONSTANTS.VALIDATION.PHONE_MAX_LENGTH} characters`),

  body('company')
    .optional()
    .trim()
    .isLength({ max: CLIENT_CONSTANTS.VALIDATION.COMPANY_MAX_LENGTH })
    .withMessage(`Company cannot exceed ${CLIENT_CONSTANTS.VALIDATION.COMPANY_MAX_LENGTH} characters`),

  body('address')
    .optional()
    .trim()
    .isLength({ max: CLIENT_CONSTANTS.VALIDATION.ADDRESS_MAX_LENGTH })
    .withMessage(`Address cannot exceed ${CLIENT_CONSTANTS.VALIDATION.ADDRESS_MAX_LENGTH} characters`),

  body('city')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('City cannot exceed 100 characters'),

  body('state')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('State cannot exceed 50 characters'),

  body('postcode')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Postcode cannot exceed 20 characters'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: CLIENT_CONSTANTS.VALIDATION.NOTES_MAX_LENGTH })
    .withMessage(`Notes cannot exceed ${CLIENT_CONSTANTS.VALIDATION.NOTES_MAX_LENGTH} characters`),

  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array')
    .custom((tags: any[]) => {
      if (tags && tags.length > CLIENT_CONSTANTS.VALIDATION.MAX_TAGS) {
        throw new Error(`Maximum ${CLIENT_CONSTANTS.VALIDATION.MAX_TAGS} tags allowed`);
      }
      return true;
    })
];

// Create client
router.post(
  '/',
  createClientValidationRules(),
  handleValidationErrors,
  auditLogger('create_client'),
  asyncErrorHandler(clientController.createClient as any)
);

// Get clients with pagination
router.get(
  '/',
  validatePaginationParams,
  auditLogger('list_clients'),
  asyncErrorHandler(clientController.getClients as any)
);

// Get VIP clients
router.get(
  '/vip',
  auditLogger('get_vip_clients'),
  asyncErrorHandler(clientController.getVIPClients as any)
);

// Get recent clients
router.get(
  '/recent',
  auditLogger('get_recent_clients'),
  asyncErrorHandler(clientController.getRecentClients as any)
);

// Get inactive clients
router.get(
  '/inactive',
  auditLogger('get_inactive_clients'),
  asyncErrorHandler(clientController.getInactiveClients as any)
);

// Get client by ID
router.get(
  '/:id',
  validateClientId,
  auditLogger('get_client'),
  asyncErrorHandler(clientController.getClientById as any)
);

// Update client
router.put(
  '/:id',
  validateClientId,
  updateClientValidationRules(),
  handleValidationErrors,
  auditLogger('update_client'),
  asyncErrorHandler(clientController.updateClient as any)
);

// Delete client
router.delete(
  '/:id',
  validateClientId,
  auditLogger('delete_client'),
  asyncErrorHandler(clientController.deleteClient as any)
);

export default router;
