import { Router } from 'express';
import { 
  asyncHandler, 
  validateRequest, 
  rateLimiters,
  requireAuth,
  requireEmailVerification,
  type IAuthController 
} from '../controllers';
import { 
  registerSchema, 
  loginSchema, 
  forgotPasswordSchema, 
  resetPasswordSchema, 
  changePasswordSchema, 
  refreshTokenSchema 
} from '../validators';
import { authMiddleware, sessionMiddleware } from '../middleware';

export function createAuthRoutes(authController: IAuthController): Router {
  const router = Router();

  router.post('/register',
    rateLimiters.register,
    validateRequest(registerSchema),
    asyncHandler(authController.register.bind(authController))
  );

  router.post('/login',
    rateLimiters.auth,
    validateRequest(loginSchema),
    asyncHandler(authController.login.bind(authController))
  );

  router.post('/forgot-password',
    rateLimiters.passwordReset,
    validateRequest(forgotPasswordSchema),
    asyncHandler(authController.forgotPassword.bind(authController))
  );

  router.post('/reset-password',
    rateLimiters.passwordReset,
    validateRequest(resetPasswordSchema),
    asyncHandler(authController.resetPassword.bind(authController))
  );

  router.post('/logout',
    authMiddleware,
    sessionMiddleware,
    asyncHandler(authController.logout.bind(authController))
  );

  router.post('/refresh-token',
    rateLimiters.auth,
    validateRequest(refreshTokenSchema),
    asyncHandler(authController.refreshToken.bind(authController))
  );

  router.post('/change-password',
    authMiddleware,
    requireEmailVerification,
    rateLimiters.passwordReset,
    validateRequest(changePasswordSchema),
    asyncHandler(authController.changePassword.bind(authController))
  );

  router.get('/me',
    authMiddleware,
    asyncHandler(authController.getCurrentUser.bind(authController))
  );

  router.put('/me',
    authMiddleware,
    rateLimiters.general,
    validateRequest(changePasswordSchema),
    asyncHandler(authController.updateProfile.bind(authController))
  );

  router.get('/health',
    asyncHandler(authController.healthCheck.bind(authController))
  );

  router.get('/rate-limit-info',
    authMiddleware,
    asyncHandler(authController.getRateLimitInfo.bind(authController))
  );

  return router;
}

export default createAuthRoutes;
