import { Request, Response } from 'express';
import { logger, createSuccessResponse, createErrorResponse } from '../../shared/utils';
import { InvoiceService } from '../services';
import { 
  CreateInvoiceRequest,
  UpdateInvoiceStatusRequest,
  InvoiceListRequest
} from '../types';

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
  };
  requestId?: string;
}

export class InvoiceController {
  private invoiceService: InvoiceService;

  constructor() {
    this.invoiceService = new InvoiceService();
  }

  async createInvoice(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const requestId = req.requestId || 'unknown';

      if (!userId) {
        res.status(401).json(createErrorResponse(
          'User authentication required',
          'INVOICE_AUTH_REQUIRED'
        ));
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

      const invoice = await this.invoiceService.createInvoice(request, requestId);

      logger.info('Invoice created successfully', {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.amount,
        currency: invoice.currency,
        userId,
        requestId
      });

      res.status(201).json(createSuccessResponse(
        'Invoice created successfully',
        invoice
      ));
    } catch (error) {
      logger.error('Failed to create invoice', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('Invalid') ? 400 : 500;
      res.status(statusCode).json(createErrorResponse(
        error instanceof Error ? error.message : 'Failed to create invoice',
        'INVOICE_CREATION_FAILED'
      ));
    }
  }

  async updateInvoiceStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const requestId = req.requestId || 'unknown';
      const invoiceId = parseInt(req.params.invoiceId);

      if (!userId) {
        res.status(401).json(createErrorResponse(
          'User authentication required',
          'INVOICE_AUTH_REQUIRED'
        ));
        return;
      }

      if (isNaN(invoiceId)) {
        res.status(400).json(createErrorResponse(
          'Invalid invoice ID',
          'INVALID_INVOICE_ID'
        ));
        return;
      }

      const request: UpdateInvoiceStatusRequest = {
        invoiceId,
        ...req.body
      };

      const updateResult = await this.invoiceService.updateInvoiceStatus(request, requestId);

      logger.info('Invoice status updated successfully', {
        invoiceId,
        status: request.status,
        userId,
        requestId
      });

      res.status(200).json(createSuccessResponse(
        'Invoice status updated successfully',
        updateResult
      ));
    } catch (error) {
      logger.error('Failed to update invoice status', {
        invoiceId: req.params.invoiceId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
      res.status(statusCode).json(createErrorResponse(
        error instanceof Error ? error.message : 'Failed to update invoice status',
        'INVOICE_STATUS_UPDATE_FAILED'
      ));
    }
  }

  async getInvoice(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const requestId = req.requestId || 'unknown';
      const invoiceId = parseInt(req.params.invoiceId);

      if (!userId) {
        res.status(401).json(createErrorResponse(
          'User authentication required',
          'INVOICE_AUTH_REQUIRED'
        ));
        return;
      }

      if (isNaN(invoiceId)) {
        res.status(400).json(createErrorResponse(
          'Invalid invoice ID',
          'INVALID_INVOICE_ID'
        ));
        return;
      }

      const invoice = await this.invoiceService.getInvoice(invoiceId, requestId);

      logger.info('Invoice retrieved successfully', {
        invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        userId,
        requestId
      });

      res.status(200).json(createSuccessResponse(
        'Invoice retrieved successfully',
        invoice
      ));
    } catch (error) {
      logger.error('Failed to get invoice', {
        invoiceId: req.params.invoiceId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
      res.status(statusCode).json(createErrorResponse(
        error instanceof Error ? error.message : 'Failed to get invoice',
        'INVOICE_RETRIEVAL_FAILED'
      ));
    }
  }

  async getUserInvoices(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const requestId = req.requestId || 'unknown';

      if (!userId) {
        res.status(401).json(createErrorResponse(
          'User authentication required',
          'INVOICE_AUTH_REQUIRED'
        ));
        return;
      }

      const request: InvoiceListRequest = {
        userId,
        status: req.query.status as string,
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0
      };

      const invoices = await this.invoiceService.getUserInvoices(request, requestId);

      logger.info('User invoices retrieved successfully', {
        userId,
        status: request.status,
        count: invoices.invoices.length,
        totalCount: invoices.totalCount,
        requestId
      });

      res.status(200).json(createSuccessResponse(
        'Invoices retrieved successfully',
        invoices
      ));
    } catch (error) {
      logger.error('Failed to get user invoices', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        requestId: req.requestId
      });

      res.status(500).json(createErrorResponse(
        error instanceof Error ? error.message : 'Failed to get invoices',
        'INVOICES_RETRIEVAL_FAILED'
      ));
    }
  }

