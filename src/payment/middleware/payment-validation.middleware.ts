import { Request, Response, NextFunction } from 'express';
import { PAYMENT_CONSTANTS } from '../../config/payment';
import { logger, createErrorResponse, AppError } from '../../shared/utils';
import { HTTP_STATUS_CODES } from '../../config/auth/constants';
import { AuthenticatedRequest } from '../../auth/middleware/auth.middleware';
import { 
  validateCreatePaymentIntent,
  validateConfirmPayment,
  validatePaymentLink,
  validateCreatePaymentMethod,
  validateAttachPaymentMethod,
  validateDetachPaymentMethod,
  validateSetDefaultPaymentMethod,
  validateCreateInvoice,
  validateUpdateInvoiceStatus,
  validateInvoiceQuery,
  validateCreateRefund,
  validateUpdateRefundStatus,
  validateRefundQuery
} from '../validators';

export const validatePaymentIntentCreation = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const validation = validateCreatePaymentIntent(req.body);
    
    if (!validation.isValid) {
      logger.warn('Payment intent validation failed', {
        errors: validation.errors,
        requestId: req.requestId,
        userId: req.user?.id
      });

      return next(new AppError(
        'Invalid payment intent data',
        HTTP_STATUS_CODES.BAD_REQUEST
      ));
    }

    req.body = validation.data;
    
    logger.info('Payment intent validation successful', {
      amount: validation.data.amount,
      currency: validation.data.currency,
      paymentMethod: validation.data.paymentMethod,
      requestId: req.requestId,
      userId: req.user?.id
    });

    next();
  } catch (error) {
    logger.error('Payment intent validation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.requestId,
      userId: req.user?.id
    });

    next(new AppError(
      'Payment validation service unavailable',
      HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
    ));
  }
};

export const validatePaymentConfirmation = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const validation = validateConfirmPayment(req.body);
    
    if (!validation.isValid) {
      logger.warn('Payment confirmation validation failed', {
        errors: validation.errors,
        requestId: req.requestId,
        userId: req.user?.id
      });

      return next(new AppError(
        'Invalid payment confirmation data',
        HTTP_STATUS_CODES.BAD_REQUEST
      ));
    }

    req.body = validation.data;
    
    logger.info('Payment confirmation validation successful', {
      paymentIntentId: validation.data.paymentIntentId,
      requestId: req.requestId,
      userId: req.user?.id
    });

    next();
  } catch (error) {
    logger.error('Payment confirmation validation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.requestId,
      userId: req.user?.id
    });

    next(new AppError(
      'Payment validation service unavailable',
      HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
    ));
  }
};

export const validatePaymentLinkCreation = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const validation = validatePaymentLink(req.body);
    
    if (!validation.isValid) {
      logger.warn('Payment link validation failed', {
        errors: validation.errors,
        requestId: req.requestId,
        userId: req.user?.id
      });

      return next(new AppError(
        'Invalid payment link data',
        HTTP_STATUS_CODES.BAD_REQUEST
      ));
    }

    req.body = validation.data;
    
    logger.info('Payment link validation successful', {
      amount: validation.data.amount,
      currency: validation.data.currency,
      requestId: req.requestId,
      userId: req.user?.id
    });

    next();
  } catch (error) {
    logger.error('Payment link validation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.requestId,
      userId: req.user?.id
    });

    next(new AppError(
      'Payment validation service unavailable',
      HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
    ));
  }
};

export const validatePaymentMethodCreation = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const validation = validateCreatePaymentMethod(req.body);
    
    if (!validation.isValid) {
      logger.warn('Payment method validation failed', {
        errors: validation.errors,
        requestId: req.requestId,
        userId: req.user?.id
      });

      return next(new AppError(
        'Invalid payment method data',
        HTTP_STATUS_CODES.BAD_REQUEST
      ));
    }

    req.body = validation.data;
    
    logger.info('Payment method validation successful', {
      type: validation.data.type,
      requestId: req.requestId,
      userId: req.user?.id
    });

    next();
  } catch (error) {
    logger.error('Payment method validation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.requestId,
      userId: req.user?.id
    });

    next(new AppError(
      'Payment validation service unavailable',
      HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
    ));
  }
};

