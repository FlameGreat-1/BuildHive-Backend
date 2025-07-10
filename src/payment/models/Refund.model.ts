import { DatabaseClient, DatabaseTransaction, RefundDatabaseRecord, RefundStatus } from '../../shared/types';
import { PAYMENT_TABLES } from '../../config/payment';
import { logger } from '../../shared/utils';

export class RefundModel {
  private client: DatabaseClient;

  constructor(client: DatabaseClient) {
    this.client = client;
  }

  async create(
    refundData: Omit<RefundDatabaseRecord, 'id' | 'created_at' | 'updated_at'>,
    transaction?: DatabaseTransaction
  ): Promise<RefundDatabaseRecord> {
    const query = `
      INSERT INTO ${PAYMENT_TABLES.REFUNDS} (
        payment_id, user_id, amount, reason, status, stripe_refund_id, processed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      refundData.payment_id,
      refundData.user_id,
      refundData.amount,
      refundData.reason,
      refundData.status,
      refundData.stripe_refund_id,
      refundData.processed_at
    ];

    const executor = transaction || this.client;
    const result = await executor.query<RefundDatabaseRecord>(query, values);
    
    if (result.rows.length === 0) {
      logger.error('Failed to create refund record', {
        paymentId: refundData.payment_id,
        amount: refundData.amount
      });
      throw new Error('Failed to create refund record');
    }

    logger.info('Refund created', {
      id: result.rows[0].id,
      paymentId: refundData.payment_id,
      amount: refundData.amount
    });

    return result.rows[0];
  }

  async findById(id: number): Promise<RefundDatabaseRecord | null> {
    const query = `SELECT * FROM ${PAYMENT_TABLES.REFUNDS} WHERE id = $1`;
    const result = await this.client.query<RefundDatabaseRecord>(query, [id]);
    
    return result.rows[0] || null;
  }

  async findByPaymentId(paymentId: number): Promise<RefundDatabaseRecord[]> {
    const query = `
      SELECT * FROM ${PAYMENT_TABLES.REFUNDS} 
      WHERE payment_id = $1 
      ORDER BY created_at DESC
    `;
    
    const result = await this.client.query<RefundDatabaseRecord>(query, [paymentId]);
    return result.rows;
  }

  async findByUserId(
    userId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<RefundDatabaseRecord[]> {
    const query = `
      SELECT * FROM ${PAYMENT_TABLES.REFUNDS} 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `;
    
    const result = await this.client.query<RefundDatabaseRecord>(query, [userId, limit, offset]);
    return result.rows;
  }

  async updateStatus(
    id: number,
    status: RefundStatus,
    processedAt?: Date,
    transaction?: DatabaseTransaction
  ): Promise<RefundDatabaseRecord> {
    const query = `
      UPDATE ${PAYMENT_TABLES.REFUNDS} 
      SET status = $1, processed_at = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `;

    const values = [status, processedAt, id];
    const executor = transaction || this.client;
    const result = await executor.query<RefundDatabaseRecord>(query, values);
    
    if (result.rows.length === 0) {
      logger.error('Refund not found for status update', { id, status });
      throw new Error('Refund not found or update failed');
    }

    logger.info('Refund status updated', {
      id: result.rows[0].id,
      status,
      processedAt
    });

    return result.rows[0];
  }

  async findByStatus(
    status: RefundStatus,
    limit: number = 100
  ): Promise<RefundDatabaseRecord[]> {
    const query = `
      SELECT * FROM ${PAYMENT_TABLES.REFUNDS} 
      WHERE status = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;
    
    const result = await this.client.query<RefundDatabaseRecord>(query, [status, limit]);
    return result.rows;
  }

  async getTotalRefundedAmount(paymentId: number): Promise<number> {
    const query = `
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM ${PAYMENT_TABLES.REFUNDS} 
      WHERE payment_id = $1 AND status = 'processed'
    `;
    
    const result = await this.client.query<{ total: string }>(query, [paymentId]);
    return parseInt(result.rows[0]?.total || '0', 10);
  }

  async delete(id: number, transaction?: DatabaseTransaction): Promise<boolean> {
    const query = `DELETE FROM ${PAYMENT_TABLES.REFUNDS} WHERE id = $1`;
    const executor = transaction || this.client;
    const result = await executor.query(query, [id]);
    
    return result.rowCount > 0;
  }
}
