import { PAYMENT_CONSTANTS } from '../../config/payment';
import { logger } from '../../shared/utils';
import { PaymentMethodRepository, PaymentRepository } from '../repositories';
import { getDbConnection } from '../../shared/database';
import { 
  CreatePaymentMethodRequest,
  CreatePaymentMethodResponse,
  AttachPaymentMethodRequest,
  DetachPaymentMethodRequest,
  SetDefaultPaymentMethodRequest,
  SetDefaultPaymentMethodResponse,
  PaymentMethodListRequest,
  PaymentMethodListResponse
} from '../types';
import { 
  sanitizePaymentMetadata
} from '../utils';
import { StripeService } from './stripe.service';
import { 
  PaymentMethodDatabaseRecord, 
  PaymentMethod 
} from '../../shared/types';

export interface AttachPaymentMethodResponse {
  success: boolean;
  paymentMethodId: string;
  customerId: string;
  attached: boolean;
}

export interface DetachPaymentMethodResponse {
  success: boolean;
  paymentMethodId: string;
  detached: boolean;
}

export class PaymentMethodService {
  private paymentMethodRepository!: PaymentMethodRepository;
  private paymentRepository!: PaymentRepository;
  private stripeService: StripeService;

  constructor() {
    this.stripeService = new StripeService();
    this.initializeRepositories();
  }

  private async initializeRepositories(): Promise<void> {
    const dbConnection = getDbConnection();
    this.paymentMethodRepository = new PaymentMethodRepository(dbConnection);
    this.paymentRepository = new PaymentRepository(dbConnection);
  }

