import { Request, Response, NextFunction } from 'express';
import { PAYMENT_CONSTANTS } from '../../config/payment';
import { authenticate, AuthenticatedRequest } from '../../auth/middleware';
import { database } from '../../shared/database/connection';
import { logger, createErrorResponse } from '../../shared/utils';
import { PaymentRepository } from '../repositories';

export const authenticatePaymentUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await authenticate(req, res, () => {
      if (!req.user) {
        logger.warn('Payment authentication failed - no user found', {
          requestId: req.requestId,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });

        res.status(401).json(createErrorResponse(
          'Authentication required for payment operations',
          'PAYMENT_AUTH_REQUIRED',
          { requiresAuth: true }
        ));
        return;
      }

      logger.info('Payment user authenticated successfully', {
        userId: req.user.id,
        email: req.user.email,
        requestId: req.requestId
      });

      next();
    });
  } catch (error) {
    logger.error('Payment authentication error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.requestId,
      ip: req.ip
    });

    res.status(500).json(createErrorResponse(
      'Authentication service unavailable',
      'PAYMENT_AUTH_ERROR'
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
      res.status(401).json(createErrorResponse(
        'User authentication required',
        'PAYMENT_USER_REQUIRED'
      ));
      return;
    }

    const paymentId = req.params.paymentId || req.body.paymentId;
    
    if (paymentId) {
      const paymentRepository = new PaymentRepository(database);
      
      const payment = await paymentRepository.getPaymentById(
        parseInt(paymentId),
        req.requestId || 'unknown'
      );

      if (!payment) {
        logger.warn('Payment not found for authorization check', {
          paymentId,
          userId: req.user.id,
          requestId: req.requestId
        });

        res.status(404).json(createErrorResponse(
          'Payment not found',
          'PAYMENT_NOT_FOUND'
        ));
        return;
      }

      if (payment.user_id !== parseInt(req.user.id) && req.user.role !== 'admin') {
        logger.warn('Unauthorized payment access attempt', {
          paymentId,
          paymentUserId: payment.user_id,
          requestUserId: req.user.id,
          requestId: req.requestId
        });

        res.status(403).json(createErrorResponse(
          'Access denied to this payment',
          'PAYMENT_ACCESS_DENIED'
        ));
        return;
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

    res.status(500).json(createErrorResponse(
      'Authorization service unavailable',
      'PAYMENT_AUTH_SERVICE_ERROR'
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
      res.status(401).json(createErrorResponse(
        'User authentication required',
        'INVOICE_USER_REQUIRED'
      ));
      return;
    }

    const invoiceId = req.params.invoiceId || req.body.invoiceId;
    
    if (invoiceId) {
      const invoiceRepository = new (await import('../repositories')).InvoiceRepository(database);
      
      const invoice = await invoiceRepository.getInvoiceById(
        parseInt(invoiceId),
        req.requestId || 'unknown'
      );

      if (!invoice) {
        logger.warn('Invoice not found for authorization check', {
          invoiceId,
          userId: req.user.id,
          requestId: req.requestId
        });

        res.status(404).json(createErrorResponse(
          'Invoice not found',
          'INVOICE_NOT_FOUND'
        ));
        return;
      }

      if (invoice.user_id !== parseInt(req.user.id) && req.user.role !== 'admin') {
        logger.warn('Unauthorized invoice access attempt', {
          invoiceId,
          invoiceUserId: invoice.user_id,
          requestUserId: req.user.id,
          requestId: req.requestId
        });

        res.status(403).json(createErrorResponse(
          'Access denied to this invoice',
          'INVOICE_ACCESS_DENIED'
        ));
        return;
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

    res.status(500).json(createErrorResponse(
      'Invoice authorization service unavailable',
      'INVOICE_AUTH_SERVICE_ERROR'
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
      res.status(401).json(createErrorResponse(
        'User authentication required',
        'REFUND_USER_REQUIRED'
      ));
      return;
    }

    const refundId = req.params.refundId || req.body.refundId;
    
    if (refundId) {
      const refundRepository = new (await import('../repositories')).RefundRepository(database);
      
      const refund = await refundRepository.getRefundById(
        parseInt(refundId),
        req.requestId || 'unknown'
      );

      if (!refund) {
        logger.warn('Refund not found for authorization check', {
          refundId,
          userId: req.user.id,
          requestId: req.requestId
        });

        res.status(404).json(createErrorResponse(
          'Refund not found',
          'REFUND_NOT_FOUND'
        ));
        return;
      }

      if (refund.user_id !== parseInt(req.user.id) && req.user.role !== 'admin') {
        logger.warn('Unauthorized refund access attempt', {
          refundId,
          refundUserId: refund.user_id,
          requestUserId: req.user.id,
          requestId: req.requestId
        });

        res.status(403).json(createErrorResponse(
          'Access denied to this refund',
          'REFUND_ACCESS_DENIED'
        ));
        return;
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

    res.status(500).json(createErrorResponse(
      'Refund authorization service unavailable',
      'REFUND_AUTH_SERVICE_ERROR'
    ));
  }
};

export const requirePaymentRole = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        res.status(401).json(createErrorResponse(
          'Authentication required',
          'PAYMENT_AUTH_REQUIRED'
        ));
        return;
      }

      if (!allowedRoles.includes(req.user.role)) {
        logger.warn('Insufficient role for payment operation', {
          userId: req.user.id,
          userRole: req.user.role,
          requiredRoles: allowedRoles,
          requestId: req.requestId
        });

        res.status(403).json(createErrorResponse(
          'Insufficient permissions for this payment operation',
          'PAYMENT_INSUFFICIENT_ROLE',
          { requiredRoles: allowedRoles }
        ));
        return;
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

      res.status(500).json(createErrorResponse(
        'Role authorization service unavailable',
        'PAYMENT_ROLE_AUTH_ERROR'
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
      res.status(401).json(createErrorResponse(
        'Authentication required',
        'PAYMENT_AUTH_REQUIRED'
      ));
      return;
    }

    const amount = req.body.amount;
    
    if (amount) {
      if (amount < PAYMENT_CONSTANTS.STRIPE.LIMITS.MIN_AMOUNT) {
        res.status(400).json(createErrorResponse(
          `Payment amount must be at least ${PAYMENT_CONSTANTS.STRIPE.LIMITS.MIN_AMOUNT} cents`,
          'PAYMENT_AMOUNT_TOO_LOW',
          { minAmount: PAYMENT_CONSTANTS.STRIPE.LIMITS.MIN_AMOUNT }
        ));
        return;
      }

      if (amount > PAYMENT_CONSTANTS.STRIPE.LIMITS.MAX_AMOUNT) {
        res.status(400).json(createErrorResponse(
          `Payment amount cannot exceed ${PAYMENT_CONSTANTS.STRIPE.LIMITS.MAX_AMOUNT} cents`,
          'PAYMENT_AMOUNT_TOO_HIGH',
          { maxAmount: PAYMENT_CONSTANTS.STRIPE.LIMITS.MAX_AMOUNT }
        ));
        return;
      }

      const paymentRepository = new PaymentRepository(database);
      
      const dailyTotal = await paymentRepository.getUserTotalAmount(
        parseInt(req.user.id),
        undefined,
        req.requestId || 'unknown'
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

        res.status(429).json(createErrorResponse(
          'Daily payment limit exceeded',
          'PAYMENT_DAILY_LIMIT_EXCEEDED',
          { 
            dailyLimit,
            currentTotal: dailyTotal,
            remainingLimit: Math.max(0, dailyLimit - dailyTotal)
          }
        ));
        return;
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

    res.status(500).json(createErrorResponse(
      'Payment limits validation service unavailable',
      'PAYMENT_LIMITS_SERVICE_ERROR'
    ));
  }
};