export const validatePaymentMethodAttachment = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const validation = validateAttachPaymentMethod(req.body);
    
    if (!validation.isValid) {
      logger.warn('Payment method attachment validation failed', {
        errors: validation.errors,
        requestId: req.requestId,
        userId: req.user?.id
      });

      return next(new AppError(
        'Invalid payment method attachment data',
        HTTP_STATUS_CODES.BAD_REQUEST
      ));
    }

    req.body = validation.data;
    
    logger.info('Payment method attachment validation successful', {
      paymentMethodId: validation.data.paymentMethodId,
      customerId: validation.data.customerId,
      requestId: req.requestId,
      userId: req.user?.id
    });

    next();
  } catch (error) {
    logger.error('Payment method attachment validation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.requestId,
      userId: req.user?.id
    });

    next(new AppError(
      'Payment validation service unavailable',
      HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
    ));
  }
};

export const validatePaymentMethodDetachment = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const validation = validateDetachPaymentMethod(req.body);
    
    if (!validation.isValid) {
      logger.warn('Payment method detachment validation failed', {
        errors: validation.errors,
        requestId: req.requestId,
        userId: req.user?.id
      });

      return next(new AppError(
        'Invalid payment method detachment data',
        HTTP_STATUS_CODES.BAD_REQUEST
      ));
    }

    req.body = validation.data;
    
    logger.info('Payment method detachment validation successful', {
      paymentMethodId: validation.data.paymentMethodId,
      requestId: req.requestId,
      userId: req.user?.id
    });

    next();
  } catch (error) {
    logger.error('Payment method detachment validation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.requestId,
      userId: req.user?.id
    });

    next(new AppError(
      'Payment validation service unavailable',
      HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
    ));
  }
};

export const validateDefaultPaymentMethodSetting = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const requestData = {
      ...req.body,
      userId: req.user?.id
    };

    const validation = validateSetDefaultPaymentMethod(requestData);
    
    if (!validation.isValid) {
      logger.warn('Default payment method validation failed', {
        errors: validation.errors,
        requestId: req.requestId,
        userId: req.user?.id
      });

      return next(new AppError(
        'Invalid default payment method data',
        HTTP_STATUS_CODES.BAD_REQUEST
      ));
    }

    req.body = validation.data;
    
    logger.info('Default payment method validation successful', {
      paymentMethodId: validation.data.paymentMethodId,
      userId: validation.data.userId,
      requestId: req.requestId
    });

    next();
  } catch (error) {
    logger.error('Default payment method validation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.requestId,
      userId: req.user?.id
    });

    next(new AppError(
      'Payment validation service unavailable',
      HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
    ));
  }
};

export const validateInvoiceCreation = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const requestData = {
      ...req.body,
      userId: req.user?.id
    };

    const validation = validateCreateInvoice(requestData);
    
    if (!validation.isValid) {
      logger.warn('Invoice creation validation failed', {
        errors: validation.errors,
        requestId: req.requestId,
        userId: req.user?.id
      });

      return next(new AppError(
        'Invalid invoice data',
        HTTP_STATUS_CODES.BAD_REQUEST
      ));
    }

    req.body = validation.data;
    
    logger.info('Invoice creation validation successful', {
      amount: validation.data.amount,
      currency: validation.data.currency,
      invoiceNumber: validation.data.invoiceNumber,
      requestId: req.requestId,
      userId: req.user?.id
    });

    next();
  } catch (error) {
    logger.error('Invoice creation validation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.requestId,
      userId: req.user?.id
    });

    next(new AppError(
      'Invoice validation service unavailable',
      HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
    ));
  }
};

export const validateInvoiceStatusUpdate = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const validation = validateUpdateInvoiceStatus(req.body);
    
    if (!validation.isValid) {
      logger.warn('Invoice status update validation failed', {
        errors: validation.errors,
        requestId: req.requestId,
        userId: req.user?.id
      });

      return next(new AppError(
        'Invalid invoice status update data',
        HTTP_STATUS_CODES.BAD_REQUEST
      ));
    }

    req.body = validation.data;
    
    logger.info('Invoice status update validation successful', {
      invoiceId: validation.data.invoiceId,
      status: validation.data.status,
      requestId: req.requestId,
      userId: req.user?.id
    });

    next();
  } catch (error) {
    logger.error('Invoice status update validation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.requestId,
      userId: req.user?.id
    });

    next(new AppError(
      'Invoice validation service unavailable',
      HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
    ));
  }
};

