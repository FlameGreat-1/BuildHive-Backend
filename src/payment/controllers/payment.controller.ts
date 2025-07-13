import { Request, Response } from 'express';
import { logger, sendSuccessResponse, sendErrorResponse } from '../../shared/utils';
import { PaymentService } from '../services';
import { CreatePaymentRequest, CreatePaymentIntentRequest, PaymentStatusRequest, PaymentLinkRequest, PaymentHistoryRequest, PaymentMethodListRequest } from '../types';

interface PaymentRequest extends Request {
  requestId?: string;
  userId?: number;
}

export class PaymentController {
  private paymentService: PaymentService;

  constructor() {
    this.paymentService = new PaymentService();
  }

  async createPayment(req: PaymentRequest, res: Response): Promise<Response> {
    try {
      const requestId = req.requestId || 'payment-unknown';
      const userId = req.userId;
      const paymentData: CreatePaymentRequest = req.body;

      if (!userId) {
        return sendErrorResponse(res, 'User ID is required', 401);
      }

      logger.info('Creating payment', {
        userId,
        amount: paymentData.amount,
        currency: paymentData.currency,
        paymentMethod: paymentData.paymentMethod,
        requestId
      });

      const payment = await this.paymentService.createPayment(userId, paymentData, requestId);

      logger.info('Payment created successfully', {
        paymentId: payment.paymentId,
        status: payment.status,
        requestId
      });

      return sendSuccessResponse(res, 'Payment created successfully', payment, 201);

    } catch (error) {
      logger.error('Payment creation error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.userId,
        requestId: req.requestId || 'unknown'
      });

      return sendErrorResponse(res, 'Failed to create payment', 500);
    }
  }

  async createPaymentIntent(req: PaymentRequest, res: Response): Promise<Response> {
    try {
      const requestId = req.requestId || 'payment-intent-unknown';
      const userId = req.userId;
      const paymentData: CreatePaymentIntentRequest = req.body;

      if (!userId) {
        return sendErrorResponse(res, 'User ID is required', 401);
      }

      logger.info('Creating payment intent', {
        userId,
        amount: paymentData.amount,
        currency: paymentData.currency,
        paymentMethod: paymentData.paymentMethod,
        requestId
      });

      const paymentIntent = await this.paymentService.createPaymentIntent(userId, paymentData, requestId);

      logger.info('Payment intent created successfully', {
        paymentIntentId: paymentIntent.paymentIntentId,
        status: paymentIntent.status,
        requestId
      });

      return sendSuccessResponse(res, 'Payment intent created successfully', paymentIntent, 201);

    } catch (error) {
      logger.error('Payment intent creation error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.userId,
        requestId: req.requestId || 'unknown'
      });

      return sendErrorResponse(res, 'Failed to create payment intent', 500);
    }
  }

  async createPaymentLink(req: PaymentRequest, res: Response): Promise<Response> {
    try {
      const requestId = req.requestId || 'payment-link-unknown';
      const userId = req.userId;
      const linkData: PaymentLinkRequest = req.body;

      if (!userId) {
        return sendErrorResponse(res, 'User ID is required', 401);
      }

      logger.info('Creating payment link', {
        userId,
        amount: linkData.amount,
        currency: linkData.currency,
        requestId
      });

      const paymentLink = await this.paymentService.createPaymentLink(userId, linkData, requestId);

      logger.info('Payment link created successfully', {
        linkId: paymentLink.id,
        url: paymentLink.url,
        requestId
      });

      return sendSuccessResponse(res, 'Payment link created successfully', paymentLink, 201);

    } catch (error) {
      logger.error('Payment link creation error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.userId,
        requestId: req.requestId || 'unknown'
      });

      return sendErrorResponse(res, 'Failed to create payment link', 500);
    }
  }

  async getPaymentMethods(req: PaymentRequest, res: Response): Promise<Response> {
    try {
      const requestId = req.requestId || 'payment-methods-unknown';
      const userId = req.userId;

      if (!userId) {
        return sendErrorResponse(res, 'User ID is required', 401);
      }

      const request: PaymentMethodListRequest = {
        userId,
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0,
        type: req.query.type as string
      };

      logger.info('Retrieving payment methods', {
        userId,
        limit: request.limit,
        offset: request.offset,
        requestId
      });

      const paymentMethods = await this.paymentService.getPaymentMethods(request, requestId);

      return sendSuccessResponse(res, 'Payment methods retrieved successfully', paymentMethods);

    } catch (error) {
      logger.error('Failed to get payment methods', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.userId,
        requestId: req.requestId || 'unknown'
      });

      return sendErrorResponse(res, 'Failed to get payment methods', 500);
    }
  }

  async getPaymentHistory(req: PaymentRequest, res: Response): Promise<Response> {
    try {
      const requestId = req.requestId || 'payment-history-unknown';
      const userId = req.userId;

      if (!userId) {
        return sendErrorResponse(res, 'User ID is required', 401);
      }

      const request: PaymentHistoryRequest = {
        userId,
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined
      };

      logger.info('Retrieving payment history', {
        userId,
        limit: request.limit,
        offset: request.offset,
        requestId
      });

      const paymentHistory = await this.paymentService.getPaymentHistory(request, requestId);

      return sendSuccessResponse(res, 'Payment history retrieved successfully', paymentHistory);

    } catch (error) {
      logger.error('Failed to get payment history', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.userId,
        requestId: req.requestId || 'unknown'
      });

      return sendErrorResponse(res, 'Failed to get payment history', 500);
    }
  }

  async getPaymentStatus(req: PaymentRequest, res: Response): Promise<Response> {
    try {
      const requestId = req.requestId || 'status-unknown';
      const paymentId = parseInt(req.params.paymentId);

      if (isNaN(paymentId)) {
        return sendErrorResponse(res, 'Invalid payment ID', 400);
      }

      logger.info('Retrieving payment status', {
        paymentId,
        requestId
      });

      const payment = await this.paymentService.getPaymentStatus(paymentId, requestId);

      if (!payment) {
        return sendErrorResponse(res, 'Payment not found', 404);
      }

      return sendSuccessResponse(res, 'Payment status retrieved successfully', payment);

    } catch (error) {
      logger.error('Failed to get payment status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        paymentId: req.params.paymentId,
        requestId: req.requestId || 'unknown'
      });

      return sendErrorResponse(res, 'Failed to get payment status', 500);
    }
  }

  async confirmPayment(req: PaymentRequest, res: Response): Promise<Response> {
    try {
      const requestId = req.requestId || 'confirm-unknown';
      const paymentId = parseInt(req.params.paymentId);
      const { paymentMethodId } = req.body;

      if (isNaN(paymentId)) {
        return sendErrorResponse(res, 'Invalid payment ID', 400);
      }

      logger.info('Confirming payment', {
        paymentId,
        paymentMethodId,
        requestId
      });

      const result = await this.paymentService.confirmPayment(paymentId, paymentMethodId, requestId);

      return sendSuccessResponse(res, 'Payment confirmed successfully', result);

    } catch (error) {
      logger.error('Payment confirmation error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        paymentId: req.params.paymentId,
        requestId: req.requestId || 'unknown'
      });

      return sendErrorResponse(res, 'Failed to confirm payment', 500);
    }
  }

  async cancelPayment(req: PaymentRequest, res: Response): Promise<Response> {
    try {
      const requestId = req.requestId || 'cancel-unknown';
      const paymentId = parseInt(req.params.paymentId);
      const { reason } = req.body;

      if (isNaN(paymentId)) {
        return sendErrorResponse(res, 'Invalid payment ID', 400);
      }

      logger.info('Canceling payment', {
        paymentId,
        reason,
        requestId
      });

      const result = await this.paymentService.cancelPayment(paymentId, reason, requestId);

      return sendSuccessResponse(res, 'Payment canceled successfully', result);

    } catch (error) {
      logger.error('Payment cancellation error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        paymentId: req.params.paymentId,
        requestId: req.requestId || 'unknown'
      });

      return sendErrorResponse(res, 'Failed to cancel payment', 500);
    }
  }

  async listPayments(req: PaymentRequest, res: Response): Promise<Response> {
    try {
      const requestId = req.requestId || 'list-unknown';
      const userId = req.userId;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const status = req.query.status as string;

      if (!userId) {
        return sendErrorResponse(res, 'User ID is required', 401);
      }

      logger.info('Listing payments', {
        userId,
        limit,
        offset,
        status,
        requestId
      });

      const payments = await this.paymentService.listPayments(userId, {
        limit,
        offset,
        status
      }, requestId);

      return sendSuccessResponse(res, 'Payments retrieved successfully', payments);

    } catch (error) {
      logger.error('Failed to list payments', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.userId,
        requestId: req.requestId || 'unknown'
      });

      return sendErrorResponse(res, 'Failed to list payments', 500);
    }
  }
}

export const paymentController = new PaymentController();
