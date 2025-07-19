import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { AUTH_CONSTANTS, HTTP_STATUS_CODES } from '../../config/auth';
import { sendRateLimitError } from '../utils';
import { logger } from '../utils';

const createRateLimitHandler = (message: string) => {
  return (req: Request, res: Response): Response => {
    const requestId = res.locals.requestId || 'unknown';
    
    logger.warn('Rate limit exceeded', {
      requestId,
      ip: req.ip,
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent')
    });

    return sendRateLimitError(res, message);
  };
};

export const registrationRateLimit = rateLimit({
  windowMs: AUTH_CONSTANTS.RATE_LIMITS.REGISTRATION.WINDOW_MS,
  max: AUTH_CONSTANTS.RATE_LIMITS.REGISTRATION.MAX_ATTEMPTS,
  message: 'Too many registration attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many registration attempts from this IP, please try again after 15 minutes'),
  keyGenerator: (req: Request): string => {
    return req.ip || 'unknown';
  },
  skip: (req: Request): boolean => {
    return req.ip === '127.0.0.1' || req.ip === '::1';
  }
});

export const loginRateLimit = rateLimit({
  windowMs: AUTH_CONSTANTS.RATE_LIMITS.LOGIN.WINDOW_MS,
  max: AUTH_CONSTANTS.RATE_LIMITS.LOGIN.MAX_ATTEMPTS,
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many login attempts from this IP, please try again after 15 minutes'),
  keyGenerator: (req: Request): string => {
    const email = req.body?.email;
    return email ? `${req.ip}-${email}` : req.ip || 'unknown';
  },
  skip: (req: Request): boolean => {
    return req.ip === '127.0.0.1' || req.ip === '::1';
  }
});

export const passwordResetRateLimit = rateLimit({
  windowMs: AUTH_CONSTANTS.RATE_LIMITS.PASSWORD_RESET.WINDOW_MS,
  max: AUTH_CONSTANTS.RATE_LIMITS.PASSWORD_RESET.MAX_ATTEMPTS,
  message: 'Too many password reset attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many password reset attempts from this IP, please try again after 1 hour'),
  keyGenerator: (req: Request): string => {
    const email = req.body?.email;
    return email ? `${req.ip}-${email}` : req.ip || 'unknown';
  },
  skip: (req: Request): boolean => {
    return req.ip === '127.0.0.1' || req.ip === '::1';
  }
});

export const changePasswordRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many password change attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many password change attempts, please try again after 15 minutes'),
  keyGenerator: (req: Request): string => {
    return req.ip || 'unknown';
  },
  skip: (req: Request): boolean => {
    return req.ip === '127.0.0.1' || req.ip === '::1';
  }
});

export const emailVerificationRateLimit = rateLimit({
  windowMs: AUTH_CONSTANTS.RATE_LIMITS.EMAIL_VERIFICATION.WINDOW_MS,
  max: AUTH_CONSTANTS.RATE_LIMITS.EMAIL_VERIFICATION.MAX_ATTEMPTS,
  message: 'Too many email verification attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many email verification attempts from this IP, please try again after 1 hour'),
  keyGenerator: (req: Request): string => {
    const email = req.body?.email || req.query?.email;
    return email ? `${req.ip}-${email}` : req.ip || 'unknown';
  }
});

export const refreshTokenRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: 'Too many token refresh attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many token refresh attempts, please try again after 5 minutes'),
  keyGenerator: (req: Request): string => {
    return req.ip || 'unknown';
  },
  skip: (req: Request): boolean => {
    return req.ip === '127.0.0.1' || req.ip === '::1';
  }
});

export const profileUpdateRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: 'Too many profile update attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many profile update attempts, please try again after 10 minutes'),
  keyGenerator: (req: Request): string => {
    return req.ip || 'unknown';
  },
  skip: (req: Request): boolean => {
    return req.ip === '127.0.0.1' || req.ip === '::1';
  }
});

export const generalApiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many requests from this IP, please try again after 15 minutes'),
  keyGenerator: (req: Request): string => {
    return req.ip || 'unknown';
  }
});

export const strictRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: 'Too many requests, please slow down',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many requests, please slow down and try again in 5 minutes')
});

export const validationRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 50,
  message: 'Too many validation requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many validation requests from this IP, please try again after 10 minutes'),
  keyGenerator: (req: Request): string => {
    return req.ip || 'unknown';
  },
  skip: (req: Request): boolean => {
    return req.ip === '127.0.0.1' || req.ip === '::1';
  }
});

export const logoutRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: 'Too many logout attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many logout attempts, please try again after 5 minutes'),
  keyGenerator: (req: Request): string => {
    return req.ip || 'unknown';
  },
  skip: (req: Request): boolean => {
    return req.ip === '127.0.0.1' || req.ip === '::1';
  }
});

export const jobCreationRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: 'Too many job creation attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many job creation attempts, please try again after 10 minutes'),
  keyGenerator: (req: Request): string => {
    const userId = req.user?.id;
    return userId ? `job-create-${userId}` : req.ip || 'unknown';
  }
});

