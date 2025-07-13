import { DatabaseClient, DatabaseTransaction, InvoiceDatabaseRecord, InvoiceStatus } from '../../shared/types';
import { InvoiceModel } from '../models';
import { logger } from '../../shared/utils';

export class InvoiceRepository {
  private invoiceModel: InvoiceModel;

  constructor(client: DatabaseClient) {
    this.invoiceModel = new InvoiceModel(client);
  }

  async createInvoice(
    invoiceData: Omit<InvoiceDatabaseRecord, 'id' | 'created_at' | 'updated_at'>,
    requestId: string,
    transaction?: DatabaseTransaction
  ): Promise<InvoiceDatabaseRecord> {
    try {
      const invoice = await this.invoiceModel.create(invoiceData, transaction);
      
      logger.info('Invoice created successfully', {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        userId: invoice.user_id,
        amount: invoice.amount,
        requestId
      });

      return invoice;
    } catch (error) {
      logger.error('Failed to create invoice', {
        invoiceNumber: invoiceData.invoice_number,
        userId: invoiceData.user_id,
        amount: invoiceData.amount,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async updateInvoice(
    id: number,
    updateData: Partial<Omit<InvoiceDatabaseRecord, 'id' | 'created_at' | 'updated_at'>>,
    requestId: string,
    transaction?: DatabaseTransaction
  ): Promise<InvoiceDatabaseRecord> {
    try {
      const invoice = await this.invoiceModel.update(id, updateData, transaction);
      
      logger.info('Invoice updated successfully', {
        invoiceId: id,
        invoiceNumber: invoice.invoice_number,
        userId: invoice.user_id,
        updatedFields: Object.keys(updateData),
        requestId
      });

      return invoice;
    } catch (error) {
      logger.error('Failed to update invoice', {
        invoiceId: id,
        updateData,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async getInvoiceById(
    id: number,
    requestId: string
  ): Promise<InvoiceDatabaseRecord | null> {
    try {
      const invoice = await this.invoiceModel.findById(id);
      
      if (invoice) {
        logger.info('Invoice retrieved successfully', {
          invoiceId: id,
          invoiceNumber: invoice.invoice_number,
          userId: invoice.user_id,
          requestId
        });
      }

      return invoice;
    } catch (error) {
      logger.error('Failed to retrieve invoice', {
        invoiceId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async getInvoiceByNumber(
    invoiceNumber: string,
    requestId: string
  ): Promise<InvoiceDatabaseRecord | null> {
    try {
      const invoice = await this.invoiceModel.findByInvoiceNumber(invoiceNumber);
      
      if (invoice) {
        logger.info('Invoice retrieved by number', {
          invoiceId: invoice.id,
          invoiceNumber,
          userId: invoice.user_id,
          requestId
        });
      }

      return invoice;
    } catch (error) {
      logger.error('Failed to retrieve invoice by number', {
        invoiceNumber,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async getUserInvoices(
    userId: number,
    limit: number,
    offset: number,
    requestId: string,
    status?: InvoiceStatus
  ): Promise<InvoiceDatabaseRecord[]> {
    try {
      const invoices = await this.invoiceModel.findByUserId(userId, limit, offset, status);
      
      logger.info('User invoices retrieved', {
        userId,
        count: invoices.length,
        limit,
        offset,
        status,
        requestId
      });

      return invoices;
    } catch (error) {
      logger.error('Failed to retrieve user invoices', {
        userId,
        limit,
        offset,
        status,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async getUserInvoicesCount(
    userId: number,
    requestId: string,
    status?: InvoiceStatus
  ): Promise<number> {
    try {
      const count = await this.invoiceModel.countByUserId(userId, status);
      
      logger.info('User invoices count retrieved', {
        userId,
        count,
        status,
        requestId
      });

      return count;
    } catch (error) {
      logger.error('Failed to retrieve user invoices count', {
        userId,
        status,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async updateInvoiceStatus(
    id: number,
    status: InvoiceStatus,
    paidAt: Date | undefined,
    requestId: string,
    transaction?: DatabaseTransaction
  ): Promise<InvoiceDatabaseRecord> {
    try {
      const invoice = await this.invoiceModel.updateStatus(id, status, paidAt, transaction);
      
      logger.info('Invoice status updated', {
        invoiceId: id,
        invoiceNumber: invoice.invoice_number,
        newStatus: status,
        paidAt,
        requestId
      });

      return invoice;
    } catch (error) {
      logger.error('Failed to update invoice status', {
        invoiceId: id,
        status,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async getInvoicesByStatus(
    status: InvoiceStatus,
    limit: number,
    requestId: string
  ): Promise<InvoiceDatabaseRecord[]> {
    try {
      const invoices = await this.invoiceModel.findByStatus(status, limit);
      
      logger.info('Invoices retrieved by status', {
        status,
        count: invoices.length,
        limit,
        requestId
      });

      return invoices;
    } catch (error) {
      logger.error('Failed to retrieve invoices by status', {
        status,
        limit,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async getOverdueInvoices(requestId: string): Promise<InvoiceDatabaseRecord[]> {
    try {
      const invoices = await this.invoiceModel.findOverdueInvoices();
      
      logger.info('Overdue invoices retrieved', {
        count: invoices.length,
        requestId
      });

      return invoices;
    } catch (error) {
      logger.error('Failed to retrieve overdue invoices', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async getInvoicesByDateRange(
    startDate: Date,
    endDate: Date,
    limit: number,
    offset: number,
    requestId: string
  ): Promise<InvoiceDatabaseRecord[]> {
    try {
      const invoices = await this.invoiceModel.findByDateRange(startDate, endDate, limit, offset);
      
      logger.info('Invoices retrieved by date range', {
        startDate,
        endDate,
        count: invoices.length,
        limit,
        offset,
        requestId
      });

      return invoices;
    } catch (error) {
      logger.error('Failed to retrieve invoices by date range', {
        startDate,
        endDate,
        limit,
        offset,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async deleteInvoice(
    id: number,
    requestId: string,
    transaction?: DatabaseTransaction
  ): Promise<boolean> {
    try {
      const deleted = await this.invoiceModel.delete(id, transaction);
      
      if (deleted) {
        logger.info('Invoice deleted successfully', {
          invoiceId: id,
          requestId
        });
      }

      return deleted;
    } catch (error) {
      logger.error('Failed to delete invoice', {
        invoiceId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }
}
