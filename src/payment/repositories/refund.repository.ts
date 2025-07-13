import { DatabaseClient, DatabaseTransaction, RefundDatabaseRecord, RefundStatus } from '../../shared/types';
import { RefundModel } from '../models';
import { logger } from '../../shared/utils';

export class RefundRepository {
  private refundModel: RefundModel;

  constructor(client: DatabaseClient) {
    this.refundModel = new RefundModel(client);
  }

  async create(
    refundData: Omit<RefundDatabaseRecord, 'id' | 'created_at' | 'updated_at'>,
    transaction?: DatabaseTransaction
  ): Promise<RefundDatabaseRecord> {
    try {
      const refund = await this.refundModel.create(refundData, transaction);
      
      logger.info('Refund created successfully', {
        refundId: refund.id,
        paymentId: refund.payment_id,
        userId: refund.user_id,
        amount: refund.amount
      });

      return refund;
    } catch (error) {
      logger.error('Failed to create refund', {
        paymentId: refundData.payment_id,
        userId: refundData.user_id,
        amount: refundData.amount,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async findById(id: number): Promise<RefundDatabaseRecord | null> {
    try {
      const refund = await this.refundModel.findById(id);
      
      if (refund) {
        logger.info('Refund retrieved successfully', {
          refundId: id,
          paymentId: refund.payment_id,
          userId: refund.user_id,
          amount: refund.amount
        });
      }

      return refund;
    } catch (error) {
      logger.error('Failed to retrieve refund', {
        refundId: id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async findByPaymentId(paymentId: number): Promise<RefundDatabaseRecord[]> {
    try {
      const refunds = await this.refundModel.findByPaymentId(paymentId);
      
      logger.info('Refunds retrieved by payment ID', {
        paymentId,
        count: refunds.length
      });

      return refunds;
    } catch (error) {
      logger.error('Failed to retrieve refunds by payment ID', {
        paymentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async findByUserId(
    userId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<RefundDatabaseRecord[]> {
    try {
      const refunds = await this.refundModel.findByUserId(userId, limit, offset);
      
      logger.info('User refunds retrieved', {
        userId,
        count: refunds.length,
        limit,
        offset
      });

      return refunds;
    } catch (error) {
      logger.error('Failed to retrieve user refunds', {
        userId,
        limit,
        offset,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async updateStatus(
    id: number,
    status: RefundStatus,
    processedAt?: Date,
    transaction?: DatabaseTransaction
  ): Promise<RefundDatabaseRecord> {
    try {
      const refund = await this.refundModel.updateStatus(id, status, processedAt, transaction);
      
      logger.info('Refund status updated', {
        refundId: id,
        paymentId: refund.payment_id,
        newStatus: status,
        processedAt
      });

      return refund;
    } catch (error) {
      logger.error('Failed to update refund status', {
        refundId: id,
        status,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async findByStatus(
    status: RefundStatus,
    limit: number = 100,
    offset: number = 0
  ): Promise<RefundDatabaseRecord[]> {
    try {
      const refunds = await this.refundModel.findByStatus(status, limit, offset);
      
      logger.info('Refunds retrieved by status', {
        status,
        count: refunds.length,
        limit
      });

      return refunds;
    } catch (error) {
      logger.error('Failed to retrieve refunds by status', {
        status,
        limit,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async getTotalRefundedAmount(paymentId: number): Promise<number> {
    try {
      const totalAmount = await this.refundModel.getTotalRefundedAmount(paymentId);
      
      logger.info('Total refunded amount retrieved', {
        paymentId,
        totalAmount
      });

      return totalAmount;
    } catch (error) {
      logger.error('Failed to retrieve total refunded amount', {
        paymentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async update(
    id: number,
    updateData: Partial<Pick<RefundDatabaseRecord, 'status' | 'description' | 'failure_reason' | 'processed_at' | 'metadata'>>,
    transaction?: DatabaseTransaction
  ): Promise<RefundDatabaseRecord> {
    try {
      const refund = await this.refundModel.update(id, updateData, transaction);
      
      logger.info('Refund updated successfully', {
        refundId: id,
        updatedFields: Object.keys(updateData)
      });

      return refund;
    } catch (error) {
      logger.error('Failed to update refund', {
        refundId: id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async findByStripeRefundId(stripeRefundId: string): Promise<RefundDatabaseRecord | null> {
    try {
      const refund = await this.refundModel.findByStripeRefundId(stripeRefundId);
      
      if (refund) {
        logger.info('Refund retrieved by Stripe ID', {
          refundId: refund.id,
          stripeRefundId
        });
      }

      return refund;
    } catch (error) {
      logger.error('Failed to retrieve refund by Stripe ID', {
        stripeRefundId,
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
      const deleted = await this.refundModel.delete(id, transaction);
      
      if (deleted) {
        logger.info('Refund deleted successfully', {
          refundId: id
        });
      }

      return deleted;
    } catch (error) {
      logger.error('Failed to delete refund', {
        refundId: id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}