export const jobUpdateRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 50,
  message: 'Too many job update attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many job update attempts, please try again after 5 minutes'),
  keyGenerator: (req: Request): string => {
    const userId = req.user?.id;
    return userId ? `job-update-${userId}` : req.ip || 'unknown';
  }
});

export const fileUploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many file upload attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many file upload attempts, please try again after 15 minutes'),
  keyGenerator: (req: Request): string => {
    const userId = req.user?.id;
    return userId ? `file-upload-${userId}` : req.ip || 'unknown';
  }
});

export const clientOperationRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 40,
  message: 'Too many client operations, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many client operations, please try again after 10 minutes'),
  keyGenerator: (req: Request): string => {
    const userId = req.user?.id;
    return userId ? `client-ops-${userId}` : req.ip || 'unknown';
  }
});

export const materialUpdateRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 60,
  message: 'Too many material updates, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many material updates, please try again after 5 minutes'),
  keyGenerator: (req: Request): string => {
    const userId = req.user?.id;
    return userId ? `material-update-${userId}` : req.ip || 'unknown';
  }
});

export const jobSearchRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: 'Too many search requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many search requests, please try again after 1 minute'),
  keyGenerator: (req: Request): string => {
    const userId = req.user?.id;
    return userId ? `job-search-${userId}` : req.ip || 'unknown';
  }
});

export const quoteCreationRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 25,
  message: 'Too many quote creation attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many quote creation attempts, please try again after 10 minutes'),
  keyGenerator: (req: Request): string => {
    const userId = req.user?.id;
    return userId ? `quote-create-${userId}` : req.ip || 'unknown';
  }
});

export const quoteUpdateRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 40,
  message: 'Too many quote update attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many quote update attempts, please try again after 5 minutes'),
  keyGenerator: (req: Request): string => {
    const userId = req.user?.id;
    return userId ? `quote-update-${userId}` : req.ip || 'unknown';
  }
});

export const quoteSendRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Too many quote send attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many quote send attempts, please try again after 15 minutes'),
  keyGenerator: (req: Request): string => {
    const userId = req.user?.id;
    return userId ? `quote-send-${userId}` : req.ip || 'unknown';
  }
});

export const aiPricingRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: 'Too many AI pricing requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many AI pricing requests, please try again after 5 minutes'),
  keyGenerator: (req: Request): string => {
    const userId = req.user?.id;
    return userId ? `ai-pricing-${userId}` : req.ip || 'unknown';
  }
});

export const quoteViewRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 50,
  message: 'Too many quote view requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many quote view requests, please try again after 1 minute'),
  keyGenerator: (req: Request): string => {
    return req.ip || 'unknown';
  }
});

export const quoteSearchRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: 'Too many quote search requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many quote search requests, please try again after 1 minute'),
  keyGenerator: (req: Request): string => {
    const userId = req.user?.id;
    return userId ? `quote-search-${userId}` : req.ip || 'unknown';
  }
});

export const quoteStatusChangeRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  message: 'Too many quote status changes, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many quote status changes, please try again after 5 minutes'),
  keyGenerator: (req: Request): string => {
    const userId = req.user?.id;
    return userId ? `quote-status-${userId}` : req.ip || 'unknown';
  }
});

export const quoteOperationRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 50,
  message: 'Too many quote operations, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many quote operations, please try again after 10 minutes'),
  keyGenerator: (req: Request): string => {
    const userId = req.user?.id;
    return userId ? `quote-ops-${userId}` : req.ip || 'unknown';
  }
});

export const paymentIntentRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: 'Too many payment intent requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many payment intent requests, please try again after 5 minutes'),
  keyGenerator: (req: Request): string => {
    const userId = req.user?.id;
    return userId ? `payment-intent-${userId}` : req.ip || 'unknown';
  }
});

export const paymentProcessingRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 15,
  message: 'Too many payment processing attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many payment processing attempts, please try again after 10 minutes'),
  keyGenerator: (req: Request): string => {
    const userId = req.user?.id;
    return userId ? `payment-process-${userId}` : req.ip || 'unknown';
  }
});

export const refundProcessingRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many refund requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many refund requests, please try again after 15 minutes'),
  keyGenerator: (req: Request): string => {
    const userId = req.user?.id;
    return userId ? `refund-process-${userId}` : req.ip || 'unknown';
  }
});

export const invoiceGenerationRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: 'Too many invoice generation requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many invoice generation requests, please try again after 10 minutes'),
  keyGenerator: (req: Request): string => {
    const userId = req.user?.id;
    return userId ? `invoice-gen-${userId}` : req.ip || 'unknown';
  }
});

export const paymentWebhookRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: 'Too many webhook requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many webhook requests, please try again after 1 minute'),
  keyGenerator: (req: Request): string => {
    return req.ip || 'unknown';
  }
});

export const creditPurchaseRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: 'Too many credit purchase attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many credit purchase attempts, please try again after 10 minutes'),
  keyGenerator: (req: Request): string => {
    const userId = req.user?.id;
    return userId ? `credit-purchase-${userId}` : req.ip || 'unknown';
  }
});

