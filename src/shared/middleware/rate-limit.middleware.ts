import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { Request, Response, NextFunction } from 'express';
import { redisClient } from '../../config/auth';
import { RATE_LIMITS } from '../../config/auth';
import { buildHiveResponse } from '../utils/response.util';
import { buildHiveLogger } from '../utils/logger.util';
import { AuthErrorFactory } from '../utils/error.util';

// Extended request interface
interface BuildHiveRequest extends Request {
  requestId?: string;
  userId?: string;
  userRole?: string;
}

// Rate limit configuration interface
interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

// Rate limit middleware class
class RateLimitMiddleware {
  // Create Redis store for rate limiting
  private static createRedisStore() {
    return new RedisStore({
      sendCommand: (...args: string[]) => redisClient.sendCommand(args),
      prefix: 'buildhive:rate_limit:',
    });
  }

  // Create rate limiter with custom configuration
  private static createLimiter(config: RateLimitConfig) {
    return rateLimit({
      store: this.createRedisStore(),
      windowMs: config.windowMs,
      max: config.max,
      message: config.message || 'Too many requests, please try again later',
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: config.skipSuccessfulRequests || false,
      skipFailedRequests: config.skipFailedRequests || false,
      keyGenerator: config.keyGenerator || ((req: Request) => req.ip),
      handler: this.rateLimitHandler,
      onLimitReached: this.onLimitReached,
    });
  }

  // Rate limit exceeded handler
  private static rateLimitHandler(
    req: BuildHiveRequest,
    res: Response,
    next: NextFunction
  ): void {
    const requestId = req.requestId || `req_${Date.now()}`;
    
    // Log rate limit exceeded
    buildHiveLogger.security.rateLimitExceeded(
      req.ip,
      req.originalUrl,
      {
        requestId,
        userAgent: req.get('User-Agent'),
        userId: req.userId,
      }
    );

    // Create rate limit error
    const error = AuthErrorFactory.rateLimitExceeded(
      req.originalUrl,
      new Date(Date.now() + RATE_LIMITS.AUTH.LOGIN.windowMs),
      {
        ip: req.ip,
        endpoint: req.originalUrl,
        userId: req.userId,
      }
    );

    // Send error response
    buildHiveResponse.rateLimitExceeded(res, error.message, requestId);
  }

  // Called when rate limit is reached
  private static onLimitReached(
    req: BuildHiveRequest,
    res: Response,
    options: any
  ): void {
    buildHiveLogger.warn('Rate limit threshold reached', {
      ip: req.ip,
      endpoint: req.originalUrl,
      userId: req.userId,
      limit: options.max,
      windowMs: options.windowMs,
    });
  }

  // Authentication rate limiters
  static auth = {
    // Login rate limiter
    login: this.createLimiter({
      windowMs: RATE_LIMITS.AUTH.LOGIN.windowMs,
      max: RATE_LIMITS.AUTH.LOGIN.max,
      message: 'Too many login attempts, please try again in 15 minutes',
      skipSuccessfulRequests: true,
      keyGenerator: (req: Request) => `login:${req.ip}:${req.body?.email || 'unknown'}`,
    }),

    // Registration rate limiter
    register: this.createLimiter({
      windowMs: RATE_LIMITS.AUTH.REGISTER.windowMs,
      max: RATE_LIMITS.AUTH.REGISTER.max,
      message: 'Too many registration attempts, please try again in 1 hour',
      keyGenerator: (req: Request) => `register:${req.ip}`,
    }),

    // Password reset rate limiter
    passwordReset: this.createLimiter({
      windowMs: RATE_LIMITS.AUTH.PASSWORD_RESET.windowMs,
      max: RATE_LIMITS.AUTH.PASSWORD_RESET.max,
      message: 'Too many password reset requests, please try again in 1 hour',
      keyGenerator: (req: Request) => `password_reset:${req.ip}:${req.body?.email || 'unknown'}`,
    }),

    // Email verification rate limiter
    emailVerification: this.createLimiter({
      windowMs: RATE_LIMITS.AUTH.EMAIL_VERIFICATION.windowMs,
      max: RATE_LIMITS.AUTH.EMAIL_VERIFICATION.max,
      message: 'Too many email verification requests, please try again in 1 hour',
      keyGenerator: (req: Request) => `email_verify:${req.ip}:${req.body?.email || req.params?.email || 'unknown'}`,
    }),
  };

