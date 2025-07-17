import { PAYMENT_CONSTANTS } from '../../config/payment/constants';
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
import { 
  PaymentDatabaseRecord, 
  PaymentStatus, 
  PaymentMethod, 
  PaymentType 
} from '../../shared/types';

export class PaymentService {
  private paymentRepository!: PaymentRepository;
  private paymentMethodRepository!: PaymentMethodRepository;
  private invoiceRepository!: InvoiceRepository;
  private stripeService: StripeService;
  private applePayService: ApplePayService;
  private googlePayService: GooglePayService;
  
  constructor() {
    this.stripeService = new StripeService();
    this.applePayService = new ApplePayService();
    this.googlePayService = new GooglePayService();
    
    const dbConnection = getDbConnection();
    this.paymentRepository = new PaymentRepository(dbConnection);
    this.paymentMethodRepository = new PaymentMethodRepository(dbConnection);
    this.invoiceRepository = new InvoiceRepository(dbConnection);
  }

  async createPayment(userId: number, paymentData: any): Promise<any> {
    const createPaymentRequest: CreatePaymentIntentRequest = {
      amount: paymentData.amount,
      currency: paymentData.currency,
      paymentMethod: paymentData.paymentMethod,
      paymentType: paymentData.paymentType,
      description: paymentData.description,
      metadata: sanitizePaymentMetadata(paymentData.metadata || {}),
      userId: userId,
      automaticPaymentMethods: paymentData.automaticPaymentMethods,
      returnUrl: paymentData.returnUrl
    };
    
    return this.createPaymentIntent(createPaymentRequest);
  }

