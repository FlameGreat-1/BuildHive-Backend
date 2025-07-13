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

  async getGooglePayConfig(request: GooglePayConfigRequest): Promise<GooglePayConfigResponse> {
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
        environment: googlePayConfig.environment
      });

      return {
        merchantId: googlePayConfig.merchantId,
        merchantName: request.merchantName || 'BuildHive',
        environment: googlePayConfig.environment,
        apiVersionMinor: googlePayConfig.apiVersionMinor,
        allowedPaymentMethods: googlePayConfig.allowedPaymentMethods,
        merchantInfo: googlePayConfig.merchantInfo,
        transactionInfo: googlePayConfig.transactionInfo
      };
    } catch (error) {
      logger.error('Failed to generate Google Pay config', {
        amount: request.amount,
        currency: request.currency,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async createGooglePayToken(request: GooglePayTokenRequest): Promise<GooglePayTokenResponse> {
    try {
      if (!request.paymentToken) {
        throw new Error('Google Pay payment token is required');
      }

      if (!validatePaymentAmount(request.amount, request.currency)) {
        throw new Error('Invalid payment amount');
      }

      const isValidToken = await this.validateGooglePayToken(request.paymentToken);
      
      if (!isValidToken) {
        throw new Error('Invalid Google Pay token');
      }

      const stripeToken = await this.stripeService.createTokenFromGooglePay(request.paymentToken);

      logger.info('Google Pay token created', {
        amount: request.amount,
        currency: request.currency,
        stripeTokenId: stripeToken.id
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
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        token: '',
        paymentMethod: null,
        success: false
      };
    }
  }

  async processGooglePayPayment(request: GooglePayPaymentRequest): Promise<GooglePayPaymentResponse> {
    try {
      const { paymentToken, amount, currency, userId, paymentType, description, metadata, returnUrl } = request;

      if (!validatePaymentAmount(amount, currency)) {
        throw new Error('Invalid payment amount');
      }

      if (!paymentToken) {
        throw new Error('Google Pay payment token is required');
      }

      const isValidToken = await this.validateGooglePayToken(paymentToken);
      
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
        payment_method: PaymentMethod.GOOGLE_PAY,
        payment_type: (paymentType as PaymentType) || PaymentType.ONE_TIME,
        status: confirmResult.status as PaymentStatus,
        description: description || 'Google Pay Payment',
        metadata: sanitizedMetadata,
        invoice_id: undefined,
        subscription_id: undefined,
        credits_purchased: undefined,
        stripe_fee: undefined,
        platform_fee: undefined,
        processing_fee: processingFee,
        failure_reason: confirmResult.error || undefined,
        net_amount: amount - processingFee,
        processed_at: confirmResult.status === PaymentStatus.SUCCEEDED ? new Date() : undefined
      };

      const savedPayment = await this.paymentRepository.create(dbPaymentData);

      logger.info('Google Pay payment processed', {
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
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async validateGooglePayToken(token: string | any): Promise<boolean> {
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
        hasSignedMessage: !!tokenData.signedMessage
      });

      return hasRequiredFields && isValidProtocolVersion;
    } catch (error) {
      logger.error('Failed to validate Google Pay token', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return false;
    }
  }

  async getGooglePayCapabilities(): Promise<{
    supportedNetworks: string[];
    supportedAuthMethods: string[];
    supportedCountries: string[];
    supportedCurrencies: string[];
    merchantId: string;
    environment: string;
  }> {
    try {
      const supportedCountries = ['AU', 'US', 'CA', 'GB'] as const;
      const supportedCurrencies = ['AUD', 'USD'] as const;
      
      const capabilities = {
        supportedNetworks: ['AMEX', 'DISCOVER', 'MASTERCARD', 'VISA'],
        supportedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
        supportedCountries: [...supportedCountries],
        supportedCurrencies: [...supportedCurrencies],
        merchantId: process.env.GOOGLE_PAY_MERCHANT_ID || '',
        environment: process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'TEST'
      };

      logger.info('Google Pay capabilities retrieved', {
        supportedNetworks: capabilities.supportedNetworks.length,
        supportedCountries: capabilities.supportedCountries.length,
        supportedCurrencies: capabilities.supportedCurrencies.length,
        environment: capabilities.environment
      });

      return capabilities;
    } catch (error) {
      logger.error('Failed to get Google Pay capabilities', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async createGooglePayPaymentMethod(userId: number, googlePayData: any): Promise<{ id: number; stripePaymentMethodId: string }> {
    try {
      const stripePaymentMethod = await this.stripeService.createPaymentMethodFromGooglePay(googlePayData);

      const paymentMethodData = {
        user_id: userId,
        stripe_payment_method_id: stripePaymentMethod.id,
        type: PaymentMethod.GOOGLE_PAY,
        card_last_four: undefined,
        card_brand: undefined,
        card_exp_month: undefined,
        card_exp_year: undefined,
        is_default: false
      };

      const savedPaymentMethod = await this.paymentMethodRepository.create(paymentMethodData);

      logger.info('Google Pay payment method created', {
        paymentMethodId: savedPaymentMethod.id,
        stripePaymentMethodId: stripePaymentMethod.id,
        userId
      });

      return {
        id: savedPaymentMethod.id,
        stripePaymentMethodId: stripePaymentMethod.id
      };
    } catch (error) {
      logger.error('Failed to create Google Pay payment method', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async isGooglePayAvailable(countryCode: string, currency: string): Promise<boolean> {
    try {
      const supportedCountries = ['AU', 'US', 'CA', 'GB'] as const;
      const supportedCurrencies = ['AUD', 'USD'] as const;

      const isCountrySupported = supportedCountries.includes(countryCode.toUpperCase() as any);
      const isCurrencySupported = supportedCurrencies.includes(currency.toUpperCase() as any);
      const isAvailable = isCountrySupported && isCurrencySupported;

      logger.info('Google Pay availability check', {
        countryCode,
        currency,
        isCountrySupported,
        isCurrencySupported,
        isAvailable
      });

      return isAvailable;
    } catch (error) {
      logger.error('Failed to check Google Pay availability', {
        countryCode,
        currency,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return false;
    }
  }
}
