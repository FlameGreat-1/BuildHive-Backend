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

export class ApplePayService {
  private paymentRepository: PaymentRepository;
  private paymentMethodRepository: PaymentMethodRepository;
  private stripeService: StripeService;

  constructor() {
    this.initializeRepositories();
    this.stripeService = new StripeService();
  }

  private async initializeRepositories(): Promise<void> {
    const dbConnection = await getDbConnection();
    this.paymentRepository = new PaymentRepository(dbConnection);
    this.paymentMethodRepository = new PaymentMethodRepository(dbConnection);
  }

  async createApplePaySession(
    request: ApplePaySessionRequest,
    requestId: string
  ): Promise<ApplePaySessionResponse> {
    try {
      if (!validatePaymentAmount(request.amount, request.currency)) {
        throw new Error('Invalid payment amount for Apple Pay');
      }

      if (!validateCurrency(request.currency)) {
        throw new Error('Unsupported currency for Apple Pay');
      }

      const processingFee = calculateProcessingFee(request.amount, request.currency);
      const totalAmount = request.amount + processingFee;

      const applePaySession = {
        countryCode: request.countryCode || 'US',
        currencyCode: request.currency.toUpperCase(),
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
        totalAmount,
        requestId
      });

      return {
        session: applePaySession,
        merchantIdentifier: process.env.APPLE_PAY_MERCHANT_ID || '',
        domainName: process.env.APPLE_PAY_DOMAIN || '',
        displayName: request.merchantName || 'BuildHive'
      };
    } catch (error) {
      logger.error('Failed to create Apple Pay session', {
        amount: request.amount,
        currency: request.currency,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      throw error;
    }
  }

  async validateApplePayMerchant(
    request: ApplePayValidationRequest,
    requestId: string
  ): Promise<ApplePayValidationResponse> {
    try {
      const validationUrl = request.validationURL;
      const merchantIdentifier = process.env.APPLE_PAY_MERCHANT_ID;
      const domainName = process.env.APPLE_PAY_DOMAIN;
      const displayName = request.displayName || 'BuildHive';

      if (!merchantIdentifier || !domainName) {
        throw new Error('Apple Pay merchant configuration missing');
      }

      const validationData = {
        merchantIdentifier,
        domainName,
        displayName
      };

      const response = await fetch(validationUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(validationData)
      });

      if (!response.ok) {
        throw new Error(`Apple Pay validation failed: ${response.statusText}`);
      }

      const merchantSession = await response.json();

      logger.info('Apple Pay merchant validated', {
        merchantIdentifier,
        domainName,
        requestId
      });

      return {
        merchantSession,
        success: true
      };
    } catch (error) {
      logger.error('Failed to validate Apple Pay merchant', {
        validationURL: request.validationURL,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      return {
        merchantSession: null,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async processApplePayPayment(
    request: ApplePayPaymentRequest,
    requestId: string
  ): Promise<ApplePayPaymentResponse> {
    try {
      const { paymentData, amount, currency, userId, paymentType } = request;

      if (!validatePaymentAmount(amount, currency)) {
        throw new Error('Invalid payment amount');
      }

      const sanitizedMetadata = sanitizePaymentMetadata({
        userId: userId.toString(),
        paymentType,
        applePayTransaction: paymentData.transactionIdentifier,
        ...request.metadata
      });

      const stripePaymentIntent = await this.stripeService.createPaymentIntent({
        amount,
        currency,
        paymentMethod: PAYMENT_CONSTANTS.PAYMENT_METHODS.APPLE_PAY,
        paymentType,
        description: request.description,
        metadata: sanitizedMetadata,
        automaticPaymentMethods: true
      }, requestId);

      const confirmResult = await this.stripeService.confirmPaymentIntent({
        paymentIntentId: stripePaymentIntent.paymentIntentId,
        paymentMethodId: undefined,
        returnUrl: request.returnUrl
      }, requestId);

      await this.paymentRepository.createPayment({
        userId,
        amount,
        currency,
        status: confirmResult.status,
        paymentMethod: PAYMENT_CONSTANTS.PAYMENT_METHODS.APPLE_PAY,
        paymentType,
        stripePaymentIntentId: stripePaymentIntent.paymentIntentId,
        processingFee: stripePaymentIntent.processingFee,
        metadata: sanitizedMetadata
      }, requestId);

      logger.info('Apple Pay payment processed', {
        paymentIntentId: stripePaymentIntent.paymentIntentId,
        amount,
        currency,
        status: confirmResult.status,
        userId,
        requestId
      });

      return {
        paymentIntentId: stripePaymentIntent.paymentIntentId,
        status: confirmResult.status,
        transactionId: paymentData.transactionIdentifier,
        amount,
        currency,
        processingFee: stripePaymentIntent.processingFee,
        requiresAction: confirmResult.requiresAction,
        error: confirmResult.error
      };
    } catch (error) {
      logger.error('Failed to process Apple Pay payment', {
        amount: request.amount,
        currency: request.currency,
        userId: request.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      throw error;
    }
  }

  async verifyApplePayDomain(domain: string, requestId: string): Promise<boolean> {
    try {
      const allowedDomains = process.env.APPLE_PAY_ALLOWED_DOMAINS?.split(',') || [];
      const isAllowed = allowedDomains.includes(domain);

      logger.info('Apple Pay domain verification', {
        domain,
        isAllowed,
        requestId
      });

      return isAllowed;
    } catch (error) {
      logger.error('Failed to verify Apple Pay domain', {
        domain,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      return false;
    }
  }

  async getApplePayCapabilities(requestId: string): Promise<any> {
    try {
      const capabilities = {
        supportedNetworks: ['visa', 'masterCard', 'amex', 'discover'],
        merchantCapabilities: ['supports3DS', 'supportsCredit', 'supportsDebit'],
        supportedCountries: PAYMENT_CONSTANTS.APPLE_PAY.SUPPORTED_COUNTRIES,
        supportedCurrencies: PAYMENT_CONSTANTS.STRIPE.CURRENCY.SUPPORTED
      };

      logger.info('Apple Pay capabilities retrieved', {
        supportedNetworks: capabilities.supportedNetworks.length,
        supportedCountries: capabilities.supportedCountries.length,
        requestId
      });

      return capabilities;
    } catch (error) {
      logger.error('Failed to get Apple Pay capabilities', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      throw error;
    }
  }
}
