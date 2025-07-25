import { PAYMENT_CONSTANTS } from '../../config/payment';
import { logger } from '../../shared/utils';
import { PaymentRepository, PaymentMethodRepository } from '../repositories';
import { getDbConnection } from '../../shared/database';
import { 
  ApplePaySessionRequest,
  ApplePaySessionResponse,
  ApplePayPaymentRequest,
  ApplePayPaymentResponse,
  ApplePayValidationRequest,
  ApplePayValidationResponse,
  PaymentError
} from '../types';
import { 
  validatePaymentAmount,
  validateCurrency,
  sanitizePaymentMetadata,
  calculateProcessingFee,
  generateIdempotencyKey
} from '../utils';
import { StripeService } from './stripe.service';
import { 
  PaymentDatabaseRecord, 
  PaymentStatus, 
  PaymentMethod, 
  PaymentType 
} from '../../shared/types';

export class ApplePayService {
  private paymentRepository!: PaymentRepository;
  private paymentMethodRepository!: PaymentMethodRepository;
  private stripeService: StripeService;

  constructor() {
    this.stripeService = new StripeService();
    this.initializeRepositories();
  }

  private async initializeRepositories(): Promise<void> {
    const dbConnection = getDbConnection();
    this.paymentRepository = new PaymentRepository(dbConnection);
    this.paymentMethodRepository = new PaymentMethodRepository(dbConnection);
  }

  async createApplePaySession(request: ApplePaySessionRequest): Promise<ApplePaySessionResponse> {
    try {
      if (!request.amount || !validatePaymentAmount(request.amount, request.currency || 'USD')) {
        throw new Error('Invalid payment amount for Apple Pay');
      }

      if (!validateCurrency(request.currency || 'USD')) {
        throw new Error('Unsupported currency for Apple Pay');
      }
      
      const processingFee = calculateProcessingFee(request.amount, request.currency || 'USD', PaymentMethod.APPLE_PAY);

      const totalAmount = request.amount + processingFee;

      const applePaySession = {
        countryCode: request.countryCode || 'US',
        currencyCode: (request.currency || 'USD').toUpperCase(),
        supportedNetworks: [
          'visa',
          'masterCard',
          'amex',
          'discover'
        ],
        merchantCapabilities: [
          'supports3DS',
          'supportsCredit',
          'supportsDebit'
        ],
        total: {
          label: request.merchantName || 'BuildHive',
          amount: (totalAmount / 100).toFixed(2),
          type: 'final'
        },
        lineItems: [
          {
            label: request.description || 'Payment',
            amount: (request.amount / 100).toFixed(2),
            type: 'final'
          },
          {
            label: 'Processing Fee',
            amount: (processingFee / 100).toFixed(2),
            type: 'final'
          }
        ],
        requiredBillingContactFields: ['postalAddress'],
        requiredShippingContactFields: request.requiresShipping ? ['postalAddress', 'name', 'phoneNumber'] : undefined
      };

      logger.info('Apple Pay session created', {
        amount: request.amount,
        currency: request.currency,
        processingFee,
        totalAmount
      });

      return {
        merchantSession: applePaySession,
        success: true,
        session: applePaySession,
        merchantIdentifier: process.env.APPLE_PAY_MERCHANT_ID || '',
        domainName: process.env.APPLE_PAY_DOMAIN || '',
        displayName: request.displayName || request.merchantName || 'BuildHive'
      };
    } catch (error) {
      logger.error('Failed to create Apple Pay session', {
        amount: request.amount,
        currency: request.currency,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        merchantSession: null,
        success: false,
        session: null,
        merchantIdentifier: '',
        domainName: '',
        displayName: request.displayName || request.merchantName || 'BuildHive'
      };
    }
  }

  async validateApplePayMerchant(request: ApplePayValidationRequest): Promise<ApplePayValidationResponse> {
    try {
      const validationUrl = request.validationUrl;
      const merchantIdentifier = process.env.APPLE_PAY_MERCHANT_ID;
      const domainName = process.env.APPLE_PAY_DOMAIN;
      const displayName = request.displayName || 'BuildHive';

      if (!merchantIdentifier || !domainName) {
        throw new Error('Apple Pay merchant configuration missing');
      }

      if (!validationUrl) {
        throw new Error('Apple Pay validation URL is required');
      }

      const validationData = {
        merchantIdentifier,
        domainName,
        displayName
      };

      const response = await fetch(validationUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'BuildHive/1.0'
        },
        body: JSON.stringify(validationData)
      });

      if (!response.ok) {
        throw new Error(`Apple Pay validation failed: ${response.statusText}`);
      }

      const merchantSession = await response.json();

      logger.info('Apple Pay merchant validated', {
        merchantIdentifier,
        domainName
      });

      return {
        merchantSession,
        success: true,
        displayName: displayName
      };
    } catch (error) {
      logger.error('Failed to validate Apple Pay merchant', {
        validationUrl: request.validationUrl,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        merchantSession: null,
        success: false,
        displayName: request.displayName || 'BuildHive'
      };
    }
  }

