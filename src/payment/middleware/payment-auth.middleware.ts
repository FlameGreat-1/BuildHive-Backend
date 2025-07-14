import { Request, Response, NextFunction } from 'express';
import { PAYMENT_CONSTANTS } from '../../config/payment';
import { authenticate, AuthenticatedRequest } from '../../auth/middleware';
import { database } from '../../shared/database/connection';
import { logger, AppError } from '../../shared/utils';
import { HTTP_STATUS_CODES } from '../../config/auth/constants';
import { PaymentRepository } from '../repositories';

export const authenticatePaymentUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await authenticate(req, res, next);
  } catch (error) {
    logger.error('Payment authentication error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.requestId,
      ip: req.ip
    });

    next(new AppError(
      'Authentication service unavailable',
      HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
    ));
  }
};

export const authorizePaymentAccess = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError(
        'User authentication required',
        HTTP_STATUS_CODES.UNAUTHORIZED
      ));
    }

    const paymentId = req.params.paymentId || req.body.paymentId;
    
    if (paymentId) {
      const paymentRepository = new PaymentRepository(database);
      
      const payment = await paymentRepository.getPaymentById(
        parseInt(paymentId)
      );

      if (!payment) {
        logger.warn('Payment not found for authorization check', {
          paymentId,
          userId: req.user.id,
          requestId: req.requestId
        });

        return next(new AppError(
          'Payment not found',
          HTTP_STATUS_CODES.NOT_FOUND
        ));
      }

      if (payment.user_id !== parseInt(req.user.id) && req.user.role !== 'admin') {
        logger.warn('Unauthorized payment access attempt', {
          paymentId,
          paymentUserId: payment.user_id,
          requestUserId: req.user.id,
          requestId: req.requestId
        });

        return next(new AppError(
          'Access denied to this payment',
          HTTP_STATUS_CODES.FORBIDDEN
        ));
      }
    }

    logger.info('Payment access authorized', {
      userId: req.user.id,
      paymentId,
      requestId: req.requestId
    });

    next();
  } catch (error) {
    logger.error('Payment authorization error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      requestId: req.requestId
    });

    next(new AppError(
      'Authorization service unavailable',
      HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
    ));
  }
};

export const authorizeInvoiceAccess = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError(
        'User authentication required',
        HTTP_STATUS_CODES.UNAUTHORIZED
      ));
    }

    const invoiceId = req.params.invoiceId || req.body.invoiceId;
    
    if (invoiceId) {
      const invoiceRepository = new (await import('../repositories')).InvoiceRepository(database);
      
      const invoice = await invoiceRepository.getInvoiceById(
        parseInt(invoiceId)
      );

      if (!invoice) {
        logger.warn('Invoice not found for authorization check', {
          invoiceId,
          userId: req.user.id,
          requestId: req.requestId
        });

        return next(new AppError(
          'Invoice not found',
          HTTP_STATUS_CODES.NOT_FOUND
        ));
      }

      if (invoice.user_id !== parseInt(req.user.id) && req.user.role !== 'admin') {
        logger.warn('Unauthorized invoice access attempt', {
          invoiceId,
          invoiceUserId: invoice.user_id,
          requestUserId: req.user.id,
          requestId: req.requestId
        });

        return next(new AppError(
          'Access denied to this invoice',
          HTTP_STATUS_CODES.FORBIDDEN
        ));
      }
    }

    logger.info('Invoice access authorized', {
      userId: req.user.id,
      invoiceId,
      requestId: req.requestId
    });

    next();
  } catch (error) {
    logger.error('Invoice authorization error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      requestId: req.requestId
    });

    next(new AppError(
      'Invoice authorization service unavailable',
      HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
    ));
  }
};

export const authorizeRefundAccess = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError(
        'User authentication required',
        HTTP_STATUS_CODES.UNAUTHORIZED
      ));
    }

    const refundId = req.params.refundId || req.body.refundId;
    
    if (refundId) {
      const refundRepository = new (await import('../repositories')).RefundRepository(database);
      
      const refund = await refundRepository.getRefundById(
        parseInt(refundId)
      );

      if (!refund) {
        logger.warn('Refund not found for authorization check', {
          refundId,
          userId: req.user.id,
          requestId: req.requestId
        });

        return next(new AppError(
          'Refund not found',
          HTTP_STATUS_CODES.NOT_FOUND
        ));
      }

      if (refund.user_id !== parseInt(req.user.id) && req.user.role !== 'admin') {
        logger.warn('Unauthorized refund access attempt', {
          refundId,
          refundUserId: refund.user_id,
          requestUserId: req.user.id,
          requestId: req.requestId
        });

        return next(new AppError(
          'Access denied to this refund',
          HTTP_STATUS_CODES.FORBIDDEN
        ));
      }
    }

    logger.info('Refund access authorized', {
      userId: req.user.id,
      refundId,
      requestId: req.requestId
    });

    next();
  } catch (error) {
    logger.error('Refund authorization error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      requestId: req.requestId
    });

    next(new AppError(
      'Refund authorization service unavailable',
      HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
    ));
  }
};