export const validateInvoiceQueryParams = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const validation = validateInvoiceQuery(req.query);
    
    if (!validation.isValid) {
      logger.warn('Invoice query validation failed', {
        errors: validation.errors,
        requestId: req.requestId,
        userId: req.user?.id
      });

      return next(new AppError(
        'Invalid invoice query parameters',
        HTTP_STATUS_CODES.BAD_REQUEST
      ));
    }

    req.query = validation.data;
    
    logger.info('Invoice query validation successful', {
      queryParams: validation.data,
      requestId: req.requestId,
      userId: req.user?.id
    });

    next();
  } catch (error) {
    logger.error('Invoice query validation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.requestId,
      userId: req.user?.id
    });

    next(new AppError(
      'Invoice validation service unavailable',
      HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
    ));
  }
};

export const validateRefundCreation = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const requestData = {
      ...req.body,
      userId: req.user?.id
    };

    const validation = validateCreateRefund(requestData);
    
    if (!validation.isValid) {
      logger.warn('Refund creation validation failed', {
        errors: validation.errors,
        requestId: req.requestId,
        userId: req.user?.id
      });

      return next(new AppError(
        'Invalid refund data',
        HTTP_STATUS_CODES.BAD_REQUEST
      ));
    }

    req.body = validation.data;
    
    logger.info('Refund creation validation successful', {
      paymentId: validation.data.paymentId,
      amount: validation.data.amount,
      reason: validation.data.reason,
      requestId: req.requestId,
      userId: req.user?.id
    });

    next();
  } catch (error) {
    logger.error('Refund creation validation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.requestId,
      userId: req.user?.id
    });

    next(new AppError(
      'Refund validation service unavailable',
      HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
    ));
  }
};

export const validateRefundAmount = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const { amount, paymentId } = req.body;
    
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      logger.warn('Invalid refund amount', {
        amount,
        requestId: req.requestId,
        userId: req.user?.id
      });

      return next(new AppError(
        'Refund amount must be a positive number',
        HTTP_STATUS_CODES.BAD_REQUEST
      ));
    }

    if (amount > PAYMENT_CONSTANTS.STRIPE.LIMITS.MAX_AMOUNT) {
      logger.warn('Refund amount exceeds maximum limit', {
        amount,
        maxAmount: PAYMENT_CONSTANTS.STRIPE.LIMITS.MAX_AMOUNT,
        requestId: req.requestId,
        userId: req.user?.id
      });

      return next(new AppError(
        `Refund amount cannot exceed ${PAYMENT_CONSTANTS.STRIPE.LIMITS.MAX_AMOUNT}`,
        HTTP_STATUS_CODES.BAD_REQUEST
      ));
    }

    if (!paymentId) {
      logger.warn('Missing payment ID for refund', {
        requestId: req.requestId,
        userId: req.user?.id
      });

      return next(new AppError(
        'Payment ID is required for refund',
        HTTP_STATUS_CODES.BAD_REQUEST
      ));
    }

    logger.info('Refund amount validation successful', {
      amount,
      paymentId,
      requestId: req.requestId,
      userId: req.user?.id
    });

    next();
  } catch (error) {
    logger.error('Refund amount validation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.requestId,
      userId: req.user?.id
    });

    next(new AppError(
      'Refund amount validation service unavailable',
      HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
    ));
  }
};

export const validateRefundStatusUpdate = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const validation = validateUpdateRefundStatus(req.body);
    
    if (!validation.isValid) {
      logger.warn('Refund status update validation failed', {
        errors: validation.errors,
        requestId: req.requestId,
        userId: req.user?.id
      });

      return next(new AppError(
        'Invalid refund status update data',
        HTTP_STATUS_CODES.BAD_REQUEST
      ));
    }

    req.body = validation.data;
    
    logger.info('Refund status update validation successful', {
      refundId: validation.data.refundId,
      status: validation.data.status,
      requestId: req.requestId,
      userId: req.user?.id
    });

    next();
  } catch (error) {
    logger.error('Refund status update validation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.requestId,
      userId: req.user?.id
    });

    next(new AppError(
      'Refund validation service unavailable',
      HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
    ));
  }
};

