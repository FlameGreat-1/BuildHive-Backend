import { Router } from 'express';
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
import { body } from 'express-validator';
import { CLIENT_CONSTANTS } from '../../config/jobs';

const router = Router();

router.use(requireTradieRole);
router.use(requestLogger);
router.use(generalJobRateLimit);

const createClientValidationRules = () => [
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
    .custom((tags) => {
      if (tags && tags.length > CLIENT_CONSTANTS.VALIDATION.MAX_TAGS) {
        throw new Error(`Maximum ${CLIENT_CONSTANTS.VALIDATION.MAX_TAGS} tags allowed`);
      }
      return true;
    })
];

const updateClientValidationRules = () => [
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
    .custom((tags) => {
      if (tags && tags.length > CLIENT_CONSTANTS.VALIDATION.MAX_TAGS) {
        throw new Error(`Maximum ${CLIENT_CONSTANTS.VALIDATION.MAX_TAGS} tags allowed`);
      }
      return true;
    })
];

router.post(
  '/',
  createClientValidationRules(),
  handleValidationErrors,
  auditLogger('create_client'),
  asyncErrorHandler(clientController.createClient.bind(clientController))
);

router.get(
  '/',
  validatePaginationParams,
  auditLogger('list_clients'),
  asyncErrorHandler(clientController.getClients.bind(clientController))
);

router.get(
  '/vip',
  auditLogger('get_vip_clients'),
  asyncErrorHandler(clientController.getVIPClients.bind(clientController))
);

router.get(
  '/recent',
  auditLogger('get_recent_clients'),
  asyncErrorHandler(clientController.getRecentClients.bind(clientController))
);

router.get(
  '/inactive',
  auditLogger('get_inactive_clients'),
  asyncErrorHandler(clientController.getInactiveClients.bind(clientController))
);

router.get(
  '/search',
  auditLogger('search_clients'),
  asyncErrorHandler(clientController.searchClients.bind(clientController))
);

router.get(
  '/:id',
  validateClientId,
  auditLogger('get_client'),
  asyncErrorHandler(clientController.getClientById.bind(clientController))
);

router.get(
  '/:id/jobs',
  validateClientId,
  auditLogger('get_client_jobs'),
  asyncErrorHandler(clientController.getClientJobs.bind(clientController))
);

router.put(
  '/:id',
  validateClientId,
  updateClientValidationRules(),
  handleValidationErrors,
  auditLogger('update_client'),
  asyncErrorHandler(clientController.updateClient.bind(clientController))
);

router.delete(
  '/:id',
  validateClientId,
  auditLogger('delete_client'),
  asyncErrorHandler(clientController.deleteClient.bind(clientController))
);

export default router;
