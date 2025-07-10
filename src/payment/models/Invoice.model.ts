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
        due_date, payment_link, stripe_invoice_id, paid_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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

  async findByStatus(
    status: InvoiceStatus,
    limit: number = 100
  ): Promise<InvoiceDatabaseRecord[]> {
    const query = `
      SELECT * FROM ${PAYMENT_TABLES.INVOICES} 
      WHERE status = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;
    
    const result = await this.client.query<InvoiceDatabaseRecord>(query, [status, limit]);
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

  async delete(id: number, transaction?: DatabaseTransaction): Promise<boolean> {
    const query = `DELETE FROM ${PAYMENT_TABLES.INVOICES} WHERE id = $1`;
    const executor = transaction || this.client;
    const result = await executor.query(query, [id]);
    
    return result.rowCount > 0;
  }
}
