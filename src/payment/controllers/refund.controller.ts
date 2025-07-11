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

  async createRefund(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = this.validateAuthentication(req, res);
      if (!userId) return;

      const requestId = req.requestId || 'unknown';

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

      sendSuccessResponse(res, 'Refund created successfully', refund, 201);

    } catch (error) {
      logger.error('Failed to create refund', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: this.getUserId(req),
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 :
                        error instanceof Error && error.message.includes('Can only refund') ? 400 :
                        error instanceof Error && error.message.includes('cannot exceed') ? 400 : 500;
      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to create refund',
        statusCode
      );
    }
  }

  async updateRefundStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = this.validateAuthentication(req, res);
      if (!userId) return;

      const requestId = req.requestId || 'unknown';
      const refundId = parseInt(req.params.refundId);

      if (isNaN(refundId)) {
        return sendErrorResponse(res, 'Invalid refund ID', 400);
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

      sendSuccessResponse(res, 'Refund status updated successfully', updateResult);

    } catch (error) {
      logger.error('Failed to update refund status', {
        refundId: req.params.refundId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: this.getUserId(req),
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to update refund status',
        statusCode
      );
    }
  }

  async getRefund(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = this.validateAuthentication(req, res);
      if (!userId) return;

      const requestId = req.requestId || 'unknown';
      const refundId = parseInt(req.params.refundId);

      if (isNaN(refundId)) {
        return sendErrorResponse(res, 'Invalid refund ID', 400);
      }

      const refund = await this.refundService.getRefund(refundId, requestId);

      logger.info('Refund retrieved successfully', {
        refundId,
        paymentId: refund.paymentId,
        status: refund.status,
        userId,
        requestId
      });

      sendSuccessResponse(res, 'Refund retrieved successfully', refund);

    } catch (error) {
      logger.error('Failed to get refund', {
        refundId: req.params.refundId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: this.getUserId(req),
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to get refund',
        statusCode
      );
    }
  }

  async getUserRefunds(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = this.validateAuthentication(req, res);
      if (!userId) return;

      const requestId = req.requestId || 'unknown';

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

      sendSuccessResponse(res, 'Refunds retrieved successfully', refunds);

    } catch (error) {
      logger.error('Failed to get user refunds', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: this.getUserId(req),
        requestId: req.requestId
      });

      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to get refunds',
        500
      );
    }
  }

  async getPaymentRefunds(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = this.validateAuthentication(req, res);
      if (!userId) return;

      const requestId = req.requestId || 'unknown';
      const paymentId = parseInt(req.params.paymentId);

      if (isNaN(paymentId)) {
        return sendErrorResponse(res, 'Invalid payment ID', 400);
      }

      const refunds = await this.refundService.getPaymentRefunds(paymentId, requestId);

      logger.info('Payment refunds retrieved successfully', {
        paymentId,
        count: refunds.refunds.length,
        userId,
        requestId
      });

      sendSuccessResponse(res, 'Payment refunds retrieved successfully', refunds);

    } catch (error) {
      logger.error('Failed to get payment refunds', {
        paymentId: req.params.paymentId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: this.getUserId(req),
        requestId: req.requestId
      });

      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to get payment refunds',
        500
      );
    }
  }

  async cancelRefund(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = this.validateAuthentication(req, res);
      if (!userId) return;

      const requestId = req.requestId || 'unknown';
      const refundId = parseInt(req.params.refundId);

      if (isNaN(refundId)) {
        return sendErrorResponse(res, 'Invalid refund ID', 400);
      }

      await this.refundService.cancelRefund(refundId, requestId);

      logger.info('Refund cancelled successfully', {
        refundId,
        userId,
        requestId
      });

      sendSuccessResponse(res, 'Refund cancelled successfully', { refundId, status: 'cancelled' });

    } catch (error) {
      logger.error('Failed to cancel refund', {
        refundId: req.params.refundId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: this.getUserId(req),
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 :
                        error instanceof Error && error.message.includes('Cannot cancel') ? 400 : 500;
      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to cancel refund',
        statusCode
      );
    }
  }
}
