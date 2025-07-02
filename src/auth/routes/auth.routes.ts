import { Router } from 'express';
import { AuthController } from '../controllers';
import { 
  validateLocalRegistration, 
  validateSocialRegistration, 
  validateEmailVerification, 
  validateResendVerification,
  validateLogin,
  validateRefreshToken,
  validatePasswordResetRequest,
  validatePasswordResetConfirm,
  validateChangePassword,
  validateLogout
} from '../validators';
import { 
  handleValidationErrors, 
  sanitizeRegistrationInput,
  sanitizeLoginInput,
  sanitizePasswordInput,
  validateContentType,
  registrationLogger,
  loginLogger,
  passwordResetLogger,
  logoutLogger,
  tokenLogger
} from '../middleware';
import { 
  authenticate,
  optionalAuth
} from '../middleware';
import { 
  registrationRateLimit, 
  emailVerificationRateLimit,
  loginRateLimit,
  passwordResetRateLimit,
  changePasswordRateLimit,
  refreshTokenRateLimit,
  logoutRateLimit,
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
  '/login',
  loginRateLimit,
  validateContentType,
  loginLogger,
  sanitizeLoginInput,
  validateLogin(),
  handleValidationErrors,
  authController.login
);

router.post(
  '/refresh-token',
  refreshTokenRateLimit,
  validateContentType,
  tokenLogger,
  validateRefreshToken(),
  handleValidationErrors,
  authController.refreshToken
);

router.post(
  '/logout',
  logoutRateLimit,
  validateContentType,
  logoutLogger,
  optionalAuth,
  validateLogout(),
  handleValidationErrors,
  authController.logout
);

router.post(
  '/forgot-password',
  passwordResetRateLimit,
  validateContentType,
  passwordResetLogger,
  validatePasswordResetRequest(),
  handleValidationErrors,
  authController.requestPasswordReset
);

router.post(
  '/reset-password',
  passwordResetRateLimit,
  validateContentType,
  passwordResetLogger,
  sanitizePasswordInput,
  validatePasswordResetConfirm(),
  handleValidationErrors,
  authController.confirmPasswordReset
);

router.post(
  '/change-password',
  changePasswordRateLimit,
  validateContentType,
  passwordResetLogger,
  authenticate,
  sanitizePasswordInput,
  validateChangePassword(),
  handleValidationErrors,
  authController.changePassword
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

router.get(
  '/me',
  authenticate,
  authController.getCurrentUser
);

router.get(
  '/validate-session',
  authenticate,
  authController.validateSession
);

export { router as authRoutes };
