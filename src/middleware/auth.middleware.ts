// src/middleware/AuthMiddleware.ts

import { Request, Response, NextFunction } from 'express';
import { logger, createLogContext } from '@/utils/logger';
import { ERROR_CODES, HTTP_STATUS_CODES, SECURITY_CONSTANTS } from '@/utils/constants';
import { validateUserToken } from '@/services/auth.service';
import { getUserById } from '@/models/User';
import { getCache, setCache } from '@/config/redis';
import { 
  UserType, 
  UserStatus, 
  JWTPayload 
} from '@/types/auth.types';
import { 
  ApiError, 
  ErrorSeverity, 
  ApiResponse 
} from '@/types/common.types';

interface AuthMiddlewareConfig {
  enableTokenCaching: boolean;
  enableRoleBasedAccess: boolean;
  enablePermissionChecking: boolean;
  tokenCacheTTL: number;
  maxFailedAttempts: number;
  rateLimitWindow: number;
}

interface AuthenticatedUser {
  userId: string;
  email: string;
  userType: UserType;
  status: UserStatus;
  permissions: string[];
  sessionId?: string;
  isVerified: boolean;
  profileCompleteness: number;
}

interface RateLimitInfo {
  count: number;
  resetTime: number;
  blocked: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      requestId?: string;
      startTime?: number;
    }
  }
}

export class AuthMiddleware {
  private static instance: AuthMiddleware;
  private config: AuthMiddlewareConfig;

  private constructor() {
    this.config = this.loadConfiguration();
  }

  public static getInstance(): AuthMiddleware {
    if (!AuthMiddleware.instance) {
      AuthMiddleware.instance = new AuthMiddleware();
    }
    return AuthMiddleware.instance;
  }

  private loadConfiguration(): AuthMiddlewareConfig {
    return {
      enableTokenCaching: process.env.ENABLE_TOKEN_CACHING !== 'false',
      enableRoleBasedAccess: process.env.ENABLE_ROLE_BASED_ACCESS !== 'false',
      enablePermissionChecking: process.env.ENABLE_PERMISSION_CHECKING !== 'false',
      tokenCacheTTL: parseInt(process.env.TOKEN_CACHE_TTL || '300'),
      maxFailedAttempts: parseInt(process.env.MAX_FAILED_ATTEMPTS || '5'),
      rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900'),
    };
  }

  public initializeRequest = (req: Request, res: Response, next: NextFunction): void => {
    const crypto = require('crypto');
    
    req.requestId = req.headers['x-request-id'] as string || crypto.randomUUID();
    req.startTime = Date.now();

    res.setHeader('X-Request-ID', req.requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');

    const logContext = createLogContext()
      .withRequest(req)
      .withMetadata({ requestId: req.requestId })
      .build();

    logger.debug('Request initialized', logContext);

    next();
  };

  public authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const logContext = createLogContext()
      .withRequest(req)
      .withMetadata({ 
        middleware: 'authenticate',
        requestId: req.requestId 
      })
      .build();

    try {
      logger.debug('Authentication middleware started', logContext);

      const token = this.extractToken(req);
      
      if (!token) {
        logger.warn('No authentication token provided', logContext);
        
        const errorResponse: ApiResponse<null> = {
          success: false,
          message: 'Authentication token is required',
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        };

        res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json(errorResponse);
        return;
      }

      let payload: JWTPayload | null = null;
      
      if (this.config.enableTokenCaching) {
        payload = await this.getTokenFromCache(token);
      }

      if (!payload) {
        payload = await validateUserToken(token);
        
        if (this.config.enableTokenCaching) {
          await this.cacheToken(token, payload);
        }
      }

      const user = await getUserById(payload.userId, true);
      
      if (!user) {
        logger.warn('User not found for valid token', {
          ...logContext,
          userId: payload.userId,
        });

        throw new ApiError(
          'User not found',
          401,
          ERROR_CODES.AUTH_USER_NOT_FOUND,
          ErrorSeverity.MEDIUM
        );
      }

      if (user.status === UserStatus.SUSPENDED) {
        logger.security('SUSPENDED_USER_ACCESS_ATTEMPT', {
          ...logContext,
          userId: user.id,
        });

        throw new ApiError(
          'Account is suspended',
          403,
          ERROR_CODES.AUTH_ACCOUNT_SUSPENDED,
          ErrorSeverity.MEDIUM
        );
      }

      if (user.status === UserStatus.INACTIVE) {
        logger.warn('Inactive user access attempt', {
          ...logContext,
          userId: user.id,
        });

        throw new ApiError(
          'Account is inactive',
          403,
          ERROR_CODES.AUTH_ACCOUNT_INACTIVE,
          ErrorSeverity.LOW
        );
      }

      req.user = {
        userId: user.id,
        email: user.email,
        userType: user.userType,
        status: user.status,
        permissions: payload.permissions || [],
        sessionId: payload.sessionId,
        isVerified: user.emailVerified && user.phoneVerified,
        profileCompleteness: user.profileCompleteness,
      };

      const duration = Date.now() - startTime;
      logger.debug('Authentication successful', {
        ...logContext,
        userId: user.id,
        userType: user.userType,
        duration,
      });

      logger.performance('auth_middleware', duration, logContext);

      next();

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Authentication failed', {
        ...logContext,
        duration,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorCode: error instanceof ApiError ? error.code : ERROR_CODES.AUTH_TOKEN_INVALID,
      });

