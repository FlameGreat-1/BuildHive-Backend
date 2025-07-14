import { DatabaseClient, DatabaseTransaction, PaymentDatabaseRecord, PaymentStatus, PaymentMethod, PaymentType } from '../../shared/types';
import { PAYMENT_TABLES } from '../../config/payment';

export class PaymentModel {
  private client: DatabaseClient;

  constructor(client: DatabaseClient) {
    this.client = client;
  }

  async create(
    paymentData: Omit<PaymentDatabaseRecord, 'id' | 'created_at' | 'updated_at'>,
    transaction?: DatabaseTransaction
  ): Promise<PaymentDatabaseRecord> {
    const query = `
      INSERT INTO ${PAYMENT_TABLES.PAYMENTS} (
        user_id, stripe_payment_intent_id, amount, currency, payment_method,
        payment_type, status, description, metadata, invoice_id, subscription_id,
        credits_purchased, stripe_fee, platform_fee, processing_fee, net_amount, 
        failure_reason, processed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `;

    const values = [
      paymentData.user_id,
      paymentData.stripe_payment_intent_id,
      paymentData.amount,
      paymentData.currency,
      paymentData.payment_method,
      paymentData.payment_type,
      paymentData.status,
      paymentData.description,
      JSON.stringify(paymentData.metadata || {}),
      paymentData.invoice_id,
      paymentData.subscription_id,
      paymentData.credits_purchased,
      paymentData.stripe_fee,
      paymentData.platform_fee,
      paymentData.processing_fee,
      paymentData.net_amount,
      paymentData.failure_reason,
      paymentData.processed_at
    ];

    const executor = transaction || this.client;
    const result = await executor.query<PaymentDatabaseRecord>(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('Failed to create payment record');
    }

    return result.rows[0];
  }

