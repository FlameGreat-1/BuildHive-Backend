import { PAYMENT_CONSTANTS } from '../../config/payment';
import { logger } from '../../shared/utils';
import { PaymentMethodRepository, PaymentRepository } from '../repositories';
import { getDbConnection } from '../../shared/database';
import { 
  CreatePaymentMethodRequest,
  CreatePaymentMethodResponse,
  AttachPaymentMethodRequest,
  AttachPaymentMethodResponse,
  DetachPaymentMethodRequest,
  DetachPaymentMethodResponse,
  SetDefaultPaymentMethodRequest,
  SetDefaultPaymentMethodResponse,
  PaymentMethodListRequest,
  PaymentMethodListResponse
} from '../types';
import { 
  sanitizePaymentMetadata
} from '../utils';
import { StripeService } from './stripe.service';

export class PaymentMethodService {
  private paymentMethodRepository: PaymentMethodRepository;
  private paymentRepository: PaymentRepository;
  private stripeService: StripeService;

  constructor() {
    this.initializeRepositories();
    this.stripeService = new StripeService();
  }

  private async initializeRepositories(): Promise<void> {
    const dbConnection = await getDbConnection();
    this.paymentMethodRepository = new PaymentMethodRepository(dbConnection);
    this.paymentRepository = new PaymentRepository(dbConnection);
  }

