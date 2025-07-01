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
  registrationLogger
} from '../middleware';
import { 
  registrationRateLimit, 
  emailVerificationRateLimit,
  sensitiveDataFilter
} from '../../shared/middleware';

const router = Router();
const authController = new AuthController();

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

router.post(
  '/verify-email',
  emailVerificationRateLimit,
  validateContentType,
  registrationLogger,
  validateEmailVerification(),
  handleValidationErrors,
  authController.verifyEmail
);

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
