import { 
  QuoteService,
  QuoteData,
  QuoteWithRelations,
  QuoteCreateData,
  QuoteUpdateData,
  QuoteFilterOptions,
  QuoteListResult,
  QuoteStatusUpdateData,
  QuoteDeliveryData,
  QuoteDeliveryResult,
  QuoteCalculation,
  QuoteAnalytics
} from '../types';
import { QuoteRepositoryImpl } from '../repositories';
import { AIPricingServiceImpl } from './ai-pricing.service';
import { JobService } from '../../jobs/services';
import { UserService } from '../../auth/services';
import { PaymentService, InvoiceService, RefundService } from '../../payment/services';
import { 
  CreatePaymentIntentRequest,
  ConfirmPaymentRequest
} from '../../payment/types';
import { 
  calculateQuoteTotal, 
  generateQuoteNumber, 
  validateQuoteStatusTransition,
  isQuoteExpired,
  isQuoteEditable,
  isQuoteCancellable,
  parseQuoteFilters
} from '../utils';
import { QUOTE_EVENTS } from '../../config/quotes';
import { logger } from '../../shared/utils';
import { AppError } from '../../shared/utils';
import { HTTP_STATUS_CODES } from '../../config/auth';
import { QuoteStatus, PaymentMethod, PaymentType, PaymentStatus, RefundStatus } from '../../shared/types/database.types';

export class QuoteServiceImpl implements QuoteService {
  private quoteRepository: QuoteRepositoryImpl;
  private aiPricingService: AIPricingServiceImpl;
  private jobService: JobService;
  private userService: UserService;
  private paymentService: PaymentService;
  private invoiceService: InvoiceService;
  private refundService: RefundService;

  constructor(
    jobService: JobService,
    userService: UserService
  ) {
    this.quoteRepository = new QuoteRepositoryImpl();
    this.aiPricingService = new AIPricingServiceImpl();
    this.jobService = jobService;
    this.userService = userService;
    this.paymentService = new PaymentService();
    this.invoiceService = new InvoiceService();
    this.refundService = new RefundService();
  }

