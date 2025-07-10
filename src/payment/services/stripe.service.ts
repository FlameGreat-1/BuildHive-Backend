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
      apiVersion: PAYMENT_CONSTANTS.STRIPE.API_VERSION as Stripe.LatestApiVersion,
      maxNetworkRetries: PAYMENT_CONSTANTS.STRIPE.MAX_NETWORK_RETRIES,
      timeout: PAYMENT_CONSTANTS.STRIPE.TIMEOUT
    });

    this.initializeRepositories();
  }

  private async initializeRepositories(): Promise<void> {
    const dbConnection = await getDbConnection();
    this.paymentRepository = new PaymentRepository(dbConnection);
    this.paymentMethodRepository = new PaymentMethodRepository(dbConnection);
    this.refundRepository = new RefundRepository(dbConnection);
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

      const sanitizedMetadata = sanitizePaymentMetadata(request.metadata || {});
      const idempotencyKey = generateIdempotencyKey(
        parseInt(sanitizedMetadata.userId || '0'),
        request.amount
      );

      const processingFee = calculateProcessingFee(request.amount, request.currency);
      const totalAmount = request.amount + processingFee;

      const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
        amount: totalAmount,
        currency: request.currency.toLowerCase(),
        payment_method_types: this.getPaymentMethodTypes(request.paymentMethod),
        description: request.description,
        metadata: {
          ...sanitizedMetadata,
          originalAmount: request.amount.toString(),
          processingFee: processingFee.toString(),
          paymentType: request.paymentType
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

      await this.paymentRepository.createPayment({
        userId: parseInt(sanitizedMetadata.userId || '0'),
        amount: request.amount,
        currency: request.currency,
        status: 'pending',
        paymentMethod: request.paymentMethod,
        paymentType: request.paymentType,
        stripePaymentIntentId: paymentIntent.id,
        processingFee,
        metadata: sanitizedMetadata
      }, requestId);

      logger.info('Stripe payment intent created', {
        paymentIntentId: paymentIntent.id,
        amount: request.amount,
        currency: request.currency,
        paymentMethod: request.paymentMethod,
        processingFee,
        requestId
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
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      if (error instanceof Stripe.errors.StripeError) {
        throw parseStripeError(error);
      }
      
      throw error;
    }
  }

  async confirmPaymentIntent(
    request: ConfirmPaymentRequest,
    requestId: string
  ): Promise<ConfirmPaymentResponse> {
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

      const payment = await this.paymentRepository.getPaymentByStripeId(
        request.paymentIntentId,
        requestId
      );

      if (payment) {
        await this.paymentRepository.updatePaymentStatus(
          payment.id,
          this.mapStripeStatus(paymentIntent.status),
          requestId
        );
      }

      logger.info('Stripe payment intent confirmed', {
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        requestId
      });

      return {
        paymentIntentId: paymentIntent.id,
        status: this.mapStripeStatus(paymentIntent.status),
        requiresAction: paymentIntent.status === 'requires_action',
        nextAction: paymentIntent.next_action ? {
          type: paymentIntent.next_action.type as any,
          redirectUrl: paymentIntent.next_action.redirect_to_url?.url
        } : undefined,
        error: paymentIntent.last_payment_error ? 
          parseStripeError(paymentIntent.last_payment_error) : undefined
      };
    } catch (error) {
      logger.error('Failed to confirm Stripe payment intent', {
        paymentIntentId: request.paymentIntentId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      if (error instanceof Stripe.errors.StripeError) {
        throw parseStripeError(error);
      }
      
      throw error;
    }
  }
  
    async createPaymentMethod(
    request: CreatePaymentMethodRequest,
    requestId: string
  ): Promise<CreatePaymentMethodResponse> {
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
        type: paymentMethod.type,
        requestId
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
          country: paymentMethod.card.country
        } : undefined
      };
    } catch (error) {
      logger.error('Failed to create Stripe payment method', {
        type: request.type,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      if (error instanceof Stripe.errors.StripeError) {
        throw parseStripeError(error);
      }
      
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
        expires_at: request.expiresAt ? Math.floor(request.expiresAt.getTime() / 1000) : undefined,
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
        processingFee,
        requestId
      });

      return {
        id: paymentLink.id,
        url: paymentLink.url,
        amount: request.amount,
        currency: request.currency,
        processingFee,
        status: paymentLink.active ? 'active' : 'inactive',
        expiresAt: paymentLink.expires_at ? new Date(paymentLink.expires_at * 1000) : undefined,
        created: new Date(paymentLink.created * 1000)
      };
    } catch (error) {
      logger.error('Failed to create Stripe payment link', {
        amount: request.amount,
        currency: request.currency,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      if (error instanceof Stripe.errors.StripeError) {
        throw parseStripeError(error);
      }
      
      throw error;
    }
  }

  async createRefund(
    paymentIntentId: string,
    amount: number,
    reason: string,
    requestId: string
  ): Promise<Stripe.Refund> {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount,
        reason: reason as Stripe.RefundCreateParams.Reason,
        metadata: {
          refund_reason: reason,
          request_id: requestId
        }
      });

      const payment = await this.paymentRepository.getPaymentByStripeId(
        paymentIntentId,
        requestId
      );

      if (payment) {
        await this.refundRepository.createRefund({
          paymentId: payment.id,
          userId: payment.user_id,
          amount,
          reason,
          status: 'pending',
          stripeRefundId: refund.id
        }, requestId);
      }

      logger.info('Stripe refund created', {
        refundId: refund.id,
        paymentIntentId,
        amount,
        reason,
        requestId
      });

      return refund;
    } catch (error) {
      logger.error('Failed to create Stripe refund', {
        paymentIntentId,
        amount,
        reason,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      if (error instanceof Stripe.errors.StripeError) {
        throw parseStripeError(error);
      }
      
      throw error;
    }
  }

  async retrievePaymentIntent(paymentIntentId: string, requestId: string): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      
      logger.info('Stripe payment intent retrieved', {
        paymentIntentId,
        status: paymentIntent.status,
        requestId
      });

      return paymentIntent;
    } catch (error) {
      logger.error('Failed to retrieve Stripe payment intent', {
        paymentIntentId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      if (error instanceof Stripe.errors.StripeError) {
        throw parseStripeError(error);
      }
      
      throw error;
    }
  }

  async attachPaymentMethod(
    paymentMethodId: string,
    customerId: string,
    requestId: string
  ): Promise<Stripe.PaymentMethod> {
    try {
      const paymentMethod = await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId
      });

      logger.info('Stripe payment method attached', {
        paymentMethodId,
        customerId,
        requestId
      });

      return paymentMethod;
    } catch (error) {
      logger.error('Failed to attach Stripe payment method', {
        paymentMethodId,
        customerId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      if (error instanceof Stripe.errors.StripeError) {
        throw parseStripeError(error);
      }
      
      throw error;
    }
  }

  async detachPaymentMethod(paymentMethodId: string, requestId: string): Promise<Stripe.PaymentMethod> {
    try {
      const paymentMethod = await this.stripe.paymentMethods.detach(paymentMethodId);

      logger.info('Stripe payment method detached', {
        paymentMethodId,
        requestId
      });

      return paymentMethod;
    } catch (error) {
      logger.error('Failed to detach Stripe payment method', {
        paymentMethodId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
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
    metadata: Record<string, string>,
    requestId: string
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
        requestId
      });

      return customer;
    } catch (error) {
      logger.error('Failed to create Stripe customer', {
        email,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      if (error instanceof Stripe.errors.StripeError) {
        throw parseStripeError(error);
      }
      
      throw error;
    }
  }

  async cancelPaymentIntent(paymentIntentId: string, requestId: string): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.cancel(paymentIntentId);

      logger.info('Stripe payment intent cancelled', {
        paymentIntentId,
        requestId
      });

      return paymentIntent;
    } catch (error) {
      logger.error('Failed to cancel Stripe payment intent', {
        paymentIntentId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      if (error instanceof Stripe.errors.StripeError) {
        throw parseStripeError(error);
      }
      
      throw error;
    }
  }

  private getPaymentMethodTypes(paymentMethod: string): string[] {
    switch (paymentMethod) {
      case PAYMENT_CONSTANTS.PAYMENT_METHODS.STRIPE_CARD:
        return ['card'];
      case PAYMENT_CONSTANTS.PAYMENT_METHODS.APPLE_PAY:
        return ['card'];
      case PAYMENT_CONSTANTS.PAYMENT_METHODS.GOOGLE_PAY:
        return ['card'];
      default:
        return ['card'];
    }
  }

  private mapPaymentMethodType(type: string): Stripe.PaymentMethodCreateParams.Type {
    switch (type) {
      case PAYMENT_CONSTANTS.PAYMENT_METHODS.STRIPE_CARD:
        return 'card';
      default:
        return 'card';
    }
  }

  private mapStripeStatus(status: string): string {
    switch (status) {
      case 'requires_payment_method':
        return 'pending';
      case 'requires_confirmation':
        return 'pending';
      case 'requires_action':
        return 'requires_action';
      case 'processing':
        return 'processing';
      case 'requires_capture':
        return 'authorized';
      case 'succeeded':
        return 'completed';
      case 'canceled':
        return 'cancelled';
      default:
        return 'failed';
    }
  }
}

