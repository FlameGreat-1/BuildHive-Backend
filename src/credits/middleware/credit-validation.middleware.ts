import { Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { CreditUsageType, CreditPackageType, UserRole, ValidationError } from '../../shared/types';
import { sendValidationError, sendError } from '../../shared/utils';
import { logger } from '../../shared/utils';
import { AuthenticatedRequest } from '../../auth/middleware';
import { 
  validateCreditSufficiency,
  validateCreditUsage,
  validateCreditPurchase,
  validateAutoTopupSettings,
  validateRefundEligibility,
  validateTransactionAmount,
  validateRateLimit
} from '../utils';
import { 
  CREDIT_USAGE_CONFIGS,
  getLimitsForRole,
  TRANSACTION_LIMITS
} from '../../config/credits';

export const handleValidationErrors = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const requestId = res.locals.requestId || 'unknown';
    const userId = req.user?.id;
    
    logger.warn('Credit validation failed', {
      requestId,
      userId,
      errors: errors.array(),
      path: req.path,
      method: req.method,
      body: req.body
    });
    
    const validationErrors: ValidationError[] = errors.array().map(error => ({
      field: error.type === 'field' ? error.path : 'unknown',
      message: error.msg,
      code: 'VALIDATION_ERROR'
    }));
    
    sendValidationError(res, 'Validation failed', validationErrors);
    return;
  }
  
  next();
};

