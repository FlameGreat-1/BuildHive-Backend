import { DatabaseClient, DatabaseTransaction, InvoiceDatabaseRecord, InvoiceStatus } from '../../shared/types';
import { InvoiceModel } from '../models';
import { logger } from '../../shared/utils';

export class InvoiceRepository {
  private invoiceModel: InvoiceModel;

  constructor(client: DatabaseClient) {
    this.invoiceModel = new InvoiceModel(client);
  }

  async create(
    invoiceData: Omit<InvoiceDatabaseRecord, 'id' | 'created_at' | 'updated_at'>,
    transaction?: DatabaseTransaction
  ): Promise<InvoiceDatabaseRecord> {
    try {
      const invoice = await this.invoiceModel.create(invoiceData, transaction);
      
      logger.info('Invoice created successfully', {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        userId: invoice.user_id,
        amount: invoice.amount
      });

      return invoice;
    } catch (error) {
      logger.error('Failed to create invoice', {
        invoiceNumber: invoiceData.invoice_number,
        userId: invoiceData.user_id,
        amount: invoiceData.amount,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async update(
    id: number,
    updateData: Partial<Pick<InvoiceDatabaseRecord, 'status' | 'description' | 'processing_fee' | 'metadata' | 'payment_link' | 'paid_at'>>,
    transaction?: DatabaseTransaction
  ): Promise<InvoiceDatabaseRecord> {
    try {
      const invoice = await this.invoiceModel.update(id, updateData, transaction);
      
      logger.info('Invoice updated successfully', {
        invoiceId: id,
        invoiceNumber: invoice.invoice_number,
        userId: invoice.user_id,
        updatedFields: Object.keys(updateData)
      });

      return invoice;
    } catch (error) {
      logger.error('Failed to update invoice', {
        invoiceId: id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async findById(id: number): Promise<InvoiceDatabaseRecord | null> {
    try {
      const invoice = await this.invoiceModel.findById(id);
      
      if (invoice) {
        logger.info('Invoice retrieved successfully', {
          invoiceId: id,
          invoiceNumber: invoice.invoice_number,
          userId: invoice.user_id
        });
      }

      return invoice;
    } catch (error) {
      logger.error('Failed to retrieve invoice', {
        invoiceId: id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
  
  async getInvoiceById(id: number): Promise<InvoiceDatabaseRecord | null> {
  return this.findById(id);
}

  async findByInvoiceNumber(invoiceNumber: string): Promise<InvoiceDatabaseRecord | null> {
    try {
      const invoice = await this.invoiceModel.findByInvoiceNumber(invoiceNumber);
      
      if (invoice) {
        logger.info('Invoice retrieved by number', {
          invoiceId: invoice.id,
          invoiceNumber,
          userId: invoice.user_id
        });
      }

      return invoice;
    } catch (error) {
      logger.error('Failed to retrieve invoice by number', {
        invoiceNumber,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async findByUserId(
    userId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<InvoiceDatabaseRecord[]> {
    try {
      const invoices = await this.invoiceModel.findByUserId(userId, limit, offset);
      
      logger.info('User invoices retrieved', {
        userId,
        count: invoices.length,
        limit,
        offset
      });

      return invoices;
    } catch (error) {
      logger.error('Failed to retrieve user invoices', {
        userId,
        limit,
        offset,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async countByUserId(userId: number): Promise<number> {
    try {
      const count = await this.invoiceModel.countByUserId(userId);
      
      logger.info('User invoices count retrieved', {
        userId,
        count
      });

      return count;
    } catch (error) {
      logger.error('Failed to retrieve user invoices count', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async updateStatus(
    id: number,
    status: InvoiceStatus,
    paidAt?: Date,
    transaction?: DatabaseTransaction
  ): Promise<InvoiceDatabaseRecord> {
    try {
      const invoice = await this.invoiceModel.updateStatus(id, status, paidAt, transaction);
      
      logger.info('Invoice status updated', {
        invoiceId: id,
        invoiceNumber: invoice.invoice_number,
        newStatus: status,
        paidAt
      });

      return invoice;
    } catch (error) {
      logger.error('Failed to update invoice status', {
        invoiceId: id,
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
  ): Promise<InvoiceDatabaseRecord> {
    try {
      const invoice = await this.invoiceModel.updateMetadata(id, metadata, transaction);
      
      logger.info('Invoice metadata updated', {
        invoiceId: id
      });

      return invoice;
    } catch (error) {
      logger.error('Failed to update invoice metadata', {
        invoiceId: id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async findByStatus(
    status: InvoiceStatus,
    limit: number = 100,
    offset: number = 0
  ): Promise<InvoiceDatabaseRecord[]> {
    try {
      const invoices = await this.invoiceModel.findByStatus(status, limit, offset);
      
      logger.info('Invoices retrieved by status', {
        status,
        count: invoices.length,
        limit
      });

      return invoices;
    } catch (error) {
      logger.error('Failed to retrieve invoices by status', {
        status,
        limit,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async findByQuoteId(quoteId: number): Promise<InvoiceDatabaseRecord[]> {
    try {
      const invoices = await this.invoiceModel.findByQuoteId(quoteId);
      
      logger.info('Invoices retrieved by quote ID', {
        quoteId,
        count: invoices.length
      });

      return invoices;
    } catch (error) {
      logger.error('Failed to retrieve invoices by quote ID', {
        quoteId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async findOverdueInvoices(): Promise<InvoiceDatabaseRecord[]> {
    try {
      const invoices = await this.invoiceModel.findOverdueInvoices();
      
      logger.info('Overdue invoices retrieved', {
        count: invoices.length
      });

      return invoices;
    } catch (error) {
      logger.error('Failed to retrieve overdue invoices', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date,
    userId?: number
  ): Promise<InvoiceDatabaseRecord[]> {
    try {
      const invoices = await this.invoiceModel.findByDateRange(startDate, endDate, userId);
      
      logger.info('Invoices retrieved by date range', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        userId,
        count: invoices.length
      });

      return invoices;
    } catch (error) {
      logger.error('Failed to retrieve invoices by date range', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async getTotalAmountByUser(userId: number, status?: InvoiceStatus): Promise<number> {
    try {
      const totalAmount = await this.invoiceModel.getTotalAmountByUser(userId, status);
      
      logger.info('User total invoice amount retrieved', {
        userId,
        status,
        totalAmount
      });

      return totalAmount;
    } catch (error) {
      logger.error('Failed to retrieve user total invoice amount', {
        userId,
        status,
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
      const deleted = await this.invoiceModel.delete(id, transaction);
      
      if (deleted) {
        logger.info('Invoice deleted successfully', {
          invoiceId: id
        });
      }

      return deleted;
    } catch (error) {
      logger.error('Failed to delete invoice', {
        invoiceId: id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}
