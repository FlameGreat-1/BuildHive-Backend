import { DatabaseClient, DatabaseTransaction, RefundDatabaseRecord, RefundStatus } from '../../shared/types';
import { RefundModel } from '../models';
import { logger } from '../../shared/utils';

export class RefundRepository {
  private refundModel: RefundModel;

  constructor(client: DatabaseClient) {
    this.refundModel = new RefundModel(client);
  }

  async createRefund(
    refundData: Omit<RefundDatabaseRecord, 'id' | 'created_at' | 'updated_at'>,
    requestId: string,
    transaction?: DatabaseTransaction
  ): Promise<RefundDatabaseRecord> {
    try {
      const refund = await this.refundModel.create(refundData, transaction);
      
      logger.info('Refund created successfully', {
        refundId: refund.id,
        paymentId: refund.payment_id,
        userId: refund.user_id,
        amount: refund.amount,
        requestId
      });

      return refund;
    } catch (error) {
      logger.error('Failed to create refund', {
        paymentId: refundData.payment_id,
        userId: refundData.user_id,
        amount: refundData.amount,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async getRefundById(
    id: number,
    requestId: string
  ): Promise<RefundDatabaseRecord | null> {
    try {
      const refund = await this.refundModel.findById(id);
      
      if (refund) {
        logger.info('Refund retrieved successfully', {
          refundId: id,
          paymentId: refund.payment_id,
          userId: refund.user_id,
          amount: refund.amount,
          requestId
        });
      }

      return refund;
    } catch (error) {
      logger.error('Failed to retrieve refund', {
        refundId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async getRefundsByPaymentId(
    paymentId: number,
    requestId: string
  ): Promise<RefundDatabaseRecord[]> {
    try {
      const refunds = await this.refundModel.findByPaymentId(paymentId);
      
      logger.info('Refunds retrieved by payment ID', {
        paymentId,
        count: refunds.length,
        requestId
      });

      return refunds;
    } catch (error) {
      logger.error('Failed to retrieve refunds by payment ID', {
        paymentId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async getUserRefunds(
    userId: number,
    limit: number,
    offset: number,
    requestId: string
  ): Promise<RefundDatabaseRecord[]> {
    try {
      const refunds = await this.refundModel.findByUserId(userId, limit, offset);
      
      logger.info('User refunds retrieved', {
        userId,
        count: refunds.length,
        limit,
        offset,
        requestId
      });

      return refunds;
    } catch (error) {
      logger.error('Failed to retrieve user refunds', {
        userId,
        limit,
        offset,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async updateRefundStatus(
    id: number,
    status: RefundStatus,
    processedAt: Date | undefined,
    requestId: string,
    transaction?: DatabaseTransaction
  ): Promise<RefundDatabaseRecord> {
    try {
      const refund = await this.refundModel.updateStatus(id, status, processedAt, transaction);
      
      logger.info('Refund status updated', {
        refundId: id,
        paymentId: refund.payment_id,
        newStatus: status,
        processedAt,
        requestId
      });

      return refund;
    } catch (error) {
      logger.error('Failed to update refund status', {
        refundId: id,
        status,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async getRefundsByStatus(
    status: RefundStatus,
    limit: number,
    requestId: string
  ): Promise<RefundDatabaseRecord[]> {
    try {
      const refunds = await this.refundModel.findByStatus(status, limit);
      
      logger.info('Refunds retrieved by status', {
        status,
        count: refunds.length,
        limit,
        requestId
      });

      return refunds;
    } catch (error) {
      logger.error('Failed to retrieve refunds by status', {
        status,
        limit,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async getTotalRefundedAmount(
    paymentId: number,
    requestId: string
  ): Promise<number> {
    try {
      const totalAmount = await this.refundModel.getTotalRefundedAmount(paymentId);
      
      logger.info('Total refunded amount retrieved', {
        paymentId,
        totalAmount,
        requestId
      });

      return totalAmount;
    } catch (error) {
      logger.error('Failed to retrieve total refunded amount', {
        paymentId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async deleteRefund(
    id: number,
    requestId: string,
    transaction?: DatabaseTransaction
  ): Promise<boolean> {
    try {
      const deleted = await this.refundModel.delete(id, transaction);
      
      if (deleted) {
        logger.info('Refund deleted successfully', {
          refundId: id,
          requestId
        });
      }

      return deleted;
    } catch (error) {
      logger.error('Failed to delete refund', {
        refundId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }
}
