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

  private getUserId(req: AuthenticatedRequest): number | null {
    if (!req.user?.id) {
      return null;
    }
    const userId = parseInt(req.user.id);
    return isNaN(userId) ? null : userId;
  }

  private validateAuthentication(req: AuthenticatedRequest, res: Response): number | null {
    if (!req.user) {
      sendErrorResponse(res, 'User authentication required', 401);
      return null;
    }

    if (!req.user.id) {
      sendErrorResponse(res, 'Invalid user session', 401);
      return null;
    }

    const userId = this.getUserId(req);
    if (!userId) {
      sendErrorResponse(res, 'Invalid user ID', 401);
      return null;
    }

    return userId;
  }

  async createPaymentIntent(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = this.validateAuthentication(req, res);
      if (!userId) return;

      const requestId = req.requestId || 'unknown';

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

      sendSuccessResponse(res, 'Payment intent created successfully', paymentIntent, 201);

    } catch (error) {
      logger.error('Failed to create payment intent', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: this.getUserId(req),
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('Invalid') ? 400 : 500;
      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to create payment intent',
        statusCode
      );
    }
  }

  async confirmPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = this.validateAuthentication(req, res);
      if (!userId) return;

      const requestId = req.requestId || 'unknown';

      const request: ConfirmPaymentRequest = req.body;
      const confirmResult = await this.paymentService.confirmPayment(request, requestId);

      logger.info('Payment confirmed successfully', {
        paymentIntentId: request.paymentIntentId,
        status: confirmResult.status,
        userId,
        requestId
      });

      sendSuccessResponse(res, 'Payment confirmed successfully', confirmResult);

    } catch (error) {
      logger.error('Failed to confirm payment', {
        paymentIntentId: req.body.paymentIntentId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: this.getUserId(req),
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to confirm payment',
        statusCode
      );
    }
  }

  async createPaymentLink(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = this.validateAuthentication(req, res);
      if (!userId) return;

      const requestId = req.requestId || 'unknown';

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

      sendSuccessResponse(res, 'Payment link created successfully', paymentLink, 201);

    } catch (error) {
      logger.error('Failed to create payment link', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: this.getUserId(req),
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('Invalid') ? 400 : 500;
      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to create payment link',
        statusCode
      );
    }
  }

  async getPaymentStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = this.validateAuthentication(req, res);
      if (!userId) return;

      const requestId = req.requestId || 'unknown';
      const paymentId = parseInt(req.params.paymentId);

      if (isNaN(paymentId)) {
        return sendErrorResponse(res, 'Invalid payment ID', 400);
      }

      const request: PaymentStatusRequest = { paymentId };
      const paymentStatus = await this.paymentService.getPaymentStatus(request, requestId);

      logger.info('Payment status retrieved successfully', {
        paymentId,
        status: paymentStatus.status,
        userId,
        requestId
      });

      sendSuccessResponse(res, 'Payment status retrieved successfully', paymentStatus);

    } catch (error) {
      logger.error('Failed to get payment status', {
        paymentId: req.params.paymentId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: this.getUserId(req),
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to get payment status',
        statusCode
      );
    }
  }

  async getPaymentHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = this.validateAuthentication(req, res);
      if (!userId) return;

      const requestId = req.requestId || 'unknown';

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

      sendSuccessResponse(res, 'Payment history retrieved successfully', paymentHistory);

    } catch (error) {
      logger.error('Failed to get payment history', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: this.getUserId(req),
        requestId: req.requestId
      });

      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to get payment history',
        500
      );
    }
  }

  async cancelPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = this.validateAuthentication(req, res);
      if (!userId) return;

      const requestId = req.requestId || 'unknown';
      const paymentId = parseInt(req.params.paymentId);

      if (isNaN(paymentId)) {
        return sendErrorResponse(res, 'Invalid payment ID', 400);
      }

      await this.paymentService.cancelPayment(paymentId, requestId);

      logger.info('Payment cancelled successfully', {
        paymentId,
        userId,
        requestId
      });

      sendSuccessResponse(res, 'Payment cancelled successfully', { paymentId, status: 'cancelled' });

    } catch (error) {
      logger.error('Failed to cancel payment', {
        paymentId: req.params.paymentId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: this.getUserId(req),
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 
                        error instanceof Error && error.message.includes('Cannot cancel') ? 400 : 500;
      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to cancel payment',
        statusCode
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

      sendSuccessResponse(res, 'Payment methods retrieved successfully', supportedMethods);

    } catch (error) {
      logger.error('Failed to get payment methods', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.requestId
      });

      sendErrorResponse(res,
        'Failed to get payment methods',
        500
      );
    }
  }
}
