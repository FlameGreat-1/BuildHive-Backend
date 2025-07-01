import { Router } from 'express';
import { AuthController } from '../controllers';
import { 
  validateLocalRegistration, 
  validateSocialRegistration, 
  validateEmailVerification, 
  validateResendVerification 
} from '../validators';
import { 
  handleValidationErrors, 
  sanitizeRegistrationInput, 
  validateContentType,
  registrationLogger,
  sensitiveDataFilter
} from '../middleware';
import { 
  registrationRateLimit, 
  emailVerificationRateLimit 
} from '../../shared/middleware';

const router = Router();
const authController = new AuthController();

// Local Registration Route
router.post(
  '/register/local',
  registrationRateLimit,
  validateContentType,
  sensitiveDataFilter,
  registrationLogger,
  sanitizeRegistrationInput,
  validateLocalRegistration(),
  handleValidationErrors,
  authController.registerLocal
);

// Social Registration Route
router.post(
  '/register/social',
  registrationRateLimit,
  validateContentType,
  registrationLogger,
  sanitizeRegistrationInput,
  validateSocialRegistration(),
  handleValidationErrors,
  authController.registerSocial
);

// Email Verification Route
router.post(
  '/verify-email',
  emailVerificationRateLimit,
  validateContentType,
  registrationLogger,
  validateEmailVerification(),
  handleValidationErrors,
  authController.verifyEmail
);

// Resend Email Verification Route
router.post(
  '/resend-verification',
  emailVerificationRateLimit,
  validateContentType,
  registrationLogger,
  validateResendVerification(),
  handleValidationErrors,
  authController.resendVerificationEmail
);

export { router as authRoutes };
