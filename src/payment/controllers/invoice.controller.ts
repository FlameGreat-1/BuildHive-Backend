import { Request, Response } from 'express';
import { logger, sendSuccessResponse, sendErrorResponse } from '../../shared/utils';
import { InvoiceService } from '../services';
import { AuthenticatedRequest } from '../../auth/middleware/auth.middleware';
import { 
  CreateInvoiceRequest,
  UpdateInvoiceStatusRequest,
  InvoiceListRequest
} from '../types';

export class InvoiceController {
  private invoiceService: InvoiceService;

  constructor() {
    this.invoiceService = new InvoiceService();
  }

  async createInvoice(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user ? parseInt(req.user.id) : undefined;
      const requestId = req.requestId || 'unknown';

      if (!userId) {
        sendErrorResponse(res, 'User authentication required', 401);
        return;
      }

      const request: CreateInvoiceRequest = {
        ...req.body,
        userId,
        metadata: {
          ...req.body.metadata,
          userId: userId.toString()
        }
      };

      const invoice = await this.invoiceService.createInvoice(request);

      logger.info('Invoice created successfully', {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.amount,
        currency: invoice.currency,
        userId,
        requestId
      });
      
      sendSuccessResponse(res, 'Invoice created successfully', invoice, 201);

    } catch (error) {
      logger.error('Failed to create invoice', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user ? parseInt(req.user.id) : undefined,
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('Invalid') ? 400 : 500;
      sendErrorResponse(res, 
        error instanceof Error ? error.message : 'Failed to create invoice',
        statusCode
      );
    }
  }

  async updateInvoiceStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user ? parseInt(req.user.id) : undefined;
      const requestId = req.requestId || 'unknown';
      const invoiceId = parseInt(req.params.invoiceId);

      if (!userId) {
        sendErrorResponse(res, 'User authentication required', 401);
        return;
      }

      if (isNaN(invoiceId)) {
        sendErrorResponse(res, 'Invalid invoice ID', 400);
        return;
      }

      const request: UpdateInvoiceStatusRequest = {
        invoiceId,
        ...req.body
      };

      const updateResult = await this.invoiceService.updateInvoiceStatus(request);

      logger.info('Invoice status updated successfully', {
        invoiceId,
        status: request.status,
        userId,
        requestId
      });

      sendSuccessResponse(res, 'Invoice status updated successfully', updateResult);

    } catch (error) {
      logger.error('Failed to update invoice status', {
        invoiceId: req.params.invoiceId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user ? parseInt(req.user.id) : undefined,
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to update invoice status',
        statusCode
      );
    }
  }

  async getInvoice(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user ? parseInt(req.user.id) : undefined;
      const requestId = req.requestId || 'unknown';
      const invoiceId = parseInt(req.params.invoiceId);

      if (!userId) {
        sendErrorResponse(res, 'User authentication required', 401);
        return;
      }

      if (isNaN(invoiceId)) {
        sendErrorResponse(res, 'Invalid invoice ID', 400);
        return;
      }

      const invoice = await this.invoiceService.getInvoice(invoiceId);

      logger.info('Invoice retrieved successfully', {
        invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        userId,
        requestId
      });

      sendSuccessResponse(res, 'Invoice retrieved successfully', invoice);

    } catch (error) {
      logger.error('Failed to get invoice', {
        invoiceId: req.params.invoiceId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user ? parseInt(req.user.id) : undefined,
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to get invoice',
        statusCode
      );
    }
  }

  async getUserInvoices(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user ? parseInt(req.user.id) : undefined;
      const requestId = req.requestId || 'unknown';

      if (!userId) {
        sendErrorResponse(res, 'User authentication required', 401);
        return;
      }

      const request: InvoiceListRequest = {
        userId,
        status: req.query.status as string,
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0
      };

      const invoices = await this.invoiceService.getUserInvoices(request);

      logger.info('User invoices retrieved successfully', {
        userId,
        status: request.status,
        count: invoices.invoices.length,
        totalCount: invoices.totalCount,
        requestId
      });

      sendSuccessResponse(res, 'Invoices retrieved successfully', invoices);

    } catch (error) {
      logger.error('Failed to get user invoices', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user ? parseInt(req.user.id) : undefined,
        requestId: req.requestId
      });

      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to get invoices',
        500
      );
    }
  }

  async sendInvoice(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user ? parseInt(req.user.id) : undefined;
      const requestId = req.requestId || 'unknown';
      const invoiceId = parseInt(req.params.invoiceId);

      if (!userId) {
        sendErrorResponse(res, 'User authentication required', 401);
        return;
      }

      if (isNaN(invoiceId)) {
        sendErrorResponse(res, 'Invalid invoice ID', 400);
        return;
      }

      await this.invoiceService.sendInvoice(invoiceId);

      logger.info('Invoice sent successfully', {
        invoiceId,
        userId,
        requestId
      });

      sendSuccessResponse(res, 'Invoice sent successfully', { invoiceId, status: 'sent' });

    } catch (error) {
      logger.error('Failed to send invoice', {
        invoiceId: req.params.invoiceId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user ? parseInt(req.user.id) : undefined,
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 :
                        error instanceof Error && error.message.includes('Only draft') ? 400 : 500;
      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to send invoice',
        statusCode
      );
    }
  }

  async cancelInvoice(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user ? parseInt(req.user.id) : undefined;
      const requestId = req.requestId || 'unknown';
      const invoiceId = parseInt(req.params.invoiceId);

      if (!userId) {
        sendErrorResponse(res, 'User authentication required', 401);
        return;
      }

      if (isNaN(invoiceId)) {
        sendErrorResponse(res, 'Invalid invoice ID', 400);
        return;
      }

      await this.invoiceService.cancelInvoice(invoiceId);

      logger.info('Invoice cancelled successfully', {
        invoiceId,
        userId,
        requestId
      });

      sendSuccessResponse(res, 'Invoice cancelled successfully', { invoiceId, status: 'cancelled' });

    } catch (error) {
      logger.error('Failed to cancel invoice', {
        invoiceId: req.params.invoiceId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user ? parseInt(req.user.id) : undefined,
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 :
                        error instanceof Error && error.message.includes('Cannot cancel') ? 400 : 500;
      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to cancel invoice',
        statusCode
      );
    }
  }

  async deleteInvoice(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user ? parseInt(req.user.id) : undefined;
      const requestId = req.requestId || 'unknown';
      const invoiceId = parseInt(req.params.invoiceId);

      if (!userId) {
        sendErrorResponse(res, 'User authentication required', 401);
        return;
      }

      if (isNaN(invoiceId)) {
        sendErrorResponse(res, 'Invalid invoice ID', 400);
        return;
      }

      await this.invoiceService.deleteInvoice(invoiceId);

      logger.info('Invoice deleted successfully', {
        invoiceId,
        userId,
        requestId
      });

      sendSuccessResponse(res, 'Invoice deleted successfully', { invoiceId, deleted: true });

    } catch (error) {
      logger.error('Failed to delete invoice', {
        invoiceId: req.params.invoiceId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user ? parseInt(req.user.id) : undefined,
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 :
                        error instanceof Error && error.message.includes('Cannot delete') ? 400 : 500;
      sendErrorResponse(res,
        error instanceof Error ? error.message : 'Failed to delete invoice',
        statusCode
      );
    }
  }
}
