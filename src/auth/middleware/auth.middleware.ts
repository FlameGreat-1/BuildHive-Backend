import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { buildHiveLogger, buildHiveResponse, AuthErrorFactory } from '../../shared';
import type { ServiceContainer } from '../services';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  roles?: string[];
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  sessionId?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  session?: {
    id: string;
    userId: string;
    deviceInfo: any;
  };
}

interface JWTPayload {
  userId: string;
  sessionId?: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      session?: {
        id: string;
        userId: string;
        deviceInfo: any;
      };
    }
  }
}

export class AuthMiddleware {
  private readonly serviceContainer: ServiceContainer;
  private readonly logger = buildHiveLogger;

  constructor(serviceContainer: ServiceContainer) {
    this.serviceContainer = serviceContainer;
  }

  authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = this.extractToken(req);

      if (!token) {
        throw AuthErrorFactory.unauthorized('Authentication token required');
      }

      const decoded = this.verifyToken(token) as JWTPayload;
      
      const userService = this.serviceContainer.getUserService();
      const userResult = await userService.getUserById(decoded.userId);
      
      if (!userResult.success) {
        throw AuthErrorFactory.unauthorized('Invalid user');
      }

      const user = userResult.data;

      if (user.status !== 'active') {
        throw AuthErrorFactory.forbidden('Account is not active');
      }

      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        roles: user.roles || [user.role],
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
        sessionId: decoded.sessionId
      };

      this.logger.debug('User authenticated successfully', {
        userId: user.id,
        email: this.maskEmail(user.email),
        role: user.role,
        sessionId: decoded.sessionId,
        ip: req.ip
      });

      next();

    } catch (error) {
      this.logger.warn('Authentication failed', error as Error, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path
      });

      const err = error as any;
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json(buildHiveResponse.error(
          'Token expired',
          'TOKEN_EXPIRED'
        ));
      }

      if (err.name === 'JsonWebTokenError') {
        return res.status(401).json(buildHiveResponse.error(
          'Invalid token',
          'INVALID_TOKEN'
        ));
      }

      next(error);
    }
  };

  optionalAuthenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = this.extractToken(req);

      if (!token) {
        return next();
      }

      await this.authenticate(req, res, (error?: any) => {
        if (error) {
          this.logger.debug('Optional authentication failed', error as Error);
        }
        next();
      });

    } catch (error) {
      next();
    }
  };

  validateSession = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user?.sessionId) {
        throw AuthErrorFactory.unauthorized('Session required');
      }

      const authService = this.serviceContainer.getAuthService();
      const sessionValid = await authService.validateSession(req.user.sessionId, req.user.id);

      if (!sessionValid) {
        throw AuthErrorFactory.unauthorized('Invalid or expired session');
      }

      this.logger.debug('Session validated', {
        userId: req.user.id,
        sessionId: req.user.sessionId,
        ip: req.ip
      });

      next();

    } catch (error) {
      this.logger.warn('Session validation failed', error as Error, {
        userId: req.user?.id,
        sessionId: req.user?.sessionId,
        ip: req.ip
      });

      next(error);
    }
  };

  requireRole = (roles: string | string[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      try {
        if (!req.user) {
          throw AuthErrorFactory.unauthorized('Authentication required');
        }

        const userRoles = req.user.roles || [req.user.role];
        const requiredRoles = Array.isArray(roles) ? roles : [roles];
        
        const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));
        
        if (!hasRequiredRole) {
          this.logger.warn('Insufficient permissions', {
            userId: req.user.id,
            userRoles,
            requiredRoles,
            path: req.path,
            ip: req.ip
          });

          throw AuthErrorFactory.forbidden('Insufficient permissions');
        }

        this.logger.debug('Role authorization successful', {
          userId: req.user.id,
          userRoles,
          requiredRoles,
          path: req.path
        });

        next();

      } catch (error) {
        next(error);
      }
    };
  };

  requireEmailVerification = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw AuthErrorFactory.unauthorized('Authentication required');
      }

      if (!req.user.isEmailVerified) {
        this.logger.warn('Email verification required', {
          userId: req.user.id,
          email: this.maskEmail(req.user.email),
          path: req.path,
          ip: req.ip
        });

        throw AuthErrorFactory.forbidden('Email verification required');
      }

      next();

    } catch (error) {
      next(error);
    }
  };

  requirePhoneVerification = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw AuthErrorFactory.unauthorized('Authentication required');
      }

      if (!req.user.isPhoneVerified) {
        this.logger.warn('Phone verification required', {
          userId: req.user.id,
          path: req.path,
          ip: req.ip
        });

        throw AuthErrorFactory.forbidden('Phone verification required');
      }

      next();

    } catch (error) {
      next(error);
    }
  };

  validateProfileOwnership = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AuthErrorFactory.unauthorized('Authentication required');
      }

      const profileId = req.params.id;
      if (!profileId) {
        throw AuthErrorFactory.validationError('Profile ID required');
      }

      if (req.user.roles?.includes('admin')) {
        return next();
      }

      const profileService = this.serviceContainer.getProfileService();
      const profileResult = await profileService.getProfileById(profileId);

      if (!profileResult.success) {
        throw AuthErrorFactory.notFound('Profile not found');
      }

      if (profileResult.data.userId !== req.user.id) {
        this.logger.warn('Profile ownership validation failed', {
          userId: req.user.id,
          profileId,
          profileOwnerId: profileResult.data.userId,
          path: req.path,
          ip: req.ip
        });

        throw AuthErrorFactory.forbidden('You do not have permission to access this profile');
      }

      this.logger.debug('Profile ownership validated', {
        userId: req.user.id,
        profileId,
        path: req.path
      });

      next();

    } catch (error) {
      next(error);
    }
  };

  private extractToken(req: Request): string | null {
    const authHeader = req.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    const cookieToken = req.cookies?.accessToken;
    if (cookieToken) {
      return cookieToken;
    }

    return null;
  }

  private verifyToken(token: string): JWTPayload {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }

    try {
      const decoded = jwt.verify(token, secret) as JWTPayload;
      return decoded;
    } catch (error) {
      throw error;
    }
  }

  private maskEmail(email: string): string {
    if (!email || !email.includes('@')) return email;
    const [username, domain] = email.split('@');
    const maskedUsername = username.length > 2 
      ? username.substring(0, 2) + '*'.repeat(username.length - 2)
      : username;
    return `${maskedUsername}@${domain}`;
  }
}

export function createAuthMiddleware(serviceContainer: ServiceContainer): AuthMiddleware {
  return new AuthMiddleware(serviceContainer);
}

export function createAuthMiddlewareFunctions(serviceContainer: ServiceContainer) {
  const authMiddleware = new AuthMiddleware(serviceContainer);
  
  return {
    authenticate: authMiddleware.authenticate,
    optionalAuthenticate: authMiddleware.optionalAuthenticate,
    validateSession: authMiddleware.validateSession,
    requireRole: authMiddleware.requireRole,
    requireEmailVerification: authMiddleware.requireEmailVerification,
    requirePhoneVerification: authMiddleware.requirePhoneVerification,
    validateProfileOwnership: authMiddleware.validateProfileOwnership
  };
}

export default AuthMiddleware;
