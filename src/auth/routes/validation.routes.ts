import { Router } from 'express';
import { ValidationController } from '../controllers';
import { 
  validateEmailAvailability, 
  validateUsernameAvailability 
} from '../validators';
import { 
  handleValidationErrors,
  validateContentType,
  sanitizeRegistrationInput
} from '../middleware';
import { strictRateLimit } from '../../shared/middleware';

const router = Router();
const validationController = new ValidationController();

// Check Email Availability Route
router.post(
  '/email/availability',
  strictRateLimit,
  validateContentType,
  sanitizeRegistrationInput,
  validateEmailAvailability(),
  handleValidationErrors,
  validationController.checkEmailAvailability
);

// Check Username Availability Route
router.post(
  '/username/availability',
  strictRateLimit,
  validateContentType,
  sanitizeRegistrationInput,
  validateUsernameAvailability(),
  handleValidationErrors,
  validationController.checkUsernameAvailability
);

// Validate Registration Data Route
router.post(
  '/registration-data',
  strictRateLimit,
  validateContentType,
  sanitizeRegistrationInput,
  validationController.validateRegistrationData
);

// Generate Username from Name Route
router.post(
  '/generate-username',
  strictRateLimit,
  validateContentType,
  validationController.generateUsernameFromName
);

// Bulk Availability Check Route
router.post(
  '/bulk-availability',
  strictRateLimit,
  validateContentType,
  validationController.bulkAvailabilityCheck
);

export { router as validationRoutes };
