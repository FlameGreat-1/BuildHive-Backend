import { 
  PaymentIntentData,
  PaymentIntentResponse,
  PaymentResult,
  RefundData,
  RefundResult,
  InvoiceData,
  InvoiceResult,
  PaymentMethodData,
  PaymentHistoryItem,
  PaymentAnalytics,
  PaymentWebhookData,
  PaymentStatus,
  RefundStatus,
  PaymentMethodType
} from '../types/payment.types';
import { DatabaseClient, DatabaseTransaction } from '../../shared/types';
import { connection } from '../../shared/database';
import { 
  paymentTableNames,
  paymentColumnNames,
  paymentQueries,
  paymentCacheConfig
} from '../../config/quotes';
import { logger } from '../../shared/utils';
import { AppError } from '../../shared/utils';
import { HTTP_STATUS_CODES } from '../../config/auth';

export interface PaymentRepository {
  createPaymentIntent(data: PaymentIntentData): Promise<void>;
  updatePaymentStatus(quoteId: number, status: PaymentStatus, paymentId?: string, paymentMethodType?: string, failureReason?: string): Promise<void>;
  updateRefundStatus(quoteId: number, refundId: string, status: RefundStatus): Promise<void>;
  saveInvoiceRecord(quoteId: number, invoiceId: string, invoiceNumber: string): Promise<void>;
  getPaymentByQuoteId(quoteId: number): Promise<any>;
  getPaymentByIntentId(paymentIntentId: string): Promise<any>;
  getPaymentHistory(userId: number, userType: 'client' | 'tradie', limit: number, offset: number): Promise<PaymentHistoryItem[]>;
  getPaymentAnalytics(tradieId: number, startDate: Date, endDate: Date): Promise<PaymentAnalytics>;
  getMonthlyPaymentTrends(tradieId: number, startDate: Date, endDate: Date): Promise<any[]>;
  savePaymentMethod(data: PaymentMethodData): Promise<void>;
  getUserPaymentMethods(userId: number): Promise<any[]>;
  deletePaymentMethod(userId: number, paymentMethodId: string): Promise<void>;
  setDefaultPaymentMethod(userId: number, paymentMethodId: string): Promise<void>;
  saveWebhookEvent(stripeEventId: string, eventType: string, payload: any): Promise<void>;
  markWebhookProcessed(stripeEventId: string): Promise<void>;
  getUnprocessedWebhooks(limit: number): Promise<any[]>;
  cleanupOldWebhooks(): Promise<number>;
}

export class PaymentRepositoryImpl implements PaymentRepository {
  private db: DatabaseClient;

  constructor() {
    this.db = connection;
  }

