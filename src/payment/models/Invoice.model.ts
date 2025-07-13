import { DatabaseClient, DatabaseTransaction, InvoiceDatabaseRecord, InvoiceStatus } from '../../shared/types';
import { PAYMENT_TABLES } from '../../config/payment';
import { logger } from '../../shared/utils';

export class InvoiceModel {
  private client: DatabaseClient;

  constructor(client: DatabaseClient) {
    this.client = client;
  }

  async create(
    invoiceData: Omit<InvoiceDatabaseRecord, 'id' | 'created_at' | 'updated_at'>,
    transaction?: DatabaseTransaction
  ): Promise<InvoiceDatabaseRecord> {
    const query = `
      INSERT INTO ${PAYMENT_TABLES.INVOICES} (
        quote_id, user_id, invoice_number, amount, currency, status,
        due_date, description, processing_fee, metadata, payment_link, 
        stripe_invoice_id, paid_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const values = [
      invoiceData.quote_id,
      invoiceData.user_id,
      invoiceData.invoice_number,
      invoiceData.amount,
      invoiceData.currency,
      invoiceData.status,
      invoiceData.due_date,
      invoiceData.description,
      invoiceData.processing_fee,
      JSON.stringify(invoiceData.metadata || {}),
      invoiceData.payment_link,
      invoiceData.stripe_invoice_id,
      invoiceData.paid_at
    ];

    const executor = transaction || this.client;
    const result = await executor.query<InvoiceDatabaseRecord>(query, values);
    
    if (result.rows.length === 0) {
      logger.error('Failed to create invoice record', {
        invoiceNumber: invoiceData.invoice_number,
        userId: invoiceData.user_id
      });
      throw new Error('Failed to create invoice record');
    }

    logger.info('Invoice created', {
      id: result.rows[0].id,
      invoiceNumber: invoiceData.invoice_number,
      amount: invoiceData.amount
    });

    return result.rows[0];
  }

  async update(
    id: number,
    updateData: Partial<Pick<InvoiceDatabaseRecord, 'status' | 'description' | 'processing_fee' | 'metadata' | 'payment_link' | 'paid_at'>>,
    transaction?: DatabaseTransaction
  ): Promise<InvoiceDatabaseRecord> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updateData.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(updateData.status);
    }

    if (updateData.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(updateData.description);
    }

    if (updateData.processing_fee !== undefined) {
      fields.push(`processing_fee = $${paramIndex++}`);
      values.push(updateData.processing_fee);
    }

    if (updateData.metadata !== undefined) {
      fields.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(updateData.metadata));
    }

    if (updateData.payment_link !== undefined) {
      fields.push(`payment_link = $${paramIndex++}`);
      values.push(updateData.payment_link);
    }

    if (updateData.paid_at !== undefined) {
      fields.push(`paid_at = $${paramIndex++}`);
      values.push(updateData.paid_at);
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const query = `
      UPDATE ${PAYMENT_TABLES.INVOICES} 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const executor = transaction || this.client;
    const result = await executor.query<InvoiceDatabaseRecord>(query, values);
    
    if (result.rows.length === 0) {
      logger.error('Invoice not found for update', { id });
      throw new Error('Invoice not found or update failed');
    }

    logger.info('Invoice updated', {
      id: result.rows[0].id,
      invoiceNumber: result.rows[0].invoice_number
    });

    return result.rows[0];
  }

  async countByUserId(userId: number): Promise<number> {
    const query = `SELECT COUNT(*) as count FROM ${PAYMENT_TABLES.INVOICES} WHERE user_id = $1`;
    const result = await this.client.query<{ count: string }>(query, [userId]);
    return parseInt(result.rows[0]?.count || '0', 10);
  }

  async findById(id: number): Promise<InvoiceDatabaseRecord | null> {
    const query = `SELECT * FROM ${PAYMENT_TABLES.INVOICES} WHERE id = $1`;
    const result = await this.client.query<InvoiceDatabaseRecord>(query, [id]);
    
    return result.rows[0] || null;
  }

  async findByInvoiceNumber(invoiceNumber: string): Promise<InvoiceDatabaseRecord | null> {
    const query = `SELECT * FROM ${PAYMENT_TABLES.INVOICES} WHERE invoice_number = $1`;
    const result = await this.client.query<InvoiceDatabaseRecord>(query, [invoiceNumber]);
    
    return result.rows[0] || null;
  }

