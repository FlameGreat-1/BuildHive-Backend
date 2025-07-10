import { DatabaseClient, DatabaseTransaction, PaymentMethodDatabaseRecord, PaymentMethod } from '../../shared/types';
import { PaymentMethodModel } from '../models';
import { logger } from '../../shared/utils';

export class PaymentMethodRepository {
  private paymentMethodModel: PaymentMethodModel;

  constructor(client: DatabaseClient) {
    this.paymentMethodModel = new PaymentMethodModel(client);
  }

  async createPaymentMethod(
    paymentMethodData: Omit<PaymentMethodDatabaseRecord, 'id' | 'created_at' | 'updated_at'>,
    requestId: string,
    transaction?: DatabaseTransaction
  ): Promise<PaymentMethodDatabaseRecord> {
    try {
      const paymentMethod = await this.paymentMethodModel.create(paymentMethodData, transaction);
      
      logger.info('Payment method created successfully', {
        paymentMethodId: paymentMethod.id,
        userId: paymentMethod.user_id,
        type: paymentMethod.type,
        isDefault: paymentMethod.is_default,
        requestId
      });

      return paymentMethod;
    } catch (error) {
      logger.error('Failed to create payment method', {
        userId: paymentMethodData.user_id,
        type: paymentMethodData.type,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async getPaymentMethodById(
    id: number,
    requestId: string
  ): Promise<PaymentMethodDatabaseRecord | null> {
    try {
      const paymentMethod = await this.paymentMethodModel.findById(id);
      
      if (paymentMethod) {
        logger.info('Payment method retrieved successfully', {
          paymentMethodId: id,
          userId: paymentMethod.user_id,
          type: paymentMethod.type,
          requestId
        });
      }

      return paymentMethod;
    } catch (error) {
      logger.error('Failed to retrieve payment method', {
        paymentMethodId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async getPaymentMethodByStripeId(
    stripePaymentMethodId: string,
    requestId: string
  ): Promise<PaymentMethodDatabaseRecord | null> {
    try {
      const paymentMethod = await this.paymentMethodModel.findByStripePaymentMethodId(stripePaymentMethodId);
      
      if (paymentMethod) {
        logger.info('Payment method retrieved by Stripe ID', {
          paymentMethodId: paymentMethod.id,
          stripePaymentMethodId,
          requestId
        });
      }

      return paymentMethod;
    } catch (error) {
      logger.error('Failed to retrieve payment method by Stripe ID', {
        stripePaymentMethodId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async getUserPaymentMethods(
    userId: number,
    requestId: string
  ): Promise<PaymentMethodDatabaseRecord[]> {
    try {
      const paymentMethods = await this.paymentMethodModel.findByUserId(userId);
      
      logger.info('User payment methods retrieved', {
        userId,
        count: paymentMethods.length,
        requestId
      });

      return paymentMethods;
    } catch (error) {
      logger.error('Failed to retrieve user payment methods', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async getUserDefaultPaymentMethod(
    userId: number,
    requestId: string
  ): Promise<PaymentMethodDatabaseRecord | null> {
    try {
      const paymentMethod = await this.paymentMethodModel.findDefaultByUserId(userId);
      
      if (paymentMethod) {
        logger.info('User default payment method retrieved', {
          userId,
          paymentMethodId: paymentMethod.id,
          type: paymentMethod.type,
          requestId
        });
      }

      return paymentMethod;
    } catch (error) {
      logger.error('Failed to retrieve user default payment method', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async setDefaultPaymentMethod(
    id: number,
    userId: number,
    requestId: string,
    transaction?: DatabaseTransaction
  ): Promise<PaymentMethodDatabaseRecord> {
    try {
      const paymentMethod = await this.paymentMethodModel.setAsDefault(id, userId, transaction);
      
      logger.info('Payment method set as default', {
        paymentMethodId: id,
        userId,
        requestId
      });

      return paymentMethod;
    } catch (error) {
      logger.error('Failed to set payment method as default', {
        paymentMethodId: id,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async updatePaymentMethodCardDetails(
    id: number,
    cardDetails: {
      card_last_four?: string;
      card_brand?: string;
      card_exp_month?: number;
      card_exp_year?: number;
    },
    requestId: string,
    transaction?: DatabaseTransaction
  ): Promise<PaymentMethodDatabaseRecord> {
    try {
      const paymentMethod = await this.paymentMethodModel.updateCardDetails(id, cardDetails, transaction);
      
      logger.info('Payment method card details updated', {
        paymentMethodId: id,
        requestId
      });

      return paymentMethod;
    } catch (error) {
      logger.error('Failed to update payment method card details', {
        paymentMethodId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async deletePaymentMethod(
    id: number,
    userId: number,
    requestId: string,
    transaction?: DatabaseTransaction
  ): Promise<boolean> {
    try {
      const deleted = await this.paymentMethodModel.delete(id, userId, transaction);
      
      if (deleted) {
        logger.info('Payment method deleted successfully', {
          paymentMethodId: id,
          userId,
          requestId
        });
      }

      return deleted;
    } catch (error) {
      logger.error('Failed to delete payment method', {
        paymentMethodId: id,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async getPaymentMethodsByType(
    userId: number,
    type: PaymentMethod,
    requestId: string
  ): Promise<PaymentMethodDatabaseRecord[]> {
    try {
      const paymentMethods = await this.paymentMethodModel.findByType(userId, type);
      
      logger.info('Payment methods retrieved by type', {
        userId,
        type,
        count: paymentMethods.length,
        requestId
      });

      return paymentMethods;
    } catch (error) {
      logger.error('Failed to retrieve payment methods by type', {
        userId,
        type,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async getUserPaymentMethodCount(userId: number, requestId: string): Promise<number> {
    try {
      const count = await this.paymentMethodModel.countByUserId(userId);
      
      logger.info('User payment method count retrieved', {
        userId,
        count,
        requestId
      });

      return count;
    } catch (error) {
      logger.error('Failed to retrieve user payment method count', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async getExpiredCards(userId: number | undefined, requestId: string): Promise<PaymentMethodDatabaseRecord[]> {
    try {
      const expiredCards = await this.paymentMethodModel.findExpiredCards(userId);
      
      logger.info('Expired cards retrieved', {
        userId,
        count: expiredCards.length,
        requestId
      });

      return expiredCards;
    } catch (error) {
      logger.error('Failed to retrieve expired cards', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }
}
