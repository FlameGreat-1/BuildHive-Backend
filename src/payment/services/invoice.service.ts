import { PAYMENT_CONSTANTS } from '../../config/payment';
import { logger } from '../../shared/utils';
import { InvoiceRepository, PaymentRepository } from '../repositories';
import { getDbConnection } from '../../shared/database';
import { 
  CreateInvoiceRequest,
  CreateInvoiceResponse,
  UpdateInvoiceStatusRequest,
  UpdateInvoiceStatusResponse,
  InvoiceListRequest,
  InvoiceListResponse,
  InvoiceDetailsResponse
} from '../types';
import { 
  validatePaymentAmount,
  validateCurrency,
  sanitizePaymentMetadata,
  calculateProcessingFee,
  generateInvoiceNumber
} from '../utils';
import { StripeService } from './stripe.service';

export class InvoiceService {
  private invoiceRepository: InvoiceRepository;
  private paymentRepository: PaymentRepository;
  private stripeService: StripeService;

  constructor() {
    this.initializeRepositories();
    this.stripeService = new StripeService();
  }

  private async initializeRepositories(): Promise<void> {
    const dbConnection = await getDbConnection();
    this.invoiceRepository = new InvoiceRepository(dbConnection);
    this.paymentRepository = new PaymentRepository(dbConnection);
  }