export const validateRefundQueryParams = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const validation = validateRefundQuery(req.query);
    
    if (!validation.isValid) {
      logger.warn('Refund query validation failed', {
        errors: validation.errors,
        requestId: req.requestId,
        userId: req.user?.id
      });

      return next(new AppError(
        'Invalid refund query parameters',
        HTTP_STATUS_CODES.BAD_REQUEST
      ));
    }

    req.query = validation.data;
    
    logger.info('Refund query validation successful', {
      queryParams: validation.data,
      requestId: req.requestId,
      userId: req.user?.id
    });

    next();
  } catch (error) {
    logger.error('Refund query validation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.requestId,
      userId: req.user?.id
    });

    next(new AppError(
      'Refund validation service unavailable',
      HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
    ));
  }
};

export const validateCurrencySupport = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const currency = req.body.currency;
    
    if (!currency) {
      next();
      return;
    }

    if (!PAYMENT_CONSTANTS.STRIPE.CURRENCY.SUPPORTED.includes(currency.toUpperCase())) {
      logger.warn('Unsupported currency detected', {
        currency,
        supportedCurrencies: PAYMENT_CONSTANTS.STRIPE.CURRENCY.SUPPORTED,
        requestId: req.requestId,
        userId: req.user?.id
      });

      return next(new AppError(
        `Currency ${currency} is not supported`,
        HTTP_STATUS_CODES.BAD_REQUEST
      ));
    }

    logger.info('Currency validation successful', {
      currency,
      requestId: req.requestId,
      userId: req.user?.id
    });

    next();
  } catch (error) {
    logger.error('Currency validation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.requestId,
      userId: req.user?.id
    });

    next(new AppError(
      'Currency validation service unavailable',
      HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
    ));
  }
};

export const validateInvoiceAccess = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const invoiceId = req.params.invoiceId || req.body.invoiceId;
    const userId = req.user?.id;

    if (!invoiceId) {
      logger.warn('Invoice access validation failed - missing invoice ID', {
        requestId: req.requestId,
        userId
      });

      return next(new AppError(
        'Invoice ID is required',
        HTTP_STATUS_CODES.BAD_REQUEST
      ));
    }

    if (!userId) {
      logger.warn('Invoice access validation failed - missing user ID', {
        invoiceId,
        requestId: req.requestId
      });

      return next(new AppError(
        'User authentication required',
        HTTP_STATUS_CODES.UNAUTHORIZED
      ));
    }

    logger.info('Invoice access validation successful', {
      invoiceId,
      userId,
      requestId: req.requestId
    });

    next();
  } catch (error) {
    logger.error('Invoice access validation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.requestId,
      userId: req.user?.id
    });

    next(new AppError(
      'Invoice access validation service unavailable',
      HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
    ));
  }
};

export const validateRefundAccess = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const refundId = req.params.refundId || req.body.refundId;
    const userId = req.user?.id;

    if (!refundId) {
      logger.warn('Refund access validation failed - missing refund ID', {
        requestId: req.requestId,
        userId
      });

      return next(new AppError(
        'Refund ID is required',
        HTTP_STATUS_CODES.BAD_REQUEST
      ));
    }

    if (!userId) {
      logger.warn('Refund access validation failed - missing user ID', {
        refundId,
        requestId: req.requestId
      });

      return next(new AppError(
        'User authentication required',
        HTTP_STATUS_CODES.UNAUTHORIZED
      ));
    }

    logger.info('Refund access validation successful', {
      refundId,
      userId,
      requestId: req.requestId
    });

    next();
  } catch (error) {
    logger.error('Refund access validation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.requestId,
      userId: req.user?.id
    });

    next(new AppError(
      'Refund access validation service unavailable',
      HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
    ));
  }
};
