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
  calculateProcessingFee
} from '../utils';
import { StripeService } from './stripe.service';

export class GooglePayService {
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

  async getGooglePayConfig(
    request: GooglePayConfigRequest,
    requestId: string
  ): Promise<GooglePayConfigResponse> {
    try {
      if (!validatePaymentAmount(request.amount, request.currency)) {
        throw new Error('Invalid payment amount for Google Pay');
      }

      if (!validateCurrency(request.currency)) {
        throw new Error('Unsupported currency for Google Pay');
      }

      const processingFee = calculateProcessingFee(request.amount, request.currency);
      const totalAmount = request.amount + processingFee;

      const googlePayConfig = {
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
              gatewayMerchantId: process.env.STRIPE_PUBLISHABLE_KEY
            }
          }
        }],
        merchantInfo: {
          merchantId: process.env.GOOGLE_PAY_MERCHANT_ID,
          merchantName: request.merchantName || 'BuildHive'
        },
        transactionInfo: {
          totalPriceStatus: 'FINAL',
          totalPrice: (totalAmount / 100).toFixed(2),
          currencyCode: request.currency.toUpperCase(),
          displayItems: [
            {
              label: request.description || 'Payment',
              type: 'LINE_ITEM',
              price: (request.amount / 100).toFixed(2)
            },
            {
              label: 'Processing Fee',
              type: 'LINE_ITEM',
              price: (processingFee / 100).toFixed(2)
            }
          ]
        }
      };

      logger.info('Google Pay config generated', {
        amount: request.amount,
        currency: request.currency,
        processingFee,
        totalAmount,
        requestId
      });

      return {
        config: googlePayConfig,
        merchantId: process.env.GOOGLE_PAY_MERCHANT_ID || '',
        environment: process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'TEST'
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

  async processGooglePayPayment(
    request: GooglePayPaymentRequest,
    requestId: string
  ): Promise<GooglePayPaymentResponse> {
    try {
      const { paymentToken, amount, currency, userId, paymentType } = request;

      if (!validatePaymentAmount(amount, currency)) {
        throw new Error('Invalid payment amount');
      }

      const sanitizedMetadata = sanitizePaymentMetadata({
        userId: userId.toString(),
        paymentType,
        googlePayToken: paymentToken.token,
        ...request.metadata
      });

      const stripePaymentIntent = await this.stripeService.createPaymentIntent({
        amount,
        currency,
        paymentMethod: PAYMENT_CONSTANTS.PAYMENT_METHODS.GOOGLE_PAY,
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
        paymentMethod: PAYMENT_CONSTANTS.PAYMENT_METHODS.GOOGLE_PAY,
        paymentType,
        stripePaymentIntentId: stripePaymentIntent.paymentIntentId,
        processingFee: stripePaymentIntent.processingFee,
        metadata: sanitizedMetadata
      }, requestId);

      logger.info('Google Pay payment processed', {
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
        amount,
        currency,
        processingFee: stripePaymentIntent.processingFee,
        requiresAction: confirmResult.requiresAction,
        error: confirmResult.error
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
    token: string,
    requestId: string
  ): Promise<boolean> {
    try {
      if (!token || typeof token !== 'string') {
        return false;
      }

      const tokenData = JSON.parse(token);
      const isValid = tokenData.signature && tokenData.protocolVersion && tokenData.signedMessage;

      logger.info('Google Pay token validation', {
        isValid,
        hasSignature: !!tokenData.signature,
        protocolVersion: tokenData.protocolVersion,
        requestId
      });

      return isValid;
    } catch (error) {
      logger.error('Failed to validate Google Pay token', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      return false;
    }
  }

  async getGooglePayCapabilities(requestId: string): Promise<any> {
    try {
      const capabilities = {
        supportedNetworks: ['AMEX', 'DISCOVER', 'MASTERCARD', 'VISA'],
        supportedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
        supportedCountries: PAYMENT_CONSTANTS.GOOGLE_PAY.SUPPORTED_COUNTRIES,
        supportedCurrencies: PAYMENT_CONSTANTS.STRIPE.CURRENCY.SUPPORTED
      };

      logger.info('Google Pay capabilities retrieved', {
        supportedNetworks: capabilities.supportedNetworks.length,
        supportedCountries: capabilities.supportedCountries.length,
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
}
