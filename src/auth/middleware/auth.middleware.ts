import { Request, Response, NextFunction } from 'express';
import { TokenService } from '../services';
import { UserService } from '../services';
import { AppError } from '../../shared/utils';
import { HTTP_STATUS_CODES, ERROR_CODES } from '../../config/auth';
import { extractTokenFromHeader } from '../utils';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    emailVerified: boolean;
  };
}

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new AppError(
        'Access token required',
        HTTP_STATUS_CODES.UNAUTHORIZED,
        ERROR_CODES.INVALID_TOKEN
      );
    }

    const token = extractTokenFromHeader(authHeader);
    if (!token) {
      throw new AppError(
        'Invalid authorization header format',
        HTTP_STATUS_CODES.UNAUTHORIZED,
        ERROR_CODES.INVALID_TOKEN
      );
    }

    const tokenService = new TokenService();
    const isBlacklisted = await tokenService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      throw new AppError(
        'Token has been revoked',
        HTTP_STATUS_CODES.UNAUTHORIZED,
        ERROR_CODES.INVALID_TOKEN
      );
    }

    const tokenData = await tokenService.verifyAccessToken(token);
    const userService = new UserService();
    const user = await userService.getUserById(tokenData.userId);

    if (!user) {
      throw new AppError(
        'User not found',
        HTTP_STATUS_CODES.UNAUTHORIZED,
        ERROR_CODES.INVALID_CREDENTIALS
      );
    }

    if (user.status === 'suspended') {
      throw new AppError(
        'Account has been suspended',
        HTTP_STATUS_CODES.FORBIDDEN,
        ERROR_CODES.ACCOUNT_LOCKED
      );
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AppError(
        'Account is temporarily locked',
        HTTP_STATUS_CODES.FORBIDDEN,
        ERROR_CODES.ACCOUNT_LOCKED
      );
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified
    };

    next();
  } catch (error) {
    next(error);
  }
};

export const requireEmailVerification = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw new AppError(
        'Access token required',
        HTTP_STATUS_CODES.UNAUTHORIZED,
        ERROR_CODES.INVALID_TOKEN
      );
    }

    const token = extractTokenFromHeader(authHeader);
    if (!token) {
      throw new AppError(
        'Invalid authorization header format',
        HTTP_STATUS_CODES.UNAUTHORIZED,
        ERROR_CODES.INVALID_TOKEN
      );
    }

    const tokenService = new TokenService();
    const tokenData = await tokenService.verifyAccessToken(token);
    const userService = new UserService();
    const user = await userService.getUserById(tokenData.userId);

    if (!user) {
      throw new AppError(
        'User not found',
        HTTP_STATUS_CODES.UNAUTHORIZED,
        ERROR_CODES.INVALID_CREDENTIALS
      );
    }

    if (!user.emailVerified) {
      throw new AppError(
        'Email verification required',
        HTTP_STATUS_CODES.FORBIDDEN,
        ERROR_CODES.EMAIL_NOT_VERIFIED
      );
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified
    };

    next();
  } catch (error) {
    next(error);
  }
};

export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return next();
    }

    const token = extractTokenFromHeader(authHeader);
    if (!token) {
      return next();
    }

    const tokenService = new TokenService();
    const isBlacklisted = await tokenService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      return next();
    }

    const tokenData = await tokenService.verifyAccessToken(token);
    const userService = new UserService();
    const user = await userService.getUserById(tokenData.userId);

    if (user && user.status !== 'suspended') {
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified
      };
    }

    next();
  } catch (error) {
    next();
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError(
        'Authentication required',
        HTTP_STATUS_CODES.UNAUTHORIZED,
        ERROR_CODES.INVALID_CREDENTIALS
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new AppError(
        'Insufficient permissions',
        HTTP_STATUS_CODES.FORBIDDEN,
        ERROR_CODES.INVALID_CREDENTIALS
      );
    }

    next();
  };
};

export const requireVerifiedEmail = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    throw new AppError(
      'Authentication required',
      HTTP_STATUS_CODES.UNAUTHORIZED,
      ERROR_CODES.INVALID_CREDENTIALS
    );
  }

  if (!req.user.emailVerified) {
    throw new AppError(
      'Email verification required',
      HTTP_STATUS_CODES.FORBIDDEN,
      ERROR_CODES.EMAIL_NOT_VERIFIED
    );
  }

  next();
};

export const requireActiveAccount = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    throw new AppError(
      'Authentication required',
      HTTP_STATUS_CODES.UNAUTHORIZED,
      ERROR_CODES.INVALID_CREDENTIALS
    );
  }

  next();
};

export const attachUser = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (req.user) {
    res.locals.userId = req.user.id;
    res.locals.userRole = req.user.role;
    res.locals.userEmail = req.user.email;
  }
  next();
};