  async sendInvoice(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const requestId = req.requestId || 'unknown';
      const invoiceId = parseInt(req.params.invoiceId);

      if (!userId) {
        res.status(401).json(createErrorResponse(
          'User authentication required',
          'INVOICE_AUTH_REQUIRED'
        ));
        return;
      }

      if (isNaN(invoiceId)) {
        res.status(400).json(createErrorResponse(
          'Invalid invoice ID',
          'INVALID_INVOICE_ID'
        ));
        return;
      }

      await this.invoiceService.sendInvoice(invoiceId, requestId);

      logger.info('Invoice sent successfully', {
        invoiceId,
        userId,
        requestId
      });

      res.status(200).json(createSuccessResponse(
        'Invoice sent successfully',
        { invoiceId, status: 'sent' }
      ));
    } catch (error) {
      logger.error('Failed to send invoice', {
        invoiceId: req.params.invoiceId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 :
                        error instanceof Error && error.message.includes('Only draft') ? 400 : 500;
      res.status(statusCode).json(createErrorResponse(
        error instanceof Error ? error.message : 'Failed to send invoice',
        'INVOICE_SEND_FAILED'
      ));
    }
  }

  async cancelInvoice(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const requestId = req.requestId || 'unknown';
      const invoiceId = parseInt(req.params.invoiceId);

      if (!userId) {
        res.status(401).json(createErrorResponse(
          'User authentication required',
          'INVOICE_AUTH_REQUIRED'
        ));
        return;
      }

      if (isNaN(invoiceId)) {
        res.status(400).json(createErrorResponse(
          'Invalid invoice ID',
          'INVALID_INVOICE_ID'
        ));
        return;
      }

      await this.invoiceService.cancelInvoice(invoiceId, requestId);

      logger.info('Invoice cancelled successfully', {
        invoiceId,
        userId,
        requestId
      });

      res.status(200).json(createSuccessResponse(
        'Invoice cancelled successfully',
        { invoiceId, status: 'cancelled' }
      ));
    } catch (error) {
      logger.error('Failed to cancel invoice', {
        invoiceId: req.params.invoiceId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 :
                        error instanceof Error && error.message.includes('Cannot cancel') ? 400 : 500;
      res.status(statusCode).json(createErrorResponse(
        error instanceof Error ? error.message : 'Failed to cancel invoice',
        'INVOICE_CANCELLATION_FAILED'
      ));
    }
  }

  async deleteInvoice(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const requestId = req.requestId || 'unknown';
      const invoiceId = parseInt(req.params.invoiceId);

      if (!userId) {
        res.status(401).json(createErrorResponse(
          'User authentication required',
          'INVOICE_AUTH_REQUIRED'
        ));
        return;
      }

      if (isNaN(invoiceId)) {
        res.status(400).json(createErrorResponse(
          'Invalid invoice ID',
          'INVALID_INVOICE_ID'
        ));
        return;
      }

      await this.invoiceService.deleteInvoice(invoiceId, requestId);

      logger.info('Invoice deleted successfully', {
        invoiceId,
        userId,
        requestId
      });

      res.status(200).json(createSuccessResponse(
        'Invoice deleted successfully',
        { invoiceId, deleted: true }
      ));
    } catch (error) {
      logger.error('Failed to delete invoice', {
        invoiceId: req.params.invoiceId,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        requestId: req.requestId
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 :
                        error instanceof Error && error.message.includes('Cannot delete') ? 400 : 500;
      res.status(statusCode).json(createErrorResponse(
        error instanceof Error ? error.message : 'Failed to delete invoice',
        'INVOICE_DELETION_FAILED'
      ));
    }
  }
}
