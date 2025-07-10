import { Request, Response } from 'express';
import { logger, createSuccessResponse, createErrorResponse } from '../../shared/utils';
import { PaymentMethodService } from '../services';
import { 
  CreatePaymentMethodRequest,
  AttachPaymentMethodRequest,
  DetachPaymentMethodRequest,
  SetDefaultPaymentMethodRequest,
  PaymentMethodListRequest
} from '../types';

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
  };
  requestId?: string;
}

export class PaymentMethodController {
  private paymentMethodService: PaymentMethodService;

  constructor() {
    this.paymentMethodService = new PaymentMethodService();
  }

  async createPaymentMethod(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const requestId = req.requestId || 'unknown';

      if (!userId) {
        res.status(401).json(createErrorResponse(
          'User authentication required',
          'PAYMENT_METHOD_AUTH_REQUIRED'
        ));
        return;
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

      res.status(201).json(createSuccessResponse(
        'Payment method created successfully',
        paymentMethod
      ));
    } catch (error) {
      logger.error('Failed to create payment method', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('Invalid') ? 400 : 500;
      res.status(statusCode).json(createErrorResponse(
        error instanceof Error ? error.message : 'Failed to create payment method',
        'PAYMENT_METHOD_CREATION_FAILED'
      ));
    }
  }

  async attachPaymentMethod(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const requestId = req.requestId || 'unknown';

      if (!userId) {
        res.status(401).json(createErrorResponse(
          'User authentication required',
          'PAYMENT_METHOD_AUTH_REQUIRED'
        ));
        return;
      }

      const request: AttachPaymentMethodRequest = req.body;
      const attachResult = await this.paymentMethodService.attachPaymentMethod(request, requestId);

      logger.info('Payment method attached successfully', {
        paymentMethodId: request.paymentMethodId,
        customerId: request.customerId,
        userId,
        requestId
      });

      res.status(200).json(createSuccessResponse(
        'Payment method attached successfully',
        attachResult
      ));
    } catch (error) {
      logger.error('Failed to attach payment method', {
        paymentMethodId: req.body.paymentMethodId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
      res.status(statusCode).json(createErrorResponse(
        error instanceof Error ? error.message : 'Failed to attach payment method',
        'PAYMENT_METHOD_ATTACH_FAILED'
      ));
    }
  }

  async detachPaymentMethod(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const requestId = req.requestId || 'unknown';
      const paymentMethodId = req.params.paymentMethodId;

      if (!userId) {
        res.status(401).json(createErrorResponse(
          'User authentication required',
          'PAYMENT_METHOD_AUTH_REQUIRED'
        ));
        return;
      }

      if (!paymentMethodId) {
        res.status(400).json(createErrorResponse(
          'Payment method ID is required',
          'PAYMENT_METHOD_ID_REQUIRED'
        ));
        return;
      }

      const request: DetachPaymentMethodRequest = { paymentMethodId };
      const detachResult = await this.paymentMethodService.detachPaymentMethod(request, requestId);

      logger.info('Payment method detached successfully', {
        paymentMethodId,
        userId,
        requestId
      });

      res.status(200).json(createSuccessResponse(
        'Payment method detached successfully',
        detachResult
      ));
    } catch (error) {
      logger.error('Failed to detach payment method', {
        paymentMethodId: req.params.paymentMethodId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 :
                        error instanceof Error && error.message.includes('Cannot detach') ? 400 : 500;
      res.status(statusCode).json(createErrorResponse(
        error instanceof Error ? error.message : 'Failed to detach payment method',
        'PAYMENT_METHOD_DETACH_FAILED'
      ));
    }
  }

  async setDefaultPaymentMethod(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const requestId = req.requestId || 'unknown';
      const paymentMethodId = parseInt(req.params.paymentMethodId);

      if (!userId) {
        res.status(401).json(createErrorResponse(
          'User authentication required',
          'PAYMENT_METHOD_AUTH_REQUIRED'
        ));
        return;
      }

      if (isNaN(paymentMethodId)) {
        res.status(400).json(createErrorResponse(
          'Invalid payment method ID',
          'INVALID_PAYMENT_METHOD_ID'
        ));
        return;
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

      res.status(200).json(createSuccessResponse(
        'Default payment method set successfully',
        defaultResult
      ));
    } catch (error) {
      logger.error('Failed to set default payment method', {
        paymentMethodId: req.params.paymentMethodId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 :
                        error instanceof Error && error.message.includes('does not belong') ? 403 : 500;
      res.status(statusCode).json(createErrorResponse(
        error instanceof Error ? error.message : 'Failed to set default payment method',
        'SET_DEFAULT_PAYMENT_METHOD_FAILED'
      ));
    }
  }

  async getUserPaymentMethods(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const requestId = req.requestId || 'unknown';

      if (!userId) {
        res.status(401).json(createErrorResponse(
          'User authentication required',
          'PAYMENT_METHOD_AUTH_REQUIRED'
        ));
        return;
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

      res.status(200).json(createSuccessResponse(
        'Payment methods retrieved successfully',
        paymentMethods
      ));
    } catch (error) {
      logger.error('Failed to get user payment methods', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        requestId: req.requestId
      });

      res.status(500).json(createErrorResponse(
        error instanceof Error ? error.message : 'Failed to get payment methods',
        'PAYMENT_METHODS_RETRIEVAL_FAILED'
      ));
    }
  }

  async deletePaymentMethod(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const requestId = req.requestId || 'unknown';
      const paymentMethodId = parseInt(req.params.paymentMethodId);

      if (!userId) {
        res.status(401).json(createErrorResponse(
          'User authentication required',
          'PAYMENT_METHOD_AUTH_REQUIRED'
        ));
        return;
      }

      if (isNaN(paymentMethodId)) {
        res.status(400).json(createErrorResponse(
          'Invalid payment method ID',
          'INVALID_PAYMENT_METHOD_ID'
        ));
        return;
      }

      await this.paymentMethodService.deletePaymentMethod(paymentMethodId, userId, requestId);

      logger.info('Payment method deleted successfully', {
        paymentMethodId,
        userId,
        requestId
      });

      res.status(200).json(createSuccessResponse(
        'Payment method deleted successfully',
        { paymentMethodId, deleted: true }
      ));
    } catch (error) {
      logger.error('Failed to delete payment method', {
        paymentMethodId: req.params.paymentMethodId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 :
                        error instanceof Error && error.message.includes('Cannot delete') ? 400 :
                        error instanceof Error && error.message.includes('does not belong') ? 403 : 500;
      res.status(statusCode).json(createErrorResponse(
        error instanceof Error ? error.message : 'Failed to delete payment method',
        'PAYMENT_METHOD_DELETION_FAILED'
      ));
    }
  }

  async getDefaultPaymentMethod(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const requestId = req.requestId || 'unknown';

      if (!userId) {
        res.status(401).json(createErrorResponse(
          'User authentication required',
          'PAYMENT_METHOD_AUTH_REQUIRED'
        ));
        return;
      }

      const defaultPaymentMethod = await this.paymentMethodService.getDefaultPaymentMethod(userId, requestId);

      if (!defaultPaymentMethod) {
        res.status(404).json(createErrorResponse(
          'No default payment method found',
          'DEFAULT_PAYMENT_METHOD_NOT_FOUND'
        ));
        return;
      }

      logger.info('Default payment method retrieved successfully', {
        paymentMethodId: defaultPaymentMethod.id,
        userId,
        requestId
      });

      res.status(200).json(createSuccessResponse(
        'Default payment method retrieved successfully',
        defaultPaymentMethod
      ));
    } catch (error) {
      logger.error('Failed to get default payment method', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        requestId: req.requestId
      });

      res.status(500).json(createErrorResponse(
        error instanceof Error ? error.message : 'Failed to get default payment method',
        'DEFAULT_PAYMENT_METHOD_RETRIEVAL_FAILED'
      ));
    }
  }
}
