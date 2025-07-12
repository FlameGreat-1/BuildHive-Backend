import { Pool, PoolClient } from 'pg';
import { 
  QuoteRepository,
  QuoteData, 
  QuoteWithRelations, 
  QuoteCreateData, 
  QuoteUpdateData,
  QuoteFilterOptions,
  QuoteListResult,
  QuoteSummary,
  QuoteStatusUpdateData,
  QuoteExpiryCheck,
  QuoteAnalytics,
  QuoteItemData
} from '../types';
import { QuoteModel, QuoteRecord, QuoteWithRelationsRecord, QuoteItemModel, QuoteItemRecord } from '../models';
import { calculateQuoteTotal, generateQuoteNumber, generateQuoteItemSortOrder } from '../utils';
import { quoteQueries, quoteTableNames, quoteColumnNames } from '../../config/quotes';
import { connection } from '../../shared/database';
import { logger } from '../../shared/utils';
import { AppError } from '../../shared/utils';
import { HTTP_STATUS_CODES } from '../../config/auth';

export class QuoteRepositoryImpl implements QuoteRepository {
  private pool: Pool;

  constructor() {
    this.pool = connection;
  }

  async create(tradieId: number, data: QuoteCreateData): Promise<QuoteData> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      const calculations = calculateQuoteTotal(data.items, data.gstEnabled);
      const quoteNumber = generateQuoteNumber();
      
      const quoteRecord = QuoteModel.toCreateRecord(tradieId, data, quoteNumber, calculations);
      const sanitizedRecord = QuoteModel.sanitizeRecord(quoteRecord);
      
      const validationErrors = QuoteModel.validateRecord(sanitizedRecord);
      if (validationErrors.length > 0) {
        throw new AppError(
          `Quote validation failed: ${validationErrors.join(', ')}`,
          HTTP_STATUS_CODES.BAD_REQUEST,
          'QUOTE_VALIDATION_ERROR'
        );
      }

      const quoteResult = await client.query(quoteQueries.CREATE_QUOTE, [
        sanitizedRecord.tradie_id,
        sanitizedRecord.client_id,
        sanitizedRecord.job_id,
        sanitizedRecord.quote_number,
        sanitizedRecord.title,
        sanitizedRecord.description,
        sanitizedRecord.status,
        sanitizedRecord.subtotal,
        sanitizedRecord.gst_amount,
        sanitizedRecord.total_amount,
        sanitizedRecord.gst_enabled,
        sanitizedRecord.valid_until,
        sanitizedRecord.terms_conditions,
        sanitizedRecord.notes
      ]);

      const quote = QuoteModel.fromRecord(quoteResult.rows[0]);
      const items: QuoteItemData[] = [];

      for (let i = 0; i < data.items.length; i++) {
        const item = data.items[i];
        const sortOrder = i + 1;
        
        const itemRecord = QuoteItemModel.toCreateRecord(quote.id, item, sortOrder);
        const sanitizedItemRecord = QuoteItemModel.sanitizeRecord(itemRecord);
        
        const itemValidationErrors = QuoteItemModel.validateRecord(sanitizedItemRecord);
        if (itemValidationErrors.length > 0) {
          throw new AppError(
            `Quote item validation failed: ${itemValidationErrors.join(', ')}`,
            HTTP_STATUS_CODES.BAD_REQUEST,
            'QUOTE_VALIDATION_ERROR'
          );
        }

        const itemResult = await client.query(quoteQueries.CREATE_QUOTE_ITEM, [
          sanitizedItemRecord.quote_id,
          sanitizedItemRecord.item_type,
          sanitizedItemRecord.description,
          sanitizedItemRecord.quantity,
          sanitizedItemRecord.unit,
          sanitizedItemRecord.unit_price,
          sanitizedItemRecord.total_price,
          sanitizedItemRecord.sort_order
        ]);

        items.push(QuoteItemModel.fromRecord(itemResult.rows[0]));
      }

      await client.query('COMMIT');

