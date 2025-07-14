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
        payment_id, user_id, amount, reason, description, status, stripe_refund_id, 
        processed_at, failure_reason, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const values = [
      refundData.payment_id,
      refundData.user_id,
      refundData.amount,
      refundData.reason,
      refundData.description || null,
      refundData.status,
      refundData.stripe_refund_id,
      refundData.processed_at,
      refundData.failure_reason || null,
      JSON.stringify(refundData.metadata || {})
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

  async update(
    id: number,
    updateData: Partial<Pick<RefundDatabaseRecord, 'status' | 'stripe_refund_id' | 'processed_at' | 'failure_reason' | 'metadata'>>,
    transaction?: DatabaseTransaction
  ): Promise<RefundDatabaseRecord> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updateData.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(updateData.status);
    }

    if (updateData.stripe_refund_id !== undefined) {
      fields.push(`stripe_refund_id = $${paramIndex++}`);
      values.push(updateData.stripe_refund_id);
    }

    if (updateData.processed_at !== undefined) {
      fields.push(`processed_at = $${paramIndex++}`);
      values.push(updateData.processed_at);
    }

    if (updateData.failure_reason !== undefined) {
      fields.push(`failure_reason = $${paramIndex++}`);
      values.push(updateData.failure_reason);
    }

    if (updateData.metadata !== undefined) {
      fields.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(updateData.metadata));
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const query = `
      UPDATE ${PAYMENT_TABLES.REFUNDS} 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const executor = transaction || this.client;
    const result = await executor.query<RefundDatabaseRecord>(query, values);
    
    if (result.rows.length === 0) {
      logger.error('Refund not found for update', { id });
      throw new Error('Refund not found or update failed');
    }

    logger.info('Refund updated', {
      id: result.rows[0].id,
      updatedFields: Object.keys(updateData)
    });

    return result.rows[0];
  }

  async findByStripeRefundId(stripeRefundId: string): Promise<RefundDatabaseRecord | null> {
    const query = `SELECT * FROM ${PAYMENT_TABLES.REFUNDS} WHERE stripe_refund_id = $1`;
    const result = await this.client.query<RefundDatabaseRecord>(query, [stripeRefundId]);
    
    return result.rows[0] || null;
  }
  
  async findByDateRange(
  startDate: Date,
  endDate: Date,
  userId?: number
): Promise<RefundDatabaseRecord[]> {
  try {
    let query = `
      SELECT * FROM ${this.tableName} 
      WHERE created_at >= $1 AND created_at <= $2
    `;
    const params: any[] = [startDate, endDate];
    
    if (userId) {
      query += ` AND user_id = $3`;
      params.push(userId);
    }
    
    query += ` ORDER BY created_at DESC`;
    
    const result = await this.client.query(query, params);
    return result.rows;
  } catch (error) {
    throw error;
  }
}

  async countByUserId(userId: number): Promise<number> {
    const query = `SELECT COUNT(*) as count FROM ${PAYMENT_TABLES.REFUNDS} WHERE user_id = $1`;
    const result = await this.client.query<{ count: string }>(query, [userId]);
    return parseInt(result.rows[0]?.count || '0', 10);
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

  async findByDateRange(
    startDate: Date,
    endDate: Date,
    userId?: number
  ): Promise<RefundDatabaseRecord[]> {
    let query = `
      SELECT * FROM ${PAYMENT_TABLES.REFUNDS} 
      WHERE created_at >= $1 AND created_at <= $2
    `;
    
    const values: any[] = [startDate, endDate];
    
    if (userId) {
      query += ` AND user_id = $3`;
      values.push(userId);
    }
    
    query += ` ORDER BY created_at DESC`;
    
    const result = await this.client.query<RefundDatabaseRecord>(query, values);
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

  async getTotalRefundedAmountByUser(userId: number, status?: RefundStatus): Promise<number> {
    let query = `
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM ${PAYMENT_TABLES.REFUNDS} 
      WHERE user_id = $1
    `;
    
    const values: any[] = [userId];
    
    if (status) {
      query += ` AND status = $2`;
      values.push(status);
    }
    
    const result = await this.client.query<{ total: string }>(query, values);
    return parseInt(result.rows[0]?.total || '0', 10);
  }

  async getRefundStats(userId?: number): Promise<{
    total_refunds: number;
    processed_refunds: number;
    pending_refunds: number;
    failed_refunds: number;
    total_amount: number;
    average_amount: number;
  }> {
    let query = `
      SELECT 
        COUNT(*) as total_refunds,
        COUNT(CASE WHEN status = 'processed' THEN 1 END) as processed_refunds,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_refunds,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_refunds,
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(AVG(amount), 0) as average_amount
      FROM ${PAYMENT_TABLES.REFUNDS}
    `;
    
    const values: any[] = [];
    
    if (userId) {
      query += ` WHERE user_id = $1`;
      values.push(userId);
    }
    
    const result = await this.client.query(query, values);
    const row = result.rows[0];
    
    return {
      total_refunds: parseInt(row.total_refunds, 10),
      processed_refunds: parseInt(row.processed_refunds, 10),
      pending_refunds: parseInt(row.pending_refunds, 10),
      failed_refunds: parseInt(row.failed_refunds, 10),
      total_amount: parseInt(row.total_amount, 10),
      average_amount: parseFloat(row.average_amount)
    };
  }

  async delete(id: number, transaction?: DatabaseTransaction): Promise<boolean> {
    const query = `DELETE FROM ${PAYMENT_TABLES.REFUNDS} WHERE id = $1`;
    const executor = transaction || this.client;
    const result = await executor.query(query, [id]);
    
    const deleted = result.rowCount > 0;
    
    if (deleted) {
      logger.info('Refund deleted', { id });
    }
    
    return deleted;
  }
}