  async createInvoice(
    request: CreateInvoiceRequest,
    requestId: string
  ): Promise<CreateInvoiceResponse> {
    try {
      if (!validatePaymentAmount(request.amount, request.currency)) {
        throw new Error('Invalid invoice amount');
      }

      if (!validateCurrency(request.currency)) {
        throw new Error('Unsupported currency');
      }

      const invoiceNumber = request.invoiceNumber || generateInvoiceNumber();
      const processingFee = calculateProcessingFee(request.amount, request.currency);
      const totalAmount = request.amount + processingFee;

      const invoiceData = {
        quoteId: request.quoteId,
        userId: request.userId,
        invoiceNumber,
        amount: request.amount,
        currency: request.currency,
        status: request.status || 'draft',
        dueDate: request.dueDate,
        description: request.description,
        processingFee,
        metadata: sanitizePaymentMetadata(request.metadata || {})
      };

      const savedInvoice = await this.invoiceRepository.createInvoice(invoiceData, requestId);

      if (request.status === 'sent' || request.autoSend) {
        const paymentLink = await this.stripeService.createPaymentLink({
          amount: totalAmount,
          currency: request.currency,
          description: `Invoice ${invoiceNumber}`,
          returnUrl: `${process.env.FRONTEND_URL}/invoices/${savedInvoice.id}/success`,
          metadata: {
            invoiceId: savedInvoice.id.toString(),
            invoiceNumber,
            userId: request.userId.toString()
          }
        }, requestId);

        await this.invoiceRepository.updateInvoice(
          savedInvoice.id,
          {
            paymentLink: paymentLink.url,
            stripeInvoiceId: paymentLink.id,
            status: 'sent'
          },
          requestId
        );

        savedInvoice.payment_link = paymentLink.url;
        savedInvoice.stripe_invoice_id = paymentLink.id;
        savedInvoice.status = 'sent';
      }

      logger.info('Invoice created', {
        invoiceId: savedInvoice.id,
        invoiceNumber,
        amount: request.amount,
        currency: request.currency,
        status: savedInvoice.status,
        userId: request.userId,
        requestId
      });

      return {
        id: savedInvoice.id,
        invoiceNumber,
        amount: request.amount,
        currency: request.currency,
        status: savedInvoice.status,
        dueDate: request.dueDate,
        paymentLink: savedInvoice.payment_link,
        processingFee,
        createdAt: savedInvoice.created_at
      };
    } catch (error) {
      logger.error('Failed to create invoice', {
        amount: request.amount,
        currency: request.currency,
        userId: request.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      throw error;
    }
  }

  async updateInvoiceStatus(
    request: UpdateInvoiceStatusRequest,
    requestId: string
  ): Promise<UpdateInvoiceStatusResponse> {
    try {
      const invoice = await this.invoiceRepository.getInvoiceById(request.invoiceId, requestId);

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      const updateData: any = {
        status: request.status
      };

      if (request.status === 'paid' && request.paidAt) {
        updateData.paidAt = request.paidAt;
      }

      await this.invoiceRepository.updateInvoice(request.invoiceId, updateData, requestId);

      logger.info('Invoice status updated', {
        invoiceId: request.invoiceId,
        oldStatus: invoice.status,
        newStatus: request.status,
        requestId
      });

      return {
        invoiceId: request.invoiceId,
        status: request.status,
        updatedAt: new Date()
      };
    } catch (error) {
      logger.error('Failed to update invoice status', {
        invoiceId: request.invoiceId,
        status: request.status,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      throw error;
    }
  }
  
    async getInvoice(invoiceId: number, requestId: string): Promise<InvoiceDetailsResponse> {
    try {
      const invoice = await this.invoiceRepository.getInvoiceById(invoiceId, requestId);

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      logger.info('Invoice retrieved', {
        invoiceId,
        invoiceNumber: invoice.invoice_number,
        status: invoice.status,
        requestId
      });

      return {
        id: invoice.id,
        quoteId: invoice.quote_id,
        userId: invoice.user_id,
        invoiceNumber: invoice.invoice_number,
        amount: invoice.amount,
        currency: invoice.currency,
        status: invoice.status,
        dueDate: invoice.due_date,
        paidAt: invoice.paid_at,
        paymentLink: invoice.payment_link,
        stripeInvoiceId: invoice.stripe_invoice_id,
        description: invoice.description,
        processingFee: invoice.processing_fee,
        metadata: invoice.metadata,
        createdAt: invoice.created_at,
        updatedAt: invoice.updated_at
      };
    } catch (error) {
      logger.error('Failed to get invoice', {
        invoiceId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      throw error;
    }
  }

  async getUserInvoices(
    request: InvoiceListRequest,
    requestId: string
  ): Promise<InvoiceListResponse> {
    try {
      const invoices = await this.invoiceRepository.getUserInvoices(
        request.userId,
        request.status,
        request.limit,
        request.offset,
        requestId
      );

      const totalCount = await this.invoiceRepository.getUserInvoicesCount(
        request.userId,
        request.status,
        requestId
      );

      logger.info('User invoices retrieved', {
        userId: request.userId,
        status: request.status,
        count: invoices.length,
        totalCount,
        requestId
      });

      return {
        invoices: invoices.map(invoice => ({
          id: invoice.id,
          invoiceNumber: invoice.invoice_number,
          amount: invoice.amount,
          currency: invoice.currency,
          status: invoice.status,
          dueDate: invoice.due_date,
          paidAt: invoice.paid_at,
          paymentLink: invoice.payment_link,
          description: invoice.description,
          processingFee: invoice.processing_fee,
          createdAt: invoice.created_at,
          updatedAt: invoice.updated_at
        })),
        totalCount,
        hasMore: (request.offset || 0) + invoices.length < totalCount
      };
    } catch (error) {
      logger.error('Failed to get user invoices', {
        userId: request.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      throw error;
    }
  }

  async sendInvoice(invoiceId: number, requestId: string): Promise<void> {
    try {
      const invoice = await this.invoiceRepository.getInvoiceById(invoiceId, requestId);

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (invoice.status !== 'draft') {
        throw new Error('Only draft invoices can be sent');
      }

      if (!invoice.payment_link) {
        const totalAmount = invoice.amount + (invoice.processing_fee || 0);
        
        const paymentLink = await this.stripeService.createPaymentLink({
          amount: totalAmount,
          currency: invoice.currency,
          description: `Invoice ${invoice.invoice_number}`,
          returnUrl: `${process.env.FRONTEND_URL}/invoices/${invoice.id}/success`,
          metadata: {
            invoiceId: invoice.id.toString(),
            invoiceNumber: invoice.invoice_number,
            userId: invoice.user_id.toString()
          }
        }, requestId);

        await this.invoiceRepository.updateInvoice(
          invoiceId,
          {
            paymentLink: paymentLink.url,
            stripeInvoiceId: paymentLink.id,
            status: 'sent'
          },
          requestId
        );
      } else {
        await this.invoiceRepository.updateInvoice(
          invoiceId,
          { status: 'sent' },
          requestId
        );
      }

      logger.info('Invoice sent', {
        invoiceId,
        invoiceNumber: invoice.invoice_number,
        requestId
      });
    } catch (error) {
      logger.error('Failed to send invoice', {
        invoiceId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      throw error;
    }
  }

  async cancelInvoice(invoiceId: number, requestId: string): Promise<void> {
    try {
      const invoice = await this.invoiceRepository.getInvoiceById(invoiceId, requestId);

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (invoice.status === 'paid') {
        throw new Error('Cannot cancel paid invoice');
      }

      if (invoice.status === 'cancelled') {
        throw new Error('Invoice already cancelled');
      }

      await this.invoiceRepository.updateInvoice(
        invoiceId,
        { status: 'cancelled' },
        requestId
      );

      logger.info('Invoice cancelled', {
        invoiceId,
        invoiceNumber: invoice.invoice_number,
        previousStatus: invoice.status,
        requestId
      });
    } catch (error) {
      logger.error('Failed to cancel invoice', {
        invoiceId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      throw error;
    }
  }

  async deleteInvoice(invoiceId: number, requestId: string): Promise<void> {
    try {
      const invoice = await this.invoiceRepository.getInvoiceById(invoiceId, requestId);

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (invoice.status === 'paid') {
        throw new Error('Cannot delete paid invoice');
      }

      const hasPayments = await this.paymentRepository.hasPaymentsForInvoice(invoiceId, requestId);

      if (hasPayments) {
        throw new Error('Cannot delete invoice with associated payments');
      }

      await this.invoiceRepository.deleteInvoice(invoiceId, requestId);

      logger.info('Invoice deleted', {
        invoiceId,
        invoiceNumber: invoice.invoice_number,
        requestId
      });
    } catch (error) {
      logger.error('Failed to delete invoice', {
        invoiceId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      throw error;
    }
  }

  async markInvoiceOverdue(requestId: string): Promise<void> {
    try {
      const overdueInvoices = await this.invoiceRepository.getOverdueInvoices(requestId);

      for (const invoice of overdueInvoices) {
        await this.invoiceRepository.updateInvoice(
          invoice.id,
          { status: 'overdue' },
          requestId
        );

        logger.info('Invoice marked as overdue', {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoice_number,
          dueDate: invoice.due_date,
          requestId
        });
      }

      logger.info('Overdue invoices processed', {
        count: overdueInvoices.length,
        requestId
      });
    } catch (error) {
      logger.error('Failed to mark invoices as overdue', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      throw error;
    }
  }
}

