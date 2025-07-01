import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractTokenFromHeader } from '../utils';
import { UserService } from '../services';
import { AppError } from '../../shared/utils';
import { HTTP_STATUS_CODES, ERROR_CODES } from '../../config/auth';
import { AuthTokenPayload } from '../types';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    emailVerified: boolean;
  };
}

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

    const decoded: AuthTokenPayload = verifyToken(token);
    const userService = new UserService();
    const user = await userService.getUserById(decoded.userId);

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
        ERROR_CODES.INVALID_CREDENTIALS
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

    const decoded: AuthTokenPayload = verifyToken(token);
    const userService = new UserService();
    const user = await userService.getUserById(decoded.userId);

    if (user) {
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
