import { DatabaseClient, DatabaseTransaction, PaymentDatabaseRecord, PaymentStatus, PaymentMethod, PaymentType } from '../../shared/types';
import { PaymentModel } from '../models';
import { logger } from '../../shared/utils';
import { PaymentListFilter, PaymentSummary } from '../types';

export class PaymentRepository {
  private paymentModel: PaymentModel;

  constructor(client: DatabaseClient) {
    this.paymentModel = new PaymentModel(client);
  }

  async createPayment(
    paymentData: Omit<PaymentDatabaseRecord, 'id' | 'created_at' | 'updated_at'>,
    requestId: string,
    transaction?: DatabaseTransaction
  ): Promise<PaymentDatabaseRecord> {
    try {
      const payment = await this.paymentModel.create(paymentData, transaction);
      
      logger.info('Payment created successfully', {
        paymentId: payment.id,
        userId: payment.user_id,
        amount: payment.amount,
        paymentMethod: payment.payment_method,
        requestId
      });

      return payment;
    } catch (error) {
      logger.error('Failed to create payment', {
        userId: paymentData.user_id,
        amount: paymentData.amount,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async getPaymentById(id: number, requestId: string): Promise<PaymentDatabaseRecord | null> {
    try {
      const payment = await this.paymentModel.findById(id);
      
      if (payment) {
        logger.info('Payment retrieved successfully', {
          paymentId: id,
          userId: payment.user_id,
          requestId
        });
      }

      return payment;
    } catch (error) {
      logger.error('Failed to retrieve payment', {
        paymentId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async getPaymentByStripeIntentId(
    stripePaymentIntentId: string,
    requestId: string
  ): Promise<PaymentDatabaseRecord | null> {
    try {
      const payment = await this.paymentModel.findByStripePaymentIntentId(stripePaymentIntentId);
      
      if (payment) {
        logger.info('Payment retrieved by Stripe intent ID', {
          paymentId: payment.id,
          stripePaymentIntentId,
          requestId
        });
      }

      return payment;
    } catch (error) {
      logger.error('Failed to retrieve payment by Stripe intent ID', {
        stripePaymentIntentId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async getUserPayments(
    userId: number,
    limit: number = 50,
    offset: number = 0,
    requestId: string
  ): Promise<PaymentDatabaseRecord[]> {
    try {
      const payments = await this.paymentModel.findByUserId(userId, limit, offset);
      
      logger.info('User payments retrieved', {
        userId,
        count: payments.length,
        limit,
        offset,
        requestId
      });

      return payments;
    } catch (error) {
      logger.error('Failed to retrieve user payments', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async updatePaymentStatus(
    id: number,
    status: PaymentStatus,
    processedAt: Date | undefined,
    requestId: string,
    transaction?: DatabaseTransaction
  ): Promise<PaymentDatabaseRecord> {
    try {
      const payment = await this.paymentModel.updateStatus(id, status, processedAt, transaction);
      
      logger.info('Payment status updated', {
        paymentId: id,
        oldStatus: payment.status,
        newStatus: status,
        processedAt,
        requestId
      });

      return payment;
    } catch (error) {
      logger.error('Failed to update payment status', {
        paymentId: id,
        status,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async updatePaymentMetadata(
    id: number,
    metadata: Record<string, any>,
    requestId: string,
    transaction?: DatabaseTransaction
  ): Promise<PaymentDatabaseRecord> {
    try {
      const payment = await this.paymentModel.updateMetadata(id, metadata, transaction);
      
      logger.info('Payment metadata updated', {
        paymentId: id,
        requestId
      });

      return payment;
    } catch (error) {
      logger.error('Failed to update payment metadata', {
        paymentId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async getPaymentsByStatus(
    status: PaymentStatus,
    limit: number = 100,
    offset: number = 0,
    requestId: string
  ): Promise<PaymentDatabaseRecord[]> {
    try {
      const payments = await this.paymentModel.findByStatus(status, limit, offset);
      
      logger.info('Payments retrieved by status', {
        status,
        count: payments.length,
        requestId
      });

      return payments;
    } catch (error) {
      logger.error('Failed to retrieve payments by status', {
        status,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async getPaymentsByDateRange(
    startDate: Date,
    endDate: Date,
    userId: number | undefined,
    requestId: string
  ): Promise<PaymentDatabaseRecord[]> {
    try {
      const payments = await this.paymentModel.findByDateRange(startDate, endDate, userId);
      
      logger.info('Payments retrieved by date range', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        userId,
        count: payments.length,
        requestId
      });

      return payments;
    } catch (error) {
      logger.error('Failed to retrieve payments by date range', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async getUserTotalAmount(
    userId: number,
    status: PaymentStatus | undefined,
    requestId: string
  ): Promise<number> {
    try {
      const totalAmount = await this.paymentModel.getTotalAmountByUser(userId, status);
      
      logger.info('User total amount retrieved', {
        userId,
        status,
        totalAmount,
        requestId
      });

      return totalAmount;
    } catch (error) {
      logger.error('Failed to retrieve user total amount', {
        userId,
        status,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async getPaymentSummary(userId: number | undefined, requestId: string): Promise<PaymentSummary> {
    try {
      const stats = await this.paymentModel.getPaymentStats(userId);
      
      const summary: PaymentSummary = {
        totalPayments: stats.total_payments,
        totalAmount: stats.total_amount,
        successfulPayments: stats.successful_payments,
        failedPayments: stats.failed_payments,
        pendingPayments: stats.total_payments - stats.successful_payments - stats.failed_payments,
        averageAmount: stats.average_amount
      };

      logger.info('Payment summary retrieved', {
        userId,
        summary,
        requestId
      });

      return summary;
    } catch (error) {
      logger.error('Failed to retrieve payment summary', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async deletePayment(
    id: number,
    requestId: string,
    transaction?: DatabaseTransaction
  ): Promise<boolean> {
    try {
      const deleted = await this.paymentModel.delete(id, transaction);
      
      if (deleted) {
        logger.info('Payment deleted successfully', {
          paymentId: id,
          requestId
        });
      }

      return deleted;
    } catch (error) {
      logger.error('Failed to delete payment', {
        paymentId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async getPendingPayments(
    olderThanMinutes: number,
    requestId: string
  ): Promise<PaymentDatabaseRecord[]> {
    try {
      const payments = await this.paymentModel.findPendingPayments(olderThanMinutes);
      
      logger.info('Pending payments retrieved', {
        count: payments.length,
        olderThanMinutes,
        requestId
      });

      return payments;
    } catch (error) {
      logger.error('Failed to retrieve pending payments', {
        olderThanMinutes,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }
}
