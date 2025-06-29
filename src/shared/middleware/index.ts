// Shared Middleware Export Module
// Centralized export for all shared middleware functions

// Error middleware
export {
  errorHandler,
  asyncHandler,
  notFoundHandler,
  validationErrorHandler,
  ErrorMiddleware,
} from './error.middleware';

// Rate limiting middleware
export {
  authRateLimit,
  profileRateLimit,
  generalRateLimit,
  strictRateLimit,
  dynamicRateLimit,
  customRateLimit,
  skipRateLimitIf,
  rateLimitHealthCheck,
  RateLimitMiddleware,
} from './rate-limit.middleware';

// Default exports for convenience
export { default as ErrorMiddleware } from './error.middleware';
export { default as RateLimitMiddleware } from './rate-limit.middleware';

// Combined middleware object for easy access
export const middleware = {
  error: {
    handler: errorHandler,
    asyncHandler,
    notFoundHandler,
    validationErrorHandler,
  },
  rateLimit: {
    auth: authRateLimit,
    profile: profileRateLimit,
    general: generalRateLimit,
    strict: strictRateLimit,
    dynamic: dynamicRateLimit,
    custom: customRateLimit,
    skipIf: skipRateLimitIf,
    healthCheck: rateLimitHealthCheck,
  },
};

export default middleware;
