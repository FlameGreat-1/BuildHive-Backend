import { PAYMENT_CONSTANTS } from '../../config/payment';
import { logger, createErrorResponse } from '../../shared/utils';
import { PaymentRepository, PaymentMethodRepository, InvoiceRepository } from '../repositories';
import { getDbConnection } from '../../shared/database';
import { 
  CreatePaymentIntentRequest,
  CreatePaymentIntentResponse,
  ConfirmPaymentRequest,
  ConfirmPaymentResponse,
  PaymentLinkRequest,
  PaymentLinkResponse,
  PaymentStatusRequest,
  PaymentStatusResponse,
  PaymentHistoryRequest,
  PaymentHistoryResponse
} from '../types';
import { 
  validatePaymentAmount,
  validateCurrency,
  sanitizePaymentMetadata,
  calculateProcessingFee
} from '../utils';
import { StripeService } from './stripe.service';
import { ApplePayService } from './apple-pay.service';
import { GooglePayService } from './google-pay.service';

export class PaymentService {
  private paymentRepository!: PaymentRepository;
  private paymentMethodRepository!: PaymentMethodRepository;
  private invoiceRepository!: InvoiceRepository;
  private stripeService: StripeService;
  private applePayService: ApplePayService;
  private googlePayService: GooglePayService;

  constructor() {
    this.initializeRepositories();
    this.stripeService = new StripeService();
    this.applePayService = new ApplePayService();
    this.googlePayService = new GooglePayService();
  }

  private initializeRepositories(): void {
    getDbConnection().then(dbConnection => {
      this.paymentRepository = new PaymentRepository(dbConnection);
      this.paymentMethodRepository = new PaymentMethodRepository(dbConnection);
      this.invoiceRepository = new InvoiceRepository(dbConnection);
    });
  }

  async createPayment(userId: number, paymentData: any, requestId: string): Promise<any> {
    const createPaymentRequest: CreatePaymentIntentRequest = {
      amount: paymentData.amount,
      currency: paymentData.currency,
      paymentMethod: paymentData.paymentMethod,
      paymentType: paymentData.paymentType,
      description: paymentData.description,
      metadata: sanitizePaymentMetadata(paymentData.metadata || {}),
      userId: userId
    };
    
    return this.createPaymentIntent(createPaymentRequest, requestId);
  }

