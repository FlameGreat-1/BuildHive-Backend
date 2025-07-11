import { Request, Response } from 'express';
import { logger, sendSuccessResponse, sendErrorResponse } from '../../shared/utils';
import { PaymentMethodService } from '../services';
import { AuthenticatedRequest } from '../../auth/middleware/auth.middleware';
import { 
  CreatePaymentMethodRequest,
  AttachPaymentMethodRequest,
  DetachPaymentMethodRequest,
  SetDefaultPaymentMethodRequest,
  PaymentMethodListRequest
} from '../types';

export class PaymentMethodController {
  private paymentMethodService: PaymentMethodService;

  constructor() {
    this.paymentMethodService = new PaymentMethodService();
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

  async createPaymentMethod(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = this.validateAuthentication(req, res);
      if (!userId) return;

      const requestId = req.requestId || 'unknown';

      const request: CreatePaymentMethodRequest = {
        ...req.body,
        metadata: {
          ...req.body.metadata,
          userId: userId.toString()
        }
      };

      const paymentMethod = await this.paymentMethodService.createPaymentMethod(request, requestId);

      logger.info('Payment method created successfully', {
        paymentMethodId: paymentMethod.id,
        type: paymentMethod.type,
        userId,
        requestId
      });

      sendSuccessResponse(res, 'Payment method created successfully', paymentMethod, 201);

    } catch (error) {
      logger.error('Failed to create payment method', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: this.getUserId(req),
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('Invalid') ? 400 : 500;
      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to create payment method',
        statusCode
      );
    }
  }

  async attachPaymentMethod(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = this.validateAuthentication(req, res);
      if (!userId) return;

      const requestId = req.requestId || 'unknown';

      const request: AttachPaymentMethodRequest = req.body;
      const attachResult = await this.paymentMethodService.attachPaymentMethod(request, requestId);

      logger.info('Payment method attached successfully', {
        paymentMethodId: request.paymentMethodId,
        customerId: request.customerId,
        userId,
        requestId
      });

      sendSuccessResponse(res, 'Payment method attached successfully', attachResult);

    } catch (error) {
      logger.error('Failed to attach payment method', {
        paymentMethodId: req.body.paymentMethodId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: this.getUserId(req),
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to attach payment method',
        statusCode
      );
    }
  }

  async detachPaymentMethod(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = this.validateAuthentication(req, res);
      if (!userId) return;

      const requestId = req.requestId || 'unknown';
      const paymentMethodId = req.params.paymentMethodId;

      if (!paymentMethodId) {
        return sendErrorResponse(res, 'Payment method ID is required', 400);
      }

      const request: DetachPaymentMethodRequest = { paymentMethodId };
      const detachResult = await this.paymentMethodService.detachPaymentMethod(request, requestId);

      logger.info('Payment method detached successfully', {
        paymentMethodId,
        userId,
        requestId
      });

      sendSuccessResponse(res, 'Payment method detached successfully', detachResult);

    } catch (error) {
      logger.error('Failed to detach payment method', {
        paymentMethodId: req.params.paymentMethodId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: this.getUserId(req),
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 :
                        error instanceof Error && error.message.includes('Cannot detach') ? 400 : 500;
      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to detach payment method',
        statusCode
      );
    }
  }

  async setDefaultPaymentMethod(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = this.validateAuthentication(req, res);
      if (!userId) return;

      const requestId = req.requestId || 'unknown';
      const paymentMethodId = parseInt(req.params.paymentMethodId);

      if (isNaN(paymentMethodId)) {
        return sendErrorResponse(res, 'Invalid payment method ID', 400);
      }

      const request: SetDefaultPaymentMethodRequest = {
        paymentMethodId,
        userId
      };

      const defaultResult = await this.paymentMethodService.setDefaultPaymentMethod(request, requestId);

      logger.info('Default payment method set successfully', {
        paymentMethodId,
        userId,
        requestId
      });

      sendSuccessResponse(res, 'Default payment method set successfully', defaultResult);

    } catch (error) {
      logger.error('Failed to set default payment method', {
        paymentMethodId: req.params.paymentMethodId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: this.getUserId(req),
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 :
                        error instanceof Error && error.message.includes('does not belong') ? 403 : 500;
      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to set default payment method',
        statusCode
      );
    }
  }

  async getUserPaymentMethods(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = this.validateAuthentication(req, res);
      if (!userId) return;

      const requestId = req.requestId || 'unknown';

      const request: PaymentMethodListRequest = {
        userId,
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0
      };

      const paymentMethods = await this.paymentMethodService.getUserPaymentMethods(request, requestId);

      logger.info('User payment methods retrieved successfully', {
        userId,
        count: paymentMethods.paymentMethods.length,
        totalCount: paymentMethods.totalCount,
        requestId
      });

      sendSuccessResponse(res, 'Payment methods retrieved successfully', paymentMethods);

    } catch (error) {
      logger.error('Failed to get user payment methods', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: this.getUserId(req),
        requestId: req.requestId
      });

      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to get payment methods',
        500
      );
    }
  }

  async deletePaymentMethod(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = this.validateAuthentication(req, res);
      if (!userId) return;

      const requestId = req.requestId || 'unknown';
      const paymentMethodId = parseInt(req.params.paymentMethodId);

      if (isNaN(paymentMethodId)) {
        return sendErrorResponse(res, 'Invalid payment method ID', 400);
      }

      await this.paymentMethodService.deletePaymentMethod(paymentMethodId, userId, requestId);

      logger.info('Payment method deleted successfully', {
        paymentMethodId,
        userId,
        requestId
      });

      sendSuccessResponse(res, 'Payment method deleted successfully', { paymentMethodId, deleted: true });

    } catch (error) {
      logger.error('Failed to delete payment method', {
        paymentMethodId: req.params.paymentMethodId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: this.getUserId(req),
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 :
                        error instanceof Error && error.message.includes('Cannot delete') ? 400 :
                        error instanceof Error && error.message.includes('does not belong') ? 403 : 500;
      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to delete payment method',
        statusCode
      );
    }
  }

  async getDefaultPaymentMethod(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = this.validateAuthentication(req, res);
      if (!userId) return;

      const requestId = req.requestId || 'unknown';

      const defaultPaymentMethod = await this.paymentMethodService.getDefaultPaymentMethod(userId, requestId);

      if (!defaultPaymentMethod) {
        return sendErrorResponse(res, 'No default payment method found', 404);
      }

      logger.info('Default payment method retrieved successfully', {
        paymentMethodId: defaultPaymentMethod.id,
        userId,
        requestId
      });

      sendSuccessResponse(res, 'Default payment method retrieved successfully', defaultPaymentMethod);

    } catch (error) {
      logger.error('Failed to get default payment method', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: this.getUserId(req),
        requestId: req.requestId
      });

      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to get default payment method',
        500
      );
    }
  }
}