      if (error instanceof ApiError) {
        const errorResponse: ApiResponse<null> = {
          success: false,
          message: error.message,
          timestamp: new Date(),
          requestId: req.requestId,
        };

        res.status(error.statusCode).json(errorResponse);
        return;
      }

      const errorResponse: ApiResponse<null> = {
        success: false,
        message: 'Authentication failed',
        timestamp: new Date(),
        requestId: req.requestId,
      };

      res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json(errorResponse);
    }
  };

  public optionalAuthenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const logContext = createLogContext()
      .withRequest(req)
      .withMetadata({ 
        middleware: 'optionalAuthenticate',
        requestId: req.requestId 
      })
      .build();

    try {
      const token = this.extractToken(req);
      
      if (token) {
        try {
          await this.authenticate(req, res, () => {});
        } catch (error) {
          logger.debug('Optional authentication failed, continuing without auth', {
            ...logContext,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      next();

    } catch (error) {
      logger.debug('Optional authentication error, continuing without auth', {
        ...logContext,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      
      next();
    }
  };

  public requireRole = (allowedRoles: UserType[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const logContext = createLogContext()
        .withRequest(req)
        .withUser(req.user?.userId, req.user?.userType)
        .withMetadata({ 
          middleware: 'requireRole',
          allowedRoles,
          requestId: req.requestId 
        })
        .build();

      try {
        logger.debug('Role authorization check started', logContext);

        if (!req.user) {
          logger.warn('Role check attempted without authentication', logContext);
          
          const errorResponse: ApiResponse<null> = {
            success: false,
            message: 'Authentication required',
            timestamp: new Date(),
            requestId: req.requestId,
          };

          res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json(errorResponse);
          return;
        }

        if (!allowedRoles.includes(req.user.userType)) {
          logger.security('UNAUTHORIZED_ROLE_ACCESS_ATTEMPT', {
            ...logContext,
            userRole: req.user.userType,
            requiredRoles: allowedRoles,
          });

          const errorResponse: ApiResponse<null> = {
            success: false,
            message: 'Insufficient permissions',
            timestamp: new Date(),
            requestId: req.requestId,
          };

          res.status(HTTP_STATUS_CODES.FORBIDDEN).json(errorResponse);
          return;
        }

        logger.debug('Role authorization successful', {
          ...logContext,
          userRole: req.user.userType,
        });

        next();

      } catch (error) {
        logger.error('Role authorization failed', {
          ...logContext,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });

        const errorResponse: ApiResponse<null> = {
          success: false,
          message: 'Authorization failed',
          timestamp: new Date(),
          requestId: req.requestId,
        };

        res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(errorResponse);
      }
    };
  };

  public requirePermission = (requiredPermissions: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const logContext = createLogContext()
        .withRequest(req)
        .withUser(req.user?.userId, req.user?.userType)
        .withMetadata({ 
          middleware: 'requirePermission',
          requiredPermissions,
          requestId: req.requestId 
        })
        .build();

      try {
        logger.debug('Permission authorization check started', logContext);

        if (!req.user) {
          logger.warn('Permission check attempted without authentication', logContext);
          
          const errorResponse: ApiResponse<null> = {
            success: false,
            message: 'Authentication required',
            timestamp: new Date(),
            requestId: req.requestId,
          };

          res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json(errorResponse);
          return;
        }

        if (!this.config.enablePermissionChecking) {
          logger.debug('Permission checking disabled, allowing access', logContext);
          next();
          return;
        }

        const hasAllPermissions = requiredPermissions.every(permission => 
          req.user!.permissions.includes(permission)
        );

        if (!hasAllPermissions) {
          const missingPermissions = requiredPermissions.filter(permission => 
            !req.user!.permissions.includes(permission)
          );

          logger.security('INSUFFICIENT_PERMISSIONS_ACCESS_ATTEMPT', {
            ...logContext,
            userPermissions: req.user.permissions,
            requiredPermissions,
            missingPermissions,
          });

          const errorResponse: ApiResponse<null> = {
            success: false,
            message: 'Insufficient permissions',
            timestamp: new Date(),
            requestId: req.requestId,
          };

          res.status(HTTP_STATUS_CODES.FORBIDDEN).json(errorResponse);
          return;
        }

        logger.debug('Permission authorization successful', {
          ...logContext,
          userPermissions: req.user.permissions,
        });

        next();

      } catch (error) {
        logger.error('Permission authorization failed', {
          ...logContext,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });

        const errorResponse: ApiResponse<null> = {
          success: false,
          message: 'Authorization failed',
          timestamp: new Date(),
          requestId: req.requestId,
        };

        res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(errorResponse);
      }
    };
  };

  public requireVerification = (req: Request, res: Response, next: NextFunction): void => {
    const logContext = createLogContext()
      .withRequest(req)
      .withUser(req.user?.userId, req.user?.userType)
      .withMetadata({ 
        middleware: 'requireVerification',
        requestId: req.requestId 
      })
      .build();

    try {
      logger.debug('Verification check started', logContext);

      if (!req.user) {
        logger.warn('Verification check attempted without authentication', logContext);
        
        const errorResponse: ApiResponse<null> = {
          success: false,
          message: 'Authentication required',
          timestamp: new Date(),
          requestId: req.requestId,
        };

        res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json(errorResponse);
        return;
      }

      if (!req.user.isVerified) {
        logger.warn('Unverified user access attempt', {
          ...logContext,
          userId: req.user.userId,
        });

        const errorResponse: ApiResponse<null> = {
          success: false,
          message: 'Account verification required',
          data: {
            nextStep: 'verification',
            verificationRequired: true,
          },
          timestamp: new Date(),
          requestId: req.requestId,
        };

        res.status(HTTP_STATUS_CODES.FORBIDDEN).json(errorResponse);
        return;
      }

      logger.debug('Verification check successful', logContext);
      next();

    } catch (error) {
      logger.error('Verification check failed', {
        ...logContext,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      const errorResponse: ApiResponse<null> = {
        success: false,
        message: 'Verification check failed',
        timestamp: new Date(),
        requestId: req.requestId,
      };

      res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(errorResponse);
    }
  };

  public rateLimit = (maxRequests: number = 100, windowMs: number = 900000) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const logContext = createLogContext()
        .withRequest(req)
        .withMetadata({ 
          middleware: 'rateLimit',
          maxRequests,
          windowMs,
          requestId: req.requestId 
        })
        .build();

      try {
        const clientId = req.user?.userId || this.getClientIdentifier(req);
        const rateLimitKey = `rate_limit:${clientId}`;

        const rateLimitInfo = await getCache<RateLimitInfo>(rateLimitKey);
        const now = Date.now();

        if (rateLimitInfo) {
          if (now > rateLimitInfo.resetTime) {
            const newRateLimitInfo: RateLimitInfo = {
              count: 1,
              resetTime: now + windowMs,
              blocked: false,
            };

            await setCache(rateLimitKey, newRateLimitInfo, { ttl: windowMs / 1000 });
          } else {
            const newCount = rateLimitInfo.count + 1;
            
            if (newCount > maxRequests) {
              logger.security('RATE_LIMIT_EXCEEDED', {
                ...logContext,
                clientId,
                requestCount: newCount,
                maxRequests,
              });

              const errorResponse: ApiResponse<null> = {
                success: false,
                message: 'Rate limit exceeded',
                timestamp: new Date(),
                requestId: req.requestId,
              };

              res.status(HTTP_STATUS_CODES.TOO_MANY_REQUESTS)
                .setHeader('X-RateLimit-Limit', maxRequests.toString())
                .setHeader('X-RateLimit-Remaining', '0')
                .setHeader('X-RateLimit-Reset', rateLimitInfo.resetTime.toString())
                .json(errorResponse);
              return;
            }

            const updatedRateLimitInfo: RateLimitInfo = {
              ...rateLimitInfo,
              count: newCount,
            };

            await setCache(rateLimitKey, updatedRateLimitInfo, { ttl: Math.ceil((rateLimitInfo.resetTime - now) / 1000) });

            res.setHeader('X-RateLimit-Limit', maxRequests.toString());
            res.setHeader('X-RateLimit-Remaining', (maxRequests - newCount).toString());
            res.setHeader('X-RateLimit-Reset', rateLimitInfo.resetTime.toString());
          }
        } else {
          const newRateLimitInfo: RateLimitInfo = {
            count: 1,
            resetTime: now + windowMs,
            blocked: false,
          };

          await setCache(rateLimitKey, newRateLimitInfo, { ttl: windowMs / 1000 });

          res.setHeader('X-RateLimit-Limit', maxRequests.toString());
          res.setHeader('X-RateLimit-Remaining', (maxRequests - 1).toString());
          res.setHeader('X-RateLimit-Reset', newRateLimitInfo.resetTime.toString());
        }

        next();

      } catch (error) {
        logger.error('Rate limiting failed', {
          ...logContext,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });

        next();
      }
    };
  };

  private extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    const cookieToken = req.cookies?.accessToken;
    if (cookieToken) {
      return cookieToken;
    }

    const queryToken = req.query.token as string;
    if (queryToken) {
      return queryToken;
    }

    const customHeader = req.headers['x-access-token'] as string;
    if (customHeader) {
      return customHeader;
    }

    return null;
  }

  private async getTokenFromCache(token: string): Promise<JWTPayload | null> {
    try {
      const cacheKey = `token:${this.hashToken(token)}`;
      const cachedPayload = await getCache<JWTPayload>(cacheKey);
      
      if (cachedPayload) {
        logger.debug('Token retrieved from cache', 
          createLogContext()
            .withUser(cachedPayload.userId, cachedPayload.userType)
            .withMetadata({ cacheHit: true })
            .build()
        );
        return cachedPayload;
      }

      return null;
    } catch (error) {
      logger.warn('Token cache retrieval failed', 
        createLogContext()
          .withError(ERROR_CODES.SYS_REDIS_ERROR)
          .withMetadata({ 
            errorMessage: error instanceof Error ? error.message : 'Unknown error' 
          })
          .build()
      );
      return null;
    }
  }

  private async cacheToken(token: string, payload: JWTPayload): Promise<void> {
    try {
      const cacheKey = `token:${this.hashToken(token)}`;
      await setCache(cacheKey, payload, { ttl: this.config.tokenCacheTTL });
      
      logger.debug('Token cached successfully', 
        createLogContext()
          .withUser(payload.userId, payload.userType)
          .withMetadata({ cacheTTL: this.config.tokenCacheTTL })
          .build()
      );
    } catch (error) {
      logger.warn('Token caching failed', 
        createLogContext()
          .withUser(payload.userId, payload.userType)
          .withError(ERROR_CODES.SYS_REDIS_ERROR)
          .withMetadata({ 
            errorMessage: error instanceof Error ? error.message : 'Unknown error' 
          })
          .build()
      );
    }
  }

  private hashToken(token: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(token).digest('hex').substring(0, 16);
  }

  private getClientIdentifier(req: Request): string {
    const ipAddress = req.headers['x-forwarded-for'] as string || 
                     req.headers['x-real-ip'] as string || 
                     (req.socket as any)?.remoteAddress || 
                     '0.0.0.0';
    
    const userAgent = req.headers['user-agent'] || 'unknown';
    const crypto = require('crypto');
    
    return crypto.createHash('md5').update(`${ipAddress}-${userAgent}`).digest('hex').substring(0, 12);
  }

  public getConfig(): Readonly<AuthMiddlewareConfig> {
    return { ...this.config };
  }

  public requireProfileCompleteness = (minimumCompleteness: number = 50) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const logContext = createLogContext()
        .withRequest(req)
        .withUser(req.user?.userId, req.user?.userType)
        .withMetadata({ 
          middleware: 'requireProfileCompleteness',
          minimumCompleteness,
          requestId: req.requestId 
        })
        .build();

      try {
        logger.debug('Profile completeness check started', logContext);

        if (!req.user) {
          logger.warn('Profile completeness check attempted without authentication', logContext);
          
          const errorResponse: ApiResponse<null> = {
            success: false,
            message: 'Authentication required',
            timestamp: new Date(),
            requestId: req.requestId,
          };

          res.status(HTTP_STATUS_CODES.UNAUTHORIZED).json(errorResponse);
          return;
        }

        if (req.user.profileCompleteness < minimumCompleteness) {
          logger.warn('Incomplete profile access attempt', {
            ...logContext,
            currentCompleteness: req.user.profileCompleteness,
            requiredCompleteness: minimumCompleteness,
          });

          const errorResponse: ApiResponse<null> = {
            success: false,
            message: 'Profile completion required',
            data: {
              currentCompleteness: req.user.profileCompleteness,
              requiredCompleteness: minimumCompleteness,
              nextStep: 'complete_profile',
            },
            timestamp: new Date(),
            requestId: req.requestId,
          };

          res.status(HTTP_STATUS_CODES.FORBIDDEN).json(errorResponse);
          return;
        }

        logger.debug('Profile completeness check successful', {
          ...logContext,
          profileCompleteness: req.user.profileCompleteness,
        });

        next();

      } catch (error) {
        logger.error('Profile completeness check failed', {
          ...logContext,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });

        const errorResponse: ApiResponse<null> = {
          success: false,
          message: 'Profile completeness check failed',
          timestamp: new Date(),
          requestId: req.requestId,
        };

        res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(errorResponse);
      }
    };
  };

  public securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    res.setHeader('Content-Security-Policy', 
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "font-src 'self' https:; " +
      "connect-src 'self' https:; " +
      "frame-ancestors 'none';"
    );

    next();
  };

  public requestLogger = (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    const logContext = createLogContext()
      .withRequest(req)
      .withUser(req.user?.userId, req.user?.userType)
      .withMetadata({ 
        middleware: 'requestLogger',
        requestId: req.requestId 
      })
      .build();

    logger.info('Request started', {
      ...logContext,
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      contentLength: req.headers['content-length'],
    });

    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any) {
      const duration = Date.now() - startTime;
      
      logger.info('Request completed', {
        ...logContext,
        statusCode: res.statusCode,
        duration,
        contentLength: res.get('content-length'),
      });

      logger.performance('request_duration', duration, {
        ...logContext,
        statusCode: res.statusCode,
      });

      originalEnd.call(this, chunk, encoding);
    };

    next();
  };

  public errorHandler = (error: any, req: Request, res: Response, next: NextFunction): void => {
    const logContext = createLogContext()
      .withRequest(req)
      .withUser(req.user?.userId, req.user?.userType)
      .withMetadata({ 
        middleware: 'errorHandler',
        requestId: req.requestId 
      })
      .build();

    if (error instanceof ApiError) {
      if (error.severity === ErrorSeverity.HIGH) {
        logger.error('High severity API error', {
          ...logContext,
          errorMessage: error.message,
          errorCode: error.code,
          statusCode: error.statusCode,
          stack: error.stack,
        });
      } else {
        logger.warn('API error', {
          ...logContext,
          errorMessage: error.message,
          errorCode: error.code,
          statusCode: error.statusCode,
        });
      }

      const errorResponse: ApiResponse<null> = {
        success: false,
        message: error.message,
        timestamp: new Date(),
        requestId: req.requestId,
      };

      res.status(error.statusCode).json(errorResponse);
      return;
    }

    logger.error('Unhandled error', {
      ...logContext,
      errorMessage: error.message || 'Unknown error',
      stack: error.stack,
    });

    const errorResponse: ApiResponse<null> = {
      success: false,
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
      timestamp: new Date(),
      requestId: req.requestId,
    };

    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(errorResponse);
  };

  public corsHandler = (req: Request, res: Response, next: NextFunction): void => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    const origin = req.headers.origin;

    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Access-Token, X-Device-Fingerprint');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      res.status(HTTP_STATUS_CODES.NO_CONTENT).end();
      return;
    }

    next();
  };

  public healthCheckBypass = (req: Request, res: Response, next: NextFunction): void => {
    if (req.path === '/health' || req.path === '/api/health') {
      const healthResponse: ApiResponse<any> = {
        success: true,
        message: 'Service is healthy',
        data: {
          status: 'healthy',
          timestamp: new Date(),
          uptime: process.uptime(),
          version: process.env.APP_VERSION || '1.0.0',
        },
        timestamp: new Date(),
        requestId: req.requestId,
      };

      res.status(HTTP_STATUS_CODES.OK).json(healthResponse);
      return;
    }

    next();
  };

  public requestTimeout = (timeoutMs: number = 30000) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const timeout = setTimeout(() => {
        if (!res.headersSent) {
          const logContext = createLogContext()
            .withRequest(req)
            .withUser(req.user?.userId, req.user?.userType)
            .withMetadata({ 
              middleware: 'requestTimeout',
              timeoutMs,
              requestId: req.requestId 
            })
            .build();

          logger.warn('Request timeout', logContext);

          const errorResponse: ApiResponse<null> = {
            success: false,
            message: 'Request timeout',
            timestamp: new Date(),
            requestId: req.requestId,
          };

          res.status(HTTP_STATUS_CODES.REQUEST_TIMEOUT).json(errorResponse);
        }
      }, timeoutMs);

      res.on('finish', () => {
        clearTimeout(timeout);
      });

      next();
    };
  };
}

