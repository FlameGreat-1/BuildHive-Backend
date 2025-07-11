import { Request, Response } from 'express';
import { PAYMENT_CONSTANTS } from '../../config/payment';
import { logger, sendSuccessResponse, sendErrorResponse } from '../../shared/utils';
import { PaymentService } from '../services';
import { AuthenticatedRequest } from '../../auth/middleware/auth.middleware';
import { 
  CreatePaymentIntentRequest,
  ConfirmPaymentRequest,
  PaymentLinkRequest,
  PaymentStatusRequest,
  PaymentHistoryRequest
} from '../types';

export class PaymentController {
  private paymentService: PaymentService;

  constructor() {
    this.paymentService = new PaymentService();
  }

  async createPaymentIntent(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user ? parseInt(req.user.id) : undefined;
      const requestId = req.requestId || 'unknown';

      if (!userId) {
        return sendErrorResponse(res, 'User authentication required', 401, 'PAYMENT_AUTH_REQUIRED');
      }

      const request: CreatePaymentIntentRequest = {
        ...req.body,
        metadata: {
          ...req.body.metadata,
          userId: userId.toString()
        }
      };

      const paymentIntent = await this.paymentService.createPaymentIntent(request, requestId);

      logger.info('Payment intent created successfully', {
        paymentIntentId: paymentIntent.paymentIntentId,
        amount: request.amount,
        currency: request.currency,
        paymentMethod: request.paymentMethod,
        userId,
        requestId
      });

      sendSuccessResponse(res, {
        message: 'Payment intent created successfully',
        data: paymentIntent
      }, 201);

    } catch (error) {
      logger.error('Failed to create payment intent', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user ? parseInt(req.user.id) : undefined,
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('Invalid') ? 400 : 500;
      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to create payment intent',
        statusCode,
        'PAYMENT_INTENT_CREATION_FAILED'
      );
    }
  }

  async confirmPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user ? parseInt(req.user.id) : undefined;
      const requestId = req.requestId || 'unknown';

      if (!userId) {
        return sendErrorResponse(res, 'User authentication required', 401, 'PAYMENT_AUTH_REQUIRED');
      }

      const request: ConfirmPaymentRequest = req.body;
      const confirmResult = await this.paymentService.confirmPayment(request, requestId);

      logger.info('Payment confirmed successfully', {
        paymentIntentId: request.paymentIntentId,
        status: confirmResult.status,
        userId,
        requestId
      });

      sendSuccessResponse(res, {
        message: 'Payment confirmed successfully',
        data: confirmResult
      });

    } catch (error) {
      logger.error('Failed to confirm payment', {
        paymentIntentId: req.body.paymentIntentId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user ? parseInt(req.user.id) : undefined,
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to confirm payment',
        statusCode,
        'PAYMENT_CONFIRMATION_FAILED'
      );
    }
  }

  async createPaymentLink(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user ? parseInt(req.user.id) : undefined;
      const requestId = req.requestId || 'unknown';

      if (!userId) {
        return sendErrorResponse(res, 'User authentication required', 401, 'PAYMENT_AUTH_REQUIRED');
      }

      const request: PaymentLinkRequest = {
        ...req.body,
        metadata: {
          ...req.body.metadata,
          userId: userId.toString()
        }
      };

      const paymentLink = await this.paymentService.createPaymentLink(request, requestId);

      logger.info('Payment link created successfully', {
        paymentLinkId: paymentLink.id,
        amount: request.amount,
        currency: request.currency,
        userId,
        requestId
      });

      sendSuccessResponse(res, {
        message: 'Payment link created successfully',
        data: paymentLink
      }, 201);

    } catch (error) {
      logger.error('Failed to create payment link', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user ? parseInt(req.user.id) : undefined,
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('Invalid') ? 400 : 500;
      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to create payment link',
        statusCode,
        'PAYMENT_LINK_CREATION_FAILED'
      );
    }
  }

  async getPaymentStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user ? parseInt(req.user.id) : undefined;
      const requestId = req.requestId || 'unknown';
      const paymentId = parseInt(req.params.paymentId);

      if (!userId) {
        return sendErrorResponse(res, 'User authentication required', 401, 'PAYMENT_AUTH_REQUIRED');
      }

      if (isNaN(paymentId)) {
        return sendErrorResponse(res, 'Invalid payment ID', 400, 'INVALID_PAYMENT_ID');
      }

      const request: PaymentStatusRequest = { paymentId };
      const paymentStatus = await this.paymentService.getPaymentStatus(request, requestId);

      logger.info('Payment status retrieved successfully', {
        paymentId,
        status: paymentStatus.status,
        userId,
        requestId
      });

      sendSuccessResponse(res, {
        message: 'Payment status retrieved successfully',
        data: paymentStatus
      });

    } catch (error) {
      logger.error('Failed to get payment status', {
        paymentId: req.params.paymentId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user ? parseInt(req.user.id) : undefined,
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to get payment status',
        statusCode,
        'PAYMENT_STATUS_RETRIEVAL_FAILED'
      );
    }
  }

  async getPaymentHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user ? parseInt(req.user.id) : undefined;
      const requestId = req.requestId || 'unknown';

      if (!userId) {
        return sendErrorResponse(res, 'User authentication required', 401, 'PAYMENT_AUTH_REQUIRED');
      }

      const request: PaymentHistoryRequest = {
        userId,
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0
      };

      const paymentHistory = await this.paymentService.getPaymentHistory(request, requestId);

      logger.info('Payment history retrieved successfully', {
        userId,
        count: paymentHistory.payments.length,
        totalCount: paymentHistory.totalCount,
        requestId
      });

      sendSuccessResponse(res, {
        message: 'Payment history retrieved successfully',
        data: paymentHistory
      });

    } catch (error) {
      logger.error('Failed to get payment history', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user ? parseInt(req.user.id) : undefined,
        requestId: req.requestId
      });

      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to get payment history',
        500,
        'PAYMENT_HISTORY_RETRIEVAL_FAILED'
      );
    }
  }

  async cancelPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user ? parseInt(req.user.id) : undefined;
      const requestId = req.requestId || 'unknown';
      const paymentId = parseInt(req.params.paymentId);

      if (!userId) {
        return sendErrorResponse(res, 'User authentication required', 401, 'PAYMENT_AUTH_REQUIRED');
      }

      if (isNaN(paymentId)) {
        return sendErrorResponse(res, 'Invalid payment ID', 400, 'INVALID_PAYMENT_ID');
      }

      await this.paymentService.cancelPayment(paymentId, requestId);

      logger.info('Payment cancelled successfully', {
        paymentId,
        userId,
        requestId
      });

      sendSuccessResponse(res, {
        message: 'Payment cancelled successfully',
        data: { paymentId, status: 'cancelled' }
      });

    } catch (error) {
      logger.error('Failed to cancel payment', {
        paymentId: req.params.paymentId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user ? parseInt(req.user.id) : undefined,
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 
                        error instanceof Error && error.message.includes('Cannot cancel') ? 400 : 500;
      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to cancel payment',
        statusCode,
        'PAYMENT_CANCELLATION_FAILED'
      );
    }
  }

  async getPaymentMethods(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const requestId = req.requestId || 'unknown';

      const supportedMethods = {
        stripe: {
          enabled: true,
          types: ['card'],
          currencies: PAYMENT_CONSTANTS.STRIPE.CURRENCY.SUPPORTED
        },
        applePay: {
          enabled: !!process.env.APPLE_PAY_MERCHANT_ID,
          countries: PAYMENT_CONSTANTS.APPLE_PAY?.SUPPORTED_COUNTRIES || [],
          currencies: PAYMENT_CONSTANTS.STRIPE.CURRENCY.SUPPORTED
        },
        googlePay: {
          enabled: !!process.env.GOOGLE_PAY_MERCHANT_ID,
          countries: PAYMENT_CONSTANTS.GOOGLE_PAY?.SUPPORTED_COUNTRIES || [],
          currencies: PAYMENT_CONSTANTS.STRIPE.CURRENCY.SUPPORTED
        }
      };

      logger.info('Payment methods retrieved successfully', {
        requestId
      });

      sendSuccessResponse(res, {
        message: 'Payment methods retrieved successfully',
        data: supportedMethods
      });

    } catch (error) {
      logger.error('Failed to get payment methods', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.requestId
      });

      sendErrorResponse(res,
        'Failed to get payment methods',
        500,
        'PAYMENT_METHODS_RETRIEVAL_FAILED'
      );
    }
  }
}
