import { PAYMENT_CONSTANTS } from '../../config/payment';
import { logger } from '../../shared/utils';
import { PaymentRepository, PaymentMethodRepository } from '../repositories';
import { getDbConnection } from '../../shared/database';
import { 
  GooglePayTokenRequest,
  GooglePayTokenResponse,
  GooglePayPaymentRequest,
  GooglePayPaymentResponse,
  GooglePayConfigRequest,
  GooglePayConfigResponse
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

export class GooglePayService {
  private paymentRepository: PaymentRepository;
  private paymentMethodRepository: PaymentMethodRepository;
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

  async getGooglePayConfig(
    request: GooglePayConfigRequest,
    requestId: string
  ): Promise<GooglePayConfigResponse> {
    try {
      const amount = request.amount || 0;
      const currency = request.currency || 'USD';

      if (amount > 0 && !validatePaymentAmount(amount, currency)) {
        throw new Error('Invalid payment amount for Google Pay');
      }

      if (!validateCurrency(currency)) {
        throw new Error('Unsupported currency for Google Pay');
      }

      const processingFee = amount > 0 ? calculateProcessingFee(amount, currency) : 0;
      const totalAmount = amount + processingFee;

      const googlePayConfig = {
        merchantId: process.env.GOOGLE_PAY_MERCHANT_ID || '',
        environment: process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'TEST',
        apiVersion: 2,
        apiVersionMinor: 0,
        allowedPaymentMethods: [{
          type: 'CARD',
          parameters: {
            allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
            allowedCardNetworks: ['AMEX', 'DISCOVER', 'MASTERCARD', 'VISA']
          },
          tokenizationSpecification: {
            type: 'PAYMENT_GATEWAY',
            parameters: {
              gateway: 'stripe',
              gatewayMerchantId: process.env.STRIPE_PUBLISHABLE_KEY || ''
            }
          }
        }],
        merchantInfo: {
          merchantName: request.merchantName || 'BuildHive'
        },
        transactionInfo: amount > 0 ? {
          totalPriceStatus: 'FINAL',
          totalPrice: (totalAmount / 100).toFixed(2),
          currencyCode: currency.toUpperCase(),
          displayItems: [
            {
              label: request.description || 'Payment',
              type: 'LINE_ITEM',
              price: (amount / 100).toFixed(2)
            },
            {
              label: 'Processing Fee',
              type: 'LINE_ITEM',
              price: (processingFee / 100).toFixed(2)
            }
          ]
        } : {
          totalPriceStatus: 'NOT_CURRENTLY_KNOWN',
          currencyCode: currency.toUpperCase()
        }
      };

      logger.info('Google Pay config generated', {
        amount,
        currency,
        processingFee,
        totalAmount,
        environment: googlePayConfig.environment,
        requestId
      });

      return {
        merchantId: googlePayConfig.merchantId,
        merchantName: request.merchantName || 'BuildHive',
        environment: googlePayConfig.environment,
        apiVersion: googlePayConfig.apiVersion,
        apiVersionMinor: googlePayConfig.apiVersionMinor,
        allowedPaymentMethods: googlePayConfig.allowedPaymentMethods,
        merchantInfo: googlePayConfig.merchantInfo,
        transactionInfo: googlePayConfig.transactionInfo
      };
    } catch (error) {
      logger.error('Failed to generate Google Pay config', {
        amount: request.amount,
        currency: request.currency,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      throw error;
    }
  }

  async createGooglePayToken(
    request: GooglePayTokenRequest,
    requestId: string
  ): Promise<GooglePayTokenResponse> {
    try {
      if (!request.paymentToken) {
        throw new Error('Google Pay payment token is required');
      }

      if (!validatePaymentAmount(request.amount, request.currency)) {
        throw new Error('Invalid payment amount');
      }

      const isValidToken = await this.validateGooglePayToken(request.paymentToken, requestId);
      
      if (!isValidToken) {
        throw new Error('Invalid Google Pay token');
      }

      const stripeToken = await this.stripeService.createTokenFromGooglePay(
        request.paymentToken,
        requestId
      );

      logger.info('Google Pay token created', {
        amount: request.amount,
        currency: request.currency,
        stripeTokenId: stripeToken.id,
        requestId
      });

      return {
        token: stripeToken.id,
        paymentMethod: stripeToken.card,
        success: true
      };
    } catch (error) {
      logger.error('Failed to create Google Pay token', {
        amount: request.amount,
        currency: request.currency,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      return {
        token: '',
        paymentMethod: null,
        success: false
      };
    }
  }

  async processGooglePayPayment(
    request: GooglePayPaymentRequest,
    requestId: string
  ): Promise<GooglePayPaymentResponse> {
    try {
      const { paymentToken, amount, currency, userId, paymentType, description, metadata, returnUrl } = request;

      if (!validatePaymentAmount(amount, currency)) {
        throw new Error('Invalid payment amount');
      }

      if (!paymentToken) {
        throw new Error('Google Pay payment token is required');
      }

      const isValidToken = await this.validateGooglePayToken(paymentToken, requestId);
      
      if (!isValidToken) {
        throw new Error('Invalid Google Pay token');
      }

      const sanitizedMetadata = sanitizePaymentMetadata({
        userId: (userId || 1).toString(),
        paymentType: paymentType || PaymentType.ONE_TIME,
        googlePayToken: typeof paymentToken === 'string' ? paymentToken : JSON.stringify(paymentToken),
        ...metadata
      });

      const processingFee = calculateProcessingFee(amount, currency);

      const stripePaymentIntent = await this.stripeService.createPaymentIntent({
        amount,
        currency,
        paymentMethod: PaymentMethod.GOOGLE_PAY,
        paymentType: (paymentType as PaymentType) || PaymentType.ONE_TIME,
        description: description || 'Google Pay Payment',
        metadata: sanitizedMetadata,
        automaticPaymentMethods: true,
        userId: userId || 1,
        returnUrl
      }, requestId);

      const confirmResult = await this.stripeService.confirmPaymentIntent({
        paymentIntentId: stripePaymentIntent.paymentIntentId,
        paymentMethodId: undefined,
        returnUrl
      }, requestId);

      const paymentData: Omit<PaymentDatabaseRecord, 'id' | 'created_at' | 'updated_at'> = {
        user_id: userId || 1,
        stripe_payment_intent_id: stripePaymentIntent.paymentIntentId,
        amount,
        currency,
        payment_method: PaymentMethod.GOOGLE_PAY,
        payment_type: (paymentType as PaymentType) || PaymentType.ONE_TIME,
        status: confirmResult.status as PaymentStatus,
        description: description || 'Google Pay Payment',
        metadata: sanitizedMetadata,
        invoice_id: null,
        subscription_id: null,
        credits_purchased: null,
        stripe_fee: null,
        platform_fee: null,
        processing_fee: processingFee,
        failure_reason: confirmResult.error || null,
        net_amount: amount - processingFee,
        processed_at: confirmResult.status === PaymentStatus.SUCCEEDED ? new Date() : null
      };

      const savedPayment = await this.paymentRepository.create(paymentData);

      logger.info('Google Pay payment processed', {
        paymentId: savedPayment.id,
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
        transactionId: savedPayment.id.toString(),
        amount,
        currency,
        clientSecret: stripePaymentIntent.clientSecret,
        processingFee,
        requiresAction: confirmResult.requiresAction,
        nextAction: confirmResult.nextAction,
        success: confirmResult.status === PaymentStatus.SUCCEEDED
      };
    } catch (error) {
      logger.error('Failed to process Google Pay payment', {
        amount: request.amount,
        currency: request.currency,
        userId: request.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      throw error;
    }
  }

  async validateGooglePayToken(
    token: string | any,
    requestId: string
  ): Promise<boolean> {
    try {
      if (!token) {
        return false;
      }

      let tokenData: any;

      if (typeof token === 'string') {
        try {
          tokenData = JSON.parse(token);
        } catch {
          return false;
        }
      } else {
        tokenData = token;
      }

      const requiredFields = ['signature', 'protocolVersion', 'signedMessage'];
      const hasRequiredFields = requiredFields.every(field => 
        tokenData[field] !== undefined && tokenData[field] !== null
      );

      if (!hasRequiredFields) {
        return false;
      }

      const isValidProtocolVersion = ['ECv1', 'ECv2'].includes(tokenData.protocolVersion);

      logger.info('Google Pay token validation', {
        isValid: hasRequiredFields && isValidProtocolVersion,
        hasSignature: !!tokenData.signature,
        protocolVersion: tokenData.protocolVersion,
        hasSignedMessage: !!tokenData.signedMessage,
        requestId
      });

      return hasRequiredFields && isValidProtocolVersion;
    } catch (error) {
      logger.error('Failed to validate Google Pay token', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      return false;
    }
  }

  async getGooglePayCapabilities(requestId: string): Promise<{
    supportedNetworks: string[];
    supportedAuthMethods: string[];
    supportedCountries: string[];
    supportedCurrencies: string[];
    merchantId: string;
    environment: string;
  }> {
    try {
      const capabilities = {
        supportedNetworks: ['AMEX', 'DISCOVER', 'MASTERCARD', 'VISA'],
        supportedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
        supportedCountries: PAYMENT_CONSTANTS.GOOGLE_PAY?.SUPPORTED_COUNTRIES || ['US', 'CA', 'GB', 'AU'],
        supportedCurrencies: PAYMENT_CONSTANTS.STRIPE?.CURRENCY?.SUPPORTED || ['USD', 'EUR', 'GBP', 'AUD'],
        merchantId: process.env.GOOGLE_PAY_MERCHANT_ID || '',
        environment: process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'TEST'
      };

      logger.info('Google Pay capabilities retrieved', {
        supportedNetworks: capabilities.supportedNetworks.length,
        supportedCountries: capabilities.supportedCountries.length,
        supportedCurrencies: capabilities.supportedCurrencies.length,
        environment: capabilities.environment,
        requestId
      });

      return capabilities;
    } catch (error) {
      logger.error('Failed to get Google Pay capabilities', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      throw error;
    }
  }

  async createGooglePayPaymentMethod(
    userId: number,
    googlePayData: any,
    requestId: string
  ): Promise<{ id: number; stripePaymentMethodId: string }> {
    try {
      const stripePaymentMethod = await this.stripeService.createPaymentMethodFromGooglePay(
        googlePayData,
        requestId
      );

      const paymentMethodData = {
        user_id: userId,
        stripe_payment_method_id: stripePaymentMethod.id,
        type: PaymentMethod.GOOGLE_PAY,
        card_last_four: null,
        card_brand: null,
        card_exp_month: null,
        card_exp_year: null,
        is_default: false
      };

      const savedPaymentMethod = await this.paymentMethodRepository.create(paymentMethodData);

      logger.info('Google Pay payment method created', {
        paymentMethodId: savedPaymentMethod.id,
        stripePaymentMethodId: stripePaymentMethod.id,
        userId,
        requestId
      });

      return {
        id: savedPaymentMethod.id,
        stripePaymentMethodId: stripePaymentMethod.id
      };
    } catch (error) {
      logger.error('Failed to create Google Pay payment method', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      throw error;
    }
  }

  async isGooglePayAvailable(
    countryCode: string,
    currency: string,
    requestId: string
  ): Promise<boolean> {
    try {
      const supportedCountries = PAYMENT_CONSTANTS.GOOGLE_PAY?.SUPPORTED_COUNTRIES || ['US', 'CA', 'GB', 'AU'];
      const supportedCurrencies = PAYMENT_CONSTANTS.STRIPE?.CURRENCY?.SUPPORTED || ['USD', 'EUR', 'GBP', 'AUD'];

      const isCountrySupported = supportedCountries.includes(countryCode.toUpperCase());
      const isCurrencySupported = supportedCurrencies.includes(currency.toUpperCase());
      const isAvailable = isCountrySupported && isCurrencySupported;

      logger.info('Google Pay availability check', {
        countryCode,
        currency,
        isCountrySupported,
        isCurrencySupported,
        isAvailable,
        requestId
      });

      return isAvailable;
    } catch (error) {
      logger.error('Failed to check Google Pay availability', {
        countryCode,
        currency,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      return false;
    }
  }
}