  async processApplePayPayment(request: ApplePayPaymentRequest): Promise<ApplePayPaymentResponse> {
    try {
      const { paymentData: requestPaymentData, amount, currency, userId, paymentType, description, metadata, returnUrl } = request;

      if (!validatePaymentAmount(amount, currency)) {
        throw new Error('Invalid payment amount');
      }

      if (!requestPaymentData) {
        throw new Error('Apple Pay payment data is required');
      }

      const sanitizedMetadata = sanitizePaymentMetadata({
        userId: (userId || 1).toString(),
        paymentType: paymentType || PaymentType.ONE_TIME,
        
        applePayTransaction: requestPaymentData.transactionIdentifier || generateIdempotencyKey(userId || 1, amount),
        ...metadata
      });
      
      const processingFee = calculateProcessingFee(amount, currency, PaymentMethod.APPLE_PAY);

      const stripePaymentIntent = await this.stripeService.createPaymentIntent({
        amount,
        currency,
        paymentMethod: PaymentMethod.APPLE_PAY,
        paymentType: (paymentType as PaymentType) || PaymentType.ONE_TIME,
        description: description || 'Apple Pay Payment',
        metadata: sanitizedMetadata,
        automaticPaymentMethods: true,
        userId: userId || 1,
        returnUrl
      });

      const confirmResult = await this.stripeService.confirmPaymentIntent({
        paymentIntentId: stripePaymentIntent.paymentIntentId,
        paymentMethodId: undefined,
        returnUrl
      });

      const dbPaymentData: Omit<PaymentDatabaseRecord, 'id' | 'created_at' | 'updated_at'> = {
        user_id: userId || 1,
        stripe_payment_intent_id: stripePaymentIntent.paymentIntentId,
        amount,
        currency,
        payment_method: PaymentMethod.APPLE_PAY,
        payment_type: (paymentType as PaymentType) || PaymentType.ONE_TIME,
        status: confirmResult.status as PaymentStatus,
        description: description || 'Apple Pay Payment',
        metadata: sanitizedMetadata,
        invoice_id: undefined,
        subscription_id: undefined,
        credits_purchased: undefined,
        stripe_fee: undefined,
        platform_fee: undefined,
        processing_fee: processingFee,
        failure_reason: confirmResult.error?.message || undefined,
        net_amount: amount - processingFee,
        processed_at: confirmResult.status === PaymentStatus.SUCCEEDED ? new Date() : undefined
      };

      const savedPayment = await this.paymentRepository.create(dbPaymentData);

      logger.info('Apple Pay payment processed', {
        paymentId: savedPayment.id,
        paymentIntentId: stripePaymentIntent.paymentIntentId,
        amount,
        currency,
        status: confirmResult.status,
        userId
      });

      return {
        paymentIntentId: stripePaymentIntent.paymentIntentId,
        status: confirmResult.status,
        transactionId: requestPaymentData.transactionIdentifier || savedPayment.id.toString(),
        amount,
        currency,
        clientSecret: stripePaymentIntent.clientSecret,
        processingFee,
        requiresAction: confirmResult.requiresAction,
        nextAction: confirmResult.nextAction,
        success: confirmResult.status === PaymentStatus.SUCCEEDED
      };
    } catch (error) {
      logger.error('Failed to process Apple Pay payment', {
        amount: request.amount,
        currency: request.currency,
        userId: request.userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async verifyApplePayDomain(domain: string): Promise<boolean> {
    try {
      const allowedDomains = process.env.APPLE_PAY_ALLOWED_DOMAINS?.split(',') || [];
      const isAllowed = allowedDomains.includes(domain) || domain === process.env.APPLE_PAY_DOMAIN;

      logger.info('Apple Pay domain verification', {
        domain,
        isAllowed,
        allowedDomains: allowedDomains.length
      });

      return isAllowed;
    } catch (error) {
      logger.error('Failed to verify Apple Pay domain', {
        domain,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return false;
    }
  }

  async getApplePayCapabilities(): Promise<{
    supportedNetworks: string[];
    merchantCapabilities: string[];
    supportedCountries: string[];
    supportedCurrencies: string[];
    merchantIdentifier: string;
    domainName: string;
  }> {
    try {
      const supportedCountries = ['AU', 'US', 'CA', 'GB'] as const;
      const supportedCurrencies = ['AUD', 'USD'] as const;
      
      const capabilities = {
        supportedNetworks: ['visa', 'masterCard', 'amex', 'discover'],
        merchantCapabilities: ['supports3DS', 'supportsCredit', 'supportsDebit'],
        supportedCountries: [...supportedCountries],
        supportedCurrencies: [...supportedCurrencies],
        merchantIdentifier: process.env.APPLE_PAY_MERCHANT_ID || '',
        domainName: process.env.APPLE_PAY_DOMAIN || ''
      };

      logger.info('Apple Pay capabilities retrieved', {
        supportedNetworks: capabilities.supportedNetworks.length,
        supportedCountries: capabilities.supportedCountries.length,
        supportedCurrencies: capabilities.supportedCurrencies.length
      });

      return capabilities;
    } catch (error) {
      logger.error('Failed to get Apple Pay capabilities', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async createApplePayPaymentMethod(userId: number, applePayData: any): Promise<{ id: number; stripePaymentMethodId: string }> {
    try {
      const stripePaymentMethod = await this.stripeService.createPaymentMethodFromApplePay(applePayData);

      const paymentMethodData = {
        user_id: userId,
        stripe_payment_method_id: stripePaymentMethod.id,
        type: PaymentMethod.APPLE_PAY,
        card_last_four: undefined,
        card_brand: undefined,
        card_exp_month: undefined,
        card_exp_year: undefined,
        is_default: false
      };

      const savedPaymentMethod = await this.paymentMethodRepository.create(paymentMethodData);

      logger.info('Apple Pay payment method created', {
        paymentMethodId: savedPaymentMethod.id,
        stripePaymentMethodId: stripePaymentMethod.id,
        userId
      });

      return {
        id: savedPaymentMethod.id,
        stripePaymentMethodId: stripePaymentMethod.id
      };
    } catch (error) {
      logger.error('Failed to create Apple Pay payment method', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async validateApplePayPayment(paymentData: any): Promise<boolean> {
    try {
      if (!paymentData || !paymentData.paymentMethod) {
        return false;
      }

      const requiredFields = ['displayName', 'network', 'type'];
      const hasRequiredFields = requiredFields.every(field => 
        paymentData.paymentMethod[field]
      );

      if (!hasRequiredFields) {
        return false;
      }

      const supportedNetworks = ['Visa', 'MasterCard', 'American Express', 'Discover'];
      const isNetworkSupported = supportedNetworks.includes(paymentData.paymentMethod.network);

      logger.info('Apple Pay payment validation', {
        network: paymentData.paymentMethod.network,
        type: paymentData.paymentMethod.type,
        isValid: hasRequiredFields && isNetworkSupported
      });

      return hasRequiredFields && isNetworkSupported;
    } catch (error) {
      logger.error('Failed to validate Apple Pay payment', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return false;
    }
  }
}
