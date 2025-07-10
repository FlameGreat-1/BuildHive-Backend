import { Request, Response } from 'express';
import { PAYMENT_CONSTANTS } from '../../config/payment';
import { logger, createSuccessResponse, createErrorResponse } from '../../shared/utils';
import { PaymentService } from '../services';
import { 
  CreatePaymentIntentRequest,
  ConfirmPaymentRequest,
  PaymentLinkRequest,
  PaymentStatusRequest,
  PaymentHistoryRequest
} from '../types';

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
  };
  requestId?: string;
}

export class PaymentController {
  private paymentService: PaymentService;

  constructor() {
    this.paymentService = new PaymentService();
  }

  async createPaymentIntent(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const requestId = req.requestId || 'unknown';

      if (!userId) {
        res.status(401).json(createErrorResponse(
          'User authentication required',
          'PAYMENT_AUTH_REQUIRED'
        ));
        return;
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

      res.status(201).json(createSuccessResponse(
        'Payment intent created successfully',
        paymentIntent
      ));
    } catch (error) {
      logger.error('Failed to create payment intent', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('Invalid') ? 400 : 500;
      res.status(statusCode).json(createErrorResponse(
        error instanceof Error ? error.message : 'Failed to create payment intent',
        'PAYMENT_INTENT_CREATION_FAILED'
      ));
    }
  }

  async confirmPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const requestId = req.requestId || 'unknown';

      if (!userId) {
        res.status(401).json(createErrorResponse(
          'User authentication required',
          'PAYMENT_AUTH_REQUIRED'
        ));
        return;
      }

      const request: ConfirmPaymentRequest = req.body;
      const confirmResult = await this.paymentService.confirmPayment(request, requestId);

      logger.info('Payment confirmed successfully', {
        paymentIntentId: request.paymentIntentId,
        status: confirmResult.status,
        userId,
        requestId
      });

      res.status(200).json(createSuccessResponse(
        'Payment confirmed successfully',
        confirmResult
      ));
    } catch (error) {
      logger.error('Failed to confirm payment', {
        paymentIntentId: req.body.paymentIntentId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
      res.status(statusCode).json(createErrorResponse(
        error instanceof Error ? error.message : 'Failed to confirm payment',
        'PAYMENT_CONFIRMATION_FAILED'
      ));
    }
  }

  async createPaymentLink(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const requestId = req.requestId || 'unknown';

      if (!userId) {
        res.status(401).json(createErrorResponse(
          'User authentication required',
          'PAYMENT_AUTH_REQUIRED'
        ));
        return;
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

      res.status(201).json(createSuccessResponse(
        'Payment link created successfully',
        paymentLink
      ));
    } catch (error) {
      logger.error('Failed to create payment link', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('Invalid') ? 400 : 500;
      res.status(statusCode).json(createErrorResponse(
        error instanceof Error ? error.message : 'Failed to create payment link',
        'PAYMENT_LINK_CREATION_FAILED'
      ));
    }
  }

  async getPaymentStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const requestId = req.requestId || 'unknown';
      const paymentId = parseInt(req.params.paymentId);

      if (!userId) {
        res.status(401).json(createErrorResponse(
          'User authentication required',
          'PAYMENT_AUTH_REQUIRED'
        ));
        return;
      }

      if (isNaN(paymentId)) {
        res.status(400).json(createErrorResponse(
          'Invalid payment ID',
          'INVALID_PAYMENT_ID'
        ));
        return;
      }

      const request: PaymentStatusRequest = { paymentId };
      const paymentStatus = await this.paymentService.getPaymentStatus(request, requestId);

      logger.info('Payment status retrieved successfully', {
        paymentId,
        status: paymentStatus.status,
        userId,
        requestId
      });

      res.status(200).json(createSuccessResponse(
        'Payment status retrieved successfully',
        paymentStatus
      ));
    } catch (error) {
      logger.error('Failed to get payment status', {
        paymentId: req.params.paymentId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
      res.status(statusCode).json(createErrorResponse(
        error instanceof Error ? error.message : 'Failed to get payment status',
        'PAYMENT_STATUS_RETRIEVAL_FAILED'
      ));
    }
  }

  async getPaymentHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const requestId = req.requestId || 'unknown';

      if (!userId) {
        res.status(401).json(createErrorResponse(
          'User authentication required',
          'PAYMENT_AUTH_REQUIRED'
        ));
        return;
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

      res.status(200).json(createSuccessResponse(
        'Payment history retrieved successfully',
        paymentHistory
      ));
    } catch (error) {
      logger.error('Failed to get payment history', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        requestId: req.requestId
      });

      res.status(500).json(createErrorResponse(
        error instanceof Error ? error.message : 'Failed to get payment history',
        'PAYMENT_HISTORY_RETRIEVAL_FAILED'
      ));
    }
  }

  async cancelPayment(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const requestId = req.requestId || 'unknown';
      const paymentId = parseInt(req.params.paymentId);

      if (!userId) {
        res.status(401).json(createErrorResponse(
          'User authentication required',
          'PAYMENT_AUTH_REQUIRED'
        ));
        return;
      }

      if (isNaN(paymentId)) {
        res.status(400).json(createErrorResponse(
          'Invalid payment ID',
          'INVALID_PAYMENT_ID'
        ));
        return;
      }

      await this.paymentService.cancelPayment(paymentId, requestId);

      logger.info('Payment cancelled successfully', {
        paymentId,
        userId,
        requestId
      });

      res.status(200).json(createSuccessResponse(
        'Payment cancelled successfully',
        { paymentId, status: 'cancelled' }
      ));
    } catch (error) {
      logger.error('Failed to cancel payment', {
        paymentId: req.params.paymentId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 
                        error instanceof Error && error.message.includes('Cannot cancel') ? 400 : 500;
      res.status(statusCode).json(createErrorResponse(
        error instanceof Error ? error.message : 'Failed to cancel payment',
        'PAYMENT_CANCELLATION_FAILED'
      ));
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

      res.status(200).json(createSuccessResponse(
        'Payment methods retrieved successfully',
        supportedMethods
      ));
    } catch (error) {
      logger.error('Failed to get payment methods', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.requestId
      });

      res.status(500).json(createErrorResponse(
        'Failed to get payment methods',
        'PAYMENT_METHODS_RETRIEVAL_FAILED'
      ));
    }
  }
}
