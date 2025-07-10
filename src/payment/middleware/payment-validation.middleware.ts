import { Request, Response, NextFunction } from 'express';
import { PAYMENT_CONSTANTS } from '../../config/payment';
import { logger, createErrorResponse } from '../../shared/utils';
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

interface ValidationRequest extends Request {
  requestId?: string;
  user?: {
    id: number;
    email: string;
    role: string;
  };
}

export const validatePaymentIntentCreation = (
  req: ValidationRequest,
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

      res.status(400).json(createErrorResponse(
        'Invalid payment intent data',
        'PAYMENT_INTENT_VALIDATION_ERROR',
        { validationErrors: validation.errors }
      ));
      return;
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

    res.status(500).json(createErrorResponse(
      'Payment validation service unavailable',
      'PAYMENT_VALIDATION_SERVICE_ERROR'
    ));
  }
};

export const validatePaymentConfirmation = (
  req: ValidationRequest,
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

      res.status(400).json(createErrorResponse(
        'Invalid payment confirmation data',
        'PAYMENT_CONFIRMATION_VALIDATION_ERROR',
        { validationErrors: validation.errors }
      ));
      return;
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

    res.status(500).json(createErrorResponse(
      'Payment validation service unavailable',
      'PAYMENT_VALIDATION_SERVICE_ERROR'
    ));
  }
};

export const validatePaymentLinkCreation = (
  req: ValidationRequest,
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

      res.status(400).json(createErrorResponse(
        'Invalid payment link data',
        'PAYMENT_LINK_VALIDATION_ERROR',
        { validationErrors: validation.errors }
      ));
      return;
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

    res.status(500).json(createErrorResponse(
      'Payment validation service unavailable',
      'PAYMENT_VALIDATION_SERVICE_ERROR'
    ));
  }
};

export const validatePaymentMethodCreation = (
  req: ValidationRequest,
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

      res.status(400).json(createErrorResponse(
        'Invalid payment method data',
        'PAYMENT_METHOD_VALIDATION_ERROR',
        { validationErrors: validation.errors }
      ));
      return;
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

    res.status(500).json(createErrorResponse(
      'Payment validation service unavailable',
      'PAYMENT_VALIDATION_SERVICE_ERROR'
    ));
  }
};

export const validatePaymentMethodAttachment = (
  req: ValidationRequest,
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

      res.status(400).json(createErrorResponse(
        'Invalid payment method attachment data',
        'PAYMENT_METHOD_ATTACH_VALIDATION_ERROR',
        { validationErrors: validation.errors }
      ));
      return;
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

    res.status(500).json(createErrorResponse(
      'Payment validation service unavailable',
      'PAYMENT_VALIDATION_SERVICE_ERROR'
    ));
  }
};

export const validatePaymentMethodDetachment = (
  req: ValidationRequest,
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

      res.status(400).json(createErrorResponse(
        'Invalid payment method detachment data',
        'PAYMENT_METHOD_DETACH_VALIDATION_ERROR',
        { validationErrors: validation.errors }
      ));
      return;
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

    res.status(500).json(createErrorResponse(
      'Payment validation service unavailable',
      'PAYMENT_VALIDATION_SERVICE_ERROR'
    ));
  }
};

export const validateDefaultPaymentMethodSetting = (
  req: ValidationRequest,
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

      res.status(400).json(createErrorResponse(
        'Invalid default payment method data',
        'DEFAULT_PAYMENT_METHOD_VALIDATION_ERROR',
        { validationErrors: validation.errors }
      ));
      return;
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

    res.status(500).json(createErrorResponse(
      'Payment validation service unavailable',
      'PAYMENT_VALIDATION_SERVICE_ERROR'
    ));
  }
};

export const validateInvoiceCreation = (
  req: ValidationRequest,
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

      res.status(400).json(createErrorResponse(
        'Invalid invoice data',
        'INVOICE_VALIDATION_ERROR',
        { validationErrors: validation.errors }
      ));
      return;
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

    res.status(500).json(createErrorResponse(
      'Invoice validation service unavailable',
      'INVOICE_VALIDATION_SERVICE_ERROR'
    ));
  }
};

export const validateInvoiceStatusUpdate = (
  req: ValidationRequest,
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

      res.status(400).json(createErrorResponse(
        'Invalid invoice status update data',
        'INVOICE_STATUS_VALIDATION_ERROR',
        { validationErrors: validation.errors }
      ));
      return;
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

    res.status(500).json(createErrorResponse(
      'Invoice validation service unavailable',
      'INVOICE_VALIDATION_SERVICE_ERROR'
    ));
  }
};

export const validateInvoiceQueryParams = (
  req: ValidationRequest,
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

      res.status(400).json(createErrorResponse(
        'Invalid invoice query parameters',
        'INVOICE_QUERY_VALIDATION_ERROR',
        { validationErrors: validation.errors }
      ));
      return;
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

    res.status(500).json(createErrorResponse(
      'Invoice validation service unavailable',
      'INVOICE_VALIDATION_SERVICE_ERROR'
    ));
  }
};

export const validateRefundCreation = (
  req: ValidationRequest,
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

      res.status(400).json(createErrorResponse(
        'Invalid refund data',
        'REFUND_VALIDATION_ERROR',
        { validationErrors: validation.errors }
      ));
      return;
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

    res.status(500).json(createErrorResponse(
      'Refund validation service unavailable',
      'REFUND_VALIDATION_SERVICE_ERROR'
    ));
  }
};

export const validateRefundStatusUpdate = (
  req: ValidationRequest,
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

      res.status(400).json(createErrorResponse(
        'Invalid refund status update data',
        'REFUND_STATUS_VALIDATION_ERROR',
        { validationErrors: validation.errors }
      ));
      return;
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

    res.status(500).json(createErrorResponse(
      'Refund validation service unavailable',
      'REFUND_VALIDATION_SERVICE_ERROR'
    ));
  }
};

export const validateRefundQueryParams = (
  req: ValidationRequest,
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

      res.status(400).json(createErrorResponse(
        'Invalid refund query parameters',
        'REFUND_QUERY_VALIDATION_ERROR',
        { validationErrors: validation.errors }
      ));
      return;
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

    res.status(500).json(createErrorResponse(
      'Refund validation service unavailable',
      'REFUND_VALIDATION_SERVICE_ERROR'
    ));
  }
};

export const validateCurrencySupport = (
  req: ValidationRequest,
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

      res.status(400).json(createErrorResponse(
        `Currency ${currency} is not supported`,
        'UNSUPPORTED_CURRENCY',
        { 
          currency,
          supportedCurrencies: PAYMENT_CONSTANTS.STRIPE.CURRENCY.SUPPORTED
        }
      ));
      return;
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

    res.status(500).json(createErrorResponse(
      'Currency validation service unavailable',
      'CURRENCY_VALIDATION_SERVICE_ERROR'
    ));
  }
};