  async createQuote(tradieId: number, data: QuoteCreateData): Promise<QuoteData> {
    try {
      await this.validateTradieExists(tradieId);
      
      if (data.clientId) {
        await this.validateClientExists(data.clientId);
      }

      if (data.jobId) {
        await this.validateJobExists(data.jobId);
        await this.validateJobAccess(data.jobId, tradieId);
      }

      const quote = await this.quoteRepository.create(tradieId, data);

      logger.info('Quote created successfully', {
        quoteId: quote.id,
        quoteNumber: quote.quoteNumber,
        tradieId,
        clientId: data.clientId,
        jobId: data.jobId,
        totalAmount: quote.totalAmount
      });

      await this.publishQuoteEvent(QUOTE_EVENTS.QUOTE_CREATED, quote);

      return quote;

    } catch (error) {
      logger.error('Failed to create quote', {
        tradieId,
        clientId: data.clientId,
        jobId: data.jobId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        'Failed to create quote',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'QUOTE_CREATION_ERROR'
      );
    }
  }

  async getQuote(id: number, userId: number, userRole: string): Promise<QuoteWithRelations> {
    try {
      const quote = await this.quoteRepository.findById(id);

      if (!quote) {
        throw new AppError(
          'Quote not found',
          HTTP_STATUS_CODES.NOT_FOUND,
          'QUOTE_NOT_FOUND'
        );
      }

      await this.validateQuoteAccess(quote, userId, userRole);

      return quote;

    } catch (error) {
      logger.error('Failed to get quote', {
        quoteId: id,
        userId,
        userRole,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        'Failed to retrieve quote',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'QUOTE_RETRIEVAL_ERROR'
      );
    }
  }

  async getQuoteByNumber(quoteNumber: string): Promise<QuoteWithRelations> {
    try {
      const quote = await this.quoteRepository.findByNumber(quoteNumber);

      if (!quote) {
        throw new AppError(
          'Quote not found',
          HTTP_STATUS_CODES.NOT_FOUND,
          'QUOTE_NOT_FOUND'
        );
      }

      return quote;

    } catch (error) {
      logger.error('Failed to get quote by number', {
        quoteNumber,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        'Failed to retrieve quote',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'QUOTE_RETRIEVAL_ERROR'
      );
    }
  }

  async getQuotes(tradieId: number, filters: QuoteFilterOptions): Promise<QuoteListResult> {
    try {
      await this.validateTradieExists(tradieId);
      
      const parsedFilters = parseQuoteFilters(filters);
      const result = await this.quoteRepository.findByTradie(tradieId, parsedFilters);

      logger.info('Quotes retrieved successfully', {
        tradieId,
        totalQuotes: result.quotes.length,
        filters: parsedFilters
      });

      return result;

    } catch (error) {
      logger.error('Failed to get quotes', {
        tradieId,
        filters,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        'Failed to retrieve quotes',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'QUOTE_RETRIEVAL_ERROR'
      );
    }
  }

  async updateQuote(id: number, tradieId: number, data: QuoteUpdateData): Promise<QuoteData> {
    try {
      const existingQuote = await this.quoteRepository.findById(id);

      if (!existingQuote) {
        throw new AppError(
          'Quote not found',
          HTTP_STATUS_CODES.NOT_FOUND,
          'QUOTE_NOT_FOUND'
        );
      }

      if (existingQuote.tradieId !== tradieId) {
        throw new AppError(
          'Unauthorized to update this quote',
          HTTP_STATUS_CODES.FORBIDDEN,
          'UNAUTHORIZED_QUOTE_ACCESS'
        );
      }

      if (!isQuoteEditable(existingQuote.status)) {
        throw new AppError(
          'Quote cannot be edited in current status',
          HTTP_STATUS_CODES.BAD_REQUEST,
          'INVALID_QUOTE_STATUS'
        );
      }

      if (isQuoteExpired(existingQuote.validUntil)) {
        throw new AppError(
          'Cannot update expired quote',
          HTTP_STATUS_CODES.BAD_REQUEST,
          'QUOTE_EXPIRED'
        );
      }

      const updatedQuote = await this.quoteRepository.update(id, tradieId, data);

      logger.info('Quote updated successfully', {
        quoteId: id,
        tradieId,
        updatedFields: Object.keys(data)
      });

      await this.publishQuoteEvent(QUOTE_EVENTS.QUOTE_UPDATED, updatedQuote);

      return updatedQuote;

    } catch (error) {
      logger.error('Failed to update quote', {
        quoteId: id,
        tradieId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        'Failed to update quote',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'QUOTE_UPDATE_ERROR'
      );
    }
  }
  
  async updateQuoteStatus(id: number, tradieId: number, data: QuoteStatusUpdateData): Promise<QuoteData> {
    try {
      const existingQuote = await this.quoteRepository.findById(id);

      if (!existingQuote) {
        throw new AppError(
          'Quote not found',
          HTTP_STATUS_CODES.NOT_FOUND,
          'QUOTE_NOT_FOUND'
        );
      }

      if (existingQuote.tradieId !== tradieId) {
        throw new AppError(
          'Unauthorized to update this quote',
          HTTP_STATUS_CODES.FORBIDDEN,
          'UNAUTHORIZED_QUOTE_ACCESS'
        );
      }

      if (!validateQuoteStatusTransition(existingQuote.status, data.status)) {
        throw new AppError(
          `Invalid status transition from ${existingQuote.status} to ${data.status}`,
          HTTP_STATUS_CODES.BAD_REQUEST,
          'INVALID_QUOTE_STATUS'
        );
      }

      const updatedQuote = await this.quoteRepository.updateStatus(id, tradieId, data);

      logger.info('Quote status updated successfully', {
        quoteId: id,
        tradieId,
        oldStatus: existingQuote.status,
        newStatus: data.status,
        reason: data.reason
      });

      await this.publishQuoteStatusEvent(data.status, updatedQuote);

      return updatedQuote;

    } catch (error) {
      logger.error('Failed to update quote status', {
        quoteId: id,
        tradieId,
        status: data.status,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        'Failed to update quote status',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'QUOTE_STATUS_UPDATE_ERROR'
      );
    }
  }

  async deleteQuote(id: number, tradieId: number): Promise<void> {
    try {
      const existingQuote = await this.quoteRepository.findById(id);

      if (!existingQuote) {
        throw new AppError(
          'Quote not found',
          HTTP_STATUS_CODES.NOT_FOUND,
          'QUOTE_NOT_FOUND'
        );
      }

      if (existingQuote.tradieId !== tradieId) {
        throw new AppError(
          'Unauthorized to delete this quote',
          HTTP_STATUS_CODES.FORBIDDEN,
          'UNAUTHORIZED_QUOTE_ACCESS'
        );
      }

      if (!isQuoteCancellable(existingQuote.status)) {
        throw new AppError(
          'Quote cannot be deleted in current status',
          HTTP_STATUS_CODES.BAD_REQUEST,
          'INVALID_QUOTE_STATUS'
        );
      }

      await this.quoteRepository.delete(id, tradieId);

      logger.info('Quote deleted successfully', {
        quoteId: id,
        tradieId,
        quoteNumber: existingQuote.quoteNumber
      });

    } catch (error) {
      logger.error('Failed to delete quote', {
        quoteId: id,
        tradieId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        'Failed to delete quote',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'QUOTE_DELETE_ERROR'
      );
    }
  }
  
  async sendQuote(id: number, tradieId: number, deliveryData: QuoteDeliveryData): Promise<QuoteDeliveryResult> {
    try {
      const quote = await this.quoteRepository.findById(id);

      if (!quote) {
        throw new AppError(
          'Quote not found',
          HTTP_STATUS_CODES.NOT_FOUND,
          'QUOTE_NOT_FOUND'
        );
      }

      if (quote.tradieId !== tradieId) {
        throw new AppError(
          'Unauthorized to send this quote',
          HTTP_STATUS_CODES.FORBIDDEN,
          'UNAUTHORIZED_QUOTE_ACCESS'
        );
      }

      if (quote.status !== QuoteStatus.DRAFT) {
        throw new AppError(
          'Only draft quotes can be sent',
          HTTP_STATUS_CODES.BAD_REQUEST,
          'INVALID_QUOTE_STATUS'
        );
      }

      if (isQuoteExpired(quote.validUntil)) {
        throw new AppError(
          'Cannot send expired quote',
          HTTP_STATUS_CODES.BAD_REQUEST,
          'QUOTE_EXPIRED'
        );
      }

      await this.quoteRepository.updateStatus(id, tradieId, { status: QuoteStatus.SENT });

      const deliveryResult = await this.processQuoteDelivery(quote, deliveryData);

      logger.info('Quote sent successfully', {
        quoteId: id,
        tradieId,
        deliveryMethods: deliveryData.deliveryMethods,
        deliverySuccess: deliveryResult.success
      });

      await this.publishQuoteEvent(QUOTE_EVENTS.QUOTE_SENT, quote);

      return deliveryResult;

    } catch (error) {
      logger.error('Failed to send quote', {
        quoteId: id,
        tradieId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        'Failed to send quote',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'QUOTE_DELIVERY_ERROR'
      );
    }
  }
  
    async viewQuote(quoteNumber: string): Promise<QuoteWithRelations> {
    try {
      const quote = await this.quoteRepository.findByNumber(quoteNumber);

      if (!quote) {
        throw new AppError(
          'Quote not found',
          HTTP_STATUS_CODES.NOT_FOUND,
          'QUOTE_NOT_FOUND'
        );
      }

      if (quote.status === QuoteStatus.SENT) {
        await this.quoteRepository.updateStatus(quote.id, quote.tradieId, { 
          status: QuoteStatus.VIEWED 
        });
        quote.status = QuoteStatus.VIEWED;
        quote.viewedAt = new Date();

        await this.publishQuoteEvent(QUOTE_EVENTS.QUOTE_VIEWED, quote);
      }

      logger.info('Quote viewed', {
        quoteId: quote.id,
        quoteNumber,
        status: quote.status
      });

      return quote;

    } catch (error) {
      logger.error('Failed to view quote', {
        quoteNumber,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        'Failed to view quote',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'QUOTE_RETRIEVAL_ERROR'
      );
    }
  }

  async acceptQuote(quoteNumber: string, clientId: number): Promise<QuoteData> {
    try {
      const quote = await this.quoteRepository.findByNumber(quoteNumber);

      if (!quote) {
        throw new AppError(
          'Quote not found',
          HTTP_STATUS_CODES.NOT_FOUND,
          'QUOTE_NOT_FOUND'
        );
      }

      if (quote.clientId !== clientId) {
        throw new AppError(
          'Unauthorized to accept this quote',
          HTTP_STATUS_CODES.FORBIDDEN,
          'UNAUTHORIZED_QUOTE_ACCESS'
        );
      }

      if (![QuoteStatus.SENT, QuoteStatus.VIEWED].includes(quote.status)) {
        throw new AppError(
          'Quote cannot be accepted in current status',
          HTTP_STATUS_CODES.BAD_REQUEST,
          'INVALID_QUOTE_STATUS'
        );
      }

      if (isQuoteExpired(quote.validUntil)) {
        throw new AppError(
          'Quote has expired',
          HTTP_STATUS_CODES.BAD_REQUEST,
          'QUOTE_EXPIRED'
        );
      }

      const acceptedQuote = await this.quoteRepository.updateStatus(quote.id, quote.tradieId, { 
        status: QuoteStatus.ACCEPTED 
      });

      if (quote.jobId) {
        await this.jobService.updateJobStatus(quote.jobId, 'active');
      }

      logger.info('Quote accepted successfully', {
        quoteId: quote.id,
        quoteNumber,
        clientId,
        totalAmount: quote.totalAmount
      });

      await this.publishQuoteEvent(QUOTE_EVENTS.QUOTE_ACCEPTED, acceptedQuote);

      return acceptedQuote;

    } catch (error) {
      logger.error('Failed to accept quote', {
        quoteNumber,
        clientId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        'Failed to accept quote',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'QUOTE_ACCEPTANCE_ERROR'
      );
    }
  }

  async rejectQuote(quoteNumber: string, clientId: number, reason?: string): Promise<QuoteData> {
    try {
      const quote = await this.quoteRepository.findByNumber(quoteNumber);

      if (!quote) {
        throw new AppError(
          'Quote not found',
          HTTP_STATUS_CODES.NOT_FOUND,
          'QUOTE_NOT_FOUND'
        );
      }

      if (quote.clientId !== clientId) {
        throw new AppError(
          'Unauthorized to reject this quote',
          HTTP_STATUS_CODES.FORBIDDEN,
          'UNAUTHORIZED_QUOTE_ACCESS'
        );
      }

      if (![QuoteStatus.SENT, QuoteStatus.VIEWED].includes(quote.status)) {
        throw new AppError(
          'Quote cannot be rejected in current status',
          HTTP_STATUS_CODES.BAD_REQUEST,
          'INVALID_QUOTE_STATUS'
        );
      }

      const rejectedQuote = await this.quoteRepository.updateStatus(quote.id, quote.tradieId, { 
        status: QuoteStatus.REJECTED,
        reason 
      });

      logger.info('Quote rejected', {
        quoteId: quote.id,
        quoteNumber,
        clientId,
        reason
      });

      await this.publishQuoteEvent(QUOTE_EVENTS.QUOTE_REJECTED, rejectedQuote);

      return rejectedQuote;

    } catch (error) {
      logger.error('Failed to reject quote', {
        quoteNumber,
        clientId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        'Failed to reject quote',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'QUOTE_REJECTION_ERROR'
      );
    }
  }

  calculateQuote(items: any[], gstEnabled: boolean): QuoteCalculation {
    try {
      return calculateQuoteTotal(items, gstEnabled);
    } catch (error) {
      logger.error('Failed to calculate quote', {
        itemCount: items.length,
        gstEnabled,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Failed to calculate quote totals',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'QUOTE_CALCULATION_ERROR'
      );
    }
  }

  async generateQuoteNumber(): Promise<string> {
    try {
      return generateQuoteNumber();
    } catch (error) {
      logger.error('Failed to generate quote number', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Failed to generate quote number',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'QUOTE_GENERATION_ERROR'
      );
    }
  }

  async checkExpiry(): Promise<void> {
    try {
      const expiredCount = await this.quoteRepository.expireQuotes();
      
      logger.info('Quote expiry check completed', {
        expiredCount,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Failed to check quote expiry', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Failed to process quote expiry',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'QUOTE_EXPIRY_ERROR'
      );
    }
  }

  async getAnalytics(tradieId: number, startDate: Date, endDate: Date): Promise<QuoteAnalytics> {
    try {
      await this.validateTradieExists(tradieId);
      
      const analytics = await this.quoteRepository.getAnalytics(tradieId, startDate, endDate);

      logger.info('Quote analytics retrieved', {
        tradieId,
        startDate,
        endDate,
        totalQuotes: analytics.totalQuotes
      });

      return analytics;

    } catch (error) {
      logger.error('Failed to get quote analytics', {
        tradieId,
        startDate,
        endDate,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        'Failed to retrieve quote analytics',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'QUOTE_ANALYTICS_ERROR'
      );
    }
  }

  async acceptQuoteWithPayment(quoteNumber: string, clientId: number, paymentMethodId: string, requestId: string = 'unknown'): Promise<any> {
    try {
      const quote = await this.quoteRepository.findByNumber(quoteNumber);

      if (!quote) {
        throw new AppError(
          'Quote not found',
          HTTP_STATUS_CODES.NOT_FOUND,
          'QUOTE_NOT_FOUND'
        );
      }

      if (quote.clientId !== clientId) {
        throw new AppError(
          'Unauthorized to accept this quote',
          HTTP_STATUS_CODES.FORBIDDEN,
          'UNAUTHORIZED_QUOTE_ACCESS'
        );
      }

      if (![QuoteStatus.SENT, QuoteStatus.VIEWED].includes(quote.status)) {
        throw new AppError(
          'Quote cannot be accepted in current status',
          HTTP_STATUS_CODES.BAD_REQUEST,
          'INVALID_QUOTE_STATUS'
        );
      }

      if (isQuoteExpired(quote.validUntil)) {
        throw new AppError(
          'Quote has expired',
          HTTP_STATUS_CODES.BAD_REQUEST,
          'QUOTE_EXPIRED'
        );
      }

      const paymentIntentRequest: CreatePaymentIntentRequest = {
        amount: quote.totalAmount,
        currency: 'AUD',
        paymentMethod: PaymentMethod.CARD,
        paymentType: PaymentType.ONE_TIME,
        description: `Payment for Quote #${quote.quoteNumber}`,
        userId: clientId,
        metadata: {
          quoteId: quote.id.toString(),
          quoteNumber: quote.quoteNumber,
          clientId: clientId.toString(),
          tradieId: quote.tradieId.toString()
        },
        automaticPaymentMethods: true
      };

      const paymentIntent = await this.paymentService.createPaymentIntent(paymentIntentRequest);

      const confirmRequest: ConfirmPaymentRequest = {
        paymentIntentId: paymentIntent.paymentIntentId,
        paymentMethodId: paymentMethodId
      };

      const confirmResult = await this.paymentService.confirmPayment(confirmRequest);

      if (confirmResult.status === PaymentStatus.SUCCEEDED) {
        const acceptedQuote = await this.quoteRepository.updateStatus(quote.id, quote.tradieId, { 
          status: QuoteStatus.ACCEPTED 
        });

        await this.quoteRepository.updatePaymentStatus(quote.id, PaymentStatus.SUCCEEDED, confirmResult.paymentIntentId);

        if (quote.jobId) {
          await this.jobService.updateJobStatus(quote.jobId, 'active');
        }

        logger.info('Quote accepted with payment successfully', {
          quoteId: quote.id,
          quoteNumber,
          clientId,
          paymentIntentId: confirmResult.paymentIntentId,
          amount: quote.totalAmount
        });

        await this.publishQuoteEvent(QUOTE_EVENTS.QUOTE_ACCEPTED, acceptedQuote);

        return {
          quote: acceptedQuote,
          paymentResult: confirmResult
        };
      } else {
        await this.quoteRepository.updatePaymentStatus(quote.id, PaymentStatus.FAILED);

        throw new AppError(
          confirmResult.error?.message || 'Payment failed',
          HTTP_STATUS_CODES.PAYMENT_REQUIRED,
          'PAYMENT_FAILED'
        );
      }

    } catch (error) {
      logger.error('Failed to accept quote with payment', {
        quoteNumber,
        clientId,
        paymentMethodId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        'Failed to accept quote with payment',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'QUOTE_PAYMENT_ERROR'
      );
    }
  }
  
    async createPaymentIntent(quoteNumber: string, clientId: number, requestId: string = 'unknown'): Promise<any> {
    try {
      const quote = await this.quoteRepository.findByNumber(quoteNumber);

      if (!quote) {
        throw new AppError(
          'Quote not found',
          HTTP_STATUS_CODES.NOT_FOUND,
          'QUOTE_NOT_FOUND'
        );
      }

      if (quote.clientId !== clientId) {
        throw new AppError(
          'Unauthorized to create payment for this quote',
          HTTP_STATUS_CODES.FORBIDDEN,
          'UNAUTHORIZED_QUOTE_ACCESS'
        );
      }

      if (![QuoteStatus.SENT, QuoteStatus.VIEWED].includes(quote.status)) {
        throw new AppError(
          'Quote cannot be paid in current status',
          HTTP_STATUS_CODES.BAD_REQUEST,
          'INVALID_QUOTE_STATUS'
        );
      }

      if (isQuoteExpired(quote.validUntil)) {
        throw new AppError(
          'Quote has expired',
          HTTP_STATUS_CODES.BAD_REQUEST,
          'QUOTE_EXPIRED'
        );
      }

      const paymentIntentRequest: CreatePaymentIntentRequest = {
        amount: quote.totalAmount,
        currency: 'AUD',
        paymentMethod: PaymentMethod.CARD,
        paymentType: PaymentType.ONE_TIME,
        description: `Payment for Quote #${quote.quoteNumber}`,
        userId: clientId,
        metadata: {
          quoteId: quote.id.toString(),
          quoteNumber: quote.quoteNumber,
          clientId: quote.clientId.toString(),
          tradieId: quote.tradieId.toString(),
          jobId: quote.jobId?.toString() || ''
        },
        automaticPaymentMethods: true
      };

      const paymentIntent = await this.paymentService.createPaymentIntent(paymentIntentRequest);

      logger.info('Payment intent created for quote', {
        quoteId: quote.id,
        quoteNumber,
        clientId,
        paymentIntentId: paymentIntent.paymentIntentId,
        amount: quote.totalAmount
      });

      return {
        quote,
        paymentIntent
      };

    } catch (error) {
      logger.error('Failed to create payment intent for quote', {
        quoteNumber,
        clientId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        'Failed to create payment intent',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'PAYMENT_INTENT_ERROR'
      );
    }
  }

  async generateQuoteInvoice(quoteId: number, tradieId: number, requestId: string = 'unknown'): Promise<any> {
    try {
      const quote = await this.quoteRepository.findById(quoteId);

      if (!quote) {
        throw new AppError(
          'Quote not found',
          HTTP_STATUS_CODES.NOT_FOUND,
          'QUOTE_NOT_FOUND'
        );
      }

      if (quote.tradieId !== tradieId) {
        throw new AppError(
          'Unauthorized to generate invoice for this quote',
          HTTP_STATUS_CODES.FORBIDDEN,
          'UNAUTHORIZED_QUOTE_ACCESS'
        );
      }

      const invoiceRequest = {
        amount: quote.totalAmount,
        currency: 'AUD',
        description: `Invoice for Quote #${quote.quoteNumber}`,
        items: quote.items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.totalPrice
        })),
        metadata: {
          quoteId: quote.id.toString(),
          quoteNumber: quote.quoteNumber,
          tradieId: tradieId.toString(),
          clientId: quote.clientId.toString(),
          jobId: quote.jobId?.toString() || ''
        }
      };

      const invoiceResult = await this.invoiceService.createInvoice(invoiceRequest);

      await this.quoteRepository.updatePaymentStatus(quote.id, 'invoiced');

      logger.info('Quote invoice generated successfully', {
        quoteId,
        tradieId,
        invoiceId: invoiceResult.id
      });

      return {
        quote,
        invoiceResult
      };

    } catch (error) {
      logger.error('Failed to generate quote invoice', {
        quoteId,
        tradieId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        'Failed to generate invoice',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'INVOICE_GENERATION_ERROR'
      );
    }
  }

  async refundQuotePayment(quoteId: number, tradieId: number, amount: number, reason: string, requestId: string = 'unknown'): Promise<any> {
    try {
      const quote = await this.quoteRepository.findById(quoteId);

      if (!quote) {
        throw new AppError(
          'Quote not found',
          HTTP_STATUS_CODES.NOT_FOUND,
          'QUOTE_NOT_FOUND'
        );
      }

      if (quote.tradieId !== tradieId) {
        throw new AppError(
          'Unauthorized to refund this quote',
          HTTP_STATUS_CODES.FORBIDDEN,
          'UNAUTHORIZED_QUOTE_ACCESS'
        );
      }

      if (!quote.paymentId) {
        throw new AppError(
          'No payment found for this quote',
          HTTP_STATUS_CODES.BAD_REQUEST,
          'NO_PAYMENT_FOUND'
        );
      }

      const refundRequest = {
        paymentId: quote.paymentId,
        amount,
        reason,
        metadata: {
          quoteId: quote.id.toString(),
          quoteNumber: quote.quoteNumber,
          tradieId: tradieId.toString(),
          clientId: quote.clientId.toString()
        }
      };

      const refundResult = await this.refundService.createRefund(refundRequest);

      if (refundResult.status === RefundStatus.SUCCEEDED) {
        await this.quoteRepository.updatePaymentStatus(quote.id, PaymentStatus.REFUNDED);
        
        logger.info('Quote payment refunded successfully', {
          quoteId,
          tradieId,
          refundId: refundResult.id,
          amount: refundResult.amount
        });
      }

      return {
        quote,
        refundResult
      };

    } catch (error) {
      logger.error('Failed to refund quote payment', {
        quoteId,
        tradieId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        'Failed to process refund',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'REFUND_PROCESSING_ERROR'
      );
    }
  }

  private async validateTradieExists(tradieId: number): Promise<void> {
    const tradie = await this.userService.findById(tradieId.toString());
    if (!tradie) {
      throw new AppError(
        'Tradie not found',
        HTTP_STATUS_CODES.NOT_FOUND,
        'TRADIE_NOT_FOUND'
      );
    }
  }

  private async validateClientExists(clientId: number): Promise<void> {
    const client = await this.userService.findById(clientId.toString());
    if (!client) {
      throw new AppError(
        'Client not found',
        HTTP_STATUS_CODES.NOT_FOUND,
        'CLIENT_NOT_FOUND'
      );
    }
  }

  private async validateJobExists(jobId: number): Promise<void> {
    try {
      await this.jobService.getJobById(jobId, 999999);
    } catch (error) {
      if (error instanceof AppError && error.message.includes('not found')) {
        throw new AppError(
          'Job not found',
          HTTP_STATUS_CODES.NOT_FOUND,
          'JOB_NOT_FOUND'
        );
      }
    }
  }

  private async validateJobAccess(jobId: number, tradieId: number): Promise<void> {
    try {
      await this.jobService.getJobById(jobId, tradieId);
    } catch (error) {
      throw new AppError(
        'Unauthorized access to job',
        HTTP_STATUS_CODES.FORBIDDEN,
        'UNAUTHORIZED_JOB_ACCESS'
      );
    }
  }

  private async validateQuoteAccess(quote: QuoteWithRelations, userId: number, userRole: string): Promise<void> {
    if (userRole === 'tradie' && quote.tradieId !== userId) {
      throw new AppError(
        'Unauthorized access to quote',
        HTTP_STATUS_CODES.FORBIDDEN,
        'UNAUTHORIZED_QUOTE_ACCESS'
      );
    }

    if (userRole === 'client' && quote.clientId !== userId) {
      throw new AppError(
        'Unauthorized access to quote',
        HTTP_STATUS_CODES.FORBIDDEN,
        'UNAUTHORIZED_QUOTE_ACCESS'
      );
    }
  }

  private async processQuoteDelivery(quote: QuoteWithRelations, deliveryData: QuoteDeliveryData): Promise<QuoteDeliveryResult> {
    const deliveryStatus = {
      email: false,
      sms: false,
      pdf: false,
      portal: true
    };

    const errors: string[] = [];
    const trackingId = `QD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      for (const method of deliveryData.deliveryMethods) {
        switch (method) {
          case 'email':
            if (deliveryData.recipientEmail) {
              deliveryStatus.email = true;
            } else {
              errors.push('Email delivery failed: No recipient email provided');
            }
            break;
          case 'sms':
            if (deliveryData.recipientPhone) {
              deliveryStatus.sms = true;
            } else {
              errors.push('SMS delivery failed: No recipient phone provided');
            }
            break;
          case 'pdf':
            deliveryStatus.pdf = true;
            break;
          case 'portal':
            deliveryStatus.portal = true;
            break;
        }
      }

      const success = Object.values(deliveryStatus).some(status => status);

      return {
        success,
        deliveryStatus,
        trackingId,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      return {
        success: false,
        deliveryStatus,
        trackingId,
        errors: ['Delivery processing failed']
      };
    }
  }

  private async publishQuoteEvent(eventType: string, quote: any): Promise<void> {
    try {
      logger.info('Quote event published', {
        eventType,
        quoteId: quote.id,
        quoteNumber: quote.quoteNumber
      });
    } catch (error) {
      logger.error('Failed to publish quote event', {
        eventType,
        quoteId: quote.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async publishQuoteStatusEvent(status: string, quote: any): Promise<void> {
    const eventMap = {
      [QuoteStatus.SENT]: QUOTE_EVENTS.QUOTE_SENT,
      [QuoteStatus.VIEWED]: QUOTE_EVENTS.QUOTE_VIEWED,
      [QuoteStatus.ACCEPTED]: QUOTE_EVENTS.QUOTE_ACCEPTED,
      [QuoteStatus.REJECTED]: QUOTE_EVENTS.QUOTE_REJECTED,
      [QuoteStatus.EXPIRED]: QUOTE_EVENTS.QUOTE_EXPIRED,
      [QuoteStatus.CANCELLED]: QUOTE_EVENTS.QUOTE_CANCELLED
    };

    const eventType = eventMap[status as keyof typeof eventMap];
    if (eventType) {
      await this.publishQuoteEvent(eventType, quote);
    }
  }
}


