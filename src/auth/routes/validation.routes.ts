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
import { strictRateLimit, validationRateLimit } from '../../shared/middleware';

const router = Router();
const validationController = new ValidationController();

router.post(
  '/email/availability',
  validationRateLimit,
  validateContentType,
  sanitizeRegistrationInput,
  validateEmailAvailability(),
  handleValidationErrors,
  validationController.checkEmailAvailability
);

router.post(
  '/username/availability',
  validationRateLimit,
  validateContentType,
  sanitizeRegistrationInput,
  validateUsernameAvailability(),
  handleValidationErrors,
  validationController.checkUsernameAvailability
);

router.post(
  '/email/format',
  validationRateLimit,
  validateContentType,
  validationController.validateEmailFormat
);

router.post(
  '/username/format',
  validationRateLimit,
  validateContentType,
  validationController.validateUsernameFormat
);

router.post(
  '/password/strength',
  validationRateLimit,
  validateContentType,
  validationController.validatePassword
);

router.post(
  '/login/credentials',
  validationRateLimit,
  validateContentType,
  validationController.validateLoginCredentials
);

router.post(
  '/password-reset/data',
  validationRateLimit,
  validateContentType,
  validationController.validatePasswordReset
);

router.post(
  '/change-password/data',
  validationRateLimit,
  validateContentType,
  validationController.validateChangePassword
);

router.post(
  '/registration-data',
  strictRateLimit,
  validateContentType,
  sanitizeRegistrationInput,
  validationController.validateRegistrationData
);

router.post(
  '/social/data',
  validationRateLimit,
  validateContentType,
  validationController.validateSocialData
);

router.post(
  '/generate-username',
  strictRateLimit,
  validateContentType,
  validationController.generateUsernameFromName
);

router.post(
  '/bulk-availability',
  strictRateLimit,
  validateContentType,
  validationController.bulkAvailabilityCheck
);

export { router as validationRoutes };
