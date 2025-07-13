import { DatabaseClient, DatabaseTransaction, PaymentDatabaseRecord, PaymentStatus, PaymentMethod, PaymentType } from '../../shared/types';
import { PaymentModel } from '../models';
import { logger } from '../../shared/utils';
import { PaymentListFilter, PaymentSummary } from '../types';

export class PaymentRepository {
  private paymentModel: PaymentModel;

  constructor(client: DatabaseClient) {
    this.paymentModel = new PaymentModel(client);
  }

  async create(
    paymentData: Omit<PaymentDatabaseRecord, 'id' | 'created_at' | 'updated_at'>,
    transaction?: DatabaseTransaction
  ): Promise<PaymentDatabaseRecord> {
    try {
      const payment = await this.paymentModel.create(paymentData, transaction);
      
      logger.info('Payment created successfully', {
        paymentId: payment.id,
        userId: payment.user_id,
        amount: payment.amount,
        paymentMethod: payment.payment_method
      });

      return payment;
    } catch (error) {
      logger.error('Failed to create payment', {
        userId: paymentData.user_id,
        amount: paymentData.amount,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async findById(id: number): Promise<PaymentDatabaseRecord | null> {
    try {
      const payment = await this.paymentModel.findById(id);
      
      if (payment) {
        logger.info('Payment retrieved successfully', {
          paymentId: id,
          userId: payment.user_id
        });
      }

      return payment;
    } catch (error) {
      logger.error('Failed to retrieve payment', {
        paymentId: id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async getPaymentById(id: number): Promise<PaymentDatabaseRecord | null> {
    return this.findById(id);
  }

  async findByStripePaymentIntentId(stripePaymentIntentId: string): Promise<PaymentDatabaseRecord | null> {
    try {
      const payment = await this.paymentModel.findByStripePaymentIntentId(stripePaymentIntentId);
      
      if (payment) {
        logger.info('Payment retrieved by Stripe intent ID', {
          paymentId: payment.id,
          stripePaymentIntentId
        });
      }

      return payment;
    } catch (error) {
      logger.error('Failed to retrieve payment by Stripe intent ID', {
        stripePaymentIntentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async findByUserId(
    userId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<PaymentDatabaseRecord[]> {
    try {
      const payments = await this.paymentModel.findByUserId(userId, limit, offset);
      
      logger.info('User payments retrieved', {
        userId,
        count: payments.length,
        limit,
        offset
      });

      return payments;
    } catch (error) {
      logger.error('Failed to retrieve user payments', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async countByUserId(userId: number): Promise<number> {
    try {
      const result = await this.paymentModel.countByUserId(userId);
      
      logger.info('User total payments count retrieved', {
        userId,
        totalCount: result
      });

      return result;
    } catch (error) {
      logger.error('Failed to get user total payments count', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async updateStatus(
    id: number,
    status: PaymentStatus,
    processedAt?: Date,
    transaction?: DatabaseTransaction
  ): Promise<PaymentDatabaseRecord> {
    try {
      const payment = await this.paymentModel.updateStatus(id, status, processedAt, transaction);
      
      logger.info('Payment status updated', {
        paymentId: id,
        newStatus: status,
        processedAt
      });

      return payment;
    } catch (error) {
      logger.error('Failed to update payment status', {
        paymentId: id,
        status,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async updateMetadata(
    id: number,
    metadata: Record<string, any>,
    transaction?: DatabaseTransaction
  ): Promise<PaymentDatabaseRecord> {
    try {
      const payment = await this.paymentModel.updateMetadata(id, metadata, transaction);
      
      logger.info('Payment metadata updated', {
        paymentId: id
      });

      return payment;
    } catch (error) {
      logger.error('Failed to update payment metadata', {
        paymentId: id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async findByStatus(
    status: PaymentStatus,
    limit: number = 100,
    offset: number = 0
  ): Promise<PaymentDatabaseRecord[]> {
    try {
      const payments = await this.paymentModel.findByStatus(status, limit, offset);
      
      logger.info('Payments retrieved by status', {
        status,
        count: payments.length
      });

      return payments;
    } catch (error) {
      logger.error('Failed to retrieve payments by status', {
        status,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date,
    userId?: number
  ): Promise<PaymentDatabaseRecord[]> {
    try {
      const payments = await this.paymentModel.findByDateRange(startDate, endDate, userId);
      
      logger.info('Payments retrieved by date range', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        userId,
        count: payments.length
      });

      return payments;
    } catch (error) {
      logger.error('Failed to retrieve payments by date range', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async getTotalAmountByUser(userId: number, status?: PaymentStatus): Promise<number> {
    try {
      const totalAmount = await this.paymentModel.getTotalAmountByUser(userId, status);
      
      logger.info('User total amount retrieved', {
        userId,
        status,
        totalAmount
      });

      return totalAmount;
    } catch (error) {
      logger.error('Failed to retrieve user total amount', {
        userId,
        status,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async getUserTotalAmount(userId: number): Promise<number> {
    return this.getTotalAmountByUser(userId);
  }

  async findByInvoiceId(invoiceId: number): Promise<PaymentDatabaseRecord[]> {
    try {
      const payments = await this.paymentModel.findByInvoiceId(invoiceId);
      
      logger.info('Payments retrieved by invoice ID', {
        invoiceId,
        count: payments.length
      });

      return payments;
    } catch (error) {
      logger.error('Failed to retrieve payments by invoice ID', {
        invoiceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async getRefundsByInvoiceId(invoiceId: number): Promise<any[]> {
    try {
      const refunds = await this.paymentModel.getRefundsByInvoiceId(invoiceId);
      
      logger.info('Refunds retrieved by invoice ID', {
        invoiceId,
        count: refunds.length
      });

      return refunds;
    } catch (error) {
      logger.error('Failed to retrieve refunds by invoice ID', {
        invoiceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async hasPaymentsForInvoice(invoiceId: number): Promise<boolean> {
    try {
      const payments = await this.findByInvoiceId(invoiceId);
      const hasPayments = payments.length > 0;
      
      logger.info('Checked payments for invoice', {
        invoiceId,
        hasPayments
      });

      return hasPayments;
    } catch (error) {
      logger.error('Failed to check payments for invoice', {
        invoiceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async getPaymentStats(userId?: number): Promise<{
    total_payments: number;
    successful_payments: number;
    failed_payments: number;
    total_amount: number;
    average_amount: number;
  }> {
    try {
      const stats = await this.paymentModel.getPaymentStats(userId);
      
      logger.info('Payment stats retrieved', {
        userId,
        stats
      });

      return stats;
    } catch (error) {
      logger.error('Failed to retrieve payment stats', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async delete(
    id: number,
    transaction?: DatabaseTransaction
  ): Promise<boolean> {
    try {
      const deleted = await this.paymentModel.delete(id, transaction);
      
      if (deleted) {
        logger.info('Payment deleted successfully', {
          paymentId: id
        });
      }

      return deleted;
    } catch (error) {
      logger.error('Failed to delete payment', {
        paymentId: id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async update(
    id: number,
    updateData: Partial<Pick<PaymentDatabaseRecord, 'status' | 'processing_fee' | 'failure_reason' | 'processed_at' | 'metadata'>>,
    transaction?: DatabaseTransaction
  ): Promise<PaymentDatabaseRecord> {
    try {
      const payment = await this.paymentModel.update(id, updateData, transaction);
      
      logger.info('Payment updated successfully', {
        paymentId: id,
        updatedFields: Object.keys(updateData)
      });

      return payment;
    } catch (error) {
      logger.error('Failed to update payment', {
        paymentId: id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async findPendingPayments(olderThanMinutes: number = 30): Promise<PaymentDatabaseRecord[]> {
    try {
      const payments = await this.paymentModel.findPendingPayments(olderThanMinutes);
      
      logger.info('Pending payments retrieved', {
        count: payments.length,
        olderThanMinutes
      });

      return payments;
    } catch (error) {
      logger.error('Failed to retrieve pending payments', {
        olderThanMinutes,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}