export const authMiddleware = AuthMiddleware.getInstance();

export const initializeRequest = authMiddleware.initializeRequest;
export const authenticate = authMiddleware.authenticate;
export const optionalAuthenticate = authMiddleware.optionalAuthenticate;
export const requireRole = authMiddleware.requireRole;
export const requirePermission = authMiddleware.requirePermission;
export const requireVerification = authMiddleware.requireVerification;
export const requireProfileCompleteness = authMiddleware.requireProfileCompleteness;
export const rateLimit = authMiddleware.rateLimit;
export const securityHeaders = authMiddleware.securityHeaders;
export const requestLogger = authMiddleware.requestLogger;
export const errorHandler = authMiddleware.errorHandler;
export const corsHandler = authMiddleware.corsHandler;
export const healthCheckBypass = authMiddleware.healthCheckBypass;
export const requestTimeout = authMiddleware.requestTimeout;

export const basicAuth = [
  initializeRequest,
  securityHeaders,
  corsHandler,
  requestLogger,
  authenticate,
];

export const clientAuth = [
  ...basicAuth,
  requireRole([UserType.CLIENT]),
  requireVerification,
];

export const tradieAuth = [
  ...basicAuth,
  requireRole([UserType.TRADIE]),
  requireVerification,
  requireProfileCompleteness(75),
];

export const enterpriseAuth = [
  ...basicAuth,
  requireRole([UserType.ENTERPRISE]),
  requireVerification,
  requireProfileCompleteness(80),
];

export const adminAuth = [
  ...basicAuth,
  requireRole([UserType.ENTERPRISE]),
  requirePermission(['admin:read', 'admin:write']),
  requireVerification,
];

export const publicEndpoint = [
  initializeRequest,
  securityHeaders,
  corsHandler,
  requestLogger,
  optionalAuthenticate,
];

export default authMiddleware;