export const validateSufficientBalance = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { creditsToUse, usageType } = req.body;
    
    if (!userId) {
      sendError(res, 'User ID is required', 400);
      return;
    }

    const config = CREDIT_USAGE_CONFIGS[usageType as CreditUsageType];
    const requiredCredits = creditsToUse || config?.creditsRequired || 0;

    const currentBalance = req.user?.creditBalance || 0;
    
    const balanceCheck = validateCreditSufficiency(parseInt(userId), currentBalance, requiredCredits);
    
    if (!balanceCheck.sufficient) {
      const requestId = res.locals.requestId || 'unknown';
      logger.warn('Insufficient credit balance', {
        requestId,
        userId,
        currentBalance,
        requiredCredits,
        shortfall: balanceCheck.shortfall,
        usageType
      });
      
      sendError(res, `Insufficient credits. You need ${balanceCheck.shortfall} more credits.`, 400);
      return;
    }

    next();
  } catch (error) {
    const requestId = res.locals.requestId || 'unknown';
    logger.error('Balance validation error', {
      requestId,
      userId: req.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    sendError(res, 'Failed to validate credit balance', 400);
    return;
  }
};

export const validateUsageLimits = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { usageType, creditsToUse } = req.body;
    
    if (!userId || !usageType) {
      sendError(res, 'User ID and usage type are required', 400);
      return;
    }

    const currentBalance = req.user?.creditBalance || 0;
    const dailyUsage = req.user?.dailyUsage || 0;
    const monthlyUsage = req.user?.monthlyUsage || 0;

    const usageValidation = validateCreditUsage(
      usageType,
      creditsToUse,
      currentBalance,
      dailyUsage,
      monthlyUsage
    );

    if (!usageValidation.valid) {
      const requestId = res.locals.requestId || 'unknown';
      logger.warn('Credit usage validation failed', {
        requestId,
        userId,
        usageType,
        creditsToUse,
        reason: usageValidation.reason,
        dailyUsage,
        monthlyUsage
      });
      
      sendError(res, usageValidation.reason || 'Usage validation failed', 400);
      return;
    }

    next();
  } catch (error) {
    const requestId = res.locals.requestId || 'unknown';
    logger.error('Usage limits validation error', {
      requestId,
      userId: req.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    sendError(res, 'Failed to validate usage limits', 400);
    return;
  }
};

export const validatePurchaseLimits = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const { packageType } = req.body;
    
    if (!userId || !userRole || !packageType) {
      sendError(res, 'User information and package type are required', 400);
      return;
    }

    const currentBalance = req.user?.creditBalance || 0;
    const dailySpent = req.user?.dailySpent || 0;
    const monthlySpent = req.user?.monthlySpent || 0;

    const purchaseValidation = validateCreditPurchase({
      packageType,
      userId: parseInt(userId),
      userRole,
      currentBalance,
      dailySpent,
      monthlySpent
    });

    if (!purchaseValidation.valid) {
      const requestId = res.locals.requestId || 'unknown';
      logger.warn('Credit purchase validation failed', {
        requestId,
        userId,
        userRole,
        packageType,
        reason: purchaseValidation.reason,
        dailySpent,
        monthlySpent
      });
      
      sendError(res, purchaseValidation.reason || 'Purchase validation failed', 400);
      return;
    }

    next();
  } catch (error) {
    const requestId = res.locals.requestId || 'unknown';
    logger.error('Purchase limits validation error', {
      requestId,
      userId: req.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    sendError(res, 'Failed to validate purchase limits', 400);
    return;
  }
};

export const validateAutoTopupConfiguration = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { enabled, triggerBalance, topupAmount, packageType } = req.body;
    
    if (!enabled) {
      return next();
    }

    const autoTopupValidation = validateAutoTopupSettings(
      triggerBalance,
      topupAmount,
      packageType as CreditPackageType
    );

    if (!autoTopupValidation.valid) {
      const requestId = res.locals.requestId || 'unknown';
      const userId = req.user?.id;
      
      logger.warn('Auto topup validation failed', {
        requestId,
        userId,
        triggerBalance,
        topupAmount,
        packageType,
        reason: autoTopupValidation.reason
      });
      
      sendError(res, autoTopupValidation.reason || 'Auto topup validation failed', 400);
      return;
    }

    next();
  } catch (error) {
    const requestId = res.locals.requestId || 'unknown';
    logger.error('Auto topup validation error', {
      requestId,
      userId: req.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    sendError(res, 'Failed to validate auto topup configuration', 400);
    return;
  }
};

export const validateRefundRequest = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { transactionId, reason } = req.body;
    const userId = req.user?.id;
    
    if (!userId || !transactionId || !reason) {
      sendError(res, 'User ID, transaction ID, and reason are required', 400);
      return;
    }

    const purchaseDate = new Date();
    const creditsUsed = 0;
    const totalCredits = 0;

    const refundValidation = validateRefundEligibility(
      purchaseDate,
      creditsUsed,
      totalCredits
    );

    if (!refundValidation.valid) {
      const requestId = res.locals.requestId || 'unknown';
      logger.warn('Refund validation failed', {
        requestId,
        userId,
        transactionId,
        reason: refundValidation.reason,
        purchaseDate,
        creditsUsed,
        totalCredits
      });
      
      sendError(res, refundValidation.reason || 'Refund validation failed', 400);
      return;
    }

    next();
  } catch (error) {
    const requestId = res.locals.requestId || 'unknown';
    logger.error('Refund validation error', {
      requestId,
      userId: req.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    sendError(res, 'Failed to validate refund request', 400);
    return;
  }
};

export const validateTransactionLimits = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const { credits, transactionType } = req.body;
    
    if (!userId || !userRole) {
      sendError(res, 'User information is required', 400);
      return;
    }

    const amountValidation = validateTransactionAmount(credits, transactionType);
    
    if (!amountValidation.valid) {
      const requestId = res.locals.requestId || 'unknown';
      logger.warn('Transaction amount validation failed', {
        requestId,
        userId,
        credits,
        transactionType,
        reason: amountValidation.reason
      });
      
      sendError(res, amountValidation.reason || 'Transaction amount validation failed', 400);
      return;
    }

    const limits = getLimitsForRole(userRole as UserRole);
    const dailyTransactions = req.user?.dailyTransactions || 0;
    const monthlyTransactions = req.user?.monthlyTransactions || 0;

    if (dailyTransactions >= limits.maxTransactionsPerDay) {
      sendError(res, `Daily transaction limit of ${limits.maxTransactionsPerDay} exceeded`, 400);
      return;
    }

    if (monthlyTransactions >= limits.maxTransactionsPerMonth) {
      sendError(res, `Monthly transaction limit of ${limits.maxTransactionsPerMonth} exceeded`, 400);
      return;
    }

    next();
  } catch (error) {
    const requestId = res.locals.requestId || 'unknown';
    logger.error('Transaction limits validation error', {
      requestId,
      userId: req.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    sendError(res, 'Failed to validate transaction limits', 400);
    return;
  }
};

export const validateBusinessHours = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();

  if (day === 0 || day === 6) {
    const requestId = res.locals.requestId || 'unknown';
    logger.warn('Credit operation attempted outside business hours', {
      requestId,
      userId: req.user?.id,
      day,
      hour,
      path: req.path
    });
    sendError(res, 'Credit operations are not available on weekends', 400);
    return;
  }

  if (hour < 6 || hour > 22) {
    const requestId = res.locals.requestId || 'unknown';
    logger.warn('Credit operation attempted outside business hours', {
      requestId,
      userId: req.user?.id,
      day,
      hour,
      path: req.path
    });
    sendError(res, 'Credit operations are only available between 6 AM and 10 PM', 400);
    return;
  }

  next();
};
