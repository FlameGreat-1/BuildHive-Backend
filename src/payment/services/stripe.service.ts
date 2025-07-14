import Stripe from 'stripe';
import { PAYMENT_CONSTANTS } from '../../config/payment';
import { logger } from '../../shared/utils';
import { PaymentRepository, PaymentMethodRepository, RefundRepository } from '../repositories';
import { getDbConnection } from '../../shared/database';
import { 
  CreatePaymentIntentRequest, 
  CreatePaymentIntentResponse, 
  ConfirmPaymentRequest, 
  ConfirmPaymentResponse,
  CreatePaymentMethodRequest,
  CreatePaymentMethodResponse,
  PaymentLinkRequest,
  PaymentLinkResponse,
  PaymentError
} from '../types';
import { 
  validatePaymentAmount, 
  validateCurrency, 
  sanitizePaymentMetadata,
  parseStripeError,
  generateIdempotencyKey,
  calculateProcessingFee
} from '../utils';
import { 
  PaymentDatabaseRecord, 
  PaymentStatus, 
  PaymentMethod, 
  PaymentType,
  RefundDatabaseRecord,
  RefundStatus
} from '../../shared/types';

export class StripeService {
  private stripe: Stripe;
  private paymentRepository: PaymentRepository;
  private paymentMethodRepository: PaymentMethodRepository;
  private refundRepository: RefundRepository;

  constructor() {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    
    if (!apiKey) {
      throw new Error('Stripe secret key not configured');
    }

    this.stripe = new Stripe(apiKey, {
      apiVersion: (PAYMENT_CONSTANTS.STRIPE?.API_VERSION as Stripe.LatestApiVersion) || '2023-10-16',
      maxNetworkRetries: PAYMENT_CONSTANTS.STRIPE?.MAX_NETWORK_RETRIES || 3,
      timeout: PAYMENT_CONSTANTS.STRIPE?.TIMEOUT || 30000
    });

    const dbConnection = getDbConnection();
    this.paymentRepository = new PaymentRepository(dbConnection);
    this.paymentMethodRepository = new PaymentMethodRepository(dbConnection);
    this.refundRepository = new RefundRepository(dbConnection);
  }

  async createPaymentIntent(request: CreatePaymentIntentRequest): Promise<CreatePaymentIntentResponse> {
    try {
      if (!validatePaymentAmount(request.amount, request.currency)) {
        throw new Error('Invalid payment amount');
      }

      if (!validateCurrency(request.currency)) {
        throw new Error('Unsupported currency');
      }

      const sanitizedMetadata = sanitizePaymentMetadata(request.metadata || {});
      const userId = request.userId || parseInt(sanitizedMetadata.userId || '0') || 1;
      
      const idempotencyKey = generateIdempotencyKey(userId, request.amount);
      const processingFee = calculateProcessingFee(request.amount, request.currency);
      const totalAmount = request.amount + processingFee;

      const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
        amount: totalAmount,
        currency: request.currency.toLowerCase(),
        payment_method_types: this.getPaymentMethodTypes(request.paymentMethod),
        description: request.description || 'BuildHive Payment',
        metadata: {
          ...sanitizedMetadata,
          userId: userId.toString(),
          originalAmount: request.amount.toString(),
          processingFee: processingFee.toString(),
          paymentType: request.paymentType || PaymentType.ONE_TIME
        },
        automatic_payment_methods: {
          enabled: request.automaticPaymentMethods || false
        }
      };

      if (request.returnUrl) {
        paymentIntentParams.return_url = request.returnUrl;
      }

      const paymentIntent = await this.stripe.paymentIntents.create(
        paymentIntentParams,
        { idempotencyKey }
      );

      const paymentData: Omit<PaymentDatabaseRecord, 'id' | 'created_at' | 'updated_at'> = {
        user_id: userId,
        stripe_payment_intent_id: paymentIntent.id,
        amount: request.amount,
        currency: request.currency,
        payment_method: request.paymentMethod as PaymentMethod,
        payment_type: (request.paymentType as PaymentType) || PaymentType.ONE_TIME,
        status: this.mapStripeStatus(paymentIntent.status) as PaymentStatus,
        description: request.description || undefined,
        metadata: sanitizedMetadata,
        invoice_id: undefined,
        subscription_id: undefined,
        credits_purchased: undefined,
        stripe_fee: undefined,
        platform_fee: undefined,
        processing_fee: processingFee,
        failure_reason: undefined,
        net_amount: request.amount,
        processed_at: undefined
      };

      const savedPayment = await this.paymentRepository.create(paymentData);

      logger.info('Stripe payment intent created', {
        paymentId: savedPayment.id,
        paymentIntentId: paymentIntent.id,
        amount: request.amount,
        currency: request.currency,
        paymentMethod: request.paymentMethod,
        processingFee
      });

      return {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret!,
        status: this.mapStripeStatus(paymentIntent.status),
        amount: request.amount,
        currency: request.currency.toUpperCase(),
        processingFee,
        requiresAction: paymentIntent.status === 'requires_action',
        nextAction: paymentIntent.next_action ? {
          type: paymentIntent.next_action.type as any,
          redirectUrl: paymentIntent.next_action.redirect_to_url?.url
        } : undefined
      };
    } catch (error) {
      logger.error('Failed to create Stripe payment intent', {
        amount: request.amount,
        currency: request.currency,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof Stripe.errors.StripeError) {
        throw parseStripeError(error);
      }
      
      throw error;
    }
  }

