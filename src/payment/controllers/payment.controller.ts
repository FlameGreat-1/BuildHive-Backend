import { Request, Response } from 'express';
import { logger, sendSuccessResponse, sendErrorResponse } from '../../shared/utils';
import { PaymentService } from '../services';
import { CreatePaymentRequest, PaymentStatusRequest } from '../types';

interface PaymentRequest extends Request {
  requestId?: string;
  userId?: number;
}

export class PaymentController {
  private paymentService: PaymentService;

  constructor() {
    this.paymentService = new PaymentService();
  }

  async createPayment(req: PaymentRequest, res: Response): Promise<void> {
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

      sendSuccessResponse(res, 'Payment created successfully', payment, 201);

    } catch (error) {
      logger.error('Payment creation error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.userId,
        requestId: req.requestId || 'unknown'
      });

      sendErrorResponse(res, 'Failed to create payment', 500);
    }
  }

  async getPaymentStatus(req: PaymentRequest, res: Response): Promise<void> {
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

      sendSuccessResponse(res, 'Payment status retrieved successfully', payment);

    } catch (error) {
      logger.error('Failed to get payment status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        paymentId: req.params.paymentId,
        requestId: req.requestId || 'unknown'
      });

      sendErrorResponse(res, 'Failed to get payment status', 500);
    }
  }

  async confirmPayment(req: PaymentRequest, res: Response): Promise<void> {
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

      sendSuccessResponse(res, 'Payment confirmed successfully', result);

    } catch (error) {
      logger.error('Payment confirmation error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        paymentId: req.params.paymentId,
        requestId: req.requestId || 'unknown'
      });

      sendErrorResponse(res, 'Failed to confirm payment', 500);
    }
  }

  async cancelPayment(req: PaymentRequest, res: Response): Promise<void> {
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

      sendSuccessResponse(res, 'Payment canceled successfully', result);

    } catch (error) {
      logger.error('Payment cancellation error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        paymentId: req.params.paymentId,
        requestId: req.requestId || 'unknown'
      });

      sendErrorResponse(res, 'Failed to cancel payment', 500);
    }
  }

  async listPayments(req: PaymentRequest, res: Response): Promise<void> {
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

      sendSuccessResponse(res, 'Payments retrieved successfully', payments);

    } catch (error) {
      logger.error('Failed to list payments', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.userId,
        requestId: req.requestId || 'unknown'
      });

      sendErrorResponse(res, 'Failed to list payments', 500);
    }
  }
}

export const paymentController = new PaymentController();
