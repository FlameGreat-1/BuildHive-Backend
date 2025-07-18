import { Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../../auth/middleware/auth.middleware';
import { UserRole } from '../../shared/types';
import { sendUnauthorizedError, sendForbiddenError } from '../../shared/utils';
import { logger } from '../../shared/utils';
import { validateUserRole } from '../utils';

export const authenticateCreditAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await new Promise<void>((resolve, reject) => {
      authenticateToken(req, res, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId) {
      const requestId = res.locals.requestId || 'unknown';
      logger.warn('Credit access attempted without user ID', {
        requestId,
        ip: req.ip,
        path: req.path,
        method: req.method
      });
      return sendUnauthorizedError(res, 'Authentication required for credit operations');
    }

    const roleValidation = validateUserRole(userRole, [
      UserRole.CLIENT,
      UserRole.TRADIE,
      UserRole.ENTERPRISE
    ]);

    if (!roleValidation.valid) {
      const requestId = res.locals.requestId || 'unknown';
      logger.warn('Credit access denied - invalid role', {
        requestId,
        userId,
        userRole,
        ip: req.ip,
        path: req.path,
        method: req.method
      });
      return sendForbiddenError(res, roleValidation.reason || 'Insufficient permissions for credit operations');
    }

    next();
  } catch (error) {
    const requestId = res.locals.requestId || 'unknown';
    logger.error('Credit authentication error', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    return sendUnauthorizedError(res, 'Authentication failed');
  }
};

export const requireTradieOrEnterprise = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const userRole = req.user?.role;
  const userId = req.user?.id;

  const roleValidation = validateUserRole(userRole, [
    UserRole.TRADIE,
    UserRole.ENTERPRISE
  ]);

  if (!roleValidation.valid) {
    const requestId = res.locals.requestId || 'unknown';
    logger.warn('Credit operation denied - tradie/enterprise required', {
      requestId,
      userId,
      userRole,
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    return sendForbiddenError(res, 'Tradie or Enterprise access required');
  }

  next();
};

export const requireEnterpriseAccess = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const userRole = req.user?.role;
  const userId = req.user?.id;

  if (userRole !== UserRole.ENTERPRISE) {
    const requestId = res.locals.requestId || 'unknown';
    logger.warn('Credit operation denied - enterprise required', {
      requestId,
      userId,
      userRole,
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    return sendForbiddenError(res, 'Enterprise access required');
  }

  next();
};

export const validateCreditOwnership = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const userId = req.user?.id;
  const targetUserId = req.params.userId || req.body.userId || req.query.userId;

  if (!userId) {
    const requestId = res.locals.requestId || 'unknown';
    logger.warn('Credit ownership validation failed - no user ID', {
      requestId,
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    return sendUnauthorizedError(res, 'Authentication required');
  }

  if (targetUserId && parseInt(targetUserId) !== userId && req.user?.role !== UserRole.ENTERPRISE) {
    const requestId = res.locals.requestId || 'unknown';
    logger.warn('Credit ownership validation failed - access denied', {
      requestId,
      userId,
      targetUserId,
      userRole: req.user?.role,
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    return sendForbiddenError(res, 'Access denied - can only access own credit data');
  }

  next();
};

export const validateCreditPurchaseAccess = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId) {
    const requestId = res.locals.requestId || 'unknown';
    logger.warn('Credit purchase access denied - no user ID', {
      requestId,
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    return sendUnauthorizedError(res, 'Authentication required for credit purchases');
  }

  const roleValidation = validateUserRole(userRole, [
    UserRole.CLIENT,
    UserRole.TRADIE,
    UserRole.ENTERPRISE
  ]);

  if (!roleValidation.valid) {
    const requestId = res.locals.requestId || 'unknown';
    logger.warn('Credit purchase access denied - invalid role', {
      requestId,
      userId,
      userRole,
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    return sendForbiddenError(res, 'Insufficient permissions for credit purchases');
  }

  next();
};

export const validateCreditUsageAccess = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId) {
    const requestId = res.locals.requestId || 'unknown';
    logger.warn('Credit usage access denied - no user ID', {
      requestId,
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    return sendUnauthorizedError(res, 'Authentication required for credit usage');
  }

  const roleValidation = validateUserRole(userRole, [
    UserRole.TRADIE,
    UserRole.ENTERPRISE
  ]);

  if (!roleValidation.valid) {
    const requestId = res.locals.requestId || 'unknown';
    logger.warn('Credit usage access denied - invalid role', {
      requestId,
      userId,
      userRole,
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    return sendForbiddenError(res, 'Only tradies and enterprises can use credits');
  }

  next();
};

export const validateAutoTopupAccess = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId) {
    const requestId = res.locals.requestId || 'unknown';
    logger.warn('Auto topup access denied - no user ID', {
      requestId,
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    return sendUnauthorizedError(res, 'Authentication required for auto topup');
  }

  const roleValidation = validateUserRole(userRole, [
    UserRole.TRADIE,
    UserRole.ENTERPRISE
  ]);

  if (!roleValidation.valid) {
    const requestId = res.locals.requestId || 'unknown';
    logger.warn('Auto topup access denied - invalid role', {
      requestId,
      userId,
      userRole,
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    return sendForbiddenError(res, 'Auto topup is only available for tradies and enterprises');
  }

  next();
};

export const validateCreditRefundAccess = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId) {
    const requestId = res.locals.requestId || 'unknown';
    logger.warn('Credit refund access denied - no user ID', {
      requestId,
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    return sendUnauthorizedError(res, 'Authentication required for credit refunds');
  }

  const roleValidation = validateUserRole(userRole, [
    UserRole.CLIENT,
    UserRole.TRADIE,
    UserRole.ENTERPRISE
  ]);

  if (!roleValidation.valid) {
    const requestId = res.locals.requestId || 'unknown';
    logger.warn('Credit refund access denied - invalid role', {
      requestId,
      userId,
      userRole,
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    return sendForbiddenError(res, 'Insufficient permissions for credit refunds');
  }

  next();
};
