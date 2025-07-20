import { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../auth/middleware/auth.middleware';
import { UserRole } from '../../shared/types';
import { sendError } from '../../shared/utils';
import { logger } from '../../shared/utils';
import { validateUserRole } from '../utils';

export const authenticateCreditAccess = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await new Promise<void>((resolve, reject) => {
      authenticate(req, res, (error) => {
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
      sendError(res, 'Authentication required for credit operations', 401);
      return;
    }

    const roleValidation = validateUserRole(userRole || '', [
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
      sendError(res, roleValidation.reason || 'Insufficient permissions for credit operations', 403);
      return;
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
    sendError(res, 'Authentication failed', 401);
    return;
  }
};

export const requireTradieOrEnterprise = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const userRole = req.user?.role;
  const userId = req.user?.id;

  const roleValidation = validateUserRole(userRole || '', [
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
    sendError(res, 'Tradie or Enterprise access required', 403);
    return;
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
    sendError(res, 'Enterprise access required', 403);
    return;
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
    sendError(res, 'Authentication required', 401);
    return;
  }

  if (targetUserId && targetUserId !== userId && req.user?.role !== UserRole.ENTERPRISE) {
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
    sendError(res, 'Access denied - can only access own credit data', 403);
    return;
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
    sendError(res, 'Authentication required for credit purchases', 401);
    return;
  }

  const roleValidation = validateUserRole(userRole || '', [
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
    sendError(res, 'Insufficient permissions for credit purchases', 403);
    return;
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
    sendError(res, 'Authentication required for credit usage', 401);
    return;
  }

  const roleValidation = validateUserRole(userRole || '', [
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
    sendError(res, 'Only tradies and enterprises can use credits', 403);
    return;
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
    sendError(res, 'Authentication required for auto topup', 401);
    return;
  }

  const roleValidation = validateUserRole(userRole || '', [
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
    sendError(res, 'Auto topup is only available for tradies and enterprises', 403);
    return;
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
    sendError(res, 'Authentication required for credit refunds', 401);
    return;
  }

  const roleValidation = validateUserRole(userRole || '', [
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
    sendError(res, 'Insufficient permissions for credit refunds', 403);
    return;
  }

  next();
};
