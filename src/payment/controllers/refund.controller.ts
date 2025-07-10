import { Request, Response } from 'express';
import { logger, createSuccessResponse, createErrorResponse } from '../../shared/utils';
import { RefundService } from '../services';
import { 
  CreateRefundRequest,
  UpdateRefundStatusRequest,
  RefundListRequest
} from '../types';

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
  };
  requestId?: string;
}

export class RefundController {
  private refundService: RefundService;

  constructor() {
    this.refundService = new RefundService();
  }

  async createRefund(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const requestId = req.requestId || 'unknown';

      if (!userId) {
        res.status(401).json(createErrorResponse(
          'User authentication required',
          'REFUND_AUTH_REQUIRED'
        ));
        return;
      }

      const request: CreateRefundRequest = {
        ...req.body,
        userId,
        metadata: {
          ...req.body.metadata,
          userId: userId.toString()
        }
      };

      const refund = await this.refundService.createRefund(request, requestId);

      logger.info('Refund created successfully', {
        refundId: refund.id,
        paymentId: refund.paymentId,
        amount: refund.amount,
        reason: refund.reason,
        userId,
        requestId
      });

      res.status(201).json(createSuccessResponse(
        'Refund created successfully',
        refund
      ));
    } catch (error) {
      logger.error('Failed to create refund', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 :
                        error instanceof Error && error.message.includes('Can only refund') ? 400 :
                        error instanceof Error && error.message.includes('cannot exceed') ? 400 : 500;
      res.status(statusCode).json(createErrorResponse(
        error instanceof Error ? error.message : 'Failed to create refund',
        'REFUND_CREATION_FAILED'
      ));
    }
  }

  async updateRefundStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const requestId = req.requestId || 'unknown';
      const refundId = parseInt(req.params.refundId);

      if (!userId) {
        res.status(401).json(createErrorResponse(
          'User authentication required',
          'REFUND_AUTH_REQUIRED'
        ));
        return;
      }

      if (isNaN(refundId)) {
        res.status(400).json(createErrorResponse(
          'Invalid refund ID',
          'INVALID_REFUND_ID'
        ));
        return;
      }

      const request: UpdateRefundStatusRequest = {
        refundId,
        ...req.body
      };

      const updateResult = await this.refundService.updateRefundStatus(request, requestId);

      logger.info('Refund status updated successfully', {
        refundId,
        status: request.status,
        userId,
        requestId
      });

      res.status(200).json(createSuccessResponse(
        'Refund status updated successfully',
        updateResult
      ));
    } catch (error) {
      logger.error('Failed to update refund status', {
        refundId: req.params.refundId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
      res.status(statusCode).json(createErrorResponse(
        error instanceof Error ? error.message : 'Failed to update refund status',
        'REFUND_STATUS_UPDATE_FAILED'
      ));
    }
  }

  async getRefund(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const requestId = req.requestId || 'unknown';
      const refundId = parseInt(req.params.refundId);

      if (!userId) {
        res.status(401).json(createErrorResponse(
          'User authentication required',
          'REFUND_AUTH_REQUIRED'
        ));
        return;
      }

      if (isNaN(refundId)) {
        res.status(400).json(createErrorResponse(
          'Invalid refund ID',
          'INVALID_REFUND_ID'
        ));
        return;
      }

      const refund = await this.refundService.getRefund(refundId, requestId);

      logger.info('Refund retrieved successfully', {
        refundId,
        paymentId: refund.paymentId,
        status: refund.status,
        userId,
        requestId
      });

      res.status(200).json(createSuccessResponse(
        'Refund retrieved successfully',
        refund
      ));
    } catch (error) {
      logger.error('Failed to get refund', {
        refundId: req.params.refundId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
      res.status(statusCode).json(createErrorResponse(
        error instanceof Error ? error.message : 'Failed to get refund',
        'REFUND_RETRIEVAL_FAILED'
      ));
    }
  }

  async getUserRefunds(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const requestId = req.requestId || 'unknown';

      if (!userId) {
        res.status(401).json(createErrorResponse(
          'User authentication required',
          'REFUND_AUTH_REQUIRED'
        ));
        return;
      }

      const request: RefundListRequest = {
        userId,
        status: req.query.status as string,
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0
      };

      const refunds = await this.refundService.getUserRefunds(request, requestId);

      logger.info('User refunds retrieved successfully', {
        userId,
        status: request.status,
        count: refunds.refunds.length,
        totalCount: refunds.totalCount,
        requestId
      });

      res.status(200).json(createSuccessResponse(
        'Refunds retrieved successfully',
        refunds
      ));
    } catch (error) {
      logger.error('Failed to get user refunds', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        requestId: req.requestId
      });

      res.status(500).json(createErrorResponse(
        error instanceof Error ? error.message : 'Failed to get refunds',
        'REFUNDS_RETRIEVAL_FAILED'
      ));
    }
  }

  async getPaymentRefunds(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const requestId = req.requestId || 'unknown';
      const paymentId = parseInt(req.params.paymentId);

      if (!userId) {
        res.status(401).json(createErrorResponse(
          'User authentication required',
          'REFUND_AUTH_REQUIRED'
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

      const refunds = await this.refundService.getPaymentRefunds(paymentId, requestId);

      logger.info('Payment refunds retrieved successfully', {
        paymentId,
        count: refunds.refunds.length,
        userId,
        requestId
      });

      res.status(200).json(createSuccessResponse(
        'Payment refunds retrieved successfully',
        refunds
      ));
    } catch (error) {
      logger.error('Failed to get payment refunds', {
        paymentId: req.params.paymentId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        requestId: req.requestId
      });

      res.status(500).json(createErrorResponse(
        error instanceof Error ? error.message : 'Failed to get payment refunds',
        'PAYMENT_REFUNDS_RETRIEVAL_FAILED'
      ));
    }
  }

  async cancelRefund(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const requestId = req.requestId || 'unknown';
      const refundId = parseInt(req.params.refundId);

      if (!userId) {
        res.status(401).json(createErrorResponse(
          'User authentication required',
          'REFUND_AUTH_REQUIRED'
        ));
        return;
      }

      if (isNaN(refundId)) {
        res.status(400).json(createErrorResponse(
          'Invalid refund ID',
          'INVALID_REFUND_ID'
        ));
        return;
      }

      await this.refundService.cancelRefund(refundId, requestId);

      logger.info('Refund cancelled successfully', {
        refundId,
        userId,
        requestId
      });

      res.status(200).json(createSuccessResponse(
        'Refund cancelled successfully',
        { refundId, status: 'cancelled' }
      ));
    } catch (error) {
      logger.error('Failed to cancel refund', {
        refundId: req.params.refundId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 :
                        error instanceof Error && error.message.includes('Cannot cancel') ? 400 : 500;
      res.status(statusCode).json(createErrorResponse(
        error instanceof Error ? error.message : 'Failed to cancel refund',
        'REFUND_CANCELLATION_FAILED'
      ));
    }
  }
}
