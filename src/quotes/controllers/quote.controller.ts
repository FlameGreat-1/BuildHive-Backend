import { Request, Response, NextFunction } from 'express';
import { QuoteServiceImpl } from '../services';
import { AIPricingServiceImpl } from '../services';
import { JobService } from '../../jobs/services';
import { UserService } from '../../auth/services';
import { 
  QuoteCreateData,
  QuoteUpdateData,
  QuoteStatusUpdateData,
  QuoteDeliveryData,
  AIPricingRequest,
  QuoteFilterOptions,
  QuotePaymentData,
  QuoteRefundData,
  QuoteInvoiceData
} from '../types';
import { parseQuoteFilters } from '../utils';
import { QUOTE_RATE_LIMITS } from '../../config/quotes';
import { sendSuccessResponse, sendErrorResponse } from '../../shared/utils';
import { logger } from '../../shared/utils';
import { AppError } from '../../shared/utils';
import { HTTP_STATUS_CODES } from '../../config/auth';

export class QuoteController {
  private quoteService: QuoteServiceImpl;
  private aiPricingService: AIPricingServiceImpl;

  constructor(
    jobService: JobService,
    userService: UserService
  ) {
    this.quoteService = new QuoteServiceImpl(jobService, userService);
    this.aiPricingService = new AIPricingServiceImpl();
  }

