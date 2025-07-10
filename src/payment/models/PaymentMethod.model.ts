import { DatabaseClient, DatabaseTransaction, PaymentMethodDatabaseRecord, PaymentMethod } from '../../shared/types';
import { PAYMENT_TABLES } from '../../config/payment';

export class PaymentMethodModel {
  private client: DatabaseClient;

  constructor(client: DatabaseClient) {
    this.client = client;
  }

  async create(
    paymentMethodData: Omit<PaymentMethodDatabaseRecord, 'id' | 'created_at' | 'updated_at'>,
    transaction?: DatabaseTransaction
  ): Promise<PaymentMethodDatabaseRecord> {
    const query = `
      INSERT INTO ${PAYMENT_TABLES.PAYMENT_METHODS} (
        user_id, stripe_payment_method_id, type, card_last_four,
        card_brand, card_exp_month, card_exp_year, is_default
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      paymentMethodData.user_id,
      paymentMethodData.stripe_payment_method_id,
      paymentMethodData.type,
      paymentMethodData.card_last_four,
      paymentMethodData.card_brand,
      paymentMethodData.card_exp_month,
      paymentMethodData.card_exp_year,
      paymentMethodData.is_default
    ];

    const executor = transaction || this.client;
    const result = await executor.query<PaymentMethodDatabaseRecord>(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('Failed to create payment method record');
    }

    return result.rows[0];
  }

  async findById(id: number): Promise<PaymentMethodDatabaseRecord | null> {
    const query = `SELECT * FROM ${PAYMENT_TABLES.PAYMENT_METHODS} WHERE id = $1`;
    const result = await this.client.query<PaymentMethodDatabaseRecord>(query, [id]);
    
    return result.rows[0] || null;
  }

  async findByStripePaymentMethodId(stripePaymentMethodId: string): Promise<PaymentMethodDatabaseRecord | null> {
    const query = `SELECT * FROM ${PAYMENT_TABLES.PAYMENT_METHODS} WHERE stripe_payment_method_id = $1`;
    const result = await this.client.query<PaymentMethodDatabaseRecord>(query, [stripePaymentMethodId]);
    
    return result.rows[0] || null;
  }

  async findByUserId(userId: number): Promise<PaymentMethodDatabaseRecord[]> {
    const query = `
      SELECT * FROM ${PAYMENT_TABLES.PAYMENT_METHODS} 
      WHERE user_id = $1 
      ORDER BY is_default DESC, created_at DESC
    `;
    
    const result = await this.client.query<PaymentMethodDatabaseRecord>(query, [userId]);
    return result.rows;
  }

  async findDefaultByUserId(userId: number): Promise<PaymentMethodDatabaseRecord | null> {
    const query = `
      SELECT * FROM ${PAYMENT_TABLES.PAYMENT_METHODS} 
      WHERE user_id = $1 AND is_default = true
      LIMIT 1
    `;
    
    const result = await this.client.query<PaymentMethodDatabaseRecord>(query, [userId]);
    return result.rows[0] || null;
  }

  async setAsDefault(
    id: number,
    userId: number,
    transaction?: DatabaseTransaction
  ): Promise<PaymentMethodDatabaseRecord> {
    const executor = transaction || this.client;
    
    await executor.query(
      `UPDATE ${PAYMENT_TABLES.PAYMENT_METHODS} SET is_default = false WHERE user_id = $1`,
      [userId]
    );
    
    const query = `
      UPDATE ${PAYMENT_TABLES.PAYMENT_METHODS} 
      SET is_default = true, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `;
    
    const result = await executor.query<PaymentMethodDatabaseRecord>(query, [id, userId]);
    
    if (result.rows.length === 0) {
      throw new Error('Payment method not found or update failed');
    }

    return result.rows[0];
  }

  async updateCardDetails(
    id: number,
    cardDetails: {
      card_last_four?: string;
      card_brand?: string;
      card_exp_month?: number;
      card_exp_year?: number;
    },
    transaction?: DatabaseTransaction
  ): Promise<PaymentMethodDatabaseRecord> {
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (cardDetails.card_last_four !== undefined) {
      updateFields.push(`card_last_four = $${paramIndex++}`);
      values.push(cardDetails.card_last_four);
    }

    if (cardDetails.card_brand !== undefined) {
      updateFields.push(`card_brand = $${paramIndex++}`);
      values.push(cardDetails.card_brand);
    }

    if (cardDetails.card_exp_month !== undefined) {
      updateFields.push(`card_exp_month = $${paramIndex++}`);
      values.push(cardDetails.card_exp_month);
    }

    if (cardDetails.card_exp_year !== undefined) {
      updateFields.push(`card_exp_year = $${paramIndex++}`);
      values.push(cardDetails.card_exp_year);
    }

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const query = `
      UPDATE ${PAYMENT_TABLES.PAYMENT_METHODS} 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const executor = transaction || this.client;
    const result = await executor.query<PaymentMethodDatabaseRecord>(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('Payment method not found or update failed');
    }

    return result.rows[0];
  }

  async delete(id: number, userId: number, transaction?: DatabaseTransaction): Promise<boolean> {
    const query = `DELETE FROM ${PAYMENT_TABLES.PAYMENT_METHODS} WHERE id = $1 AND user_id = $2`;
    const executor = transaction || this.client;
    const result = await executor.query(query, [id, userId]);
    
    return result.rowCount > 0;
  }

  async findByType(userId: number, type: PaymentMethod): Promise<PaymentMethodDatabaseRecord[]> {
    const query = `
      SELECT * FROM ${PAYMENT_TABLES.PAYMENT_METHODS} 
      WHERE user_id = $1 AND type = $2 
      ORDER BY is_default DESC, created_at DESC
    `;
    
    const result = await this.client.query<PaymentMethodDatabaseRecord>(query, [userId, type]);
    return result.rows;
  }

  async countByUserId(userId: number): Promise<number> {
    const query = `SELECT COUNT(*) as count FROM ${PAYMENT_TABLES.PAYMENT_METHODS} WHERE user_id = $1`;
    const result = await this.client.query<{ count: string }>(query, [userId]);
    
    return parseInt(result.rows[0]?.count || '0', 10);
  }

  async findExpiredCards(userId?: number): Promise<PaymentMethodDatabaseRecord[]> {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    let query = `
      SELECT * FROM ${PAYMENT_TABLES.PAYMENT_METHODS} 
      WHERE type = 'stripe_card' 
      AND (
        card_exp_year < $1 
        OR (card_exp_year = $1 AND card_exp_month < $2)
      )
    `;
    
    const values: any[] = [currentYear, currentMonth];
    
    if (userId) {
      query += ` AND user_id = $3`;
      values.push(userId);
    }
    
    query += ` ORDER BY card_exp_year DESC, card_exp_month DESC`;
    
    const result = await this.client.query<PaymentMethodDatabaseRecord>(query, values);
    return result.rows;
  }
}