export const requirePaymentRole = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        return next(new AppError(
          'Authentication required',
          HTTP_STATUS_CODES.UNAUTHORIZED
        ));
      }

      if (!allowedRoles.includes(req.user.role)) {
        logger.warn('Insufficient role for payment operation', {
          userId: req.user.id,
          userRole: req.user.role,
          requiredRoles: allowedRoles,
          requestId: req.requestId
        });

        return next(new AppError(
          'Insufficient permissions for this payment operation',
          HTTP_STATUS_CODES.FORBIDDEN
        ));
      }

      logger.info('Payment role authorization successful', {
        userId: req.user.id,
        userRole: req.user.role,
        requestId: req.requestId
      });

      next();
    } catch (error) {
      logger.error('Payment role authorization error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        requestId: req.requestId
      });

      next(new AppError(
        'Role authorization service unavailable',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
      ));
    }
  };
};

export const validatePaymentLimits = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError(
        'Authentication required',
        HTTP_STATUS_CODES.UNAUTHORIZED
      ));
    }

    const amount = req.body.amount;
    
    if (amount) {
      if (amount < PAYMENT_CONSTANTS.STRIPE.LIMITS.MIN_AMOUNT) {
        return next(new AppError(
          `Payment amount must be at least ${PAYMENT_CONSTANTS.STRIPE.LIMITS.MIN_AMOUNT} cents`,
          HTTP_STATUS_CODES.BAD_REQUEST
        ));
      }

      if (amount > PAYMENT_CONSTANTS.STRIPE.LIMITS.MAX_AMOUNT) {
        return next(new AppError(
          `Payment amount cannot exceed ${PAYMENT_CONSTANTS.STRIPE.LIMITS.MAX_AMOUNT} cents`,
          HTTP_STATUS_CODES.BAD_REQUEST
        ));
      }

      const paymentRepository = new PaymentRepository(database);
      
      const dailyTotal = await paymentRepository.getUserTotalAmount(
        parseInt(req.user.id)
      );

      const dailyLimit = PAYMENT_CONSTANTS.LIMITS.DAILY_LIMIT;
      
      if (dailyTotal + amount > dailyLimit) {
        logger.warn('Daily payment limit exceeded', {
          userId: req.user.id,
          currentTotal: dailyTotal,
          attemptedAmount: amount,
          dailyLimit,
          requestId: req.requestId
        });

        return next(new AppError(
          'Daily payment limit exceeded',
          HTTP_STATUS_CODES.TOO_MANY_REQUESTS
        ));
      }
    }

    logger.info('Payment limits validated successfully', {
      userId: req.user.id,
      amount,
      requestId: req.requestId
    });

    next();
  } catch (error) {
    logger.error('Payment limits validation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      requestId: req.requestId
    });

    next(new AppError(
      'Payment limits validation service unavailable',
      HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
    ));
  }
};

export const authenticateWebhookAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await authenticate(req, res, next);
    
    if (!req.user) {
      return next(new AppError(
        'Admin authentication required for webhook operations',
        HTTP_STATUS_CODES.UNAUTHORIZED
      ));
    }

    if (req.user.role !== 'admin') {
      logger.warn('Non-admin user attempted webhook admin operation', {
        userId: req.user.id,
        userRole: req.user.role,
        requestId: req.requestId
      });

      return next(new AppError(
        'Admin privileges required for webhook operations',
        HTTP_STATUS_CODES.FORBIDDEN
      ));
    }

    logger.info('Webhook admin authentication successful', {
      userId: req.user.id,
      requestId: req.requestId
    });

    next();
  } catch (error) {
    logger.error('Webhook admin authentication error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.requestId
    });

    next(new AppError(
      'Webhook admin authentication service unavailable',
      HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
    ));
  }
};

export const authorizeWebhookAccess = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError(
        'Authentication required for webhook access',
        HTTP_STATUS_CODES.UNAUTHORIZED
      ));
    }

    const allowedRoles = ['admin', 'webhook_manager'];
    
    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('Unauthorized webhook access attempt', {
        userId: req.user.id,
        userRole: req.user.role,
        allowedRoles,
        requestId: req.requestId
      });

      return next(new AppError(
        'Insufficient permissions for webhook operations',
        HTTP_STATUS_CODES.FORBIDDEN
      ));
    }

    const webhookId = req.params.webhookId || req.body.webhookId;
    
    if (webhookId) {
      logger.info('Webhook access authorized', {
        userId: req.user.id,
        webhookId,
        userRole: req.user.role,
        requestId: req.requestId
      });
    }

    next();
  } catch (error) {
    logger.error('Webhook authorization error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      requestId: req.requestId
    });

    next(new AppError(
      'Webhook authorization service unavailable',
      HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
    ));
  }
};
