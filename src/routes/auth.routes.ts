import { Router } from 'express';
import { 
  register,
  login,
  verifyEmail,
  verifyPhone,
  requestPasswordReset,
  refreshToken,
  logout,
  getProfile,
  validateToken,
  healthCheck
} from '@/controllers/auth.controller';
import {
  initializeRequest,
  securityHeaders,
  corsHandler,
  requestLogger,
  authenticate,
  optionalAuthenticate,
  requireRole,
  requirePermission,
  requireVerification,
  requireProfileCompleteness,
  rateLimit,
  errorHandler,
  healthCheckBypass,
  requestTimeout,
  publicEndpoint,
  basicAuth,
  clientAuth,
  tradieAuth,
  enterpriseAuth
} from '@/middleware/auth.middleware';
import { UserType } from '@/types/auth.types';
import { logger, createLogContext } from '@/utils/logger';
import { RATE_LIMIT_CONSTANTS } from '@/utils/constants';

const authRouter = Router();

authRouter.use(initializeRequest);
authRouter.use(securityHeaders);
authRouter.use(corsHandler);
authRouter.use(requestLogger);
authRouter.use(healthCheckBypass);
authRouter.use(requestTimeout(30000));

authRouter.post('/register', 
  rateLimit(RATE_LIMIT_CONSTANTS.REGISTRATION.MAX_REQUESTS, RATE_LIMIT_CONSTANTS.REGISTRATION.WINDOW_MS),
  register
);

authRouter.post('/login', 
  rateLimit(RATE_LIMIT_CONSTANTS.LOGIN.MAX_REQUESTS, RATE_LIMIT_CONSTANTS.LOGIN.WINDOW_MS),
  login
);

authRouter.post('/verify-email', 
  rateLimit(RATE_LIMIT_CONSTANTS.VERIFICATION.MAX_REQUESTS, RATE_LIMIT_CONSTANTS.VERIFICATION.WINDOW_MS),
  verifyEmail
);

authRouter.post('/verify-phone', 
  rateLimit(RATE_LIMIT_CONSTANTS.VERIFICATION.MAX_REQUESTS, RATE_LIMIT_CONSTANTS.VERIFICATION.WINDOW_MS),
  verifyPhone
);

authRouter.post('/request-password-reset', 
  rateLimit(RATE_LIMIT_CONSTANTS.PASSWORD_RESET.MAX_REQUESTS, RATE_LIMIT_CONSTANTS.PASSWORD_RESET.WINDOW_MS),
  requestPasswordReset
);

authRouter.post('/refresh-token', 
  rateLimit(RATE_LIMIT_CONSTANTS.TOKEN_REFRESH.MAX_REQUESTS, RATE_LIMIT_CONSTANTS.TOKEN_REFRESH.WINDOW_MS),
  refreshToken
);

authRouter.post('/validate-token', 
  rateLimit(RATE_LIMIT_CONSTANTS.TOKEN_VALIDATION.MAX_REQUESTS, RATE_LIMIT_CONSTANTS.TOKEN_VALIDATION.WINDOW_MS),
  validateToken
);

authRouter.post('/logout', 
  authenticate,
  rateLimit(RATE_LIMIT_CONSTANTS.LOGOUT.MAX_REQUESTS, RATE_LIMIT_CONSTANTS.LOGOUT.WINDOW_MS),
  logout
);

authRouter.get('/profile', 
  authenticate,
  rateLimit(RATE_LIMIT_CONSTANTS.PROFILE.MAX_REQUESTS, RATE_LIMIT_CONSTANTS.PROFILE.WINDOW_MS),
  getProfile
);

authRouter.get('/profile/client', 
  ...clientAuth,
  rateLimit(RATE_LIMIT_CONSTANTS.PROFILE.MAX_REQUESTS, RATE_LIMIT_CONSTANTS.PROFILE.WINDOW_MS),
  getProfile
);

authRouter.get('/profile/tradie', 
  ...tradieAuth,
  rateLimit(RATE_LIMIT_CONSTANTS.PROFILE.MAX_REQUESTS, RATE_LIMIT_CONSTANTS.PROFILE.WINDOW_MS),
  getProfile
);

authRouter.get('/profile/enterprise', 
  ...enterpriseAuth,
  rateLimit(RATE_LIMIT_CONSTANTS.PROFILE.MAX_REQUESTS, RATE_LIMIT_CONSTANTS.PROFILE.WINDOW_MS),
  getProfile
);

authRouter.get('/health', healthCheck);

authRouter.use(errorHandler);

logger.info('Authentication routes registered', 
  createLogContext()
    .withMetadata({ 
      routeCount: authRouter.stack.length,
      module: 'authRoutes' 
    })
    .build()
);

export default authRouter;