  async findByUserId(
    userId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<InvoiceDatabaseRecord[]> {
    const query = `
      SELECT * FROM ${PAYMENT_TABLES.INVOICES} 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `;
    
    const result = await this.client.query<InvoiceDatabaseRecord>(query, [userId, limit, offset]);
    return result.rows;
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date,
    userId?: number
  ): Promise<InvoiceDatabaseRecord[]> {
    let query = `
      SELECT * FROM ${PAYMENT_TABLES.INVOICES} 
      WHERE created_at >= $1 AND created_at <= $2
    `;
    
    const values: any[] = [startDate, endDate];
    
    if (userId) {
      query += ` AND user_id = $3`;
      values.push(userId);
    }
    
    query += ` ORDER BY created_at DESC`;
    
    const result = await this.client.query<InvoiceDatabaseRecord>(query, values);
    return result.rows;
  }

  async updateStatus(
    id: number,
    status: InvoiceStatus,
    paidAt?: Date,
    transaction?: DatabaseTransaction
  ): Promise<InvoiceDatabaseRecord> {
    const query = `
      UPDATE ${PAYMENT_TABLES.INVOICES} 
      SET status = $1, paid_at = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `;

    const values = [status, paidAt, id];
    const executor = transaction || this.client;
    const result = await executor.query<InvoiceDatabaseRecord>(query, values);
    
    if (result.rows.length === 0) {
      logger.error('Invoice not found for status update', { id, status });
      throw new Error('Invoice not found or update failed');
    }

    logger.info('Invoice status updated', {
      id: result.rows[0].id,
      invoiceNumber: result.rows[0].invoice_number,
      status
    });

    return result.rows[0];
  }

  async updateMetadata(
    id: number,
    metadata: Record<string, any>,
    transaction?: DatabaseTransaction
  ): Promise<InvoiceDatabaseRecord> {
    const query = `
      UPDATE ${PAYMENT_TABLES.INVOICES} 
      SET metadata = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;

    const values = [JSON.stringify(metadata), id];
    const executor = transaction || this.client;
    const result = await executor.query<InvoiceDatabaseRecord>(query, values);
    
    if (result.rows.length === 0) {
      logger.error('Invoice not found for metadata update', { id });
      throw new Error('Invoice not found or update failed');
    }

    return result.rows[0];
  }

  async findByStatus(
    status: InvoiceStatus,
    limit: number = 100,
    offset: number = 0
  ): Promise<InvoiceDatabaseRecord[]> {
    const query = `
      SELECT * FROM ${PAYMENT_TABLES.INVOICES} 
      WHERE status = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `;
    
    const result = await this.client.query<InvoiceDatabaseRecord>(query, [status, limit, offset]);
    return result.rows;
  }

  async findByQuoteId(quoteId: number): Promise<InvoiceDatabaseRecord[]> {
    const query = `
      SELECT * FROM ${PAYMENT_TABLES.INVOICES} 
      WHERE quote_id = $1 
      ORDER BY created_at DESC
    `;
    
    const result = await this.client.query<InvoiceDatabaseRecord>(query, [quoteId]);
    return result.rows;
  }

  async findOverdueInvoices(): Promise<InvoiceDatabaseRecord[]> {
    const query = `
      SELECT * FROM ${PAYMENT_TABLES.INVOICES} 
      WHERE status IN ('sent', 'overdue') 
      AND due_date < CURRENT_DATE
      ORDER BY due_date ASC
    `;
    
    const result = await this.client.query<InvoiceDatabaseRecord>(query);
    return result.rows;
  }

  async getTotalAmountByUser(userId: number, status?: InvoiceStatus): Promise<number> {
    let query = `
      SELECT COALESCE(SUM(amount), 0) as total 
      FROM ${PAYMENT_TABLES.INVOICES} 
      WHERE user_id = $1
    `;
    
    const values: any[] = [userId];
    
    if (status) {
      query += ` AND status = $2`;
      values.push(status);
    }
    
    const result = await this.client.query<{ total: string }>(query, values);
    return parseFloat(result.rows[0]?.total || '0');
  }

  async delete(id: number, transaction?: DatabaseTransaction): Promise<boolean> {
    const query = `DELETE FROM ${PAYMENT_TABLES.INVOICES} WHERE id = $1`;
    const executor = transaction || this.client;
    const result = await executor.query(query, [id]);
    
    return result.rowCount > 0;
  }
}
