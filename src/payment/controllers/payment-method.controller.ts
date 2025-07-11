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

  async createPaymentMethod(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user ? parseInt(req.user.id) : undefined;
      const requestId = req.requestId || 'unknown';

      if (!userId) {
        return sendErrorResponse(res, 'User authentication required', 401, 'PAYMENT_METHOD_AUTH_REQUIRED');
      }

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

      sendSuccessResponse(res, {
        message: 'Payment method created successfully',
        data: paymentMethod
      }, 201);

    } catch (error) {
      logger.error('Failed to create payment method', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user ? parseInt(req.user.id) : undefined,
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('Invalid') ? 400 : 500;
      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to create payment method',
        statusCode,
        'PAYMENT_METHOD_CREATION_FAILED'
      );
    }
  }

  async attachPaymentMethod(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user ? parseInt(req.user.id) : undefined;
      const requestId = req.requestId || 'unknown';

      if (!userId) {
        return sendErrorResponse(res, 'User authentication required', 401, 'PAYMENT_METHOD_AUTH_REQUIRED');
      }

      const request: AttachPaymentMethodRequest = req.body;
      const attachResult = await this.paymentMethodService.attachPaymentMethod(request, requestId);

      logger.info('Payment method attached successfully', {
        paymentMethodId: request.paymentMethodId,
        customerId: request.customerId,
        userId,
        requestId
      });

      sendSuccessResponse(res, {
        message: 'Payment method attached successfully',
        data: attachResult
      });

    } catch (error) {
      logger.error('Failed to attach payment method', {
        paymentMethodId: req.body.paymentMethodId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user ? parseInt(req.user.id) : undefined,
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to attach payment method',
        statusCode,
        'PAYMENT_METHOD_ATTACH_FAILED'
      );
    }
  }

  async detachPaymentMethod(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user ? parseInt(req.user.id) : undefined;
      const requestId = req.requestId || 'unknown';
      const paymentMethodId = req.params.paymentMethodId;

      if (!userId) {
        return sendErrorResponse(res, 'User authentication required', 401, 'PAYMENT_METHOD_AUTH_REQUIRED');
      }

      if (!paymentMethodId) {
        return sendErrorResponse(res, 'Payment method ID is required', 400, 'PAYMENT_METHOD_ID_REQUIRED');
      }

      const request: DetachPaymentMethodRequest = { paymentMethodId };
      const detachResult = await this.paymentMethodService.detachPaymentMethod(request, requestId);

      logger.info('Payment method detached successfully', {
        paymentMethodId,
        userId,
        requestId
      });

      sendSuccessResponse(res, {
        message: 'Payment method detached successfully',
        data: detachResult
      });

    } catch (error) {
      logger.error('Failed to detach payment method', {
        paymentMethodId: req.params.paymentMethodId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user ? parseInt(req.user.id) : undefined,
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 :
                        error instanceof Error && error.message.includes('Cannot detach') ? 400 : 500;
      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to detach payment method',
        statusCode,
        'PAYMENT_METHOD_DETACH_FAILED'
      );
    }
  }

  async setDefaultPaymentMethod(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user ? parseInt(req.user.id) : undefined;
      const requestId = req.requestId || 'unknown';
      const paymentMethodId = parseInt(req.params.paymentMethodId);

      if (!userId) {
        return sendErrorResponse(res, 'User authentication required', 401, 'PAYMENT_METHOD_AUTH_REQUIRED');
      }

      if (isNaN(paymentMethodId)) {
        return sendErrorResponse(res, 'Invalid payment method ID', 400, 'INVALID_PAYMENT_METHOD_ID');
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

      sendSuccessResponse(res, {
        message: 'Default payment method set successfully',
        data: defaultResult
      });

    } catch (error) {
      logger.error('Failed to set default payment method', {
        paymentMethodId: req.params.paymentMethodId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user ? parseInt(req.user.id) : undefined,
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 :
                        error instanceof Error && error.message.includes('does not belong') ? 403 : 500;
      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to set default payment method',
        statusCode,
        'SET_DEFAULT_PAYMENT_METHOD_FAILED'
      );
    }
  }

  async getUserPaymentMethods(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user ? parseInt(req.user.id) : undefined;
      const requestId = req.requestId || 'unknown';

      if (!userId) {
        return sendErrorResponse(res, 'User authentication required', 401, 'PAYMENT_METHOD_AUTH_REQUIRED');
      }

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

      sendSuccessResponse(res, {
        message: 'Payment methods retrieved successfully',
        data: paymentMethods
      });

    } catch (error) {
      logger.error('Failed to get user payment methods', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user ? parseInt(req.user.id) : undefined,
        requestId: req.requestId
      });

      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to get payment methods',
        500,
        'PAYMENT_METHODS_RETRIEVAL_FAILED'
      );
    }
  }

  async deletePaymentMethod(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user ? parseInt(req.user.id) : undefined;
      const requestId = req.requestId || 'unknown';
      const paymentMethodId = parseInt(req.params.paymentMethodId);

      if (!userId) {
        return sendErrorResponse(res, 'User authentication required', 401, 'PAYMENT_METHOD_AUTH_REQUIRED');
      }

      if (isNaN(paymentMethodId)) {
        return sendErrorResponse(res, 'Invalid payment method ID', 400, 'INVALID_PAYMENT_METHOD_ID');
      }

      await this.paymentMethodService.deletePaymentMethod(paymentMethodId, userId, requestId);

      logger.info('Payment method deleted successfully', {
        paymentMethodId,
        userId,
        requestId
      });

      sendSuccessResponse(res, {
        message: 'Payment method deleted successfully',
        data: { paymentMethodId, deleted: true }
      });

    } catch (error) {
      logger.error('Failed to delete payment method', {
        paymentMethodId: req.params.paymentMethodId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user ? parseInt(req.user.id) : undefined,
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 :
                        error instanceof Error && error.message.includes('Cannot delete') ? 400 :
                        error instanceof Error && error.message.includes('does not belong') ? 403 : 500;
      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to delete payment method',
        statusCode,
        'PAYMENT_METHOD_DELETION_FAILED'
      );
    }
  }

  async getDefaultPaymentMethod(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user ? parseInt(req.user.id) : undefined;
      const requestId = req.requestId || 'unknown';

      if (!userId) {
        return sendErrorResponse(res, 'User authentication required', 401, 'PAYMENT_METHOD_AUTH_REQUIRED');
      }

      const defaultPaymentMethod = await this.paymentMethodService.getDefaultPaymentMethod(userId, requestId);

      if (!defaultPaymentMethod) {
        return sendErrorResponse(res, 'No default payment method found', 404, 'DEFAULT_PAYMENT_METHOD_NOT_FOUND');
      }

      logger.info('Default payment method retrieved successfully', {
        paymentMethodId: defaultPaymentMethod.id,
        userId,
        requestId
      });

      sendSuccessResponse(res, {
        message: 'Default payment method retrieved successfully',
        data: defaultPaymentMethod
      });

    } catch (error) {
      logger.error('Failed to get default payment method', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user ? parseInt(req.user.id) : undefined,
        requestId: req.requestId
      });

      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to get default payment method',
        500,
        'DEFAULT_PAYMENT_METHOD_RETRIEVAL_FAILED'
      );
    }
  }
}