  async createPaymentMethod(request: CreatePaymentMethodRequest): Promise<CreatePaymentMethodResponse> {
    try {
      const stripePaymentMethod = await this.stripeService.createPaymentMethod(request);

      const userId = parseInt(request.metadata?.userId || '0');
      
      if (!userId) {
        throw new Error('User ID is required');
      }

      const paymentMethodData: Omit<PaymentMethodDatabaseRecord, 'id' | 'created_at' | 'updated_at'> = {
        user_id: userId,
        stripe_payment_method_id: stripePaymentMethod.paymentMethodId,
        type: request.type,
        card_last_four: stripePaymentMethod.card?.last4 || undefined,
        card_brand: stripePaymentMethod.card?.brand || undefined,
        card_exp_month: stripePaymentMethod.card?.expMonth || undefined,
        card_exp_year: stripePaymentMethod.card?.expYear || undefined,
        is_default: request.setAsDefault || false
      };

      if (request.setAsDefault) {
        await this.paymentMethodRepository.setAsDefault(0, userId);
      }

      const savedPaymentMethod = await this.paymentMethodRepository.create(paymentMethodData);

      if (request.setAsDefault) {
        await this.paymentMethodRepository.setAsDefault(savedPaymentMethod.id, userId);
      }

      logger.info('Payment method created', {
        paymentMethodId: savedPaymentMethod.id,
        stripePaymentMethodId: stripePaymentMethod.paymentMethodId,
        type: request.type,
        userId,
        isDefault: request.setAsDefault
      });

      return {
        id: savedPaymentMethod.id,
        paymentMethodId: stripePaymentMethod.paymentMethodId,
        type: request.type,
        card: stripePaymentMethod.card,
        isDefault: request.setAsDefault || false,
        createdAt: savedPaymentMethod.created_at.toISOString()
      };
    } catch (error) {
      logger.error('Failed to create payment method', {
        type: request.type,
        userId: request.metadata?.userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async attachPaymentMethod(request: AttachPaymentMethodRequest): Promise<AttachPaymentMethodResponse> {
    try {
      const stripePaymentMethod = await this.stripeService.attachPaymentMethod(
        request.paymentMethodId,
        request.customerId
      );

      const paymentMethod = await this.paymentMethodRepository.findByStripePaymentMethodId(
        request.paymentMethodId
      );

      if (paymentMethod) {
        await this.paymentMethodRepository.updateCardDetails(
          paymentMethod.id,
          {
            card_last_four: stripePaymentMethod.card?.last4,
            card_brand: stripePaymentMethod.card?.brand,
            card_exp_month: stripePaymentMethod.card?.exp_month,
            card_exp_year: stripePaymentMethod.card?.exp_year
            
          }
        );
      }

      logger.info('Payment method attached', {
        paymentMethodId: request.paymentMethodId,
        customerId: request.customerId
      });

      return {
        success: true,
        paymentMethodId: request.paymentMethodId,
        customerId: request.customerId,
        attached: true
      };
    } catch (error) {
      logger.error('Failed to attach payment method', {
        paymentMethodId: request.paymentMethodId,
        customerId: request.customerId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async detachPaymentMethod(request: DetachPaymentMethodRequest): Promise<DetachPaymentMethodResponse> {
    try {
      const paymentMethod = await this.paymentMethodRepository.findByStripePaymentMethodId(
        request.paymentMethodId
      );

      if (!paymentMethod) {
        throw new Error('Payment method not found');
      }

      if (paymentMethod.is_default) {
        throw new Error('Cannot detach default payment method');
      }

      await this.stripeService.detachPaymentMethod(request.paymentMethodId);

      logger.info('Payment method detached', {
        paymentMethodId: request.paymentMethodId,
        paymentMethodDbId: paymentMethod.id
      });

      return {
        success: true,
        paymentMethodId: request.paymentMethodId,
        detached: true
      };
    } catch (error) {
      logger.error('Failed to detach payment method', {
        paymentMethodId: request.paymentMethodId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async setDefaultPaymentMethod(request: SetDefaultPaymentMethodRequest): Promise<SetDefaultPaymentMethodResponse> {
    try {
      const paymentMethod = await this.paymentMethodRepository.findById(
        request.paymentMethodId
      );

      if (!paymentMethod) {
        throw new Error('Payment method not found');
      }

      if (paymentMethod.user_id !== request.userId) {
        throw new Error('Payment method does not belong to user');
      }

      const updatedPaymentMethod = await this.paymentMethodRepository.setAsDefault(
        request.paymentMethodId,
        request.userId
      );

      logger.info('Default payment method set', {
        paymentMethodId: request.paymentMethodId,
        userId: request.userId
      });

      return {
        success: true,
        paymentMethodId: request.paymentMethodId,
        isDefault: true
      };
    } catch (error) {
      logger.error('Failed to set default payment method', {
        paymentMethodId: request.paymentMethodId,
        userId: request.userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }
  
  async getUserPaymentMethods(request: PaymentMethodListRequest): Promise<PaymentMethodListResponse> {
    try {
      const paymentMethods = await this.paymentMethodRepository.findByUserId(
        request.userId
      );

      const totalCount = await this.paymentMethodRepository.countByUserId(request.userId);

      const paginatedPaymentMethods = paymentMethods.slice(
        request.offset || 0,
        (request.offset || 0) + (request.limit || 50)
      );

      logger.info('User payment methods retrieved', {
        userId: request.userId,
        count: paginatedPaymentMethods.length,
        totalCount
      });

      return {
        paymentMethods: paginatedPaymentMethods.map(pm => ({
          id: pm.id,
          type: pm.type,
          cardLastFour: pm.card_last_four || undefined,
          cardBrand: pm.card_brand || undefined,
          cardExpMonth: pm.card_exp_month || undefined,
          cardExpYear: pm.card_exp_year || undefined,
          isDefault: pm.is_default,
          createdAt: pm.created_at.toISOString()
        })),
        totalCount,
        page: Math.floor((request.offset || 0) / (request.limit || 50)) + 1,
        limit: request.limit || 50
      };
    } catch (error) {
      logger.error('Failed to get user payment methods', {
        userId: request.userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }
  
    async deletePaymentMethod(paymentMethodId: number, userId: number): Promise<void> {
    try {
      const paymentMethod = await this.paymentMethodRepository.findById(paymentMethodId);

      if (!paymentMethod) {
        throw new Error('Payment method not found');
      }

      if (paymentMethod.user_id !== userId) {
        throw new Error('Payment method does not belong to user');
      }

      if (paymentMethod.is_default) {
        throw new Error('Cannot delete default payment method. Please set another payment method as default first.');
      }

      const hasActivePayments = await this.paymentRepository.hasPaymentsWithPaymentMethod(
        paymentMethod.stripe_payment_method_id
      );

      if (hasActivePayments) {
        throw new Error('Cannot delete payment method with active payments');
      }

      if (paymentMethod.stripe_payment_method_id) {
        try {
          await this.stripeService.detachPaymentMethod(paymentMethod.stripe_payment_method_id);
        } catch (error) {
          logger.warn('Failed to detach payment method from Stripe', {
            paymentMethodId,
            stripePaymentMethodId: paymentMethod.stripe_payment_method_id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      const deleted = await this.paymentMethodRepository.delete(paymentMethodId, userId);

      if (!deleted) {
        throw new Error('Failed to delete payment method from database');
      }

      logger.info('Payment method deleted', {
        paymentMethodId,
        userId,
        stripePaymentMethodId: paymentMethod.stripe_payment_method_id
      });
    } catch (error) {
      logger.error('Failed to delete payment method', {
        paymentMethodId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async getDefaultPaymentMethod(userId: number): Promise<any> {
    try {
      const defaultPaymentMethod = await this.paymentMethodRepository.findDefaultByUserId(userId);

      if (!defaultPaymentMethod) {
        logger.info('No default payment method found', {
          userId
        });
        return null;
      }

      logger.info('Default payment method retrieved', {
        userId,
        paymentMethodId: defaultPaymentMethod.id
      });

      return {
        id: defaultPaymentMethod.id,
        type: defaultPaymentMethod.type,
        stripePaymentMethodId: defaultPaymentMethod.stripe_payment_method_id,
        cardBrand: defaultPaymentMethod.card_brand || undefined,
        cardLastFour: defaultPaymentMethod.card_last_four || undefined,
        cardExpMonth: defaultPaymentMethod.card_exp_month || undefined,
        cardExpYear: defaultPaymentMethod.card_exp_year || undefined,
        isDefault: defaultPaymentMethod.is_default,
        createdAt: defaultPaymentMethod.created_at.toISOString(),
        updatedAt: defaultPaymentMethod.updated_at.toISOString()
      };
    } catch (error) {
      logger.error('Failed to get default payment method', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async updatePaymentMethod(
    paymentMethodId: number,
    userId: number,
    updateData: {
      cardLastFour?: string;
      cardBrand?: string;
      cardExpMonth?: number;
      cardExpYear?: number;
      isDefault?: boolean;
    }
  ): Promise<PaymentMethodDatabaseRecord> {
    try {
      const paymentMethod = await this.paymentMethodRepository.findById(paymentMethodId);

      if (!paymentMethod) {
        throw new Error('Payment method not found');
      }

      if (paymentMethod.user_id !== userId) {
        throw new Error('Payment method does not belong to user');
      }

      const mappedUpdateData: {
        card_last_four?: string;
        card_brand?: string;
        card_exp_month?: number;
        card_exp_year?: number;
      } = {};

      if (updateData.cardLastFour !== undefined) {
        mappedUpdateData.card_last_four = updateData.cardLastFour;
      }

      if (updateData.cardBrand !== undefined) {
        mappedUpdateData.card_brand = updateData.cardBrand;
      }

      if (updateData.cardExpMonth !== undefined) {
        mappedUpdateData.card_exp_month = updateData.cardExpMonth;
      }

      if (updateData.cardExpYear !== undefined) {
        mappedUpdateData.card_exp_year = updateData.cardExpYear;
      }

      let updatedPaymentMethod: PaymentMethodDatabaseRecord;

      if (updateData.isDefault) {
        updatedPaymentMethod = await this.paymentMethodRepository.setAsDefault(paymentMethodId, userId);
      } else if (Object.keys(mappedUpdateData).length > 0) {
        updatedPaymentMethod = await this.paymentMethodRepository.updateCardDetails(
          paymentMethodId,
          mappedUpdateData
        );
      } else {
        updatedPaymentMethod = paymentMethod;
      }

      logger.info('Payment method updated', {
        paymentMethodId,
        userId,
        updatedFields: Object.keys(updateData)
      });

      return updatedPaymentMethod;
    } catch (error) {
      logger.error('Failed to update payment method', {
        paymentMethodId,
        userId,
        updateData,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async getPaymentMethodById(paymentMethodId: number, userId: number): Promise<any> {
    try {
      const paymentMethod = await this.paymentMethodRepository.findById(paymentMethodId);

      if (!paymentMethod) {
        throw new Error('Payment method not found');
      }

      if (paymentMethod.user_id !== userId) {
        throw new Error('Payment method does not belong to user');
      }

      logger.info('Payment method retrieved', {
        paymentMethodId,
        userId
      });

      return {
        id: paymentMethod.id,
        type: paymentMethod.type,
        stripePaymentMethodId: paymentMethod.stripe_payment_method_id,
        cardBrand: paymentMethod.card_brand || undefined,
        cardLastFour: paymentMethod.card_last_four || undefined,
        cardExpMonth: paymentMethod.card_exp_month || undefined,
        cardExpYear: paymentMethod.card_exp_year || undefined,
        isDefault: paymentMethod.is_default,
        createdAt: paymentMethod.created_at.toISOString(),
        updatedAt: paymentMethod.updated_at.toISOString()
      };
    } catch (error) {
      logger.error('Failed to get payment method', {
        paymentMethodId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async validatePaymentMethodOwnership(paymentMethodId: number, userId: number): Promise<boolean> {
    try {
      const paymentMethod = await this.paymentMethodRepository.findById(paymentMethodId);

      if (!paymentMethod) {
        return false;
      }

      const isOwner = paymentMethod.user_id === userId;

      logger.info('Payment method ownership validated', {
        paymentMethodId,
        userId,
        isOwner
      });

      return isOwner;
    } catch (error) {
      logger.error('Failed to validate payment method ownership', {
        paymentMethodId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return false;
    }
  }

  async getExpiredPaymentMethods(userId?: number): Promise<PaymentMethodDatabaseRecord[]> {
    try {
      const expiredPaymentMethods = await this.paymentMethodRepository.findExpiredCards(userId);

      logger.info('Expired payment methods retrieved', {
        userId,
        count: expiredPaymentMethods.length
      });

      return expiredPaymentMethods;
    } catch (error) {
      logger.error('Failed to get expired payment methods', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async syncWithStripe(paymentMethodId: number): Promise<void> {
    try {
      const paymentMethod = await this.paymentMethodRepository.findById(paymentMethodId);

      if (!paymentMethod || !paymentMethod.stripe_payment_method_id) {
        throw new Error('Payment method not found or missing Stripe ID');
      }

      const stripePaymentMethod = await this.stripeService.retrievePaymentMethod(
        paymentMethod.stripe_payment_method_id
      );

      if (stripePaymentMethod.card) {
        await this.paymentMethodRepository.updateCardDetails(paymentMethodId, {
          card_last_four: stripePaymentMethod.card.last4,
          card_brand: stripePaymentMethod.card.brand,
          card_exp_month: stripePaymentMethod.card.exp_month,
          card_exp_year: stripePaymentMethod.card.exp_year
        });
      }

      logger.info('Payment method synced with Stripe', {
        paymentMethodId,
        stripePaymentMethodId: paymentMethod.stripe_payment_method_id
      });
    } catch (error) {
      logger.error('Failed to sync payment method with Stripe', {
        paymentMethodId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }
}

