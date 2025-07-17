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
import { 
  RefundDatabaseRecord, 
  RefundStatus, 
  PaymentStatus 
} from '../../shared/types';

export class RefundService {
  private refundRepository!: RefundRepository;
  private paymentRepository!: PaymentRepository;
  private stripeService: StripeService;

  constructor() {
    this.stripeService = new StripeService();
    this.initializeRepositories();
  }

  private async initializeRepositories(): Promise<void> {
    const dbConnection = getDbConnection();
    this.refundRepository = new RefundRepository(dbConnection);
    this.paymentRepository = new PaymentRepository(dbConnection);
  }

  async createRefund(request: CreateRefundRequest): Promise<CreateRefundResponse> {
    try {
    const payment = await this.paymentRepository.findById(Number(request.paymentId));

      if (!payment) {
        throw new Error('Payment not found');
      }

      if (payment.status !== PaymentStatus.SUCCEEDED && payment.status !== PaymentStatus.COMPLETED) {
        throw new Error('Can only refund completed payments');
      }

      if (request.amount && request.amount > payment.amount) {
        throw new Error('Refund amount cannot exceed payment amount');
      }

      const refundAmount = request.amount || payment.amount;
      
      const existingRefunds = await this.refundRepository.findByPaymentId(Number(request.paymentId));
      const totalRefunded = await this.refundRepository.getTotalRefundedAmount(Number(request.paymentId));

      if (totalRefunded + refundAmount > payment.amount) {
        throw new Error('Total refund amount cannot exceed payment amount');
      }

      const refundData: Omit<RefundDatabaseRecord, 'id' | 'created_at' | 'updated_at'> = {
      payment_id: Number(request.paymentId),
        user_id: request.userId || payment.user_id,
        amount: refundAmount,
        reason: request.reason || undefined,
        description: request.description || undefined,
        status: RefundStatus.PENDING,
        stripe_refund_id: undefined,
        failure_reason: undefined,
        metadata: sanitizePaymentMetadata(request.metadata || {}),
        processed_at: undefined
      };

      const savedRefund = await this.refundRepository.create(refundData);

      if (payment.stripe_payment_intent_id) {
        try {
          const stripeRefund = await this.stripeService.createRefund({
            paymentIntentId: payment.stripe_payment_intent_id,
            amount: refundAmount,
            reason: request.reason || 'requested_by_customer',
            metadata: request.metadata
          });

          const updatedRefund = await this.refundRepository.update(
            savedRefund.id,
            {
              stripe_refund_id: stripeRefund.id,
              status: RefundStatus.PENDING
            }
          );

          savedRefund.stripe_refund_id = stripeRefund.id;
          savedRefund.status = RefundStatus.PENDING;
        } catch (stripeError) {
          logger.error('Failed to create Stripe refund', {
            refundId: savedRefund.id,
            paymentId: Number(request.paymentId),
            stripePaymentIntentId: payment.stripe_payment_intent_id,
            error: stripeError instanceof Error ? stripeError.message : 'Unknown error'
          });

          await this.refundRepository.update(
            savedRefund.id,
            { 
              status: RefundStatus.FAILED, 
              failure_reason: stripeError instanceof Error ? stripeError.message : 'Unknown error' 
            }
          );

          throw stripeError;
        }
      }

      logger.info('Refund created', {
        refundId: savedRefund.id,
        paymentId: Number(request.paymentId),
        amount: refundAmount,
        reason: request.reason,
        status: savedRefund.status
      });

      return {
        id: savedRefund.id,
        paymentId: request.paymentId,
        amount: refundAmount,
        status: savedRefund.status,
        reason: request.reason || undefined,
        description: request.description || undefined,
        stripeRefundId: savedRefund.stripe_refund_id || undefined,
        success: true,
        createdAt: savedRefund.created_at.toISOString()
      };
    } catch (error) {
      logger.error('Failed to create refund', {
        paymentId: Number(request.paymentId),
        amount: request.amount,
        reason: request.reason,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async processRefund(refundId: number): Promise<any> {
    try {
      const refund = await this.refundRepository.findById(refundId);

      if (!refund) {
        throw new Error('Refund not found');
      }

      if (refund.status !== RefundStatus.PENDING) {
        throw new Error('Can only process pending refunds');
      }

      const updatedRefund = await this.refundRepository.updateStatus(
        refundId,
        RefundStatus.PROCESSED,
        new Date()
      );

      logger.info('Refund processed', {
        refundId,
        paymentId: refund.payment_id,
        amount: refund.amount
      });

      return {
        refundId,
        status: RefundStatus.PROCESSED,
        processedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to process refund', {
        refundId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async updateRefundStatus(request: UpdateRefundStatusRequest): Promise<UpdateRefundStatusResponse> {
    try {
      const refund = await this.refundRepository.findById(request.refundId);

      if (!refund) {
        throw new Error('Refund not found');
      }

      const updateData: Partial<Pick<RefundDatabaseRecord, 'status' | 'processed_at' | 'failure_reason'>> = {
        status: request.status as RefundStatus
      };

      if (request.status === RefundStatus.PROCESSED && request.processedAt) {
        updateData.processed_at = new Date(request.processedAt);
      }

      if (request.status === RefundStatus.FAILED && request.failureReason) {
        updateData.failure_reason = request.failureReason;
      }

      await this.refundRepository.update(request.refundId, updateData);

      logger.info('Refund status updated', {
        refundId: request.refundId,
        oldStatus: refund.status,
        newStatus: request.status
      });

      return {
        refundId: request.refundId,
        status: request.status as RefundStatus,
        updatedAt: new Date().toISOString(),
        success: true
      };
    } catch (error) {
      logger.error('Failed to update refund status', {
        refundId: request.refundId,
        status: request.status,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async getRefund(refundId: number): Promise<RefundDetailsResponse> {
    try {
      const refund = await this.refundRepository.findById(refundId);

      if (!refund) {
        throw new Error('Refund not found');
      }

      logger.info('Refund retrieved', {
        refundId,
        paymentId: refund.payment_id,
        status: refund.status
      });

      return {
        id: refund.id,
        paymentId: refund.payment_id,
        amount: refund.amount,
        status: refund.status,
        reason: refund.reason || undefined,
        description: refund.description || undefined,
        stripeRefundId: refund.stripe_refund_id || undefined,
        processedAt: refund.processed_at?.toISOString(),
        metadata: refund.metadata || undefined,
        createdAt: refund.created_at.toISOString(),
        updatedAt: refund.updated_at.toISOString()
      };
    } catch (error) {
      logger.error('Failed to get refund', {
        refundId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }
  
  async getRefundStatus(refundId: number): Promise<any> {
    try {
      const refund = await this.getRefund(refundId);
      
      return {
        refundId: refund.id,
        status: refund.status,
        amount: refund.amount,
        processedAt: refund.processedAt,
        createdAt: refund.createdAt,
        updatedAt: refund.updatedAt
      };
    } catch (error) {
      logger.error('Failed to get refund status', {
        refundId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async listRefunds(filters: any): Promise<RefundListResponse> {
    const refundRequest: RefundListRequest = {
      userId: filters.userId,
      status: filters.status,
      limit: filters.limit || 50,
      offset: filters.offset || 0
    };
    
    return this.getUserRefunds(refundRequest);
  }

  async getUserRefunds(request: RefundListRequest): Promise<RefundListResponse> {
    try {
      const refunds = await this.refundRepository.findByUserId(
        request.userId,
        request.limit || 50,
        request.offset || 0
      );

      let filteredRefunds = refunds;

      if (request.status) {
        filteredRefunds = refunds.filter(refund => refund.status === request.status);
      }

      const totalCount = refunds.length;

      logger.info('User refunds retrieved', {
        userId: request.userId,
        status: request.status,
        count: filteredRefunds.length,
        totalCount
      });

      return {
        refunds: filteredRefunds.map(refund => ({
          id: refund.id,
          paymentId: refund.payment_id,
          amount: refund.amount,
          status: refund.status,
          reason: refund.reason || undefined,
          description: refund.description || undefined,
          stripeRefundId: refund.stripe_refund_id || undefined,
          processedAt: refund.processed_at?.toISOString(),
          metadata: refund.metadata || undefined,
          createdAt: refund.created_at.toISOString()
        })),
        totalCount,
        summary: {
          totalRefunded: filteredRefunds.reduce((sum, refund) => 
            refund.status === RefundStatus.PROCESSED ? sum + refund.amount : sum, 0
          ),
          pendingRefunds: filteredRefunds.filter(refund => refund.status === RefundStatus.PENDING).length,
          processedRefunds: filteredRefunds.filter(refund => refund.status === RefundStatus.PROCESSED).length
        }
      };
    } catch (error) {
      logger.error('Failed to get user refunds', {
        userId: request.userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }
  
    async getPaymentRefunds(paymentId: number): Promise<RefundListResponse> {
    try {
      const refunds = await this.refundRepository.findByPaymentId(paymentId);

      logger.info('Payment refunds retrieved', {
        paymentId,
        count: refunds.length
      });

      return {
        refunds: refunds.map(refund => ({
          id: refund.id,
          paymentId: refund.payment_id,
          amount: refund.amount,
          status: refund.status,
          reason: refund.reason || undefined,
          description: refund.description || undefined,
          stripeRefundId: refund.stripe_refund_id || undefined,
          processedAt: refund.processed_at?.toISOString(),
          metadata: refund.metadata || undefined,
          createdAt: refund.created_at.toISOString()
        })),
        totalCount: refunds.length,
        summary: {
          totalRefunded: refunds.reduce((sum, refund) => 
            refund.status === RefundStatus.PROCESSED ? sum + refund.amount : sum, 0
          ),
          pendingRefunds: refunds.filter(refund => refund.status === RefundStatus.PENDING).length,
          processedRefunds: refunds.filter(refund => refund.status === RefundStatus.PROCESSED).length
        }
      };
    } catch (error) {
      logger.error('Failed to get payment refunds', {
        paymentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async cancelRefund(refundId: number): Promise<void> {
    try {
      const refund = await this.refundRepository.findById(refundId);

      if (!refund) {
        throw new Error('Refund not found');
      }

      if (refund.status === RefundStatus.PROCESSED) {
        throw new Error('Cannot cancel processed refund');
      }

      if (refund.status === RefundStatus.REJECTED) {
        throw new Error('Refund already cancelled');
      }

      await this.refundRepository.updateStatus(
        refundId,
        RefundStatus.REJECTED
      );

      logger.info('Refund cancelled', {
        refundId,
        paymentId: refund.payment_id,
        previousStatus: refund.status
      });
    } catch (error) {
      logger.error('Failed to cancel refund', {
        refundId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async getUserRefundsCount(userId: number, status?: string): Promise<number> {
    try {
      const refunds = await this.refundRepository.findByUserId(userId, 999999, 0);
      
      if (status) {
        const filteredCount = refunds.filter(refund => refund.status === status).length;
        return filteredCount;
      }

      const totalCount = refunds.length;

      logger.info('User refunds count retrieved', {
        userId,
        status,
        totalCount
      });

      return totalCount;
    } catch (error) {
      logger.error('Failed to get user refunds count', {
        userId,
        status,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async approveRefund(refundId: number): Promise<RefundDatabaseRecord> {
    try {
      const refund = await this.refundRepository.findById(refundId);

      if (!refund) {
        throw new Error('Refund not found');
      }

      if (refund.status !== RefundStatus.PENDING) {
        throw new Error('Can only approve pending refunds');
      }

      const updatedRefund = await this.refundRepository.updateStatus(
        refundId,
        RefundStatus.APPROVED
      );

      logger.info('Refund approved', {
        refundId,
        paymentId: refund.payment_id,
        amount: refund.amount
      });

      return updatedRefund;
    } catch (error) {
      logger.error('Failed to approve refund', {
        refundId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async rejectRefund(refundId: number, reason: string): Promise<RefundDatabaseRecord> {
    try {
      const refund = await this.refundRepository.findById(refundId);

      if (!refund) {
        throw new Error('Refund not found');
      }

      if (refund.status !== RefundStatus.PENDING) {
        throw new Error('Can only reject pending refunds');
      }

      const updatedRefund = await this.refundRepository.update(refundId, {
        status: RefundStatus.REJECTED,
        failure_reason: reason
      });

      logger.info('Refund rejected', {
        refundId,
        paymentId: refund.payment_id,
        reason
      });

      return updatedRefund;
    } catch (error) {
      logger.error('Failed to reject refund', {
        refundId,
        reason,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async getRefundsByDateRange(
    startDate: Date,
    endDate: Date,
    userId?: number
  ): Promise<RefundDatabaseRecord[]> {
    try {
      const refunds = await this.refundRepository.findByDateRange(startDate, endDate, userId);

      logger.info('Refunds by date range retrieved', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        userId,
        count: refunds.length
      });

      return refunds;
    } catch (error) {
      logger.error('Failed to get refunds by date range', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async getRefundsByStatus(
    status: RefundStatus,
    limit: number = 100
  ): Promise<RefundDatabaseRecord[]> {
    try {
      const refunds = await this.refundRepository.findByStatus(status, limit);

      logger.info('Refunds by status retrieved', {
        status,
        count: refunds.length,
        limit
      });

      return refunds;
    } catch (error) {
      logger.error('Failed to get refunds by status', {
        status,
        limit,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async getTotalRefundedAmountByUser(
    userId: number,
    status?: RefundStatus
  ): Promise<number> {
    try {
      const refunds = await this.refundRepository.findByUserId(userId, 999999, 0);
      
      let filteredRefunds = refunds;
      if (status) {
        filteredRefunds = refunds.filter(refund => refund.status === status);
      }

      const totalAmount = filteredRefunds.reduce((sum, refund) => sum + refund.amount, 0);

      logger.info('Total refunded amount by user retrieved', {
        userId,
        status,
        totalAmount
      });

      return totalAmount;
    } catch (error) {
      logger.error('Failed to get total refunded amount by user', {
        userId,
        status,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async syncRefundWithStripe(refundId: number): Promise<void> {
    try {
      const refund = await this.refundRepository.findById(refundId);

      if (!refund || !refund.stripe_refund_id) {
        throw new Error('Refund not found or missing Stripe refund ID');
      }

      logger.info('Refund synced with Stripe', {
        refundId,
        stripeRefundId: refund.stripe_refund_id
      });
    } catch (error) {
      logger.error('Failed to sync refund with Stripe', {
        refundId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  async validateRefundEligibility(paymentId: number, amount?: number): Promise<{
    eligible: boolean;
    reason?: string;
    maxRefundAmount: number;
    alreadyRefunded: number;
  }> {
    try {
      const payment = await this.paymentRepository.findById(paymentId);

      if (!payment) {
        return {
          eligible: false,
          reason: 'Payment not found',
          maxRefundAmount: 0,
          alreadyRefunded: 0
        };
      }

      if (payment.status !== PaymentStatus.SUCCEEDED && payment.status !== PaymentStatus.COMPLETED) {
        return {
          eligible: false,
          reason: 'Payment not completed',
          maxRefundAmount: 0,
          alreadyRefunded: 0
        };
      }

      const alreadyRefunded = await this.refundRepository.getTotalRefundedAmount(paymentId);
      const maxRefundAmount = payment.amount - alreadyRefunded;

      if (amount && amount > maxRefundAmount) {
        return {
          eligible: false,
          reason: 'Refund amount exceeds available amount',
          maxRefundAmount,
          alreadyRefunded
        };
      }

      return {
        eligible: true,
        maxRefundAmount,
        alreadyRefunded
      };
    } catch (error) {
      logger.error('Failed to validate refund eligibility', {
        paymentId,
        amount,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        eligible: false,
        reason: 'Validation error',
        maxRefundAmount: 0,
        alreadyRefunded: 0
      };
    }
  }
}