  // Profile rate limiters
  static profile = {
    // Profile update rate limiter
    update: this.createLimiter({
      windowMs: RATE_LIMITS.PROFILE.UPDATE.windowMs,
      max: RATE_LIMITS.PROFILE.UPDATE.max,
      message: 'Too many profile updates, please try again in 15 minutes',
      keyGenerator: (req: BuildHiveRequest) => `profile_update:${req.userId || req.ip}`,
    }),

    // Image upload rate limiter
    imageUpload: this.createLimiter({
      windowMs: RATE_LIMITS.PROFILE.IMAGE_UPLOAD.windowMs,
      max: RATE_LIMITS.PROFILE.IMAGE_UPLOAD.max,
      message: 'Too many image uploads, please try again in 1 hour',
      keyGenerator: (req: BuildHiveRequest) => `image_upload:${req.userId || req.ip}`,
    }),
  };

  // General API rate limiter
  static general = this.createLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 1000 requests per window
    message: 'Too many API requests, please try again later',
    keyGenerator: (req: BuildHiveRequest) => req.userId || req.ip,
  });

  // Strict rate limiter for sensitive operations
  static strict = this.createLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 requests per hour
    message: 'Rate limit exceeded for sensitive operation',
    keyGenerator: (req: BuildHiveRequest) => `strict:${req.userId || req.ip}:${req.originalUrl}`,
  });

  // Dynamic rate limiter based on user role
  static dynamic(req: BuildHiveRequest, res: Response, next: NextFunction): void {
    const userRole = req.userRole;
    let limiter;

    switch (userRole) {
      case 'enterprise':
        // Higher limits for enterprise users
        limiter = this.createLimiter({
          windowMs: 15 * 60 * 1000,
          max: 2000,
          message: 'Enterprise rate limit exceeded',
        });
        break;
      
      case 'tradie':
        // Standard limits for tradies
        limiter = this.createLimiter({
          windowMs: 15 * 60 * 1000,
          max: 1000,
          message: 'Tradie rate limit exceeded',
        });
        break;
      
      case 'client':
        // Standard limits for clients
        limiter = this.createLimiter({
          windowMs: 15 * 60 * 1000,
          max: 500,
          message: 'Client rate limit exceeded',
        });
        break;
      
      default:
        // Lower limits for unauthenticated users
        limiter = this.createLimiter({
          windowMs: 15 * 60 * 1000,
          max: 100,
          message: 'Anonymous user rate limit exceeded',
        });
    }

    limiter(req, res, next);
  }

  // Skip rate limiting for certain conditions
  static skipIf(condition: (req: Request) => boolean) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (condition(req)) {
        return next();
      }
      return this.general(req, res, next);
    };
  }

  // Custom rate limiter factory
  static custom(config: RateLimitConfig) {
    return this.createLimiter(config);
  }

  // Health check for rate limiting system
  static async healthCheck(): Promise<{
    redis: boolean;
    rateLimiting: boolean;
    timestamp: Date;
  }> {
    const health = {
      redis: false,
      rateLimiting: false,
      timestamp: new Date(),
    };

    try {
      // Check Redis connection
      await redisClient.ping();
      health.redis = true;

      // Test rate limiting functionality
      const testKey = `health_check:${Date.now()}`;
      await redisClient.incr(testKey);
      await redisClient.expire(testKey, 1);
      health.rateLimiting = true;
    } catch (error) {
      buildHiveLogger.error('Rate limiting health check failed', error);
    }

    return health;
  }
}

// Export rate limiters
export const authRateLimit = RateLimitMiddleware.auth;
export const profileRateLimit = RateLimitMiddleware.profile;
export const generalRateLimit = RateLimitMiddleware.general;
export const strictRateLimit = RateLimitMiddleware.strict;
export const dynamicRateLimit = RateLimitMiddleware.dynamic;
export const customRateLimit = RateLimitMiddleware.custom;
export const skipRateLimitIf = RateLimitMiddleware.skipIf;
export const rateLimitHealthCheck = RateLimitMiddleware.healthCheck;

// Export class for advanced usage
export { RateLimitMiddleware };

export default RateLimitMiddleware;