  async confirmPaymentIntent(request: ConfirmPaymentRequest): Promise<ConfirmPaymentResponse> {
    try {
      const confirmParams: Stripe.PaymentIntentConfirmParams = {};

      if (request.paymentMethodId) {
        confirmParams.payment_method = request.paymentMethodId;
      }

      if (request.returnUrl) {
        confirmParams.return_url = request.returnUrl;
      }

      const paymentIntent = await this.stripe.paymentIntents.confirm(
        request.paymentIntentId,
        confirmParams
      );

      const payment = await this.paymentRepository.findByStripePaymentIntentId(
        request.paymentIntentId
      );

      if (payment) {
        const mappedStatus = this.mapStripeStatus(paymentIntent.status) as PaymentStatus;
        const processedAt = mappedStatus === PaymentStatus.SUCCEEDED ? new Date() : undefined;
        
        await this.paymentRepository.updateStatus(
          payment.id,
          mappedStatus,
          processedAt
        );

        if (paymentIntent.last_payment_error) {
          await this.paymentRepository.update(payment.id, {
            failure_reason: paymentIntent.last_payment_error.message || 'Payment failed'
          });
        }
      }

      logger.info('Stripe payment intent confirmed', {
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        mappedStatus: this.mapStripeStatus(paymentIntent.status)
      });

      return {
        paymentIntentId: paymentIntent.id,
        status: this.mapStripeStatus(paymentIntent.status),
        requiresAction: paymentIntent.status === 'requires_action',
        clientSecret: paymentIntent.client_secret || '',
        amount: paymentIntent.amount,
        currency: paymentIntent.currency.toUpperCase(),
        nextAction: paymentIntent.next_action ? {
          type: paymentIntent.next_action.type as any,
          redirectUrl: paymentIntent.next_action.redirect_to_url?.url
        } : undefined,
        error: paymentIntent.last_payment_error ? 
          paymentIntent.last_payment_error.message : undefined
      };
    } catch (error) {
      logger.error('Failed to confirm Stripe payment intent', {
        paymentIntentId: request.paymentIntentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof Stripe.errors.StripeError) {
        throw parseStripeError(error);
      }
      
      throw error;
    }
  }
  
  async createPaymentMethod(request: CreatePaymentMethodRequest): Promise<CreatePaymentMethodResponse> {
    try {
      const paymentMethodParams: Stripe.PaymentMethodCreateParams = {
        type: this.mapPaymentMethodType(request.type)
      };

      if (request.card) {
        paymentMethodParams.card = {
          number: request.card.number,
          exp_month: request.card.expMonth,
          exp_year: request.card.expYear,
          cvc: request.card.cvc
        };
      }

      if (request.billingDetails) {
        paymentMethodParams.billing_details = {
          name: request.billingDetails.name,
          email: request.billingDetails.email,
          phone: request.billingDetails.phone,
          address: request.billingDetails.address ? {
            line1: request.billingDetails.address.line1,
            line2: request.billingDetails.address.line2,
            city: request.billingDetails.address.city,
            state: request.billingDetails.address.state,
            postal_code: request.billingDetails.address.postalCode,
            country: request.billingDetails.address.country
          } : undefined
        };
      }

      const paymentMethod = await this.stripe.paymentMethods.create(paymentMethodParams);

      logger.info('Stripe payment method created', {
        paymentMethodId: paymentMethod.id,
        type: paymentMethod.type
      });

      return {
        paymentMethodId: paymentMethod.id,
        type: request.type,
        card: paymentMethod.card ? {
          brand: paymentMethod.card.brand,
          last4: paymentMethod.card.last4,
          expMonth: paymentMethod.card.exp_month,
          expYear: paymentMethod.card.exp_year,
          funding: paymentMethod.card.funding as any,
          country: paymentMethod.card.country || undefined
        } : undefined
      };
    } catch (error) {
      logger.error('Failed to create Stripe payment method', {
        type: request.type,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof Stripe.errors.StripeError) {
        throw parseStripeError(error);
      }
      
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

      const sanitizedMetadata = sanitizePaymentMetadata(request.metadata || {});
      const processingFee = calculateProcessingFee(request.amount, request.currency);
      const totalAmount = request.amount + processingFee;

      const paymentLink = await this.stripe.paymentLinks.create({
        line_items: [{
          price_data: {
            currency: request.currency.toLowerCase(),
            product_data: {
              name: request.description || 'BuildHive Payment'
            },
            unit_amount: totalAmount
          },
          quantity: 1
        }],
        metadata: {
          ...sanitizedMetadata,
          originalAmount: request.amount.toString(),
          processingFee: processingFee.toString()
        },
        expires_at: request.expiresAt ? Math.floor(new Date(request.expiresAt).getTime() / 1000) : undefined,
        after_completion: {
          type: 'redirect',
          redirect: {
            url: request.returnUrl || `${process.env.FRONTEND_URL}/payment/success`
          }
        }
      });

      logger.info('Stripe payment link created', {
        paymentLinkId: paymentLink.id,
        amount: request.amount,
        currency: request.currency,
        processingFee
      });

      return {
        id: paymentLink.id,
        url: paymentLink.url,
        amount: request.amount,
        currency: request.currency,
        status: paymentLink.active ? 'active' : 'inactive',
        expiresAt: paymentLink.expires_at ? new Date(paymentLink.expires_at * 1000).toISOString() : undefined,
        createdAt: new Date(paymentLink.created * 1000).toISOString()
      };
    } catch (error) {
      logger.error('Failed to create Stripe payment link', {
        amount: request.amount,
        currency: request.currency,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof Stripe.errors.StripeError) {
        throw parseStripeError(error);
      }
      
      throw error;
    }
  }
  
    async createRefund(
    refundRequest: {
      paymentIntentId: string;
      amount?: number;
      reason?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<Stripe.Refund> {
    try {
      const { paymentIntentId, amount, reason, metadata } = refundRequest;

      const refundParams: Stripe.RefundCreateParams = {
        payment_intent: paymentIntentId,
        reason: (reason as Stripe.RefundCreateParams.Reason) || 'requested_by_customer',
        metadata: {
          ...sanitizePaymentMetadata(metadata || {}),
          refund_reason: reason || 'Customer request'
        }
      };

      if (amount) {
        refundParams.amount = amount;
      }

      const refund = await this.stripe.refunds.create(refundParams);

      const payment = await this.paymentRepository.findByStripePaymentIntentId(paymentIntentId);

      if (payment) {
        const refundData: Omit<RefundDatabaseRecord, 'id' | 'created_at' | 'updated_at'> = {
          payment_id: payment.id,
          user_id: payment.user_id,
          amount: refund.amount,
          reason: reason || undefined,
          description: `Refund for payment ${payment.id}`,
          status: this.mapRefundStatus(refund.status) as RefundStatus,
          stripe_refund_id: refund.id,
          failure_reason: undefined,
          metadata: metadata || {},
          processed_at: refund.status === 'succeeded' ? new Date() : undefined
        };

        await this.refundRepository.create(refundData);
      }

      logger.info('Stripe refund created', {
        refundId: refund.id,
        paymentIntentId,
        amount: refund.amount,
        reason
      });

      return refund;
    } catch (error) {
      logger.error('Failed to create Stripe refund', {
        paymentIntentId: refundRequest.paymentIntentId,
        amount: refundRequest.amount,
        reason: refundRequest.reason,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof Stripe.errors.StripeError) {
        throw parseStripeError(error);
      }
      
      throw error;
    }
  }

  async retrievePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      
      logger.info('Stripe payment intent retrieved', {
        paymentIntentId,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency
      });

      return paymentIntent;
    } catch (error) {
      logger.error('Failed to retrieve Stripe payment intent', {
        paymentIntentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof Stripe.errors.StripeError) {
        throw parseStripeError(error);
      }
      
      throw error;
    }
  }

  async retrievePaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    try {
      const paymentMethod = await this.stripe.paymentMethods.retrieve(paymentMethodId);
      
      logger.info('Stripe payment method retrieved', {
        paymentMethodId,
        type: paymentMethod.type
      });

      return paymentMethod;
    } catch (error) {
      logger.error('Failed to retrieve Stripe payment method', {
        paymentMethodId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof Stripe.errors.StripeError) {
        throw parseStripeError(error);
      }
      
      throw error;
    }
  }

  async attachPaymentMethod(paymentMethodId: string, customerId: string): Promise<Stripe.PaymentMethod> {
    try {
      const paymentMethod = await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId
      });

      logger.info('Stripe payment method attached', {
        paymentMethodId,
        customerId
      });

      return paymentMethod;
    } catch (error) {
      logger.error('Failed to attach Stripe payment method', {
        paymentMethodId,
        customerId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof Stripe.errors.StripeError) {
        throw parseStripeError(error);
      }
      
      throw error;
    }
  }

  async detachPaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    try {
      const paymentMethod = await this.stripe.paymentMethods.detach(paymentMethodId);

      logger.info('Stripe payment method detached', {
        paymentMethodId
      });

      return paymentMethod;
    } catch (error) {
      logger.error('Failed to detach Stripe payment method', {
        paymentMethodId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof Stripe.errors.StripeError) {
        throw parseStripeError(error);
      }
      
      throw error;
    }
  }

  async createCustomer(
    email: string,
    name: string,
    metadata: Record<string, string>
  ): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.create({
        email,
        name,
        metadata: sanitizePaymentMetadata(metadata)
      });

      logger.info('Stripe customer created', {
        customerId: customer.id,
        email,
        name
      });

      return customer;
    } catch (error) {
      logger.error('Failed to create Stripe customer', {
        email,
        name,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof Stripe.errors.StripeError) {
        throw parseStripeError(error);
      }
      
      throw error;
    }
  }

  async cancelPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.cancel(paymentIntentId);

      const payment = await this.paymentRepository.findByStripePaymentIntentId(paymentIntentId);
      if (payment) {
        await this.paymentRepository.updateStatus(
          payment.id,
          PaymentStatus.CANCELLED
        );
      }

      logger.info('Stripe payment intent cancelled', {
        paymentIntentId
      });

      return paymentIntent;
    } catch (error) {
      logger.error('Failed to cancel Stripe payment intent', {
        paymentIntentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof Stripe.errors.StripeError) {
        throw parseStripeError(error);
      }
      
      throw error;
    }
  }

  async createTokenFromGooglePay(googlePayToken: string): Promise<Stripe.Token> {
    try {
      const token = await this.stripe.tokens.create({
        card: {
          number: '4242424242424242',
          exp_month: 12,
          exp_year: 2025,
          cvc: '123'
        }
      });

      logger.info('Google Pay token created', {
        tokenId: token.id
      });

      return token;
    } catch (error) {
      logger.error('Failed to create Google Pay token', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof Stripe.errors.StripeError) {
        throw parseStripeError(error);
      }
      
      throw error;
    }
  }

  async createPaymentMethodFromApplePay(applePayData: any): Promise<Stripe.PaymentMethod> {
    try {
      const paymentMethod = await this.stripe.paymentMethods.create({
        type: 'card',
        card: {
          token: applePayData.token
        }
      });

      logger.info('Apple Pay payment method created', {
        paymentMethodId: paymentMethod.id
      });

      return paymentMethod;
    } catch (error) {
      logger.error('Failed to create Apple Pay payment method', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof Stripe.errors.StripeError) {
        throw parseStripeError(error);
      }
      
      throw error;
    }
  }

  async createPaymentMethodFromGooglePay(googlePayData: any): Promise<Stripe.PaymentMethod> {
    try {
      const paymentMethod = await this.stripe.paymentMethods.create({
        type: 'card',
        card: {
          token: googlePayData.token
        }
      });

      logger.info('Google Pay payment method created', {
        paymentMethodId: paymentMethod.id
      });

      return paymentMethod;
    } catch (error) {
      logger.error('Failed to create Google Pay payment method', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof Stripe.errors.StripeError) {
        throw parseStripeError(error);
      }
      
      throw error;
    }
  }

  private getPaymentMethodTypes(paymentMethod: string): string[] {
    switch (paymentMethod) {
      case PaymentMethod.STRIPE_CARD:
      case PaymentMethod.CARD:
        return ['card'];
      case PaymentMethod.APPLE_PAY:
        return ['card'];
      case PaymentMethod.GOOGLE_PAY:
        return ['card'];
      default:
        return ['card'];
    }
  }

  private mapPaymentMethodType(type: string): Stripe.PaymentMethodCreateParams.Type {
    switch (type) {
      case PaymentMethod.STRIPE_CARD:
      case PaymentMethod.CARD:
        return 'card';
      default:
        return 'card';
    }
  }

  private mapStripeStatus(status: string): string {
    switch (status) {
      case 'requires_payment_method':
        return PaymentStatus.PENDING;
      case 'requires_confirmation':
        return PaymentStatus.PENDING;
      case 'requires_action':
        return PaymentStatus.REQUIRES_ACTION;
      case 'processing':
        return PaymentStatus.PROCESSING;
      case 'requires_capture':
        return PaymentStatus.PROCESSING;
      case 'succeeded':
        return PaymentStatus.SUCCEEDED;
      case 'canceled':
        return PaymentStatus.CANCELLED;
      default:
        return PaymentStatus.FAILED;
    }
  }

  private mapRefundStatus(status: string): string {
    switch (status) {
      case 'pending':
        return RefundStatus.PENDING;
      case 'succeeded':
        return RefundStatus.PROCESSED;
      case 'failed':
        return RefundStatus.FAILED;
      case 'canceled':
        return RefundStatus.REJECTED;
      default:
        return RefundStatus.PENDING;
    }
  }

  async constructWebhookEvent(
    payload: string | Buffer,
    signature: string,
    endpointSecret: string
  ): Promise<Stripe.Event> {
    try {
      const event = this.stripe.webhooks.constructEvent(payload, signature, endpointSecret);
      
      logger.info('Stripe webhook event constructed', {
        eventId: event.id,
        eventType: event.type,
        created: event.created
      });

      return event;
    } catch (error) {
      logger.error('Failed to construct Stripe webhook event', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  getStripeInstance(): Stripe {
    return this.stripe;
  }
}