export const subscriptionRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many subscription requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many subscription requests, please try again after 15 minutes'),
  keyGenerator: (req: Request): string => {
    const userId = req.user?.id;
    return userId ? `subscription-${userId}` : req.ip || 'unknown';
  }
});

export const paymentMethodRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 25,
  message: 'Too many payment method operations, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many payment method operations, please try again after 10 minutes'),
  keyGenerator: (req: Request): string => {
    const userId = req.user?.id;
    return userId ? `payment-method-${userId}` : req.ip || 'unknown';
  }
});

export const applePayRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 15,
  message: 'Too many Apple Pay requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many Apple Pay requests, please try again after 5 minutes'),
  keyGenerator: (req: Request): string => {
    const userId = req.user?.id;
    return userId ? `apple-pay-${userId}` : req.ip || 'unknown';
  }
});

export const googlePayRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 15,
  message: 'Too many Google Pay requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many Google Pay requests, please try again after 5 minutes'),
  keyGenerator: (req: Request): string => {
    const userId = req.user?.id;
    return userId ? `google-pay-${userId}` : req.ip || 'unknown';
  }
});

export const rateLimitMiddleware = (config: {
  windowMs: number;
  max: number;
  message: string;
  keyGenerator?: (req: Request) => string;
}) => {
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    message: config.message,
    standardHeaders: true,
    legacyHeaders: false,
    handler: createRateLimitHandler(config.message),
    keyGenerator: config.keyGenerator || ((req: Request): string => {
      const userId = req.user?.id;
      return userId ? `user-${userId}` : req.ip || 'unknown';
    }),
    skip: (req: Request): boolean => {
      return req.ip === '127.0.0.1' || req.ip === '::1';
    }
  });
};

export const creditTransactionRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  message: 'Too many credit transaction requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many credit transaction requests, please try again after 5 minutes'),
  keyGenerator: (req: Request): string => {
    const userId = req.user?.id;
    return userId ? `credit-transaction-${userId}` : req.ip || 'unknown';
  }
});

export const creditUsageRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 50,
  message: 'Too many credit usage attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many credit usage attempts, please try again after 1 minute'),
  keyGenerator: (req: Request): string => {
    const userId = req.user?.id;
    return userId ? `credit-usage-${userId}` : req.ip || 'unknown';
  }
});

export const creditBalanceRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: 'Too many credit balance requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many credit balance requests, please try again after 1 minute'),
  keyGenerator: (req: Request): string => {
    const userId = req.user?.id;
    return userId ? `credit-balance-${userId}` : req.ip || 'unknown';
  }
});

export const autoTopupRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many auto topup requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many auto topup requests, please try again after 15 minutes'),
  keyGenerator: (req: Request): string => {
    const userId = req.user?.id;
    return userId ? `auto-topup-${userId}` : req.ip || 'unknown';
  }
});

export const creditRefundRateLimit = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 5,
  message: 'Too many credit refund requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many credit refund requests, please try again after 30 minutes'),
  keyGenerator: (req: Request): string => {
    const userId = req.user?.id;
    return userId ? `credit-refund-${userId}` : req.ip || 'unknown';
  }
});

export const jobApplicationCreditRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 20,
  message: 'Too many job application attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many job application attempts, please try again after 1 minute'),
  keyGenerator: (req: Request): string => {
    const userId = req.user?.id;
    return userId ? `job-application-${userId}` : req.ip || 'unknown';
  }
});

export const profileBoostRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: 'Too many profile boost requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many profile boost requests, please try again after 10 minutes'),
  keyGenerator: (req: Request): string => {
    const userId = req.user?.id;
    return userId ? `profile-boost-${userId}` : req.ip || 'unknown';
  }
});

export const premiumJobUnlockRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 15,
  message: 'Too many premium job unlock attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many premium job unlock attempts, please try again after 5 minutes'),
  keyGenerator: (req: Request): string => {
    const userId = req.user?.id;
    return userId ? `premium-unlock-${userId}` : req.ip || 'unknown';
  }
});

export const creditPackageRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: 'Too many credit package requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many credit package requests, please try again after 1 minute'),
  keyGenerator: (req: Request): string => {
    const userId = req.user?.id;
    return userId ? `credit-package-${userId}` : req.ip || 'unknown';
  }
});

export const creditDashboardRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 40,
  message: 'Too many credit dashboard requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many credit dashboard requests, please try again after 1 minute'),
  keyGenerator: (req: Request): string => {
    const userId = req.user?.id;
    return userId ? `credit-dashboard-${userId}` : req.ip || 'unknown';
  }
});

export const creditNotificationRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: 'Too many credit notification requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createRateLimitHandler('Too many credit notification requests, please try again after 10 minutes'),
  keyGenerator: (req: Request): string => {
    const userId = req.user?.id;
    return userId ? `credit-notification-${userId}` : req.ip || 'unknown';
  }
});

export { default as rateLimit } from 'express-rate-limit';