  async createPaymentIntent(
    request: CreatePaymentIntentRequest,
    requestId: string
  ): Promise<CreatePaymentIntentResponse> {
    try {
      if (!validatePaymentAmount(request.amount, request.currency)) {
        throw new Error('Invalid payment amount');
      }

      if (!validateCurrency(request.currency)) {
        throw new Error('Unsupported currency');
      }

      let paymentResult: CreatePaymentIntentResponse;

      switch (request.paymentMethod) {
        case PAYMENT_CONSTANTS.PAYMENT_METHODS.STRIPE_CARD:
          paymentResult = await this.stripeService.createPaymentIntent(request, requestId);
          break;

        case PAYMENT_CONSTANTS.PAYMENT_METHODS.APPLE_PAY:
          const applePaySession = await this.applePayService.createApplePaySession({
            amount: request.amount,
            currency: request.currency,
            countryCode: 'US',
            merchantName: 'BuildHive',
            description: request.description,
            requiresShipping: false
          }, requestId);
          
          paymentResult = {
            paymentIntentId: `apple_pay_${Date.now()}`,
            clientSecret: '',
            status: 'pending',
            amount: request.amount,
            currency: request.currency,
            processingFee: calculateProcessingFee(request.amount, request.currency),
            requiresAction: true,
            applePaySession: applePaySession.session
          };
          break;

        case PAYMENT_CONSTANTS.PAYMENT_METHODS.GOOGLE_PAY:
          const googlePayConfig = await this.googlePayService.getGooglePayConfig({
            amount: request.amount,
            currency: request.currency,
            merchantName: 'BuildHive',
            description: request.description
          }, requestId);
          
          paymentResult = {
            paymentIntentId: `google_pay_${Date.now()}`,
            clientSecret: '',
            status: 'pending',
            amount: request.amount,
            currency: request.currency,
            processingFee: calculateProcessingFee(request.amount, request.currency),
            requiresAction: true,
            googlePayConfig: googlePayConfig.config
          };
          break;

        default:
          paymentResult = await this.stripeService.createPaymentIntent(request, requestId);
      }

      logger.info('Payment intent created', {
        paymentIntentId: paymentResult.paymentIntentId,
        paymentMethod: request.paymentMethod,
        amount: request.amount,
        currency: request.currency,
        requestId
      });

      return paymentResult;
    } catch (error) {
      logger.error('Failed to create payment intent', {
        paymentMethod: request.paymentMethod,
        amount: request.amount,
        currency: request.currency,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      throw error;
    }
  }

  async confirmPayment(
    request: ConfirmPaymentRequest,
    requestId: string
  ): Promise<ConfirmPaymentResponse> {
    try {
      const payment = await this.paymentRepository.getPaymentByStripeId(
        request.paymentIntentId,
        requestId
      );

      if (!payment) {
        throw new Error('Payment not found');
      }

      let confirmResult: ConfirmPaymentResponse;

      switch (payment.payment_method) {
        case PAYMENT_CONSTANTS.PAYMENT_METHODS.STRIPE_CARD:
          confirmResult = await this.stripeService.confirmPaymentIntent(request, requestId);
          break;

        case PAYMENT_CONSTANTS.PAYMENT_METHODS.APPLE_PAY:
          confirmResult = {
            paymentIntentId: request.paymentIntentId,
            status: 'completed',
            requiresAction: false
          };
          break;

        case PAYMENT_CONSTANTS.PAYMENT_METHODS.GOOGLE_PAY:
          confirmResult = {
            paymentIntentId: request.paymentIntentId,
            status: 'completed',
            requiresAction: false
          };
          break;

        default:
          confirmResult = await this.stripeService.confirmPaymentIntent(request, requestId);
      }

      await this.paymentRepository.updatePaymentStatus(
        payment.id,
        confirmResult.status,
        requestId
      );

      logger.info('Payment confirmed', {
        paymentIntentId: request.paymentIntentId,
        status: confirmResult.status,
        paymentMethod: payment.payment_method,
        requestId
      });

      return confirmResult;
    } catch (error) {
      logger.error('Failed to confirm payment', {
        paymentIntentId: request.paymentIntentId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      throw error;
    }
  }

  async createPaymentLink(
    request: PaymentLinkRequest,
    requestId: string
  ): Promise<PaymentLinkResponse> {
    try {
      if (!validatePaymentAmount(request.amount, request.currency)) {
        throw new Error('Invalid payment amount');
      }

      const paymentLink = await this.stripeService.createPaymentLink(request, requestId);

      logger.info('Payment link created', {
        paymentLinkId: paymentLink.id,
        amount: request.amount,
        currency: request.currency,
        requestId
      });

      return paymentLink;
    } catch (error) {
      logger.error('Failed to create payment link', {
        amount: request.amount,
        currency: request.currency,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      throw error;
    }
  }

  async getPaymentStatus(
    request: PaymentStatusRequest,
    requestId: string
  ): Promise<PaymentStatusResponse> {
    try {
      const payment = await this.paymentRepository.getPaymentById(
        request.paymentId,
        requestId
      );

      if (!payment) {
        throw new Error('Payment not found');
      }

      let stripeStatus = null;
      if (payment.stripe_payment_intent_id) {
        try {
          const stripePaymentIntent = await this.stripeService.retrievePaymentIntent(
            payment.stripe_payment_intent_id,
            requestId
          );
          stripeStatus = stripePaymentIntent.status;
        } catch (error) {
          logger.warn('Failed to retrieve Stripe payment intent status', {
            paymentId: request.paymentId,
            stripePaymentIntentId: payment.stripe_payment_intent_id,
            requestId
          });
        }
      }

      logger.info('Payment status retrieved', {
        paymentId: request.paymentId,
        status: payment.status,
        stripeStatus,
        requestId
      });

      return {
        paymentId: payment.id,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        paymentMethod: payment.payment_method,
        paymentType: payment.payment_type,
        processingFee: payment.processing_fee,
        createdAt: payment.created_at,
        updatedAt: payment.updated_at,
        stripeStatus,
        metadata: payment.metadata
      };
    } catch (error) {
      logger.error('Failed to get payment status', {
        paymentId: request.paymentId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      throw error;
    }
  }

  async listPayments(userId: number, filters: any, requestId: string): Promise<any> {
    const historyRequest: PaymentHistoryRequest = {
      userId: userId,
      limit: filters.limit || 50,
      offset: filters.offset || 0,
      startDate: filters.startDate,
      endDate: filters.endDate
    };
    
    return this.getPaymentHistory(historyRequest, requestId);
  }

  async getPaymentHistory(
    request: PaymentHistoryRequest,
    requestId: string
  ): Promise<PaymentHistoryResponse> {
    try {
      const payments = await this.paymentRepository.getUserPayments(
        request.userId,
        request.limit,
        request.offset,
        requestId
      );

      const totalCount = await this.getUserTotalPayments(
        request.userId,
        requestId
      );

      logger.info('Payment history retrieved', {
        userId: request.userId,
        count: payments.length,
        totalCount,
        requestId
      });

      return {
        payments: payments.map(payment => ({
          id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          paymentMethod: payment.payment_method,
          paymentType: payment.payment_type,
          processingFee: payment.processing_fee,
          createdAt: payment.created_at,
          updatedAt: payment.updated_at,
          metadata: payment.metadata
        })),
        totalCount,
        hasMore: (request.offset || 0) + payments.length < totalCount
      };
    } catch (error) {
      logger.error('Failed to get payment history', {
        userId: request.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      throw error;
    }
  }

  async updatePayment(paymentId: number, updateData: any, requestId: string): Promise<any> {
    try {
      const payment = await this.paymentRepository.getPaymentById(paymentId, requestId);
      
      if (!payment) {
        throw new Error('Payment not found');
      }

      const updatedPayment = await this.paymentRepository.updatePayment(
        paymentId,
        updateData,
        requestId
      );

      logger.info('Payment updated', {
        paymentId,
        updateData,
        requestId
      });

      return updatedPayment;
    } catch (error) {
      logger.error('Failed to update payment', {
        paymentId,
        updateData,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async cancelPayment(paymentId: number, requestId: string): Promise<void> {
    try {
      const payment = await this.paymentRepository.getPaymentById(paymentId, requestId);

      if (!payment) {
        throw new Error('Payment not found');
      }

      if (payment.status === 'completed') {
        throw new Error('Cannot cancel completed payment');
      }

      if (payment.stripe_payment_intent_id) {
        await this.stripeService.cancelPaymentIntent(
          payment.stripe_payment_intent_id,
          requestId
        );
      }

      await this.paymentRepository.updatePaymentStatus(
        paymentId,
        'cancelled',
        requestId
      );

      logger.info('Payment cancelled', {
        paymentId,
        stripePaymentIntentId: payment.stripe_payment_intent_id,
        requestId
      });
    } catch (error) {
      logger.error('Failed to cancel payment', {
        paymentId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      throw error;
    }
  }
  
  async getUserTotalPayments(userId: number, requestId: string): Promise<number> {
  return this.paymentRepository.getUserTotalPayments(userId, requestId);
}
}


 