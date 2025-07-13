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
  calculateProcessingFee,
  generateIdempotencyKey
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
  private paymentRepository: PaymentRepository;
  private paymentMethodRepository: PaymentMethodRepository;
  private invoiceRepository: InvoiceRepository;
  private stripeService: StripeService;
  private applePayService: ApplePayService;
  private googlePayService: GooglePayService;

  constructor() {
    this.stripeService = new StripeService();
    this.applePayService = new ApplePayService();
    this.googlePayService = new GooglePayService();
    this.initializeRepositories();
  }

  private async initializeRepositories(): Promise<void> {
    const dbConnection = getDbConnection();
    this.paymentRepository = new PaymentRepository(dbConnection);
    this.paymentMethodRepository = new PaymentMethodRepository(dbConnection);
    this.invoiceRepository = new InvoiceRepository(dbConnection);
  }

  async createPayment(userId: number, paymentData: any, requestId: string): Promise<any> {
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

      const processingFee = calculateProcessingFee(request.amount, request.currency);
      let paymentResult: CreatePaymentIntentResponse;

      switch (request.paymentMethod) {
        case PaymentMethod.STRIPE_CARD:
        case PaymentMethod.CARD:
          paymentResult = await this.stripeService.createPaymentIntent(request, requestId);
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
            description: request.description,
            requiresShipping: false
          }, requestId);
          
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
            description: request.description
          }, requestId);
          
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
          paymentResult = await this.stripeService.createPaymentIntent(request, requestId);
      }

      const paymentData: Omit<PaymentDatabaseRecord, 'id' | 'created_at' | 'updated_at'> = {
        user_id: request.userId || 1,
        stripe_payment_intent_id: paymentResult.paymentIntentId,
        amount: request.amount,
        currency: request.currency,
        payment_method: request.paymentMethod as PaymentMethod,
        payment_type: (request.paymentType as PaymentType) || PaymentType.ONE_TIME,
        status: paymentResult.status as PaymentStatus,
        description: request.description || null,
        metadata: request.metadata || {},
        invoice_id: null,
        subscription_id: null,
        credits_purchased: null,
        stripe_fee: null,
        platform_fee: null,
        processing_fee: processingFee,
        failure_reason: null,
        net_amount: request.amount - processingFee,
        processed_at: null
      };

      const savedPayment = await this.paymentRepository.create(paymentData);

      logger.info('Payment intent created', {
        paymentId: savedPayment.id,
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
          confirmResult = await this.stripeService.confirmPaymentIntent(request, requestId);
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
          confirmResult = await this.stripeService.confirmPaymentIntent(request, requestId);
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

      if (!validateCurrency(request.currency)) {
        throw new Error('Unsupported currency');
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
      const payment = await this.paymentRepository.findById(request.paymentId);

      if (!payment) {
        throw new Error('Payment not found');
      }

      let stripeStatus = null;
      let failureReason = payment.failure_reason;

      if (payment.stripe_payment_intent_id) {
        try {
          const stripePaymentIntent = await this.stripeService.retrievePaymentIntent(
            payment.stripe_payment_intent_id,
            requestId
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
            error: error instanceof Error ? error.message : 'Unknown error',
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
        processedAt: payment.processed_at?.toISOString(),
        failureReason,
        creditsAwarded: payment.credits_purchased || undefined
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

  async listPayments(userId: number, filters: any, requestId: string): Promise<PaymentHistoryResponse> {
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
        totalCount,
        requestId
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
        summary: {
          totalAmount: paymentStats.total_amount,
          successfulPayments: paymentStats.successful_payments,
          failedPayments: paymentStats.failed_payments,
          pendingPayments: paymentStats.total_payments - paymentStats.successful_payments - paymentStats.failed_payments
        }
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

  async updatePayment(paymentId: number, updateData: any, requestId: string): Promise<PaymentDatabaseRecord> {
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
        updatedFields: Object.keys(mappedUpdateData),
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
      const payment = await this.paymentRepository.findById(paymentId);

      if (!payment) {
        throw new Error('Payment not found');
      }

      if (payment.status === PaymentStatus.SUCCEEDED || payment.status === PaymentStatus.COMPLETED) {
        throw new Error('Cannot cancel completed payment');
      }

      if (payment.status === PaymentStatus.CANCELED || payment.status === PaymentStatus.CANCELLED) {
        throw new Error('Payment already cancelled');
      }

      if (payment.stripe_payment_intent_id) {
        try {
          await this.stripeService.cancelPaymentIntent(
            payment.stripe_payment_intent_id,
            requestId
          );
        } catch (error) {
          logger.warn('Failed to cancel Stripe payment intent', {
            paymentId,
            stripePaymentIntentId: payment.stripe_payment_intent_id,
            error: error instanceof Error ? error.message : 'Unknown error',
            requestId
          });
        }
      }

      await this.paymentRepository.updateStatus(
        paymentId,
        PaymentStatus.CANCELLED
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
    try {
      const totalCount = await this.paymentRepository.countByUserId(userId);
      
      logger.info('User total payments retrieved', {
        userId,
        totalCount,
        requestId
      });

      return totalCount;
    } catch (error) {
      logger.error('Failed to get user total payments', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
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
    },
    requestId: string
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
        }, requestId);
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

      // Note: This would require a RefundRepository which should be created
      // const savedRefund = await this.refundRepository.create(refundRecord);

      logger.info('Payment refund initiated', {
        paymentId,
        refundAmount,
        stripeRefundId: stripeRefund?.id,
        requestId
      });

      return {
        id: paymentId, // This should be the refund ID when RefundRepository is implemented
        paymentId,
        amount: refundAmount,
        status: 'pending',
        stripeRefundId: stripeRefund?.id
      };
    } catch (error) {
      logger.error('Failed to refund payment', {
        paymentId,
        refundData,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      throw error;
    }
  }

  async getPaymentsByInvoice(invoiceId: number, requestId: string): Promise<PaymentDatabaseRecord[]> {
    try {
      const payments = await this.paymentRepository.findByInvoiceId(invoiceId);

      logger.info('Payments by invoice retrieved', {
        invoiceId,
        count: payments.length,
        requestId
      });

      return payments;
    } catch (error) {
      logger.error('Failed to get payments by invoice', {
        invoiceId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      throw error;
    }
  }

  async validatePaymentMethod(paymentMethodId: string, userId: number, requestId: string): Promise<boolean> {
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
        isValid: true,
        requestId
      });

      return true;
    } catch (error) {
      logger.error('Failed to validate payment method', {
        paymentMethodId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      return false;
    }
  }
}