  async createQuote(req: Request, res: Response, next: NextFunction): Promise<void> {
    const requestId = res.locals.requestId || 'unknown';
    
    try {
      const tradieId = req.user?.id;
      if (!tradieId) {
        throw new AppError(
          'Authentication required',
          HTTP_STATUS_CODES.UNAUTHORIZED,
          'AUTHENTICATION_REQUIRED'
        );
      }

      const data: QuoteCreateData = req.body;
      const quote = await this.quoteService.createQuote(tradieId, data);

      logger.info('Quote created via API', {
        requestId,
        quoteId: quote.id,
        tradieId,
        totalAmount: quote.totalAmount
      });

      sendSuccessResponse(res, {
        message: 'Quote created successfully',
        data: quote
      }, HTTP_STATUS_CODES.CREATED);

    } catch (error) {
      logger.error('Quote creation failed via API', {
        requestId,
        tradieId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      next(error);
    }
  }

  async getQuote(req: Request, res: Response, next: NextFunction): Promise<void> {
    const requestId = res.locals.requestId || 'unknown';
    
    try {
      const quoteId = parseInt(req.params.quoteId);
      const userId = req.user?.id;
      const userRole = req.user?.role || 'tradie';

      if (!userId) {
        throw new AppError(
          'Authentication required',
          HTTP_STATUS_CODES.UNAUTHORIZED,
          'AUTHENTICATION_REQUIRED'
        );
      }

      const quote = await this.quoteService.getQuote(quoteId, userId, userRole);

      logger.info('Quote retrieved via API', {
        requestId,
        quoteId,
        userId,
        userRole
      });

      sendSuccessResponse(res, {
        message: 'Quote retrieved successfully',
        data: quote
      });

    } catch (error) {
      logger.error('Quote retrieval failed via API', {
        requestId,
        quoteId: req.params.quoteId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      next(error);
    }
  }

  async getQuoteByNumber(req: Request, res: Response, next: NextFunction): Promise<void> {
    const requestId = res.locals.requestId || 'unknown';
    
    try {
      const quoteNumber = req.params.quoteNumber;
      const quote = await this.quoteService.getQuoteByNumber(quoteNumber);

      logger.info('Quote retrieved by number via API', {
        requestId,
        quoteNumber
      });

      sendSuccessResponse(res, {
        message: 'Quote retrieved successfully',
        data: quote
      });

    } catch (error) {
      logger.error('Quote retrieval by number failed via API', {
        requestId,
        quoteNumber: req.params.quoteNumber,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      next(error);
    }
  }

  async getQuotes(req: Request, res: Response, next: NextFunction): Promise<void> {
    const requestId = res.locals.requestId || 'unknown';
    
    try {
      const tradieId = req.user?.id;
      if (!tradieId) {
        throw new AppError(
          'Authentication required',
          HTTP_STATUS_CODES.UNAUTHORIZED,
          'AUTHENTICATION_REQUIRED'
        );
      }

      const filters: QuoteFilterOptions = parseQuoteFilters(req.query);
      const result = await this.quoteService.getQuotes(tradieId, filters);

      logger.info('Quotes list retrieved via API', {
        requestId,
        tradieId,
        totalQuotes: result.quotes.length,
        page: filters.page,
        limit: filters.limit
      });

      sendSuccessResponse(res, {
        message: 'Quotes retrieved successfully',
        data: result.quotes,
        meta: {
          summary: result.summary,
          pagination: result.pagination
        }
      });

    } catch (error) {
      logger.error('Quotes list retrieval failed via API', {
        requestId,
        tradieId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      next(error);
    }
  }

  async updateQuote(req: Request, res: Response, next: NextFunction): Promise<void> {
    const requestId = res.locals.requestId || 'unknown';
    
    try {
      const quoteId = parseInt(req.params.quoteId);
      const tradieId = req.user?.id;

      if (!tradieId) {
        throw new AppError(
          'Authentication required',
          HTTP_STATUS_CODES.UNAUTHORIZED,
          'AUTHENTICATION_REQUIRED'
        );
      }

      const data: QuoteUpdateData = req.body;
      const quote = await this.quoteService.updateQuote(quoteId, tradieId, data);

      logger.info('Quote updated via API', {
        requestId,
        quoteId,
        tradieId,
        updatedFields: Object.keys(data)
      });

      sendSuccessResponse(res, {
        message: 'Quote updated successfully',
        data: quote
      });

    } catch (error) {
      logger.error('Quote update failed via API', {
        requestId,
        quoteId: req.params.quoteId,
        tradieId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      next(error);
    }
  }

  async updateQuoteStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    const requestId = res.locals.requestId || 'unknown';
    
    try {
      const quoteId = parseInt(req.params.quoteId);
      const tradieId = req.user?.id;

      if (!tradieId) {
        throw new AppError(
          'Authentication required',
          HTTP_STATUS_CODES.UNAUTHORIZED,
          'AUTHENTICATION_REQUIRED'
        );
      }

      const data: QuoteStatusUpdateData = req.body;
      const quote = await this.quoteService.updateQuoteStatus(quoteId, tradieId, data);

      logger.info('Quote status updated via API', {
        requestId,
        quoteId,
        tradieId,
        newStatus: data.status
      });

      sendSuccessResponse(res, {
        message: 'Quote status updated successfully',
        data: quote
      });

    } catch (error) {
      logger.error('Quote status update failed via API', {
        requestId,
        quoteId: req.params.quoteId,
        tradieId: req.user?.id,
        status: req.body.status,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      next(error);
    }
  }

  async deleteQuote(req: Request, res: Response, next: NextFunction): Promise<void> {
    const requestId = res.locals.requestId || 'unknown';
    
    try {
      const quoteId = parseInt(req.params.quoteId);
      const tradieId = req.user?.id;

      if (!tradieId) {
        throw new AppError(
          'Authentication required',
          HTTP_STATUS_CODES.UNAUTHORIZED,
          'AUTHENTICATION_REQUIRED'
        );
      }

      await this.quoteService.deleteQuote(quoteId, tradieId);

      logger.info('Quote deleted via API', {
        requestId,
        quoteId,
        tradieId
      });

      sendSuccessResponse(res, {
        message: 'Quote deleted successfully'
      });

    } catch (error) {
      logger.error('Quote deletion failed via API', {
        requestId,
        quoteId: req.params.quoteId,
        tradieId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      next(error);
    }
  }

  async sendQuote(req: Request, res: Response, next: NextFunction): Promise<void> {
    const requestId = res.locals.requestId || 'unknown';
    
    try {
      const quoteId = parseInt(req.params.quoteId);
      const tradieId = req.user?.id;

      if (!tradieId) {
        throw new AppError(
          'Authentication required',
          HTTP_STATUS_CODES.UNAUTHORIZED,
          'AUTHENTICATION_REQUIRED'
        );
      }

      const deliveryData: QuoteDeliveryData = {
        ...req.body,
        quoteId
      };

      const result = await this.quoteService.sendQuote(quoteId, tradieId, deliveryData);

      logger.info('Quote sent via API', {
        requestId,
        quoteId,
        tradieId,
        deliveryMethods: deliveryData.deliveryMethods,
        success: result.success
      });

      sendSuccessResponse(res, {
        message: 'Quote sent successfully',
        data: result
      });

    } catch (error) {
      logger.error('Quote sending failed via API', {
        requestId,
        quoteId: req.params.quoteId,
        tradieId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      next(error);
    }
  }

  async viewQuote(req: Request, res: Response, next: NextFunction): Promise<void> {
    const requestId = res.locals.requestId || 'unknown';
    
    try {
      const quoteNumber = req.params.quoteNumber;
      const quote = await this.quoteService.viewQuote(quoteNumber);

      logger.info('Quote viewed via API', {
        requestId,
        quoteNumber,
        quoteId: quote.id
      });

      sendSuccessResponse(res, {
        message: 'Quote retrieved successfully',
        data: quote
      });

    } catch (error) {
      logger.error('Quote viewing failed via API', {
        requestId,
        quoteNumber: req.params.quoteNumber,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      next(error);
    }
  }
  
    async acceptQuote(req: Request, res: Response, next: NextFunction): Promise<void> {
    const requestId = res.locals.requestId || 'unknown';
    
    try {
      const quoteNumber = req.params.quoteNumber;
      const clientId = req.user?.id;

      if (!clientId) {
        throw new AppError(
          'Authentication required',
          HTTP_STATUS_CODES.UNAUTHORIZED,
          'AUTHENTICATION_REQUIRED'
        );
      }

      const quote = await this.quoteService.acceptQuote(quoteNumber, clientId);

      logger.info('Quote accepted via API', {
        requestId,
        quoteNumber,
        clientId,
        quoteId: quote.id,
        totalAmount: quote.totalAmount
      });

      sendSuccessResponse(res, {
        message: 'Quote accepted successfully',
        data: quote
      });

    } catch (error) {
      logger.error('Quote acceptance failed via API', {
        requestId,
        quoteNumber: req.params.quoteNumber,
        clientId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      next(error);
    }
  }

  async rejectQuote(req: Request, res: Response, next: NextFunction): Promise<void> {
    const requestId = res.locals.requestId || 'unknown';
    
    try {
      const quoteNumber = req.params.quoteNumber;
      const clientId = req.user?.id;
      const { reason } = req.body;

      if (!clientId) {
        throw new AppError(
          'Authentication required',
          HTTP_STATUS_CODES.UNAUTHORIZED,
          'AUTHENTICATION_REQUIRED'
        );
      }

      const quote = await this.quoteService.rejectQuote(quoteNumber, clientId, reason);

      logger.info('Quote rejected via API', {
        requestId,
        quoteNumber,
        clientId,
        quoteId: quote.id,
        reason
      });

      sendSuccessResponse(res, {
        message: 'Quote rejected successfully',
        data: quote
      });

    } catch (error) {
      logger.error('Quote rejection failed via API', {
        requestId,
        quoteNumber: req.params.quoteNumber,
        clientId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      next(error);
    }
  }

  async calculateQuote(req: Request, res: Response, next: NextFunction): Promise<void> {
    const requestId = res.locals.requestId || 'unknown';
    
    try {
      const { items, gstEnabled } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        throw new AppError(
          'Quote items are required for calculation',
          HTTP_STATUS_CODES.BAD_REQUEST,
          'QUOTE_VALIDATION_ERROR'
        );
      }

      const calculation = this.quoteService.calculateQuote(items, gstEnabled);

      logger.info('Quote calculated via API', {
        requestId,
        itemCount: items.length,
        gstEnabled,
        totalAmount: calculation.totalAmount
      });

      sendSuccessResponse(res, {
        message: 'Quote calculated successfully',
        data: calculation
      });

    } catch (error) {
      logger.error('Quote calculation failed via API', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      next(error);
    }
  }

  async calculateQuoteWithFees(req: Request, res: Response, next: NextFunction): Promise<void> {
    const requestId = res.locals.requestId || 'unknown';
    
    try {
      const { items, gstEnabled } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        throw new AppError(
          'Quote items are required for calculation',
          HTTP_STATUS_CODES.BAD_REQUEST,
          'QUOTE_VALIDATION_ERROR'
        );
      }

      const calculation = this.quoteService.calculateQuoteWithFees(items, gstEnabled);

      logger.info('Quote calculated with fees via API', {
        requestId,
        itemCount: items.length,
        gstEnabled,
        totalAmount: calculation.totalAmount,
        finalAmount: calculation.finalAmount
      });

      sendSuccessResponse(res, {
        message: 'Quote calculated with fees successfully',
        data: calculation
      });

    } catch (error) {
      logger.error('Quote calculation with fees failed via API', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      next(error);
    }
  }

  async createPaymentIntent(req: Request, res: Response, next: NextFunction): Promise<void> {
    const requestId = res.locals.requestId || 'unknown';
    
    try {
      const quoteNumber = req.params.quoteNumber;
      const clientId = req.user?.id;

      if (!clientId) {
        throw new AppError(
          'Authentication required',
          HTTP_STATUS_CODES.UNAUTHORIZED,
          'AUTHENTICATION_REQUIRED'
        );
      }

      const result = await this.quoteService.createPaymentIntent(quoteNumber, clientId);

      logger.info('Payment intent created via API', {
        requestId,
        quoteNumber,
        clientId,
        paymentIntentId: result.paymentIntent.paymentIntentId,
        amount: result.quote.totalAmount
      });

      sendSuccessResponse(res, {
        message: 'Payment intent created successfully',
        data: result
      });

    } catch (error) {
      logger.error('Payment intent creation failed via API', {
        requestId,
        quoteNumber: req.params.quoteNumber,
        clientId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      next(error);
    }
  }

  async acceptQuoteWithPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    const requestId = res.locals.requestId || 'unknown';
    
    try {
      const quoteNumber = req.params.quoteNumber;
      const clientId = req.user?.id;
      const { paymentMethodId } = req.body;

      if (!clientId) {
        throw new AppError(
          'Authentication required',
          HTTP_STATUS_CODES.UNAUTHORIZED,
          'AUTHENTICATION_REQUIRED'
        );
      }

      if (!paymentMethodId) {
        throw new AppError(
          'Payment method is required',
          HTTP_STATUS_CODES.BAD_REQUEST,
          'PAYMENT_METHOD_REQUIRED'
        );
      }

      const result = await this.quoteService.acceptQuoteWithPayment(quoteNumber, clientId, paymentMethodId);

      logger.info('Quote accepted with payment via API', {
        requestId,
        quoteNumber,
        clientId,
        paymentId: result.paymentResult.paymentId,
        amount: result.paymentResult.amount
      });

      sendSuccessResponse(res, {
        message: 'Quote accepted and payment processed successfully',
        data: result
      });

    } catch (error) {
      logger.error('Quote acceptance with payment failed via API', {
        requestId,
        quoteNumber: req.params.quoteNumber,
        clientId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      next(error);
    }
  }

  async processQuotePayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    const requestId = res.locals.requestId || 'unknown';
    
    try {
      const quoteId = parseInt(req.params.quoteId);
      const clientId = req.user?.id;

      if (!clientId) {
        throw new AppError(
          'Authentication required',
          HTTP_STATUS_CODES.UNAUTHORIZED,
          'AUTHENTICATION_REQUIRED'
        );
      }

      const quote = await this.quoteService.getQuote(quoteId, clientId, 'client');
      
      const paymentData: QuotePaymentData = {
        quoteId,
        quoteNumber: quote.quoteNumber,
        paymentMethodId: req.body.paymentMethodId,
        clientId,
        tradieId: quote.tradieId,
        amount: quote.totalAmount,
        currency: 'AUD',
        clientEmail: quote.clientEmail,
        tradieEmail: quote.tradieEmail,
        description: `Payment for Quote #${quote.quoteNumber}`
      };

      const result = await this.quoteService.processQuotePayment(paymentData);

      logger.info('Quote payment processed via API', {
        requestId,
        quoteId,
        clientId,
        paymentId: result.paymentResult.paymentId,
        amount: result.paymentResult.amount
      });

      sendSuccessResponse(res, {
        message: 'Payment processed successfully',
        data: result
      });

    } catch (error) {
      logger.error('Quote payment processing failed via API', {
        requestId,
        quoteId: req.params.quoteId,
        clientId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      next(error);
    }
  }

  async refundQuotePayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    const requestId = res.locals.requestId || 'unknown';
    
    try {
      const quoteId = parseInt(req.params.quoteId);
      const tradieId = req.user?.id;

      if (!tradieId) {
        throw new AppError(
          'Authentication required',
          HTTP_STATUS_CODES.UNAUTHORIZED,
          'AUTHENTICATION_REQUIRED'
        );
      }

      const quote = await this.quoteService.getQuote(quoteId, tradieId, 'tradie');

      if (!quote.paymentId) {
        throw new AppError(
          'No payment found for this quote',
          HTTP_STATUS_CODES.BAD_REQUEST,
          'NO_PAYMENT_FOUND'
        );
      }

      const refundData: QuoteRefundData = {
        quoteId,
        quoteNumber: quote.quoteNumber,
        paymentId: quote.paymentId,
        amount: req.body.amount,
        reason: req.body.reason || 'Refund requested by tradie',
        tradieId,
        clientId: quote.clientId
      };

      const result = await this.quoteService.refundQuotePayment(refundData);

      logger.info('Quote payment refunded via API', {
        requestId,
        quoteId,
        tradieId,
        refundId: result.refundResult.refundId,
        amount: result.refundResult.amount
      });

      sendSuccessResponse(res, {
        message: 'Payment refunded successfully',
        data: result
      });

    } catch (error) {
      logger.error('Quote payment refund failed via API', {
        requestId,
        quoteId: req.params.quoteId,
        tradieId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      next(error);
    }
  }

  async generateQuoteInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    const requestId = res.locals.requestId || 'unknown';
    
    try {
      const quoteId = parseInt(req.params.quoteId);
      const tradieId = req.user?.id;

      if (!tradieId) {
        throw new AppError(
          'Authentication required',
          HTTP_STATUS_CODES.UNAUTHORIZED,
          'AUTHENTICATION_REQUIRED'
        );
      }

      const quote = await this.quoteService.getQuote(quoteId, tradieId, 'tradie');

      if (!quote.paymentId) {
        throw new AppError(
          'No payment found for this quote',
          HTTP_STATUS_CODES.BAD_REQUEST,
          'NO_PAYMENT_FOUND'
        );
      }

      const invoiceData: QuoteInvoiceData = {
        quoteId,
        quoteNumber: quote.quoteNumber,
        paymentId: quote.paymentId,
        clientId: quote.clientId,
        tradieId,
        jobId: quote.jobId
      };

      const result = await this.quoteService.generateQuoteInvoice(invoiceData);

      logger.info('Quote invoice generated via API', {
        requestId,
        quoteId,
        tradieId,
        invoiceId: result.invoiceResult.invoiceId,
        invoiceNumber: result.invoiceResult.invoiceNumber
      });

      sendSuccessResponse(res, {
        message: 'Invoice generated successfully',
        data: result
      });

    } catch (error) {
      logger.error('Quote invoice generation failed via API', {
        requestId,
        quoteId: req.params.quoteId,
        tradieId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      next(error);
    }
  }
  
    async getQuotePaymentSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    const requestId = res.locals.requestId || 'unknown';
    
    try {
      const quoteId = parseInt(req.params.quoteId);
      const userId = req.user?.id;
      const userRole = req.user?.role || 'tradie';

      if (!userId) {
        throw new AppError(
          'Authentication required',
          HTTP_STATUS_CODES.UNAUTHORIZED,
          'AUTHENTICATION_REQUIRED'
        );
      }

      await this.quoteService.getQuote(quoteId, userId, userRole);
      const summary = await this.quoteService.getQuotePaymentSummary(quoteId);

      logger.info('Quote payment summary retrieved via API', {
        requestId,
        quoteId,
        userId,
        paymentStatus: summary.paymentStatus
      });

      sendSuccessResponse(res, {
        message: 'Payment summary retrieved successfully',
        data: summary
      });

    } catch (error) {
      logger.error('Quote payment summary retrieval failed via API', {
        requestId,
        quoteId: req.params.quoteId,
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      next(error);
    }
  }

  async getQuoteWithPaymentDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    const requestId = res.locals.requestId || 'unknown';
    
    try {
      const quoteNumber = req.params.quoteNumber;
      const quote = await this.quoteService.getQuoteWithPaymentDetails(quoteNumber);

      logger.info('Quote with payment details retrieved via API', {
        requestId,
        quoteNumber,
        quoteId: quote.id,
        paymentStatus: quote.paymentStatus
      });

      sendSuccessResponse(res, {
        message: 'Quote with payment details retrieved successfully',
        data: quote
      });

    } catch (error) {
      logger.error('Quote with payment details retrieval failed via API', {
        requestId,
        quoteNumber: req.params.quoteNumber,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      next(error);
    }
  }

  async handlePaymentWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    const requestId = res.locals.requestId || 'unknown';
    
    try {
      const { quoteId, paymentStatus, paymentId } = req.body;

      if (!quoteId || !paymentStatus) {
        throw new AppError(
          'Quote ID and payment status are required',
          HTTP_STATUS_CODES.BAD_REQUEST,
          'WEBHOOK_VALIDATION_ERROR'
        );
      }

      await this.quoteService.handlePaymentWebhook(quoteId, paymentStatus, paymentId);

      logger.info('Payment webhook processed via API', {
        requestId,
        quoteId,
        paymentStatus,
        paymentId
      });

      sendSuccessResponse(res, {
        message: 'Webhook processed successfully'
      });

    } catch (error) {
      logger.error('Payment webhook processing failed via API', {
        requestId,
        quoteId: req.body.quoteId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      next(error);
    }
  }

  async getAIPricing(req: Request, res: Response, next: NextFunction): Promise<void> {
    const requestId = res.locals.requestId || 'unknown';
    
    try {
      const tradieId = req.user?.id;
      if (!tradieId) {
        throw new AppError(
          'Authentication required',
          HTTP_STATUS_CODES.UNAUTHORIZED,
          'AUTHENTICATION_REQUIRED'
        );
      }

      const request: AIPricingRequest = req.body;
      const pricing = await this.aiPricingService.getSuggestedPricing(request);

      logger.info('AI pricing generated via API', {
        requestId,
        tradieId,
        jobType: request.jobType,
        suggestedTotal: pricing.suggestedTotal,
        confidence: pricing.confidence
      });

      sendSuccessResponse(res, {
        message: 'AI pricing suggestion generated successfully',
        data: pricing
      });

    } catch (error) {
      logger.error('AI pricing generation failed via API', {
        requestId,
        tradieId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      next(error);
    }
  }

  async getAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    const requestId = res.locals.requestId || 'unknown';
    
    try {
      const tradieId = req.user?.id;
      if (!tradieId) {
        throw new AppError(
          'Authentication required',
          HTTP_STATUS_CODES.UNAUTHORIZED,
          'AUTHENTICATION_REQUIRED'
        );
      }

      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        throw new AppError(
          'Start date and end date are required',
          HTTP_STATUS_CODES.BAD_REQUEST,
          'VALIDATION_ERROR'
        );
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new AppError(
          'Invalid date format',
          HTTP_STATUS_CODES.BAD_REQUEST,
          'VALIDATION_ERROR'
        );
      }

      const analytics = await this.quoteService.getAnalytics(tradieId, start, end);

      logger.info('Quote analytics retrieved via API', {
        requestId,
        tradieId,
        startDate,
        endDate,
        totalQuotes: analytics.totalQuotes
      });

      sendSuccessResponse(res, {
        message: 'Quote analytics retrieved successfully',
        data: analytics
      });

    } catch (error) {
      logger.error('Quote analytics retrieval failed via API', {
        requestId,
        tradieId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      next(error);
    }
  }

  async generateQuoteNumber(req: Request, res: Response, next: NextFunction): Promise<void> {
    const requestId = res.locals.requestId || 'unknown';
    
    try {
      const quoteNumber = await this.quoteService.generateQuoteNumber();

      logger.info('Quote number generated via API', {
        requestId,
        quoteNumber
      });

      sendSuccessResponse(res, {
        message: 'Quote number generated successfully',
        data: { quoteNumber }
      });

    } catch (error) {
      logger.error('Quote number generation failed via API', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      next(error);
    }
  }

  async getClientQuotes(req: Request, res: Response, next: NextFunction): Promise<void> {
    const requestId = res.locals.requestId || 'unknown';
    
    try {
      const clientId = req.user?.id;
      if (!clientId) {
        throw new AppError(
          'Authentication required',
          HTTP_STATUS_CODES.UNAUTHORIZED,
          'AUTHENTICATION_REQUIRED'
        );
      }

      const filters: QuoteFilterOptions = parseQuoteFilters(req.query);
      const result = await this.quoteService.getQuotes(clientId, filters);

      logger.info('Client quotes retrieved via API', {
        requestId,
        clientId,
        totalQuotes: result.quotes.length
      });

      sendSuccessResponse(res, {
        message: 'Client quotes retrieved successfully',
        data: result.quotes,
        meta: {
          summary: result.summary,
          pagination: result.pagination
        }
      });

    } catch (error) {
      logger.error('Client quotes retrieval failed via API', {
        requestId,
        clientId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      next(error);
    }
  }

  async duplicateQuote(req: Request, res: Response, next: NextFunction): Promise<void> {
    const requestId = res.locals.requestId || 'unknown';
    
    try {
      const quoteId = parseInt(req.params.quoteId);
      const tradieId = req.user?.id;

      if (!tradieId) {
        throw new AppError(
          'Authentication required',
          HTTP_STATUS_CODES.UNAUTHORIZED,
          'AUTHENTICATION_REQUIRED'
        );
      }

      const originalQuote = await this.quoteService.getQuote(quoteId, tradieId, 'tradie');
      
      const duplicateData: QuoteCreateData = {
        clientId: originalQuote.clientId,
        jobId: originalQuote.jobId,
        title: `${originalQuote.title} (Copy)`,
        description: originalQuote.description,
        items: originalQuote.items.map(item => ({
          itemType: item.itemType,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice
        })),
        gstEnabled: originalQuote.gstEnabled,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        termsConditions: originalQuote.termsConditions,
        notes: originalQuote.notes
      };

      const duplicatedQuote = await this.quoteService.createQuote(tradieId, duplicateData);

      logger.info('Quote duplicated via API', {
        requestId,
        originalQuoteId: quoteId,
        duplicatedQuoteId: duplicatedQuote.id,
        tradieId
      });

      sendSuccessResponse(res, {
        message: 'Quote duplicated successfully',
        data: duplicatedQuote
      }, HTTP_STATUS_CODES.CREATED);

    } catch (error) {
      logger.error('Quote duplication failed via API', {
        requestId,
        quoteId: req.params.quoteId,
        tradieId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      next(error);
    }
  }
}

export const quoteController = new QuoteController(
  {} as JobService,
  {} as UserService
);


