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
import { InvoiceDatabaseRecord, InvoiceStatus } from '../../shared/types';

export class InvoiceService {
  private invoiceRepository!: InvoiceRepository;
  private paymentRepository!: PaymentRepository;
  private stripeService: StripeService;

  constructor() {
    this.stripeService = new StripeService();
    this.initializeRepositories();
  }

  private async initializeRepositories(): Promise<void> {
    const dbConnection = getDbConnection();
    this.invoiceRepository = new InvoiceRepository(dbConnection);
    this.paymentRepository = new PaymentRepository(dbConnection);
  }

  async createInvoice(request: CreateInvoiceRequest): Promise<CreateInvoiceResponse> {
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

      const invoiceData: Omit<InvoiceDatabaseRecord, 'id' | 'created_at' | 'updated_at'> = {
        quote_id: request.quoteId || undefined,
        user_id: request.userId || 1,
        invoice_number: invoiceNumber,
        amount: request.amount,
        currency: request.currency,
        status: (request.status as InvoiceStatus) || InvoiceStatus.DRAFT,
        due_date: request.dueDate ? new Date(request.dueDate) : new Date(),
        description: request.description || undefined,
        processing_fee: processingFee,
        metadata: sanitizePaymentMetadata(request.metadata || {}),
        payment_link: undefined,
        paid_at: undefined
      };

      const savedInvoice = await this.invoiceRepository.create(invoiceData);

      if (request.status === InvoiceStatus.SENT || request.autoSend) {
        const paymentLink = await this.stripeService.createPaymentLink({
          amount: totalAmount,
          currency: request.currency,
          description: `Invoice ${invoiceNumber}`,
          returnUrl: `${process.env.FRONTEND_URL}/invoices/${savedInvoice.id}/success`,
          metadata: {
            invoiceId: savedInvoice.id.toString(),
            invoiceNumber,
            userId: (request.userId || 1).toString()
          }
        });

        await this.invoiceRepository.update(
          savedInvoice.id,
          {
            payment_link: paymentLink.url,
            status: InvoiceStatus.SENT
          }
        );

        savedInvoice.payment_link = paymentLink.url;
        savedInvoice.status = InvoiceStatus.SENT;
      }

      logger.info('Invoice created', {
        invoiceId: savedInvoice.id,
        invoiceNumber,
        amount: request.amount,
        currency: request.currency,
        status: savedInvoice.status,
        userId: request.userId
      });

      return {
        id: savedInvoice.id,
        invoiceNumber,
        amount: request.amount,
        currency: request.currency,
        status: savedInvoice.status,
        dueDate: savedInvoice.due_date.toISOString(),
        paymentLink: savedInvoice.payment_link || undefined,
        processingFee,
        createdAt: savedInvoice.created_at.toISOString()
      };
    } catch (error) {
      logger.error('Failed to create invoice', {
        amount: request.amount,
        currency: request.currency,
        userId: request.userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async updateInvoiceStatus(request: UpdateInvoiceStatusRequest): Promise<UpdateInvoiceStatusResponse> {
    try {
      const invoice = await this.invoiceRepository.findById(request.invoiceId);

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      const updateData: Partial<Pick<InvoiceDatabaseRecord, 'status' | 'paid_at'>> = {
        status: request.status as InvoiceStatus
      };

      if (request.status === InvoiceStatus.PAID && request.paidAt) {
        updateData.paid_at = new Date(request.paidAt);
      }

      await this.invoiceRepository.update(request.invoiceId, updateData);

      logger.info('Invoice status updated', {
        invoiceId: request.invoiceId,
        oldStatus: invoice.status,
        newStatus: request.status
      });

      return {
        invoiceId: request.invoiceId,
        status: request.status as InvoiceStatus,
        updatedAt: new Date().toISOString(),
        success: true
      };
    } catch (error) {
      logger.error('Failed to update invoice status', {
        invoiceId: request.invoiceId,
        status: request.status,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }
  
  async getInvoice(invoiceId: number): Promise<InvoiceDetailsResponse> {
    try {
      const invoice = await this.invoiceRepository.findById(invoiceId);

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      const payments = await this.paymentRepository.findByInvoiceId(invoiceId);
      const refunds = await this.paymentRepository.getRefundsByInvoiceId(invoiceId);

      logger.info('Invoice retrieved', {
        invoiceId,
        invoiceNumber: invoice.invoice_number,
        status: invoice.status
      });

      return {
        invoiceNumber: invoice.invoice_number,
        status: invoice.status,
        invoice: {
          id: invoice.id,
          invoiceNumber: invoice.invoice_number,
          amount: invoice.amount,
          currency: invoice.currency,
          status: invoice.status,
          dueDate: invoice.due_date.toISOString(),
          description: invoice.description || undefined,
          processingFee: invoice.processing_fee || undefined,
          metadata: invoice.metadata || undefined,
          paymentLink: invoice.payment_link || undefined,
          stripeInvoiceId: invoice.stripe_invoice_id || undefined,
          paidAt: invoice.paid_at?.toISOString(),
          createdAt: invoice.created_at.toISOString(),
          updatedAt: invoice.updated_at.toISOString()
        },
        payments: payments.map(payment => ({
          id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          paymentMethod: payment.payment_method,
          paymentType: payment.payment_type,
          status: payment.status,
          description: payment.description || undefined,
          creditsAwarded: payment.credits_purchased || undefined,
          stripeFee: payment.stripe_fee || undefined,
          platformFee: payment.platform_fee || undefined,
          netAmount: payment.net_amount || undefined,
          processedAt: payment.processed_at?.toISOString(),
          createdAt: payment.created_at.toISOString()
        })),
        refunds: refunds.map(refund => ({
          id: refund.id,
          paymentId: refund.payment_id,
          amount: refund.amount,
          status: refund.status,
          reason: refund.reason || undefined,
          description: refund.description || undefined,
          stripeRefundId: refund.stripe_refund_id || undefined,
          processedAt: refund.processed_at?.toISOString(),
          metadata: refund.metadata || undefined,
          createdAt: refund.created_at.toISOString()
        }))
      };
    } catch (error) {
      logger.error('Failed to get invoice', {
        invoiceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async getUserInvoices(request: InvoiceListRequest): Promise<InvoiceListResponse> {
    try {
      const invoices = await this.invoiceRepository.findByUserId(
        request.userId,
        request.limit || 50,
        request.offset || 0
      );

      const filteredInvoices = request.status 
        ? invoices.filter(invoice => invoice.status === request.status)
        : invoices;

      const totalCount = await this.invoiceRepository.countByUserId(request.userId);

      logger.info('User invoices retrieved', {
        userId: request.userId,
        status: request.status,
        count: filteredInvoices.length,
        totalCount
      });

      return {
        invoices: filteredInvoices.map(invoice => ({
          id: invoice.id,
          invoiceNumber: invoice.invoice_number,
          amount: invoice.amount,
          currency: invoice.currency,
          status: invoice.status,
          dueDate: invoice.due_date.toISOString(),
          description: invoice.description || undefined,
          processingFee: invoice.processing_fee || undefined,
          metadata: invoice.metadata || undefined,
          paymentLink: invoice.payment_link || undefined,
          stripeInvoiceId: invoice.stripe_invoice_id || undefined,
          paidAt: invoice.paid_at?.toISOString(),
          createdAt: invoice.created_at.toISOString(),
          updatedAt: invoice.updated_at.toISOString()
        })),
        totalCount,
        total: totalCount,
        page: Math.floor((request.offset || 0) / (request.limit || 50)) + 1,
        limit: request.limit || 50
      };
    } catch (error) {
      logger.error('Failed to get user invoices', {
        userId: request.userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async sendInvoice(invoiceId: number): Promise<void> {
    try {
      const invoice = await this.invoiceRepository.findById(invoiceId);

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (invoice.status !== InvoiceStatus.DRAFT) {
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
        });

        await this.invoiceRepository.update(
          invoiceId,
          {
            payment_link: paymentLink.url,
            status: InvoiceStatus.SENT
          }
        );
      } else {
        await this.invoiceRepository.update(
          invoiceId,
          { status: InvoiceStatus.SENT }
        );
      }

      logger.info('Invoice sent', {
        invoiceId,
        invoiceNumber: invoice.invoice_number
      });
    } catch (error) {
      logger.error('Failed to send invoice', {
        invoiceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async cancelInvoice(invoiceId: number): Promise<void> {
    try {
      const invoice = await this.invoiceRepository.findById(invoiceId);

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (invoice.status === InvoiceStatus.PAID) {
        throw new Error('Cannot cancel paid invoice');
      }

      if (invoice.status === InvoiceStatus.CANCELLED) {
        throw new Error('Invoice already cancelled');
      }

      await this.invoiceRepository.update(
        invoiceId,
        { status: InvoiceStatus.CANCELLED }
      );

      logger.info('Invoice cancelled', {
        invoiceId,
        invoiceNumber: invoice.invoice_number,
        previousStatus: invoice.status
      });
    } catch (error) {
      logger.error('Failed to cancel invoice', {
        invoiceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async deleteInvoice(invoiceId: number): Promise<void> {
    try {
      const invoice = await this.invoiceRepository.findById(invoiceId);

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      if (invoice.status === InvoiceStatus.PAID) {
        throw new Error('Cannot delete paid invoice');
      }

      const hasPayments = await this.paymentRepository.hasPaymentsForInvoice(invoiceId);

      if (hasPayments) {
        throw new Error('Cannot delete invoice with associated payments');
      }

      await this.invoiceRepository.delete(invoiceId);

      logger.info('Invoice deleted', {
        invoiceId,
        invoiceNumber: invoice.invoice_number
      });
    } catch (error) {
      logger.error('Failed to delete invoice', {
        invoiceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async markInvoiceOverdue(): Promise<void> {
    try {
      const overdueInvoices = await this.invoiceRepository.findOverdueInvoices();

      for (const invoice of overdueInvoices) {
        await this.invoiceRepository.updateStatus(
          invoice.id,
          InvoiceStatus.OVERDUE
        );

        logger.info('Invoice marked as overdue', {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoice_number,
          dueDate: invoice.due_date
        });
      }

      logger.info('Overdue invoices processed', {
        count: overdueInvoices.length
      });
    } catch (error) {
      logger.error('Failed to mark invoices as overdue', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }
}