  async createPaymentIntent(data: PaymentIntentData): Promise<void> {
    try {
      const query = paymentQueries.CREATE_PAYMENT_INTENT;
      
      await this.db.query(query, [
        data.quoteId,
        data.metadata.quoteNumber, // Using quote number as payment intent ID initially
        data.amount,
        data.currency
      ]);

      logger.info('Payment intent record created in database', {
        quoteId: data.quoteId,
        amount: data.amount,
        currency: data.currency
      });

    } catch (error) {
      logger.error('Failed to create payment intent record', {
        quoteId: data.quoteId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Failed to create payment intent record',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'PAYMENT_INTENT_DB_ERROR'
      );
    }
  }

  async updatePaymentStatus(
    quoteId: number, 
    status: PaymentStatus, 
    paymentId?: string, 
    paymentMethodType?: string, 
    failureReason?: string
  ): Promise<void> {
    try {
      const query = paymentQueries.UPDATE_PAYMENT_STATUS;
      
      await this.db.query(query, [
        quoteId,
        status,
        paymentId,
        paymentMethodType,
        failureReason
      ]);

      logger.info('Payment status updated in database', {
        quoteId,
        status,
        paymentId
      });

    } catch (error) {
      logger.error('Failed to update payment status', {
        quoteId,
        status,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Failed to update payment status',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'PAYMENT_STATUS_UPDATE_ERROR'
      );
    }
  }

  async updateRefundStatus(quoteId: number, refundId: string, status: RefundStatus): Promise<void> {
    try {
      const query = paymentQueries.UPDATE_REFUND_STATUS;
      
      await this.db.query(query, [quoteId, refundId, status]);

      logger.info('Refund status updated in database', {
        quoteId,
        refundId,
        status
      });

    } catch (error) {
      logger.error('Failed to update refund status', {
        quoteId,
        refundId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Failed to update refund status',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'REFUND_STATUS_UPDATE_ERROR'
      );
    }
  }

  async saveInvoiceRecord(quoteId: number, invoiceId: string, invoiceNumber: string): Promise<void> {
    try {
      const query = paymentQueries.SAVE_INVOICE_RECORD;
      
      await this.db.query(query, [quoteId, invoiceId, invoiceNumber]);

      logger.info('Invoice record saved in database', {
        quoteId,
        invoiceId,
        invoiceNumber
      });

    } catch (error) {
      logger.error('Failed to save invoice record', {
        quoteId,
        invoiceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Failed to save invoice record',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'INVOICE_SAVE_ERROR'
      );
    }
  }

  async getPaymentByQuoteId(quoteId: number): Promise<any> {
    try {
      const query = paymentQueries.GET_PAYMENT_BY_QUOTE_ID;
      const result = await this.db.query(query, [quoteId]);

      if (result.rows.length === 0) {
        return null;
      }

      const payment = result.rows[0];
      
      return {
        id: payment.id,
        quoteId: payment.quote_id,
        paymentIntentId: payment.payment_intent_id,
        paymentId: payment.payment_id,
        amount: parseFloat(payment.amount),
        currency: payment.currency,
        status: payment.status,
        paymentMethodType: payment.payment_method_type,
        stripeCustomerId: payment.stripe_customer_id,
        refundId: payment.refund_id,
        refundStatus: payment.refund_status,
        invoiceId: payment.invoice_id,
        invoiceNumber: payment.invoice_number,
        failureReason: payment.failure_reason,
        paidAt: payment.paid_at,
        refundedAt: payment.refunded_at,
        createdAt: payment.created_at,
        updatedAt: payment.updated_at
      };

    } catch (error) {
      logger.error('Failed to get payment by quote ID', {
        quoteId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Failed to retrieve payment',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'PAYMENT_RETRIEVAL_ERROR'
      );
    }
  }

  async getPaymentByIntentId(paymentIntentId: string): Promise<any> {
    try {
      const query = paymentQueries.GET_PAYMENT_BY_INTENT_ID;
      const result = await this.db.query(query, [paymentIntentId]);

      if (result.rows.length === 0) {
        return null;
      }

      const payment = result.rows[0];
      
      return {
        id: payment.id,
        quoteId: payment.quote_id,
        paymentIntentId: payment.payment_intent_id,
        paymentId: payment.payment_id,
        amount: parseFloat(payment.amount),
        currency: payment.currency,
        status: payment.status,
        paymentMethodType: payment.payment_method_type,
        stripeCustomerId: payment.stripe_customer_id,
        refundId: payment.refund_id,
        refundStatus: payment.refund_status,
        invoiceId: payment.invoice_id,
        invoiceNumber: payment.invoice_number,
        failureReason: payment.failure_reason,
        paidAt: payment.paid_at,
        refundedAt: payment.refunded_at,
        createdAt: payment.created_at,
        updatedAt: payment.updated_at
      };

    } catch (error) {
      logger.error('Failed to get payment by intent ID', {
        paymentIntentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Failed to retrieve payment',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'PAYMENT_RETRIEVAL_ERROR'
      );
    }
  }

  async getPaymentHistory(userId: number, userType: 'client' | 'tradie', limit: number, offset: number): Promise<PaymentHistoryItem[]> {
    try {
      const query = paymentQueries.GET_PAYMENT_HISTORY_BY_USER;
      const result = await this.db.query(query, [userId, userType, limit, offset]);

      return result.rows.map(row => ({
        id: row.id,
        quoteId: row.quote_id,
        quoteNumber: row.quote_number,
        amount: parseFloat(row.amount),
        currency: row.currency,
        status: row.status,
        paymentMethod: row.payment_method_type,
        createdAt: row.created_at,
        paidAt: row.paid_at,
        refundedAt: row.refunded_at,
        failureReason: row.failure_reason
      }));

    } catch (error) {
      logger.error('Failed to get payment history', {
        userId,
        userType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Failed to retrieve payment history',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'PAYMENT_HISTORY_ERROR'
      );
    }
  }
  
    async getPaymentAnalytics(tradieId: number, startDate: Date, endDate: Date): Promise<PaymentAnalytics> {
    try {
      const analyticsQuery = paymentQueries.GET_PAYMENT_ANALYTICS;
      const result = await this.db.query(analyticsQuery, [tradieId, startDate, endDate]);

      let totalPayments = 0;
      let totalAmount = 0;
      let successfulPayments = 0;
      let failedPayments = 0;
      let refundedPayments = 0;
      const paymentMethodBreakdown: { [key in PaymentMethodType]: number } = {} as any;

      result.rows.forEach(row => {
        totalPayments += parseInt(row.total_payments);
        totalAmount += parseFloat(row.total_amount || 0);
        successfulPayments += parseInt(row.successful_payments || 0);
        failedPayments += parseInt(row.failed_payments || 0);
        refundedPayments += parseInt(row.refunded_payments || 0);
        if (row.payment_method_type) {
          paymentMethodBreakdown[row.payment_method_type as PaymentMethodType] = parseInt(row.method_count);
        }
      });

      const monthlyTrends = await this.getMonthlyPaymentTrends(tradieId, startDate, endDate);

      return {
        totalPayments,
        totalAmount: parseFloat(totalAmount.toFixed(2)),
        successfulPayments,
        failedPayments,
        refundedPayments,
        averagePaymentAmount: totalPayments > 0 ? parseFloat((totalAmount / totalPayments).toFixed(2)) : 0,
        paymentMethodBreakdown,
        monthlyTrends
      };

    } catch (error) {
      logger.error('Failed to get payment analytics', {
        tradieId,
        startDate,
        endDate,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Failed to retrieve payment analytics',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'PAYMENT_ANALYTICS_ERROR'
      );
    }
  }

  async getMonthlyPaymentTrends(tradieId: number, startDate: Date, endDate: Date): Promise<any[]> {
    try {
      const query = paymentQueries.GET_MONTHLY_PAYMENT_TRENDS;
      const result = await this.db.query(query, [tradieId, startDate, endDate]);

      return result.rows.map(row => ({
        month: row.month.toISOString().substring(0, 7),
        paymentsCount: parseInt(row.payments_count),
        totalAmount: parseFloat(row.total_amount),
        successRate: parseFloat(row.success_rate || 0)
      }));

    } catch (error) {
      logger.error('Failed to get monthly payment trends', {
        tradieId,
        startDate,
        endDate,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Failed to retrieve payment trends',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'PAYMENT_TRENDS_ERROR'
      );
    }
  }

  async savePaymentMethod(data: PaymentMethodData): Promise<void> {
    try {
      const query = paymentQueries.SAVE_PAYMENT_METHOD;
      
      await this.db.query(query, [
        data.clientId,
        data.paymentMethodId,
        data.type,
        data.card?.brand || null,
        data.card?.last4 || null,
        data.card?.expiryMonth || null,
        data.card?.expiryYear || null,
        false // is_default - set to false by default
      ]);

      logger.info('Payment method saved in database', {
        clientId: data.clientId,
        paymentMethodId: data.paymentMethodId,
        type: data.type
      });

    } catch (error) {
      logger.error('Failed to save payment method', {
        clientId: data.clientId,
        paymentMethodId: data.paymentMethodId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Failed to save payment method',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'PAYMENT_METHOD_SAVE_ERROR'
      );
    }
  }

  async getUserPaymentMethods(userId: number): Promise<any[]> {
    try {
      const query = paymentQueries.GET_USER_PAYMENT_METHODS;
      const result = await this.db.query(query, [userId]);

      return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        paymentMethodId: row.payment_method_id,
        type: row.type,
        cardBrand: row.card_brand,
        cardLast4: row.card_last4,
        cardExpiryMonth: row.card_expiry_month,
        cardExpiryYear: row.card_expiry_year,
        isDefault: row.is_default,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));

    } catch (error) {
      logger.error('Failed to get user payment methods', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Failed to retrieve payment methods',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'PAYMENT_METHODS_RETRIEVAL_ERROR'
      );
    }
  }

  async updatePaymentStatus(quoteId: number, status: PaymentStatus, paymentId?: string): Promise<void> {
    try {
      const query = `
        UPDATE quotes 
        SET payment_status = $1, 
            payment_id = $2, 
            paid_at = CASE WHEN $1 = 'succeeded' THEN NOW() ELSE paid_at END,
            updated_at = NOW()
        WHERE id = $3
      `;
      
      const result = await this.db.query(query, [status, paymentId, quoteId]);

      if (result.rowCount === 0) {
        throw new AppError(
          'Quote not found',
          HTTP_STATUS_CODES.NOT_FOUND,
          'QUOTE_NOT_FOUND'
        );
      }

      logger.info('Quote payment status updated', {
        quoteId,
        status,
        paymentId
      });

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      logger.error('Failed to update quote payment status', {
        quoteId,
        status,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Failed to update payment status',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'PAYMENT_STATUS_UPDATE_ERROR'
      );
    }
  }

  async getPaymentSummary(quoteId: number): Promise<QuotePaymentSummary> {
    try {
      const query = `
        SELECT 
          q.id,
          q.quote_number,
          q.total_amount,
          q.payment_status,
          q.payment_id,
          q.paid_at,
          q.refund_id,
          q.refunded_at,
          CASE 
            WHEN q.payment_status = 'succeeded' AND q.paid_at IS NOT NULL 
            AND (NOW() - q.paid_at) < INTERVAL '90 days' 
            THEN true 
            ELSE false 
          END as can_refund,
          CASE 
            WHEN q.payment_status = 'succeeded' AND q.paid_at IS NOT NULL 
            AND (NOW() - q.paid_at) < INTERVAL '90 days' 
            THEN q.total_amount 
            ELSE 0 
          END as refundable_amount
        FROM quotes q
        WHERE q.id = $1
      `;
      
      const result = await this.db.query(query, [quoteId]);

      if (result.rows.length === 0) {
        throw new AppError(
          'Quote not found',
          HTTP_STATUS_CODES.NOT_FOUND,
          'QUOTE_NOT_FOUND'
        );
      }

      const row = result.rows[0];

      return {
        quoteId: row.id,
        quoteNumber: row.quote_number,
        totalAmount: parseFloat(row.total_amount),
        paymentStatus: row.payment_status,
        paymentId: row.payment_id,
        paidAt: row.paid_at,
        refundId: row.refund_id,
        refundedAt: row.refunded_at,
        canRefund: row.can_refund,
        refundableAmount: parseFloat(row.refundable_amount)
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      logger.error('Failed to get quote payment summary', {
        quoteId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Failed to retrieve payment summary',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'PAYMENT_SUMMARY_ERROR'
      );
    }
  }

  async deletePaymentMethod(userId: number, paymentMethodId: string): Promise<void> {
    try {
      const query = paymentQueries.DELETE_PAYMENT_METHOD;
      const result = await this.db.query(query, [userId, paymentMethodId]);

      if (result.rowCount === 0) {
        throw new AppError(
          'Payment method not found',
          HTTP_STATUS_CODES.NOT_FOUND,
          'PAYMENT_METHOD_NOT_FOUND'
        );
      }

      logger.info('Payment method deleted from database', {
        userId,
        paymentMethodId
      });

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      logger.error('Failed to delete payment method', {
        userId,
        paymentMethodId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Failed to delete payment method',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'PAYMENT_METHOD_DELETE_ERROR'
      );
    }
  }

  async setDefaultPaymentMethod(userId: number, paymentMethodId: string): Promise<void> {
    try {
      const query = paymentQueries.SET_DEFAULT_PAYMENT_METHOD;
      await this.db.query(query, [userId, paymentMethodId]);

      logger.info('Default payment method updated in database', {
        userId,
        paymentMethodId
      });

    } catch (error) {
      logger.error('Failed to set default payment method', {
        userId,
        paymentMethodId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Failed to set default payment method',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'DEFAULT_PAYMENT_METHOD_ERROR'
      );
    }
  }

  async saveWebhookEvent(stripeEventId: string, eventType: string, payload: any): Promise<void> {
    try {
      const query = paymentQueries.SAVE_WEBHOOK_EVENT;
      await this.db.query(query, [stripeEventId, eventType, JSON.stringify(payload)]);

      logger.info('Webhook event saved in database', {
        stripeEventId,
        eventType
      });

    } catch (error) {
      logger.error('Failed to save webhook event', {
        stripeEventId,
        eventType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Failed to save webhook event',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'WEBHOOK_SAVE_ERROR'
      );
    }
  }

  async markWebhookProcessed(stripeEventId: string): Promise<void> {
    try {
      const query = paymentQueries.MARK_WEBHOOK_PROCESSED;
      const result = await this.db.query(query, [stripeEventId]);

      if (result.rowCount === 0) {
        throw new AppError(
          'Webhook event not found',
          HTTP_STATUS_CODES.NOT_FOUND,
          'WEBHOOK_NOT_FOUND'
        );
      }

      logger.info('Webhook marked as processed in database', {
        stripeEventId
      });

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      logger.error('Failed to mark webhook as processed', {
        stripeEventId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Failed to mark webhook as processed',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'WEBHOOK_PROCESS_ERROR'
      );
    }
  }

  async getUnprocessedWebhooks(limit: number): Promise<any[]> {
    try {
      const query = paymentQueries.GET_UNPROCESSED_WEBHOOKS;
      const result = await this.db.query(query, [limit]);

      return result.rows.map(row => ({
        id: row.id,
        stripeEventId: row.stripe_event_id,
        eventType: row.event_type,
        processed: row.processed,
        payload: row.payload,
        createdAt: row.created_at,
        processedAt: row.processed_at
      }));

    } catch (error) {
      logger.error('Failed to get unprocessed webhooks', {
        limit,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Failed to retrieve unprocessed webhooks',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'UNPROCESSED_WEBHOOKS_ERROR'
      );
    }
  }

  async cleanupOldWebhooks(): Promise<number> {
    try {
      const query = paymentQueries.CLEANUP_OLD_WEBHOOKS;
      const result = await this.db.query(query);

      const deletedCount = result.rows[0]?.count || 0;

      logger.info('Old webhooks cleaned up from database', {
        deletedCount
      });

      return parseInt(deletedCount);

    } catch (error) {
      logger.error('Failed to cleanup old webhooks', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Failed to cleanup old webhooks',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'WEBHOOK_CLEANUP_ERROR'
      );
    }
  }

  async executeInTransaction<T>(callback: (transaction: DatabaseTransaction) => Promise<T>): Promise<T> {
    const transaction = await this.db.transaction();
    
    try {
      const result = await callback(transaction);
      await transaction.commit();
      return result;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

export const paymentRepository = new PaymentRepositoryImpl();