      logger.info('Quote created successfully', {
        quoteId: quote.id,
        quoteNumber: quote.quoteNumber,
        tradieId,
        itemCount: items.length,
        totalAmount: quote.totalAmount
      });

      return { ...quote, items };

    } catch (error) {
      await client.query('ROLLBACK');
      
      logger.error('Failed to create quote', {
        tradieId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        'Failed to create quote',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'QUOTE_CREATION_ERROR'
      );
    } finally {
      client.release();
    }
  }

  async findById(id: number): Promise<QuoteWithRelations | null> {
    try {
      const result = await this.pool.query(quoteQueries.GET_QUOTE_BY_ID, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const quote = QuoteModel.fromRecordWithRelations(result.rows[0]);
      const items = await this.getQuoteItems(id);
      
      return { ...quote, items };

    } catch (error) {
      logger.error('Failed to find quote by ID', {
        quoteId: id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Failed to retrieve quote',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'QUOTE_RETRIEVAL_ERROR'
      );
    }
  }

  async findByNumber(quoteNumber: string): Promise<QuoteWithRelations | null> {
    try {
      const result = await this.pool.query(quoteQueries.GET_QUOTE_BY_NUMBER, [quoteNumber]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const quote = QuoteModel.fromRecordWithRelations(result.rows[0]);
      const items = await this.getQuoteItems(quote.id);
      
      return { ...quote, items };

    } catch (error) {
      logger.error('Failed to find quote by number', {
        quoteNumber,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Failed to retrieve quote',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'QUOTE_RETRIEVAL_ERROR'
      );
    }
  }

  async findByTradie(tradieId: number, filters: QuoteFilterOptions): Promise<QuoteListResult> {
    try {
      const offset = ((filters.page || 1) - 1) * (filters.limit || 20);
      
      const result = await this.pool.query(quoteQueries.SEARCH_QUOTES, [
        tradieId,
        filters.status || null,
        filters.clientId || null,
        filters.jobId || null,
        filters.startDate || null,
        filters.endDate || null,
        filters.searchTerm || null,
        filters.sortBy || 'created_at',
        filters.sortOrder || 'desc',
        filters.limit || 20,
        offset
      ]);

      const quotes = result.rows.map(row => QuoteModel.fromRecordWithRelations(row));
      
      for (const quote of quotes) {
        quote.items = await this.getQuoteItems(quote.id);
      }

      const countResult = await this.pool.query(quoteQueries.COUNT_QUOTES_BY_TRADIE, [tradieId]);
      const total = parseInt(countResult.rows[0].total);

      const summaryResult = await this.pool.query(quoteQueries.COUNT_QUOTES_BY_STATUS, [tradieId]);
      const summary = this.buildQuoteSummary(summaryResult.rows, total);

      const totalPages = Math.ceil(total / (filters.limit || 20));
      const currentPage = filters.page || 1;

      return {
        quotes,
        summary,
        pagination: {
          page: currentPage,
          limit: filters.limit || 20,
          total,
          totalPages,
          hasNext: currentPage < totalPages,
          hasPrev: currentPage > 1
        }
      };

    } catch (error) {
      logger.error('Failed to find quotes by tradie', {
        tradieId,
        filters,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Failed to retrieve quotes',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'QUOTE_RETRIEVAL_ERROR'
      );
    }
  }
  
  async findByClient(clientId: number, filters: QuoteFilterOptions): Promise<QuoteListResult> {
    try {
      const offset = ((filters.page || 1) - 1) * (filters.limit || 20);
      
      const result = await this.pool.query(quoteQueries.GET_QUOTES_BY_CLIENT, [
        clientId,
        filters.limit || 20,
        offset
      ]);

      const quotes = result.rows.map(row => QuoteModel.fromRecordWithRelations(row));
      
      for (const quote of quotes) {
        quote.items = await this.getQuoteItems(quote.id);
      }

      const countResult = await this.pool.query(
        'SELECT COUNT(*) as total FROM quotes WHERE client_id = $1',
        [clientId]
      );
      const total = parseInt(countResult.rows[0].total);

      const summaryResult = await this.pool.query(
        'SELECT status, COUNT(*) as count FROM quotes WHERE client_id = $1 GROUP BY status',
        [clientId]
      );
      const summary = this.buildQuoteSummary(summaryResult.rows, total);

      const totalPages = Math.ceil(total / (filters.limit || 20));
      const currentPage = filters.page || 1;

      return {
        quotes,
        summary,
        pagination: {
          page: currentPage,
          limit: filters.limit || 20,
          total,
          totalPages,
          hasNext: currentPage < totalPages,
          hasPrev: currentPage > 1
        }
      };

    } catch (error) {
      logger.error('Failed to find quotes by client', {
        clientId,
        filters,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Failed to retrieve quotes',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'QUOTE_RETRIEVAL_ERROR'
      );
    }
  }

  async findByPaymentStatus(
    paymentStatus: string,
    tradieId?: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<QuoteWithRelations[]> {
    try {
      let query = `
        SELECT q.*, 
               c.name as client_name,
               c.email as client_email,
               c.phone as client_phone
        FROM quotes q
        LEFT JOIN clients c ON q.client_id = c.id
        WHERE q.payment_status = $1
      `;
      
      const params: any[] = [paymentStatus];
      
      if (tradieId) {
        query += ` AND q.tradie_id = $${params.length + 1}`;
        params.push(tradieId);
      }
      
      query += ` ORDER BY q.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(limit, offset);

      const result = await this.pool.query(query, params);
      const quotes = result.rows.map(row => QuoteModel.fromRecordWithRelations(row));
      
      for (const quote of quotes) {
        quote.items = await this.getQuoteItems(quote.id);
      }

      logger.info('Quotes retrieved by payment status', {
        paymentStatus,
        tradieId,
        count: quotes.length
      });

      return quotes;

    } catch (error) {
      logger.error('Failed to find quotes by payment status', {
        paymentStatus,
        tradieId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Failed to retrieve quotes by payment status',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'QUOTE_PAYMENT_STATUS_ERROR'
      );
    }
  }

  async update(id: number, tradieId: number, data: QuoteUpdateData): Promise<QuoteData> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      let calculations;
      if (data.items) {
        calculations = calculateQuoteTotal(data.items, data.gstEnabled ?? true);
      }

      const updateRecord = QuoteModel.toUpdateRecord(data, calculations);
      const sanitizedRecord = QuoteModel.sanitizeRecord(updateRecord);

      const result = await client.query(quoteQueries.UPDATE_QUOTE, [
        id,
        sanitizedRecord.title,
        sanitizedRecord.description,
        sanitizedRecord.status,
        sanitizedRecord.subtotal,
        sanitizedRecord.gst_amount,
        sanitizedRecord.total_amount,
        sanitizedRecord.gst_enabled,
        sanitizedRecord.valid_until,
        sanitizedRecord.terms_conditions,
        sanitizedRecord.notes
      ]);

      if (result.rows.length === 0) {
        throw new AppError(
          'Quote not found or unauthorized',
          HTTP_STATUS_CODES.NOT_FOUND,
          'QUOTE_NOT_FOUND'
        );
      }

      const quote = QuoteModel.fromRecord(result.rows[0]);

      if (data.items) {
        await client.query(quoteQueries.DELETE_QUOTE_ITEMS, [id]);
        
        const items: QuoteItemData[] = [];
        for (let i = 0; i < data.items.length; i++) {
          const item = data.items[i];
          const sortOrder = i + 1;
          
          const itemRecord = QuoteItemModel.toCreateRecord(quote.id, item, sortOrder);
          const sanitizedItemRecord = QuoteItemModel.sanitizeRecord(itemRecord);

          const itemResult = await client.query(quoteQueries.CREATE_QUOTE_ITEM, [
            sanitizedItemRecord.quote_id,
            sanitizedItemRecord.item_type,
            sanitizedItemRecord.description,
            sanitizedItemRecord.quantity,
            sanitizedItemRecord.unit,
            sanitizedItemRecord.unit_price,
            sanitizedItemRecord.total_price,
            sanitizedItemRecord.sort_order
          ]);

          items.push(QuoteItemModel.fromRecord(itemResult.rows[0]));
        }
        quote.items = items;
      } else {
        quote.items = await this.getQuoteItems(id);
      }

      await client.query('COMMIT');

      logger.info('Quote updated successfully', {
        quoteId: id,
        tradieId,
        updatedFields: Object.keys(data)
      });

      return quote;

    } catch (error) {
      await client.query('ROLLBACK');
      
      logger.error('Failed to update quote', {
        quoteId: id,
        tradieId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        'Failed to update quote',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'QUOTE_UPDATE_ERROR'
      );
    } finally {
      client.release();
    }
  }

  async updateStatus(id: number, tradieId: number, data: QuoteStatusUpdateData): Promise<QuoteData> {
    try {
      const result = await this.pool.query(quoteQueries.UPDATE_QUOTE_STATUS, [id, data.status]);

      if (result.rows.length === 0) {
        throw new AppError(
          'Quote not found or unauthorized',
          HTTP_STATUS_CODES.NOT_FOUND,
          'QUOTE_NOT_FOUND'
        );
      }

      const quote = QuoteModel.fromRecord(result.rows[0]);
      quote.items = await this.getQuoteItems(id);

      logger.info('Quote status updated successfully', {
        quoteId: id,
        tradieId,
        newStatus: data.status,
        reason: data.reason
      });

      return quote;

    } catch (error) {
      logger.error('Failed to update quote status', {
        quoteId: id,
        tradieId,
        status: data.status,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        'Failed to update quote status',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'QUOTE_STATUS_UPDATE_ERROR'
      );
    }
  }

  async updatePaymentStatus(quoteId: number, paymentStatus: string, paymentId?: string): Promise<QuoteData> {
    try {
      const result = await this.pool.query(quoteQueries.UPDATE_PAYMENT_STATUS, [
        quoteId, 
        paymentStatus, 
        paymentId
      ]);

      if (result.rows.length === 0) {
        throw new AppError(
          'Quote not found',
          HTTP_STATUS_CODES.NOT_FOUND,
          'QUOTE_NOT_FOUND'
        );
      }

      const quote = QuoteModel.fromRecord(result.rows[0]);
      quote.items = await this.getQuoteItems(quoteId);

      logger.info('Quote payment status updated successfully', {
        quoteId,
        paymentStatus,
        paymentId
      });

      return quote;

    } catch (error) {
      logger.error('Failed to update quote payment status', {
        quoteId,
        paymentStatus,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        'Failed to update quote payment status',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'QUOTE_PAYMENT_UPDATE_ERROR'
      );
    }
  }

  async delete(id: number, tradieId: number): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      await client.query(quoteQueries.DELETE_QUOTE_ITEMS, [id]);
      const result = await client.query(quoteQueries.DELETE_QUOTE, [id, tradieId]);

      if (result.rowCount === 0) {
        throw new AppError(
          'Quote not found or unauthorized',
          HTTP_STATUS_CODES.NOT_FOUND,
          'QUOTE_NOT_FOUND'
        );
      }

      await client.query('COMMIT');

      logger.info('Quote deleted successfully', {
        quoteId: id,
        tradieId
      });

    } catch (error) {
      await client.query('ROLLBACK');
      
      logger.error('Failed to delete quote', {
        quoteId: id,
        tradieId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        'Failed to delete quote',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'QUOTE_DELETE_ERROR'
      );
    } finally {
      client.release();
    }
  }

  async findExpiring(hours: number): Promise<QuoteExpiryCheck[]> {
    try {
      const expiryDate = new Date();
      expiryDate.setHours(expiryDate.getHours() + hours);

      const result = await this.pool.query(quoteQueries.GET_EXPIRING_QUOTES, [expiryDate]);

      return result.rows.map(row => ({
        quoteId: row.id,
        quoteNumber: row.quote_number,
        tradieId: row.tradie_id,
        clientId: row.client_id,
        validUntil: row.valid_until,
        daysUntilExpiry: Math.ceil((new Date(row.valid_until).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      }));

    } catch (error) {
      logger.error('Failed to find expiring quotes', {
        hours,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Failed to retrieve expiring quotes',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'QUOTE_EXPIRY_CHECK_ERROR'
      );
    }
  }

  async expireQuotes(): Promise<number> {
    try {
      const result = await this.pool.query(quoteQueries.EXPIRE_QUOTES);
      
      logger.info('Expired quotes processed', {
        expiredCount: result.rowCount
      });

      return result.rowCount || 0;

    } catch (error) {
      logger.error('Failed to expire quotes', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Failed to expire quotes',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'QUOTE_EXPIRY_ERROR'
      );
    }
  }

  async getAnalytics(tradieId: number, startDate: Date, endDate: Date): Promise<QuoteAnalytics> {
    try {
      const analyticsQuery = `
        SELECT 
          COUNT(*) as total_quotes,
          COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted_quotes,
          AVG(total_amount) as average_quote_value,
          AVG(EXTRACT(EPOCH FROM (accepted_at - sent_at))/3600) as average_response_time,
          COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as paid_quotes,
          COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) as pending_payment_quotes,
          COUNT(CASE WHEN payment_status = 'refunded' THEN 1 END) as refunded_quotes,
          SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END) as total_revenue,
          SUM(CASE WHEN payment_status = 'pending' THEN total_amount ELSE 0 END) as pending_revenue
        FROM quotes 
        WHERE tradie_id = $1 AND created_at BETWEEN $2 AND $3
      `;

      const result = await this.pool.query(analyticsQuery, [tradieId, startDate, endDate]);
      const stats = result.rows[0];

      const totalQuotes = parseInt(stats.total_quotes) || 0;
      const acceptedQuotes = parseInt(stats.accepted_quotes) || 0;
      const acceptanceRate = totalQuotes > 0 ? (acceptedQuotes / totalQuotes) * 100 : 0;

      return {
        totalQuotes,
        acceptanceRate: parseFloat(acceptanceRate.toFixed(2)),
        averageQuoteValue: parseFloat(stats.average_quote_value) || 0,
        averageResponseTime: parseFloat(stats.average_response_time) || 0,
        topPerformingServices: [],
        monthlyTrends: [],
        paymentMetrics: {
          paid: parseInt(stats.paid_quotes) || 0,
          pendingPayment: parseInt(stats.pending_payment_quotes) || 0,
          refunded: parseInt(stats.refunded_quotes) || 0,
          totalRevenue: parseFloat(stats.total_revenue) || 0,
          pendingRevenue: parseFloat(stats.pending_revenue) || 0
        }
      };

    } catch (error) {
      logger.error('Failed to get quote analytics', {
        tradieId,
        startDate,
        endDate,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Failed to retrieve quote analytics',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'QUOTE_ANALYTICS_ERROR'
      );
    }
  }

  private async getQuoteItems(quoteId: number): Promise<QuoteItemData[]> {
    const result = await this.pool.query(quoteQueries.GET_QUOTE_ITEMS, [quoteId]);
    return result.rows.map(row => QuoteItemModel.fromRecord(row));
  }

  private buildQuoteSummary(statusCounts: any[], total: number): QuoteSummary {
    const summary: QuoteSummary = {
      total,
      draft: 0,
      sent: 0,
      viewed: 0,
      accepted: 0,
      rejected: 0,
      expired: 0,
      cancelled: 0,
      paid: 0,
      pendingPayment: 0,
      refunded: 0,
      totalRevenue: 0,
      pendingRevenue: 0
    };

    statusCounts.forEach(row => {
      const status = row.status as keyof QuoteSummary;
      const count = parseInt(row.count);
      if (status in summary && typeof summary[status] === 'number') {
        (summary as any)[status] = count;
      }
    });

    return summary;
  }
}
