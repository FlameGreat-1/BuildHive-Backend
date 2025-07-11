import { Request, Response } from 'express';
import { logger, sendSuccessResponse, sendErrorResponse } from '../../shared/utils';
import { RefundService } from '../services';
import { AuthenticatedRequest } from '../../auth/middleware/auth.middleware';
import { 
  CreateRefundRequest,
  UpdateRefundStatusRequest,
  RefundListRequest
} from '../types';

export class RefundController {
  private refundService: RefundService;

  constructor() {
    this.refundService = new RefundService();
  }

  async createRefund(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user ? parseInt(req.user.id) : undefined;
      const requestId = req.requestId || 'unknown';

      if (!userId) {
        return sendErrorResponse(res, 'User authentication required', 401, 'REFUND_AUTH_REQUIRED');
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

      sendSuccessResponse(res, {
        message: 'Refund created successfully',
        data: refund
      }, 201);

    } catch (error) {
      logger.error('Failed to create refund', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user ? parseInt(req.user.id) : undefined,
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 :
                        error instanceof Error && error.message.includes('Can only refund') ? 400 :
                        error instanceof Error && error.message.includes('cannot exceed') ? 400 : 500;
      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to create refund',
        statusCode,
        'REFUND_CREATION_FAILED'
      );
    }
  }

  async updateRefundStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user ? parseInt(req.user.id) : undefined;
      const requestId = req.requestId || 'unknown';
      const refundId = parseInt(req.params.refundId);

      if (!userId) {
        return sendErrorResponse(res, 'User authentication required', 401, 'REFUND_AUTH_REQUIRED');
      }

      if (isNaN(refundId)) {
        return sendErrorResponse(res, 'Invalid refund ID', 400, 'INVALID_REFUND_ID');
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

      sendSuccessResponse(res, {
        message: 'Refund status updated successfully',
        data: updateResult
      });

    } catch (error) {
      logger.error('Failed to update refund status', {
        refundId: req.params.refundId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user ? parseInt(req.user.id) : undefined,
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to update refund status',
        statusCode,
        'REFUND_STATUS_UPDATE_FAILED'
      );
    }
  }

  async getRefund(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user ? parseInt(req.user.id) : undefined;
      const requestId = req.requestId || 'unknown';
      const refundId = parseInt(req.params.refundId);

      if (!userId) {
        return sendErrorResponse(res, 'User authentication required', 401, 'REFUND_AUTH_REQUIRED');
      }

      if (isNaN(refundId)) {
        return sendErrorResponse(res, 'Invalid refund ID', 400, 'INVALID_REFUND_ID');
      }

      const refund = await this.refundService.getRefund(refundId, requestId);

      logger.info('Refund retrieved successfully', {
        refundId,
        paymentId: refund.paymentId,
        status: refund.status,
        userId,
        requestId
      });

      sendSuccessResponse(res, {
        message: 'Refund retrieved successfully',
        data: refund
      });

    } catch (error) {
      logger.error('Failed to get refund', {
        refundId: req.params.refundId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user ? parseInt(req.user.id) : undefined,
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to get refund',
        statusCode,
        'REFUND_RETRIEVAL_FAILED'
      );
    }
  }

  async getUserRefunds(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user ? parseInt(req.user.id) : undefined;
      const requestId = req.requestId || 'unknown';

      if (!userId) {
        return sendErrorResponse(res, 'User authentication required', 401, 'REFUND_AUTH_REQUIRED');
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

      sendSuccessResponse(res, {
        message: 'Refunds retrieved successfully',
        data: refunds
      });

    } catch (error) {
      logger.error('Failed to get user refunds', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user ? parseInt(req.user.id) : undefined,
        requestId: req.requestId
      });

      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to get refunds',
        500,
        'REFUNDS_RETRIEVAL_FAILED'
      );
    }
  }

  async getPaymentRefunds(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user ? parseInt(req.user.id) : undefined;
      const requestId = req.requestId || 'unknown';
      const paymentId = parseInt(req.params.paymentId);

      if (!userId) {
        return sendErrorResponse(res, 'User authentication required', 401, 'REFUND_AUTH_REQUIRED');
      }

      if (isNaN(paymentId)) {
        return sendErrorResponse(res, 'Invalid payment ID', 400, 'INVALID_PAYMENT_ID');
      }

      const refunds = await this.refundService.getPaymentRefunds(paymentId, requestId);

      logger.info('Payment refunds retrieved successfully', {
        paymentId,
        count: refunds.refunds.length,
        userId,
        requestId
      });

      sendSuccessResponse(res, {
        message: 'Payment refunds retrieved successfully',
        data: refunds
      });

    } catch (error) {
      logger.error('Failed to get payment refunds', {
        paymentId: req.params.paymentId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user ? parseInt(req.user.id) : undefined,
        requestId: req.requestId
      });

      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to get payment refunds',
        500,
        'PAYMENT_REFUNDS_RETRIEVAL_FAILED'
      );
    }
  }

  async cancelRefund(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user ? parseInt(req.user.id) : undefined;
      const requestId = req.requestId || 'unknown';
      const refundId = parseInt(req.params.refundId);

      if (!userId) {
        return sendErrorResponse(res, 'User authentication required', 401, 'REFUND_AUTH_REQUIRED');
      }

      if (isNaN(refundId)) {
        return sendErrorResponse(res, 'Invalid refund ID', 400, 'INVALID_REFUND_ID');
      }

      await this.refundService.cancelRefund(refundId, requestId);

      logger.info('Refund cancelled successfully', {
        refundId,
        userId,
        requestId
      });

      sendSuccessResponse(res, {
        message: 'Refund cancelled successfully',
        data: { refundId, status: 'cancelled' }
      });

    } catch (error) {
      logger.error('Failed to cancel refund', {
        refundId: req.params.refundId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user ? parseInt(req.user.id) : undefined,
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 :
                        error instanceof Error && error.message.includes('Cannot cancel') ? 400 : 500;
      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to cancel refund',
        statusCode,
        'REFUND_CANCELLATION_FAILED'
      );
    }
  }
}