  async update(
    id: number,
    updateData: Partial<Pick<PaymentDatabaseRecord, 'status' | 'processing_fee' | 'failure_reason' | 'processed_at' | 'metadata'>>,
    transaction?: DatabaseTransaction
  ): Promise<PaymentDatabaseRecord> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updateData.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(updateData.status);
    }

    if (updateData.processing_fee !== undefined) {
      fields.push(`processing_fee = $${paramIndex++}`);
      values.push(updateData.processing_fee);
    }

    if (updateData.failure_reason !== undefined) {
      fields.push(`failure_reason = $${paramIndex++}`);
      values.push(updateData.failure_reason);
    }

    if (updateData.processed_at !== undefined) {
      fields.push(`processed_at = $${paramIndex++}`);
      values.push(updateData.processed_at);
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
      UPDATE ${PAYMENT_TABLES.PAYMENTS} 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const executor = transaction || this.client;
    const result = await executor.query<PaymentDatabaseRecord>(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('Payment not found or update failed');
    }

    return result.rows[0];
  }

  async countByUserId(userId: number): Promise<number> {
    const query = `SELECT COUNT(*) as count FROM ${PAYMENT_TABLES.PAYMENTS} WHERE user_id = $1`;
    const result = await this.client.query<{ count: string }>(query, [userId]);
    return parseInt(result.rows[0]?.count || '0', 10);
  }

  async findById(id: number): Promise<PaymentDatabaseRecord | null> {
    const query = `SELECT * FROM ${PAYMENT_TABLES.PAYMENTS} WHERE id = $1`;
    const result = await this.client.query<PaymentDatabaseRecord>(query, [id]);
    
    return result.rows[0] || null;
  }

  async findByStripePaymentIntentId(stripePaymentIntentId: string): Promise<PaymentDatabaseRecord | null> {
    const query = `SELECT * FROM ${PAYMENT_TABLES.PAYMENTS} WHERE stripe_payment_intent_id = $1`;
    const result = await this.client.query<PaymentDatabaseRecord>(query, [stripePaymentIntentId]);
    
    return result.rows[0] || null;
  }

  async findByUserId(
    userId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<PaymentDatabaseRecord[]> {
    const query = `
      SELECT * FROM ${PAYMENT_TABLES.PAYMENTS} 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `;
    
    const result = await this.client.query<PaymentDatabaseRecord>(query, [userId, limit, offset]);
    return result.rows;
  }
  
  async findByStripePaymentMethodId(stripePaymentMethodId: string): Promise<PaymentDatabaseRecord[]> {
  try {
    const query = `
      SELECT * FROM ${this.tableName} 
      WHERE stripe_payment_method_id = $1 
      ORDER BY created_at DESC
    `;
    
    const result = await this.client.query(query, [stripePaymentMethodId]);
    return result.rows;
  } catch (error) {
    throw error;
  }
}
  
  async findByInvoiceId(invoiceId: number): Promise<PaymentDatabaseRecord[]> {
    const query = `SELECT * FROM ${PAYMENT_TABLES.PAYMENTS} WHERE invoice_id = $1`;
    const result = await this.client.query<PaymentDatabaseRecord>(query, [invoiceId]);
    return result.rows;
  }

  async updateStatus(
    id: number,
    status: PaymentStatus,
    processedAt?: Date,
    transaction?: DatabaseTransaction
  ): Promise<PaymentDatabaseRecord> {
    const query = `
      UPDATE ${PAYMENT_TABLES.PAYMENTS} 
      SET status = $1, processed_at = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `;

    const values = [status, processedAt, id];
    const executor = transaction || this.client;
    const result = await executor.query<PaymentDatabaseRecord>(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('Payment not found or update failed');
    }

    return result.rows[0];
  }

  async updateMetadata(
    id: number,
    metadata: Record<string, any>,
    transaction?: DatabaseTransaction
  ): Promise<PaymentDatabaseRecord> {
    const query = `
      UPDATE ${PAYMENT_TABLES.PAYMENTS} 
      SET metadata = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;

    const values = [JSON.stringify(metadata), id];
    const executor = transaction || this.client;
    const result = await executor.query<PaymentDatabaseRecord>(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('Payment not found or update failed');
    }

    return result.rows[0];
  }

  async findByStatus(
    status: PaymentStatus,
    limit: number = 100,
    offset: number = 0
  ): Promise<PaymentDatabaseRecord[]> {
    const query = `
      SELECT * FROM ${PAYMENT_TABLES.PAYMENTS} 
      WHERE status = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `;
    
    const result = await this.client.query<PaymentDatabaseRecord>(query, [status, limit, offset]);
    return result.rows;
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date,
    userId?: number
  ): Promise<PaymentDatabaseRecord[]> {
    let query = `
      SELECT * FROM ${PAYMENT_TABLES.PAYMENTS} 
      WHERE created_at >= $1 AND created_at <= $2
    `;
    
    const values: any[] = [startDate, endDate];
    
    if (userId) {
      query += ` AND user_id = $3`;
      values.push(userId);
    }
    
    query += ` ORDER BY created_at DESC`;
    
    const result = await this.client.query<PaymentDatabaseRecord>(query, values);
    return result.rows;
  }

  async getTotalAmountByUser(userId: number, status?: PaymentStatus): Promise<number> {
    let query = `
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM ${PAYMENT_TABLES.PAYMENTS} 
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

  async getPaymentStats(userId?: number): Promise<{
    total_payments: number;
    successful_payments: number;
    failed_payments: number;
    total_amount: number;
    average_amount: number;
  }> {
    let query = `
      SELECT 
        COUNT(*) as total_payments,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_payments,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_payments,
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(AVG(amount), 0) as average_amount
      FROM ${PAYMENT_TABLES.PAYMENTS}
    `;
    
    const values: any[] = [];
    
    if (userId) {
      query += ` WHERE user_id = $1`;
      values.push(userId);
    }
    
    const result = await this.client.query(query, values);
    const row = result.rows[0];
    
    return {
      total_payments: parseInt(row.total_payments, 10),
      successful_payments: parseInt(row.successful_payments, 10),
      failed_payments: parseInt(row.failed_payments, 10),
      total_amount: parseInt(row.total_amount, 10),
      average_amount: parseFloat(row.average_amount)
    };
  }

  async delete(id: number, transaction?: DatabaseTransaction): Promise<boolean> {
    const query = `DELETE FROM ${PAYMENT_TABLES.PAYMENTS} WHERE id = $1`;
    const executor = transaction || this.client;
    const result = await executor.query(query, [id]);
    
    return result.rowCount > 0;
  }

  async findPendingPayments(olderThanMinutes: number = 30): Promise<PaymentDatabaseRecord[]> {
    const query = `
      SELECT * FROM ${PAYMENT_TABLES.PAYMENTS} 
      WHERE status IN ('pending', 'processing') 
      AND created_at < NOW() - INTERVAL '${olderThanMinutes} minutes'
      ORDER BY created_at ASC
    `;
    
    const result = await this.client.query<PaymentDatabaseRecord>(query);
    return result.rows;
  }
}