  async createPaymentMethod(
    request: CreatePaymentMethodRequest,
    requestId: string
  ): Promise<CreatePaymentMethodResponse> {
    try {
      const stripePaymentMethod = await this.stripeService.createPaymentMethod(
        request,
        requestId
      );

      const paymentMethodData = {
        userId: parseInt(request.metadata?.userId || '0'),
        type: request.type,
        stripePaymentMethodId: stripePaymentMethod.paymentMethodId,
        isDefault: false,
        cardBrand: stripePaymentMethod.card?.brand,
        cardLast4: stripePaymentMethod.card?.last4,
        cardExpMonth: stripePaymentMethod.card?.expMonth,
        cardExpYear: stripePaymentMethod.card?.expYear,
        billingDetails: request.billingDetails,
        metadata: sanitizePaymentMetadata(request.metadata || {})
      };

      const savedPaymentMethod = await this.paymentMethodRepository.createPaymentMethod(
        paymentMethodData,
        requestId
      );

      logger.info('Payment method created', {
        paymentMethodId: savedPaymentMethod.id,
        stripePaymentMethodId: stripePaymentMethod.paymentMethodId,
        type: request.type,
        userId: paymentMethodData.userId,
        requestId
      });

      return {
        id: savedPaymentMethod.id,
        paymentMethodId: stripePaymentMethod.paymentMethodId,
        type: request.type,
        card: stripePaymentMethod.card,
        isDefault: false,
        createdAt: savedPaymentMethod.created_at
      };
    } catch (error) {
      logger.error('Failed to create payment method', {
        type: request.type,
        userId: request.metadata?.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      throw error;
    }
  }

  async attachPaymentMethod(
    request: AttachPaymentMethodRequest,
    requestId: string
  ): Promise<AttachPaymentMethodResponse> {
    try {
      const stripePaymentMethod = await this.stripeService.attachPaymentMethod(
        request.paymentMethodId,
        request.customerId,
        requestId
      );

      const paymentMethod = await this.paymentMethodRepository.getPaymentMethodByStripeId(
        request.paymentMethodId,
        requestId
      );

      if (paymentMethod) {
        await this.paymentMethodRepository.updatePaymentMethod(
          paymentMethod.id,
          { isAttached: true },
          requestId
        );
      }

      logger.info('Payment method attached', {
        paymentMethodId: request.paymentMethodId,
        customerId: request.customerId,
        requestId
      });

      return {
        paymentMethodId: request.paymentMethodId,
        customerId: request.customerId,
        attached: true,
        attachedAt: new Date()
      };
    } catch (error) {
      logger.error('Failed to attach payment method', {
        paymentMethodId: request.paymentMethodId,
        customerId: request.customerId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      throw error;
    }
  }

  async detachPaymentMethod(
    request: DetachPaymentMethodRequest,
    requestId: string
  ): Promise<DetachPaymentMethodResponse> {
    try {
      const paymentMethod = await this.paymentMethodRepository.getPaymentMethodByStripeId(
        request.paymentMethodId,
        requestId
      );

      if (!paymentMethod) {
        throw new Error('Payment method not found');
      }

      if (paymentMethod.is_default) {
        throw new Error('Cannot detach default payment method');
      }

      await this.stripeService.detachPaymentMethod(request.paymentMethodId, requestId);

      await this.paymentMethodRepository.updatePaymentMethod(
        paymentMethod.id,
        { isAttached: false },
        requestId
      );

      logger.info('Payment method detached', {
        paymentMethodId: request.paymentMethodId,
        paymentMethodDbId: paymentMethod.id,
        requestId
      });

      return {
        paymentMethodId: request.paymentMethodId,
        detached: true,
        detachedAt: new Date()
      };
    } catch (error) {
      logger.error('Failed to detach payment method', {
        paymentMethodId: request.paymentMethodId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      throw error;
    }
  }

  async setDefaultPaymentMethod(
    request: SetDefaultPaymentMethodRequest,
    requestId: string
  ): Promise<SetDefaultPaymentMethodResponse> {
    try {
      const paymentMethod = await this.paymentMethodRepository.getPaymentMethodById(
        request.paymentMethodId,
        requestId
      );

      if (!paymentMethod) {
        throw new Error('Payment method not found');
      }

      if (paymentMethod.user_id !== request.userId) {
        throw new Error('Payment method does not belong to user');
      }

      await this.paymentMethodRepository.clearDefaultPaymentMethods(
        request.userId,
        requestId
      );

      await this.paymentMethodRepository.updatePaymentMethod(
        request.paymentMethodId,
        { isDefault: true },
        requestId
      );

      logger.info('Default payment method set', {
        paymentMethodId: request.paymentMethodId,
        userId: request.userId,
        requestId
      });

      return {
        paymentMethodId: request.paymentMethodId,
        userId: request.userId,
        isDefault: true,
        updatedAt: new Date()
      };
    } catch (error) {
      logger.error('Failed to set default payment method', {
        paymentMethodId: request.paymentMethodId,
        userId: request.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      throw error;
    }
  }

  async getUserPaymentMethods(
    request: PaymentMethodListRequest,
    requestId: string
  ): Promise<PaymentMethodListResponse> {
    try {
      const paymentMethods = await this.paymentMethodRepository.getUserPaymentMethods(
        request.userId,
        request.limit,
        request.offset,
        requestId
      );

      const totalCount = await this.paymentMethodRepository.getUserPaymentMethodsCount(
        request.userId,
        requestId
      );

      logger.info('User payment methods retrieved', {
        userId: request.userId,
        count: paymentMethods.length,
        totalCount,
        requestId
      });

      return {
        paymentMethods: paymentMethods.map(pm => ({
          id: pm.id,
          type: pm.type,
          stripePaymentMethodId: pm.stripe_payment_method_id,
          isDefault: pm.is_default,
          cardBrand: pm.card_brand,
          cardLast4: pm.card_last4,
          cardExpMonth: pm.card_exp_month,
          cardExpYear: pm.card_exp_year,
          billingDetails: pm.billing_details,
          createdAt: pm.created_at,
          updatedAt: pm.updated_at
        })),
        totalCount,
        hasMore: (request.offset || 0) + paymentMethods.length < totalCount
      };
    } catch (error) {
      logger.error('Failed to get user payment methods', {
        userId: request.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      throw error;
    }
  }

  async deletePaymentMethod(paymentMethodId: number, userId: number, requestId: string): Promise<void> {
    try {
      const paymentMethod = await this.paymentMethodRepository.getPaymentMethodById(
        paymentMethodId,
        requestId
      );

      if (!paymentMethod) {
        throw new Error('Payment method not found');
      }

      if (paymentMethod.user_id !== userId) {
        throw new Error('Payment method does not belong to user');
      }

      if (paymentMethod.is_default) {
        throw new Error('Cannot delete default payment method');
      }

      const hasActivePayments = await this.paymentRepository.hasActivePaymentsWithMethod(
        paymentMethod.stripe_payment_method_id,
        requestId
      );

      if (hasActivePayments) {
        throw new Error('Cannot delete payment method with active payments');
      }

      if (paymentMethod.stripe_payment_method_id) {
        try {
          await this.stripeService.detachPaymentMethod(
            paymentMethod.stripe_payment_method_id,
            requestId
          );
        } catch (error) {
          logger.warn('Failed to detach payment method from Stripe', {
            paymentMethodId,
            stripePaymentMethodId: paymentMethod.stripe_payment_method_id,
            error: error instanceof Error ? error.message : 'Unknown error',
            requestId
          });
        }
      }

      await this.paymentMethodRepository.deletePaymentMethod(paymentMethodId, requestId);

      logger.info('Payment method deleted', {
        paymentMethodId,
        userId,
        stripePaymentMethodId: paymentMethod.stripe_payment_method_id,
        requestId
      });
    } catch (error) {
      logger.error('Failed to delete payment method', {
        paymentMethodId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      throw error;
    }
  }

  async getDefaultPaymentMethod(userId: number, requestId: string): Promise<any> {
    try {
      const defaultPaymentMethod = await this.paymentMethodRepository.getDefaultPaymentMethod(
        userId,
        requestId
      );

      if (!defaultPaymentMethod) {
        return null;
      }

      logger.info('Default payment method retrieved', {
        userId,
        paymentMethodId: defaultPaymentMethod.id,
        requestId
      });

      return {
        id: defaultPaymentMethod.id,
        type: defaultPaymentMethod.type,
        stripePaymentMethodId: defaultPaymentMethod.stripe_payment_method_id,
        cardBrand: defaultPaymentMethod.card_brand,
        cardLast4: defaultPaymentMethod.card_last4,
        cardExpMonth: defaultPaymentMethod.card_exp_month,
        cardExpYear: defaultPaymentMethod.card_exp_year,
        billingDetails: defaultPaymentMethod.billing_details,
        createdAt: defaultPaymentMethod.created_at
      };
    } catch (error) {
      logger.error('Failed to get default payment method', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      throw error;
    }
  }
}
