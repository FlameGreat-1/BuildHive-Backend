import { CreditTransactionRepository } from '../repositories';
import { 
  CreditTransaction,
  CreditTransactionRequest,
  CreditTransactionResponse,
  CreditTransactionHistory,
  CreditTransactionSummary,
  CreditTransactionFilter,
  CreditTransactionResult
} from '../types';
import { CreditTransactionModel } from '../models';
import { CreditService } from './credit.service';
import { CreditNotificationService } from './credit-notification.service';
import { 
  generateTransactionId,
  getTransactionDescription,
  calculateBalanceAfterTransaction,
  validateTransactionAmount,
  validateCreditUsage
} from '../utils';
import { logger } from '../../shared/utils';
import { 
  CreditTransactionType,
  CreditTransactionStatus,
  CreditUsageType
} from '../../shared/types';
import { 
  CREDIT_USAGE_CONFIGS,
  validateUsageLimit
} from '../../config/credits';

export class CreditTransactionService {
  private transactionRepository: CreditTransactionRepository;
  private creditService: CreditService;
  private notificationService: CreditNotificationService;

  constructor() {
    this.transactionRepository = new CreditTransactionRepository();
    this.creditService = new CreditService();
    this.notificationService = new CreditNotificationService();
  }

  async createTransaction(
    userId: number,
    request: CreditTransactionRequest
  ): Promise<CreditTransactionResponse> {
    try {
      const validation = validateTransactionAmount(request.credits, request.transactionType);
      
      if (!validation.valid) {
        throw new Error(validation.reason);
      }

      const balance = await this.creditService.getCreditBalance(userId);
      const balanceBefore = balance.currentBalance;

      if (request.transactionType === CreditTransactionType.USAGE) {
        if (!request.usageType) {
          throw new Error('Usage type is required for usage transactions');
        }

        const usageValidation = validateCreditUsage(
          request.usageType,
          request.credits,
          balanceBefore,
          0,
          0
        );

        if (!usageValidation.valid) {
          throw new Error(usageValidation.reason);
        }
      }

      const transaction = CreditTransactionModel.fromRequest(userId, request);
      const createdTransaction = await this.transactionRepository.createTransaction(transaction.toJSON());

      let balanceAfter = balanceBefore;

      try {
        if (createdTransaction.isCreditsAddition()) {
          await this.creditService.addCredits(userId, request.credits, 'transaction');
        } else if (createdTransaction.isCreditsDeduction()) {
          await this.creditService.deductCredits(userId, request.credits, 'transaction');
        }

        const updatedBalance = await this.creditService.getCreditBalance(userId);
        balanceAfter = updatedBalance.currentBalance;

        await this.transactionRepository.updateTransactionStatus(
          createdTransaction.id,
          CreditTransactionStatus.COMPLETED
        );

        createdTransaction.complete();

        await this.notificationService.sendTransactionNotification(
          userId,
          createdTransaction.toJSON()
        );

        logger.info('Credit transaction completed', {
          userId,
          transactionId: createdTransaction.id,
          transactionType: request.transactionType,
          credits: request.credits,
          balanceBefore,
          balanceAfter
        });

      } catch (error) {
        await this.transactionRepository.updateTransactionStatus(
          createdTransaction.id,
          CreditTransactionStatus.FAILED,
          { failureReason: error instanceof Error ? error.message : 'Unknown error' }
        );

        createdTransaction.fail(error instanceof Error ? error.message : 'Unknown error');

        logger.error('Credit transaction failed', {
          userId,
          transactionId: createdTransaction.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        throw error;
      }

      return createdTransaction.toResponse(balanceBefore, balanceAfter);
    } catch (error) {
      logger.error('Failed to create credit transaction', {
        userId,
        request,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async processJobApplicationCredit(
    userId: number,
    jobId: number,
    creditsRequired: number
  ): Promise<CreditTransactionResponse> {
    try {
      const request: CreditTransactionRequest = {
        transactionType: CreditTransactionType.USAGE,
        credits: creditsRequired,
        description: `Job application for job #${jobId}`,
        referenceId: jobId,
        referenceType: 'job',
        usageType: CreditUsageType.JOB_APPLICATION,
        metadata: {
          jobId,
          usageType: CreditUsageType.JOB_APPLICATION
        }
      };

      return await this.createTransaction(userId, request);
    } catch (error) {
      logger.error('Failed to process job application credit', {
        userId,
        jobId,
        creditsRequired,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async processProfileBoostCredit(
    userId: number,
    boostType: string,
    duration: number,
    creditsRequired: number
  ): Promise<CreditTransactionResponse> {
    try {
      const request: CreditTransactionRequest = {
        transactionType: CreditTransactionType.USAGE,
        credits: creditsRequired,
        description: `Profile boost - ${boostType} for ${duration} days`,
        usageType: CreditUsageType.PROFILE_BOOST,
        metadata: {
          boostType,
          duration,
          usageType: CreditUsageType.PROFILE_BOOST
        }
      };

      return await this.createTransaction(userId, request);
    } catch (error) {
      logger.error('Failed to process profile boost credit', {
        userId,
        boostType,
        duration,
        creditsRequired,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async processPremiumJobUnlock(
    userId: number,
    jobId: number,
    creditsRequired: number
  ): Promise<CreditTransactionResponse> {
    try {
      const request: CreditTransactionRequest = {
        transactionType: CreditTransactionType.USAGE,
        credits: creditsRequired,
        description: `Premium job unlock for job #${jobId}`,
        referenceId: jobId,
        referenceType: 'job',
        usageType: CreditUsageType.PREMIUM_JOB_UNLOCK,
        metadata: {
          jobId,
          usageType: CreditUsageType.PREMIUM_JOB_UNLOCK
        }
      };

      return await this.createTransaction(userId, request);
    } catch (error) {
      logger.error('Failed to process premium job unlock credit', {
        userId,
        jobId,
        creditsRequired,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async getTransactionById(transactionId: number): Promise<CreditTransactionModel | null> {
    try {
      return await this.transactionRepository.getTransactionById(transactionId);
    } catch (error) {
      logger.error('Failed to get transaction by ID', {
        transactionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async getTransactionHistory(
    userId: number,
    filter?: CreditTransactionFilter
  ): Promise<CreditTransactionHistory> {
    try {
      return await this.transactionRepository.getTransactionHistory(userId, filter);
    } catch (error) {
      logger.error('Failed to get transaction history', {
        userId,
        filter,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async getTransactionSummary(
    userId: number,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<CreditTransactionSummary> {
    try {
      return await this.transactionRepository.getTransactionSummary(userId, dateFrom, dateTo);
    } catch (error) {
      logger.error('Failed to get transaction summary', {
        userId,
        dateFrom,
        dateTo,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async cancelTransaction(transactionId: number, reason: string): Promise<CreditTransactionModel> {
    try {
      const transaction = await this.transactionRepository.getTransactionById(transactionId);
      
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      if (transaction.status !== CreditTransactionStatus.PENDING) {
        throw new Error('Only pending transactions can be cancelled');
      }

      const updatedTransaction = await this.transactionRepository.updateTransactionStatus(
        transactionId,
        CreditTransactionStatus.CANCELLED,
        { cancellationReason: reason }
      );

      await this.notificationService.sendTransactionCancellationNotification(
        transaction.userId,
        transaction.toJSON(),
        reason
      );

      logger.info('Transaction cancelled', {
        transactionId,
        userId: transaction.userId,
        reason
      });

      return updatedTransaction;
    } catch (error) {
      logger.error('Failed to cancel transaction', {
        transactionId,
        reason,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async refundTransaction(
    transactionId: number,
    refundAmount: number,
    reason: string
  ): Promise<CreditTransactionResponse> {
    try {
      const originalTransaction = await this.transactionRepository.getTransactionById(transactionId);
      
      if (!originalTransaction) {
        throw new Error('Original transaction not found');
      }

      if (originalTransaction.status !== CreditTransactionStatus.COMPLETED) {
        throw new Error('Only completed transactions can be refunded');
      }

      if (refundAmount > originalTransaction.credits) {
        throw new Error('Refund amount cannot exceed original transaction amount');
      }

      const refundRequest: CreditTransactionRequest = {
        transactionType: CreditTransactionType.REFUND,
        credits: refundAmount,
        description: `Refund for transaction #${transactionId}: ${reason}`,
        referenceId: transactionId,
        referenceType: 'transaction',
        metadata: {
          originalTransactionId: transactionId,
          refundReason: reason
        }
      };

      const refundResponse = await this.createTransaction(originalTransaction.userId, refundRequest);

      logger.info('Transaction refunded', {
        originalTransactionId: transactionId,
        refundTransactionId: refundResponse.transactionId,
        userId: originalTransaction.userId,
        refundAmount,
        reason
      });

      return refundResponse;
    } catch (error) {
      logger.error('Failed to refund transaction', {
        transactionId,
        refundAmount,
        reason,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async processExpiringTransactions(): Promise<void> {
    try {
      const expiringTransactions = await this.transactionRepository.getExpiringTransactions(7);

      for (const transaction of expiringTransactions) {
        const expiryRequest: CreditTransactionRequest = {
          transactionType: CreditTransactionType.EXPIRY,
          credits: transaction.credits,
          description: `Credit expiry for transaction #${transaction.id}`,
          referenceId: transaction.id,
          referenceType: 'transaction',
          metadata: {
            originalTransactionId: transaction.id,
            expiryDate: transaction.expiresAt
          }
        };

        await this.createTransaction(transaction.userId, expiryRequest);

        await this.notificationService.sendCreditExpiryNotification(
          transaction.userId,
          transaction.credits
        );

        logger.info('Processed expiring transaction', {
          transactionId: transaction.id,
          userId: transaction.userId,
          credits: transaction.credits
        });
      }
    } catch (error) {
      logger.error('Failed to process expiring transactions', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async validateTransactionRequest(
    userId: number,
    request: CreditTransactionRequest
  ): Promise<CreditTransactionResult> {
    try {
      const amountValidation = validateTransactionAmount(request.credits, request.transactionType);
      
      if (!amountValidation.valid) {
        return {
          success: false,
          balanceBefore: 0,
          balanceAfter: 0,
          credits: request.credits,
          message: amountValidation.reason || 'Invalid transaction amount',
          errorCode: 'INVALID_AMOUNT'
        };
      }

      if (request.transactionType === CreditTransactionType.USAGE) {
        const balance = await this.creditService.getCreditBalance(userId);
        
        if (balance.currentBalance < request.credits) {
          return {
            success: false,
            balanceBefore: balance.currentBalance,
            balanceAfter: balance.currentBalance,
            credits: request.credits,
            message: 'Insufficient credit balance',
            errorCode: 'INSUFFICIENT_BALANCE'
          };
        }
      }

      return {
        success: true,
        balanceBefore: 0,
        balanceAfter: 0,
        credits: request.credits,
        message: 'Transaction validation successful'
      };
    } catch (error) {
      logger.error('Failed to validate transaction request', {
        userId,
        request,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        success: false,
        balanceBefore: 0,
        balanceAfter: 0,
        credits: request.credits,
        message: 'Validation failed due to system error',
        errorCode: 'SYSTEM_ERROR'
      };
    }
  }
}
