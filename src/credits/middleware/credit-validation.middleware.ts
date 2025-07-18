import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { CreditUsageType, CreditPackageType } from '../../shared/types';
import { sendValidationError, sendBadRequestError } from '../../shared/utils';
import { logger } from '../../shared/utils';
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
  req: Request,
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
    
    return sendValidationError(res, 'Validation failed', errors.array());
  }
  
  next();
};

export const validateSufficientBalance = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { creditsToUse, usageType } = req.body;
    
    if (!userId) {
      return sendBadRequestError(res, 'User ID is required');
    }

    const config = CREDIT_USAGE_CONFIGS[usageType as CreditUsageType];
    const requiredCredits = creditsToUse || config?.creditsRequired || 0;

    const currentBalance = req.user?.creditBalance || 0;
    
    const balanceCheck = validateCreditSufficiency(userId, currentBalance, requiredCredits);
    
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
      
      return sendBadRequestError(res, `Insufficient credits. You need ${balanceCheck.shortfall} more credits.`);
    }

    next();
  } catch (error) {
    const requestId = res.locals.requestId || 'unknown';
    logger.error('Balance validation error', {
      requestId,
      userId: req.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return sendBadRequestError(res, 'Failed to validate credit balance');
  }
};

export const validateUsageLimits = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { usageType, creditsToUse } = req.body;
    
    if (!userId || !usageType) {
      return sendBadRequestError(res, 'User ID and usage type are required');
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
      
      return sendBadRequestError(res, usageValidation.reason || 'Usage validation failed');
    }

    next();
  } catch (error) {
    const requestId = res.locals.requestId || 'unknown';
    logger.error('Usage limits validation error', {
      requestId,
      userId: req.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return sendBadRequestError(res, 'Failed to validate usage limits');
  }
};

export const validatePurchaseLimits = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const { packageType } = req.body;
    
    if (!userId || !userRole || !packageType) {
      return sendBadRequestError(res, 'User information and package type are required');
    }

    const currentBalance = req.user?.creditBalance || 0;
    const dailySpent = req.user?.dailySpent || 0;
    const monthlySpent = req.user?.monthlySpent || 0;

    const purchaseValidation = validateCreditPurchase({
      packageType,
      userId,
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
      
      return sendBadRequestError(res, purchaseValidation.reason || 'Purchase validation failed');
    }

    next();
  } catch (error) {
    const requestId = res.locals.requestId || 'unknown';
    logger.error('Purchase limits validation error', {
      requestId,
      userId: req.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return sendBadRequestError(res, 'Failed to validate purchase limits');
  }
};

export const validateAutoTopupConfiguration = async (
  req: Request,
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
      
      return sendBadRequestError(res, autoTopupValidation.reason || 'Auto topup validation failed');
    }

    next();
  } catch (error) {
    const requestId = res.locals.requestId || 'unknown';
    logger.error('Auto topup validation error', {
      requestId,
      userId: req.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return sendBadRequestError(res, 'Failed to validate auto topup configuration');
  }
};

export const validateRefundRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { transactionId, reason } = req.body;
    const userId = req.user?.id;
    
    if (!userId || !transactionId || !reason) {
      return sendBadRequestError(res, 'User ID, transaction ID, and reason are required');
    }

    const purchaseDate = req.transaction?.createdAt || new Date();
    const creditsUsed = req.transaction?.creditsUsed || 0;
    const totalCredits = req.transaction?.totalCredits || 0;

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
      
      return sendBadRequestError(res, refundValidation.reason || 'Refund validation failed');
    }

    next();
  } catch (error) {
    const requestId = res.locals.requestId || 'unknown';
    logger.error('Refund validation error', {
      requestId,
      userId: req.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return sendBadRequestError(res, 'Failed to validate refund request');
  }
};

export const validateTransactionLimits = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const { credits, transactionType } = req.body;
    
    if (!userId || !userRole) {
      return sendBadRequestError(res, 'User information is required');
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
      
      return sendBadRequestError(res, amountValidation.reason || 'Transaction amount validation failed');
    }

    const limits = getLimitsForRole(userRole);
    const dailyTransactions = req.user?.dailyTransactions || 0;
    const monthlyTransactions = req.user?.monthlyTransactions || 0;

    if (dailyTransactions >= limits.maxTransactionsPerDay) {
      return sendBadRequestError(res, `Daily transaction limit of ${limits.maxTransactionsPerDay} exceeded`);
    }

    if (monthlyTransactions >= limits.maxTransactionsPerMonth) {
      return sendBadRequestError(res, `Monthly transaction limit of ${limits.maxTransactionsPerMonth} exceeded`);
    }

    next();
  } catch (error) {
    const requestId = res.locals.requestId || 'unknown';
    logger.error('Transaction limits validation error', {
      requestId,
      userId: req.user?.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return sendBadRequestError(res, 'Failed to validate transaction limits');
  }
};

export const validateBusinessHours = (
  req: Request,
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
    return sendBadRequestError(res, 'Credit operations are not available on weekends');
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
    return sendBadRequestError(res, 'Credit operations are only available between 6 AM and 10 PM');
  }

  next();
};