  async createPaymentIntent(request: CreatePaymentIntentRequest): Promise<CreatePaymentIntentResponse> {
    try {
      if (!validatePaymentAmount(request.amount, request.currency)) {
        throw new Error('Invalid payment amount');
      }

      if (!validateCurrency(request.currency)) {
        throw new Error('Unsupported currency');
      }
      
      const processingFee = calculateProcessingFee(request.amount, request.currency, PaymentMethod.CARD);
      let paymentResult: CreatePaymentIntentResponse;

      switch (request.paymentMethod) {
        case PaymentMethod.STRIPE_CARD:
        case PaymentMethod.CARD:
          paymentResult = await this.stripeService.createPaymentIntent(request);
          break;

        case PaymentMethod.APPLE_PAY:
          const applePaySession = await this.applePayService.createApplePaySession({
            validationUrl: '',
            displayName: 'BuildHive',
            domainName: process.env.APPLE_PAY_DOMAIN || '',
            amount: request.amount,
            currency: request.currency,
            countryCode: 'US',
            merchantName: 'BuildHive',
            description: request.description || 'BuildHive Payment',
            requiresShipping: false
          });
          
          paymentResult = {
            paymentIntentId: `apple_pay_${Date.now()}`,
            clientSecret: '',
            status: PaymentStatus.PENDING,
            amount: request.amount,
            currency: request.currency,
            processingFee,
            requiresAction: true
          };
          break;

        case PaymentMethod.GOOGLE_PAY:
          const googlePayConfig = await this.googlePayService.getGooglePayConfig({
            amount: request.amount,
            currency: request.currency,
            merchantName: 'BuildHive',
            description: request.description || 'BuildHive Payment'
          });
          
          paymentResult = {
            paymentIntentId: `google_pay_${Date.now()}`,
            clientSecret: '',
            status: PaymentStatus.PENDING,
            amount: request.amount,
            currency: request.currency,
            processingFee,
            requiresAction: true
          };
          break;

        default:
          paymentResult = await this.stripeService.createPaymentIntent(request);
      }

      const paymentData: Omit<PaymentDatabaseRecord, 'id' | 'created_at' | 'updated_at'> = {
        user_id: request.userId || 1,
        stripe_payment_intent_id: paymentResult.paymentIntentId,
        amount: request.amount,
        currency: request.currency,
        payment_method: request.paymentMethod as PaymentMethod,
        payment_type: (request.paymentType as PaymentType) || PaymentType.ONE_TIME,
        status: paymentResult.status as PaymentStatus,
        description: request.description || undefined,
        metadata: request.metadata || {},
        invoice_id: undefined,
        subscription_id: undefined,
        credits_purchased: undefined,
        stripe_fee: undefined,
        platform_fee: undefined,
        processing_fee: processingFee,
        failure_reason: undefined,
        net_amount: request.amount - processingFee,
        processed_at: undefined
      };

      const savedPayment = await this.paymentRepository.create(paymentData);

      logger.info('Payment intent created', {
        paymentId: savedPayment.id,
        paymentIntentId: paymentResult.paymentIntentId,
        paymentMethod: request.paymentMethod,
        amount: request.amount,
        currency: request.currency
      });

      return paymentResult;
    } catch (error) {
      logger.error('Failed to create payment intent', {
        paymentMethod: request.paymentMethod,
        amount: request.amount,
        currency: request.currency,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async confirmPayment(request: ConfirmPaymentRequest): Promise<ConfirmPaymentResponse> {
    try {
      const payment = await this.paymentRepository.findByStripePaymentIntentId(
        request.paymentIntentId
      );

      if (!payment) {
        throw new Error('Payment not found');
      }

      let confirmResult: ConfirmPaymentResponse;

      switch (payment.payment_method) {
        case PaymentMethod.STRIPE_CARD:
        case PaymentMethod.CARD:
          confirmResult = await this.stripeService.confirmPaymentIntent(request);
          break;

        case PaymentMethod.APPLE_PAY:
          confirmResult = {
            paymentIntentId: request.paymentIntentId,
            status: PaymentStatus.SUCCEEDED,
            requiresAction: false,
            clientSecret: '',
            amount: payment.amount,
            currency: payment.currency
          };
          break;

        case PaymentMethod.GOOGLE_PAY:
          confirmResult = {
            paymentIntentId: request.paymentIntentId,
            status: PaymentStatus.SUCCEEDED,
            requiresAction: false,
            clientSecret: '',
            amount: payment.amount,
            currency: payment.currency
          };
          break;

        default:
          confirmResult = await this.stripeService.confirmPaymentIntent(request);
      }

      await this.paymentRepository.updateStatus(
        payment.id,
        confirmResult.status as PaymentStatus,
        confirmResult.status === PaymentStatus.SUCCEEDED ? new Date() : undefined
      );

      logger.info('Payment confirmed', {
        paymentId: payment.id,
        paymentIntentId: request.paymentIntentId,
        status: confirmResult.status,
        paymentMethod: payment.payment_method
      });

      return confirmResult;
    } catch (error) {
      logger.error('Failed to confirm payment', {
        paymentIntentId: request.paymentIntentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }
  
  async createPaymentLink(request: PaymentLinkRequest): Promise<PaymentLinkResponse> {
    try {
      if (!validatePaymentAmount(request.amount, request.currency)) {
        throw new Error('Invalid payment amount');
      }

      if (!validateCurrency(request.currency)) {
        throw new Error('Unsupported currency');
      }

      const paymentLink = await this.stripeService.createPaymentLink(request);

      logger.info('Payment link created', {
        paymentLinkId: paymentLink.id,
        amount: request.amount,
        currency: request.currency
      });

      return paymentLink;
    } catch (error) {
      logger.error('Failed to create payment link', {
        amount: request.amount,
        currency: request.currency,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async getPaymentStatus(request: PaymentStatusRequest): Promise<PaymentStatusResponse> {
    try {
      const payment = await this.paymentRepository.findById(request.paymentId);

      if (!payment) {
        throw new Error('Payment not found');
      }

      let stripeStatus = null;
      let failureReason = payment.failure_reason;

      if (payment.stripe_payment_intent_id) {
        try {
          const stripePaymentIntent = await this.stripeService.retrievePaymentIntent(
            payment.stripe_payment_intent_id
          );
          stripeStatus = stripePaymentIntent.status;
          
          if (stripePaymentIntent.status !== payment.status) {
            await this.paymentRepository.updateStatus(
              payment.id,
              stripePaymentIntent.status as PaymentStatus,
              stripePaymentIntent.status === PaymentStatus.SUCCEEDED ? new Date() : undefined
            );
          }
        } catch (error) {
          logger.warn('Failed to retrieve Stripe payment intent status', {
            paymentId: request.paymentId,
            stripePaymentIntentId: payment.stripe_payment_intent_id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      logger.info('Payment status retrieved', {
        paymentId: request.paymentId,
        status: payment.status,
        stripeStatus
      });

      return {
        paymentId: payment.id,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        paymentMethod: payment.payment_method,
        paymentType: payment.payment_type,
        processedAt: payment.processed_at?.toISOString(),
        failureReason,
        creditsAwarded: payment.credits_purchased || undefined,
        createdAt: payment.created_at.toISOString()  
      };
    } catch (error) {
      logger.error('Failed to get payment status', {
        paymentId: request.paymentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async listPayments(userId: number, filters: any): Promise<PaymentHistoryResponse> {
    const historyRequest: PaymentHistoryRequest = {
      userId: userId,
      limit: filters.limit || 50,
      offset: filters.offset || 0,
      startDate: filters.startDate,
      endDate: filters.endDate
    };
    
    return this.getPaymentHistory(historyRequest);
  }
  
  async getPaymentHistory(request: PaymentHistoryRequest): Promise<PaymentHistoryResponse> {
    try {
      const payments = await this.paymentRepository.findByUserId(
        request.userId,
        request.limit || 50,
        request.offset || 0
      );

      let filteredPayments = payments;

      if (request.startDate || request.endDate) {
        const startDate = request.startDate ? new Date(request.startDate) : new Date(0);
        const endDate = request.endDate ? new Date(request.endDate) : new Date();
        
        filteredPayments = await this.paymentRepository.findByDateRange(
          startDate,
          endDate,
          request.userId
        );
      }

      const totalCount = await this.paymentRepository.countByUserId(request.userId);

      const paymentStats = await this.paymentRepository.getPaymentStats(request.userId);

      logger.info('Payment history retrieved', {
        userId: request.userId,
        count: filteredPayments.length,
        totalCount
      });

      return {
        payments: filteredPayments.map(payment => ({
          id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          paymentMethod: payment.payment_method,
          paymentType: payment.payment_type,
          description: payment.description || undefined,
          creditsAwarded: payment.credits_purchased || undefined,
          stripeFee: payment.stripe_fee || undefined,
          platformFee: payment.platform_fee || undefined,
          netAmount: payment.net_amount || undefined,
          processedAt: payment.processed_at?.toISOString(),
          createdAt: payment.created_at.toISOString()
        })),
        totalCount,
        page: Math.floor((request.offset || 0) / (request.limit || 50)) + 1,
        limit: request.limit || 50,
        summary: {
          totalPayments: paymentStats.total_payments,  
          totalAmount: paymentStats.total_amount,
          successfulPayments: paymentStats.successful_payments,
          failedPayments: paymentStats.failed_payments,
          pendingPayments: paymentStats.total_payments - paymentStats.successful_payments - paymentStats.failed_payments,
          averageAmount: paymentStats.average_amount  
        }
      };
    } catch (error) {
      logger.error('Failed to get payment history', {
        userId: request.userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }  

  async updatePayment(paymentId: number, updateData: any): Promise<PaymentDatabaseRecord> {
    try {
      const payment = await this.paymentRepository.findById(paymentId);
      
      if (!payment) {
        throw new Error('Payment not found');
      }

      const mappedUpdateData: Partial<Pick<PaymentDatabaseRecord, 'status' | 'processing_fee' | 'failure_reason' | 'processed_at' | 'metadata'>> = {};

      if (updateData.status !== undefined) {
        mappedUpdateData.status = updateData.status as PaymentStatus;
      }

      if (updateData.processingFee !== undefined) {
        mappedUpdateData.processing_fee = updateData.processingFee;
      }

      if (updateData.failureReason !== undefined) {
        mappedUpdateData.failure_reason = updateData.failureReason;
      }

      if (updateData.processedAt !== undefined) {
        mappedUpdateData.processed_at = new Date(updateData.processedAt);
      }

      if (updateData.metadata !== undefined) {
        mappedUpdateData.metadata = sanitizePaymentMetadata(updateData.metadata);
      }

      const updatedPayment = await this.paymentRepository.update(paymentId, mappedUpdateData);

      logger.info('Payment updated', {
        paymentId,
        updatedFields: Object.keys(mappedUpdateData)
      });

      return updatedPayment;
    } catch (error) {
      logger.error('Failed to update payment', {
        paymentId,
        updateData,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async cancelPayment(paymentId: number): Promise<void> {
    try {
      const payment = await this.paymentRepository.findById(paymentId);

      if (!payment) {
        throw new Error('Payment not found');
      }

      if (payment.status === PaymentStatus.SUCCEEDED || payment.status === PaymentStatus.COMPLETED) {
        throw new Error('Cannot cancel completed payment');
      }
      
      if (payment.status === PaymentStatus.CANCELLED) {
        throw new Error('Payment already cancelled');
      }

      if (payment.stripe_payment_intent_id) {
        try {
          await this.stripeService.cancelPaymentIntent(payment.stripe_payment_intent_id);
        } catch (error) {
          logger.warn('Failed to cancel Stripe payment intent', {
            paymentId,
            stripePaymentIntentId: payment.stripe_payment_intent_id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      await this.paymentRepository.updateStatus(
        paymentId,
        PaymentStatus.CANCELLED
      );

      logger.info('Payment cancelled', {
        paymentId,
        stripePaymentIntentId: payment.stripe_payment_intent_id
      });
    } catch (error) {
      logger.error('Failed to cancel payment', {
        paymentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }  
  
  async getUserTotalPayments(userId: number): Promise<number> {
    try {
      const totalCount = await this.paymentRepository.countByUserId(userId);
      
      logger.info('User total payments retrieved', {
        userId,
        totalCount
      });

      return totalCount;
    } catch (error) {
      logger.error('Failed to get user total payments', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async refundPayment(
    paymentId: number,
    refundData: {
      amount?: number;
      reason?: string;
      description?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<any> {
    try {
      const payment = await this.paymentRepository.findById(paymentId);

      if (!payment) {
        throw new Error('Payment not found');
      }

      if (payment.status !== PaymentStatus.SUCCEEDED && payment.status !== PaymentStatus.COMPLETED) {
        throw new Error('Can only refund successful payments');
      }

      const refundAmount = refundData.amount || payment.amount;

      if (refundAmount > payment.amount) {
        throw new Error('Refund amount cannot exceed payment amount');
      }

      let stripeRefund = null;
      if (payment.stripe_payment_intent_id) {
        stripeRefund = await this.stripeService.createRefund({
          paymentIntentId: payment.stripe_payment_intent_id,
          amount: refundAmount,
          reason: refundData.reason,
          metadata: refundData.metadata
        });
      }

      const refundRecord = {
        payment_id: paymentId,
        user_id: payment.user_id,
        amount: refundAmount,
        reason: refundData.reason || null,
        description: refundData.description || null,
        status: 'pending' as any,
        stripe_refund_id: stripeRefund?.id || null,
        failure_reason: null,
        metadata: refundData.metadata || {},
        processed_at: null
      };

      logger.info('Payment refund initiated', {
        paymentId,
        refundAmount,
        stripeRefundId: stripeRefund?.id
      });

      return {
        id: paymentId,
        paymentId,
        amount: refundAmount,
        status: 'pending',
        stripeRefundId: stripeRefund?.id
      };
    } catch (error) {
      logger.error('Failed to refund payment', {
        paymentId,
        refundData,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async getPaymentsByInvoice(invoiceId: number): Promise<PaymentDatabaseRecord[]> {
    try {
      const payments = await this.paymentRepository.findByInvoiceId(invoiceId);

      logger.info('Payments by invoice retrieved', {
        invoiceId,
        count: payments.length
      });

      return payments;
    } catch (error) {
      logger.error('Failed to get payments by invoice', {
        invoiceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async validatePaymentMethod(paymentMethodId: string, userId: number): Promise<boolean> {
    try {
      const paymentMethod = await this.paymentMethodRepository.findByStripePaymentMethodId(paymentMethodId);

      if (!paymentMethod) {
        return false;
      }

      if (paymentMethod.user_id !== userId) {
        return false;
      }

      logger.info('Payment method validated', {
        paymentMethodId,
        userId,
        isValid: true
      });

      return true;
    } catch (error) {
      logger.error('Failed to validate payment method', {
        paymentMethodId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return false;
    }
  }

  async getPaymentMethods(userId: number): Promise<any[]> {
    try {
      const paymentMethods = await this.paymentMethodRepository.findByUserId(userId);
      
      logger.info('Payment methods retrieved', {
        userId,
        count: paymentMethods.length
      });

      return paymentMethods.map(pm => ({
        id: pm.id,
        type: pm.type,
        cardLastFour: pm.card_last_four,
        cardBrand: pm.card_brand,
        cardExpMonth: pm.card_exp_month,
        cardExpYear: pm.card_exp_year,
        isDefault: pm.is_default
      }));
    } catch (error) {
      logger.error('Failed to get payment methods', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}
