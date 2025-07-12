import { PAYMENT_CONSTANTS } from '../../config/payment';
import { logger } from '../../shared/utils';
import { RefundRepository, PaymentRepository } from '../repositories';
import { getDbConnection } from '../../shared/database';
import { 
  CreateRefundRequest,
  CreateRefundResponse,
  UpdateRefundStatusRequest,
  UpdateRefundStatusResponse,
  RefundListRequest,
  RefundListResponse,
  RefundDetailsResponse
} from '../types';
import { 
  validatePaymentAmount,
  sanitizePaymentMetadata
} from '../utils';
import { StripeService } from './stripe.service';

export class RefundService {
  private refundRepository!: RefundRepository;
  private paymentRepository!: PaymentRepository;
  private stripeService: StripeService;

  constructor() {
    this.initializeRepositories();
    this.stripeService = new StripeService();
  }

  private initializeRepositories(): void {
    getDbConnection().then(dbConnection => {
      this.refundRepository = new RefundRepository(dbConnection);
      this.paymentRepository = new PaymentRepository(dbConnection);
    });
  }

  async createRefund(
    request: CreateRefundRequest,
    requestId: string
  ): Promise<CreateRefundResponse> {
    try {
      const payment = await this.paymentRepository.getPaymentById(request.paymentId, requestId);

      if (!payment) {
        throw new Error('Payment not found');
      }

      if (payment.status !== 'completed') {
        throw new Error('Can only refund completed payments');
      }

      if (request.amount > payment.amount) {
        throw new Error('Refund amount cannot exceed payment amount');
      }

      const existingRefunds = await this.refundRepository.getRefundsByPaymentId(
        request.paymentId,
        requestId
      );

      const totalRefunded = existingRefunds
        .filter(refund => refund.status === 'processed')
        .reduce((sum, refund) => sum + refund.amount, 0);

      if (totalRefunded + request.amount > payment.amount) {
        throw new Error('Total refund amount cannot exceed payment amount');
      }

      const refundData = {
        paymentId: request.paymentId,
        userId: request.userId,
        amount: request.amount,
        reason: request.reason,
        description: request.description,
        status: 'pending',
        metadata: sanitizePaymentMetadata(request.metadata || {})
      };

      const savedRefund = await this.refundRepository.createRefund(refundData, requestId);

      if (payment.stripe_payment_intent_id) {
        try {
          const stripeRefund = await this.stripeService.createRefund(
            payment.stripe_payment_intent_id,
            request.amount,
            request.reason,
            requestId
          );

          await this.refundRepository.updateRefund(
            savedRefund.id,
            {
              stripeRefundId: stripeRefund.id,
              status: 'processing'
            },
            requestId
          );

          savedRefund.stripe_refund_id = stripeRefund.id;
          savedRefund.status = 'processing';
        } catch (stripeError) {
          logger.error('Failed to create Stripe refund', {
            refundId: savedRefund.id,
            paymentId: request.paymentId,
            stripePaymentIntentId: payment.stripe_payment_intent_id,
            error: stripeError instanceof Error ? stripeError.message : 'Unknown error',
            requestId
          });

          await this.refundRepository.updateRefund(
            savedRefund.id,
            { status: 'failed', failureReason: stripeError instanceof Error ? stripeError.message : 'Unknown error' },
            requestId
          );

          throw stripeError;
        }
      }

      logger.info('Refund created', {
        refundId: savedRefund.id,
        paymentId: request.paymentId,
        amount: request.amount,
        reason: request.reason,
        status: savedRefund.status,
        requestId
      });

      return {
        id: savedRefund.id,
        paymentId: request.paymentId,
        amount: request.amount,
        reason: request.reason,
        status: savedRefund.status,
        stripeRefundId: savedRefund.stripe_refund_id,
        createdAt: savedRefund.created_at
      };
    } catch (error) {
      logger.error('Failed to create refund', {
        paymentId: request.paymentId,
        amount: request.amount,
        reason: request.reason,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      throw error;
    }
  }

  async processRefund(refundId: number, requestId: string): Promise<any> {
    try {
      const refund = await this.refundRepository.getRefundById(refundId, requestId);

      if (!refund) {
        throw new Error('Refund not found');
      }

      if (refund.status !== 'pending') {
        throw new Error('Can only process pending refunds');
      }

      await this.refundRepository.updateRefund(
        refundId,
        { 
          status: 'processing',
          processedAt: new Date()
        },
        requestId
      );

      logger.info('Refund processed', {
        refundId,
        paymentId: refund.payment_id,
        amount: refund.amount,
        requestId
      });

      return {
        refundId,
        status: 'processing',
        processedAt: new Date()
      };
    } catch (error) {
      logger.error('Failed to process refund', {
        refundId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async updateRefundStatus(
    request: UpdateRefundStatusRequest,
    requestId: string
  ): Promise<UpdateRefundStatusResponse> {
    try {
      const refund = await this.refundRepository.getRefundById(request.refundId, requestId);

      if (!refund) {
        throw new Error('Refund not found');
      }

      const updateData: any = {
        status: request.status
      };

      if (request.status === 'processed' && request.processedAt) {
        updateData.processedAt = request.processedAt;
      }

      if (request.status === 'failed' && request.failureReason) {
        updateData.failureReason = request.failureReason;
      }

      await this.refundRepository.updateRefund(request.refundId, updateData, requestId);

      logger.info('Refund status updated', {
        refundId: request.refundId,
        oldStatus: refund.status,
        newStatus: request.status,
        requestId
      });

      return {
        refundId: request.refundId,
        status: request.status,
        updatedAt: new Date()
      };
    } catch (error) {
      logger.error('Failed to update refund status', {
        refundId: request.refundId,
        status: request.status,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      throw error;
    }
  }

  async getRefund(refundId: number, requestId: string): Promise<RefundDetailsResponse> {
    try {
      const refund = await this.refundRepository.getRefundById(refundId, requestId);

      if (!refund) {
        throw new Error('Refund not found');
      }

      logger.info('Refund retrieved', {
        refundId,
        paymentId: refund.payment_id,
        status: refund.status,
        requestId
      });

      return {
        id: refund.id,
        paymentId: refund.payment_id,
        userId: refund.user_id,
        amount: refund.amount,
        reason: refund.reason,
        description: refund.description,
        status: refund.status,
        stripeRefundId: refund.stripe_refund_id,
        processedAt: refund.processed_at,
        failureReason: refund.failure_reason,
        metadata: refund.metadata,
        createdAt: refund.created_at,
        updatedAt: refund.updated_at
      };
    } catch (error) {
      logger.error('Failed to get refund', {
        refundId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      throw error;
    }
  }

  async getRefundStatus(refundId: number, requestId: string): Promise<any> {
    try {
      const refund = await this.getRefund(refundId, requestId);
      
      return {
        refundId: refund.id,
        status: refund.status,
        amount: refund.amount,
        processedAt: refund.processedAt,
        failureReason: refund.failureReason,
        createdAt: refund.createdAt,
        updatedAt: refund.updatedAt
      };
    } catch (error) {
      logger.error('Failed to get refund status', {
        refundId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }

  async listRefunds(filters: any, requestId: string): Promise<RefundListResponse> {
    const refundRequest: RefundListRequest = {
      userId: filters.userId,
      status: filters.status,
      limit: filters.limit || 50,
      offset: filters.offset || 0
    };
    
    return this.getUserRefunds(refundRequest, requestId);
  }

  async getUserRefunds(
    request: RefundListRequest,
    requestId: string
  ): Promise<RefundListResponse> {
    try {
      const refunds = await this.refundRepository.getUserRefunds(
        request.userId,
        request.limit,
        request.offset,
        requestId
      );

      const totalCount = await this.getUserRefundsCount(
        request.userId,
        request.status,
        requestId
      );

      logger.info('User refunds retrieved', {
        userId: request.userId,
        status: request.status,
        count: refunds.length,
        totalCount,
        requestId
      });

      return {
        refunds: refunds.map(refund => ({
          id: refund.id,
          paymentId: refund.payment_id,
          amount: refund.amount,
          reason: refund.reason,
          description: refund.description,
          status: refund.status,
          stripeRefundId: refund.stripe_refund_id,
          processedAt: refund.processed_at,
          failureReason: refund.failure_reason,
          createdAt: refund.created_at,
          updatedAt: refund.updated_at
        })),
        totalCount,
        hasMore: (request.offset || 0) + refunds.length < totalCount
      };
    } catch (error) {
      logger.error('Failed to get user refunds', {
        userId: request.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      throw error;
    }
  }

  async getPaymentRefunds(paymentId: number, requestId: string): Promise<RefundListResponse> {
    try {
      const refunds = await this.refundRepository.getRefundsByPaymentId(paymentId, requestId);

      logger.info('Payment refunds retrieved', {
        paymentId,
        count: refunds.length,
        requestId
      });

      return {
        refunds: refunds.map(refund => ({
          id: refund.id,
          paymentId: refund.payment_id,
          amount: refund.amount,
          reason: refund.reason,
          description: refund.description,
          status: refund.status,
          stripeRefundId: refund.stripe_refund_id,
          processedAt: refund.processed_at,
          failureReason: refund.failure_reason,
          createdAt: refund.created_at,
          updatedAt: refund.updated_at
        })),
        totalCount: refunds.length,
        hasMore: false
      };
    } catch (error) {
      logger.error('Failed to get payment refunds', {
        paymentId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      throw error;
    }
  }

  async cancelRefund(refundId: number, requestId: string): Promise<void> {
    try {
      const refund = await this.refundRepository.getRefundById(refundId, requestId);

      if (!refund) {
        throw new Error('Refund not found');
      }

      if (refund.status === 'processed') {
        throw new Error('Cannot cancel processed refund');
      }

      if (refund.status === 'cancelled') {
        throw new Error('Refund already cancelled');
      }

      await this.refundRepository.updateRefund(
        refundId,
        { status: 'cancelled' },
        requestId
      );

      logger.info('Refund cancelled', {
        refundId,
        paymentId: refund.payment_id,
        previousStatus: refund.status,
        requestId
      });
    } catch (error) {
      logger.error('Failed to cancel refund', {
        refundId,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });

      throw error;
    }
  }

  async getUserRefundsCount(userId: number, status?: string, requestId?: string): Promise<number> {
    try {
      const refunds = await this.refundRepository.getUserRefunds(userId, 999999, 0, requestId || '');
      const filteredRefunds = status ? refunds.filter(refund => refund.status === status) : refunds;
      return filteredRefunds.length;
    } catch (error) {
      logger.error('Failed to get user refunds count', {
        userId,
        status,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw error;
    }
  }
}
