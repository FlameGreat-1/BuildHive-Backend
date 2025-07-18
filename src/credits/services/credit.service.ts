import { CreditRepository } from '../repositories';
import { 
  CreditBalance,
  CreditDashboard,
  CreditBalanceCheck,
  CreditValidationResult,
  CreditLimits,
  CreditExpiry
} from '../types';
import { 
  CreditBalanceModel,
  CreditUsageModel,
  AutoTopupModel,
  CreditNotificationModel
} from '../models';
import { 
  buildCreditDashboard,
  shouldTriggerLowBalanceAlert,
  shouldTriggerCriticalBalanceAlert,
  getExpiringCredits,
  validateCreditSufficiency,
  getRecommendedTopupAmount,
  calculateUsageBreakdown
} from '../utils';
import { UserService } from '../../auth/services';
import { CreditNotificationService } from './credit-notification.service';
import { AutoTopupService } from './auto-topup.service';
import { logger } from '../../shared/utils';
import { 
  CREDIT_LIMITS,
  getLimitsForRole,
  TRIAL_CREDITS_AMOUNT
} from '../../config/credits';
import { UserRole } from '../../shared/types';

export class CreditService {
  private creditRepository: CreditRepository;
  private userService: UserService;
  private notificationService: CreditNotificationService;
  private autoTopupService: AutoTopupService;

  constructor() {
    this.creditRepository = new CreditRepository();
    this.userService = new UserService();
    this.notificationService = new CreditNotificationService();
    this.autoTopupService = new AutoTopupService();
  }

  async getCreditBalance(userId: number): Promise<CreditBalanceModel> {
    try {
      let balance = await this.creditRepository.getCreditBalance(userId);
      
      if (!balance) {
        balance = await this.creditRepository.createCreditBalance(userId, 0);
        logger.info('Created new credit balance', { userId, balance: 0 });
      }

      return balance;
    } catch (error) {
      logger.error('Failed to get credit balance', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async awardTrialCredits(userId: number): Promise<CreditBalanceModel> {
    try {
      const existingBalance = await this.creditRepository.getCreditBalance(userId);
      
      if (existingBalance) {
        logger.warn('Trial credits already awarded or balance exists', { userId });
        return existingBalance;
      }

      const balance = await this.creditRepository.createCreditBalance(userId, TRIAL_CREDITS_AMOUNT);
      
      await this.notificationService.sendTrialCreditsNotification(userId, TRIAL_CREDITS_AMOUNT);
      
      logger.info('Trial credits awarded', { 
        userId, 
        credits: TRIAL_CREDITS_AMOUNT 
      });

      return balance;
    } catch (error) {
      logger.error('Failed to award trial credits', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async addCredits(userId: number, credits: number, source: string = 'purchase'): Promise<CreditBalanceModel> {
    try {
      const balance = await this.getCreditBalance(userId);
      
      balance.addCredits(credits);
      
      const updatedBalance = await this.creditRepository.updateCreditBalance(userId, {
        currentBalance: balance.currentBalance,
        totalPurchased: balance.totalPurchased,
        lastPurchaseAt: balance.lastPurchaseAt
      });

      await this.checkAndTriggerNotifications(userId, updatedBalance.currentBalance);

      logger.info('Credits added to balance', {
        userId,
        credits,
        source,
        newBalance: updatedBalance.currentBalance
      });

      return updatedBalance;
    } catch (error) {
      logger.error('Failed to add credits', {
        userId,
        credits,
        source,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async deductCredits(userId: number, credits: number, reason: string = 'usage'): Promise<CreditBalanceModel> {
    try {
      const balance = await this.getCreditBalance(userId);
      
      if (!balance.hasSufficientBalance(credits)) {
        throw new Error(`Insufficient credits. Required: ${credits}, Available: ${balance.currentBalance}`);
      }

      const success = balance.deductCredits(credits);
      
      if (!success) {
        throw new Error('Failed to deduct credits');
      }

      const updatedBalance = await this.creditRepository.updateCreditBalance(userId, {
        currentBalance: balance.currentBalance,
        totalUsed: balance.totalUsed,
        lastUsageAt: balance.lastUsageAt
      });

      await this.checkAndTriggerNotifications(userId, updatedBalance.currentBalance);
      await this.checkAutoTopupTrigger(userId, updatedBalance.currentBalance);

      logger.info('Credits deducted from balance', {
        userId,
        credits,
        reason,
        newBalance: updatedBalance.currentBalance
      });

      return updatedBalance;
    } catch (error) {
      logger.error('Failed to deduct credits', {
        userId,
        credits,
        reason,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async refundCredits(userId: number, credits: number, reason: string = 'refund'): Promise<CreditBalanceModel> {
    try {
      const balance = await this.getCreditBalance(userId);
      
      balance.refundCredits(credits);
      
      const updatedBalance = await this.creditRepository.updateCreditBalance(userId, {
        currentBalance: balance.currentBalance,
        totalRefunded: balance.totalRefunded
      });

      await this.notificationService.sendRefundNotification(userId, credits, reason);

      logger.info('Credits refunded to balance', {
        userId,
        credits,
        reason,
        newBalance: updatedBalance.currentBalance
      });

      return updatedBalance;
    } catch (error) {
      logger.error('Failed to refund credits', {
        userId,
        credits,
        reason,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async checkCreditSufficiency(userId: number, requiredCredits: number): Promise<CreditBalanceCheck> {
    try {
      const balance = await this.getCreditBalance(userId);
      
      return validateCreditSufficiency(userId, balance.currentBalance, requiredCredits);
    } catch (error) {
      logger.error('Failed to check credit sufficiency', {
        userId,
        requiredCredits,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async getCreditDashboard(userId: number): Promise<CreditDashboard> {
    try {
      const balance = await this.getCreditBalance(userId);
      const recentTransactions = await this.creditRepository.getCreditUsageHistory(userId, {
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
      
      const usageData = await this.creditRepository.getCreditUsageHistory(userId, {
        dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        limit: 100
      });

      const autoTopupSettings = await this.creditRepository.getAutoTopupSettings(userId);
      const autoTopupStatus = autoTopupSettings?.status || 'disabled';

      const dashboard = buildCreditDashboard(
        balance.toJSON(),
        [],
        usageData.map(u => u.toJSON()),
        autoTopupStatus as any
      );

      return dashboard;
    } catch (error) {
      logger.error('Failed to get credit dashboard', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async getCreditLimits(userId: number): Promise<CreditLimits> {
    try {
      const user = await this.userService.getUserById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      return getLimitsForRole(user.role as UserRole);
    } catch (error) {
      logger.error('Failed to get credit limits', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async getExpiringCredits(userId: number, daysThreshold: number = 7): Promise<CreditExpiry[]> {
    try {
      const transactions = [];
      
      return getExpiringCredits(transactions, daysThreshold);
    } catch (error) {
      logger.error('Failed to get expiring credits', {
        userId,
        daysThreshold,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async processExpiredCredits(): Promise<void> {
    try {
      const expiredTransactions = [];
      
      for (const transaction of expiredTransactions) {
        await this.deductCredits(
          transaction.userId,
          transaction.credits,
          'Credit expiry'
        );

        await this.notificationService.sendCreditExpiryNotification(
          transaction.userId,
          transaction.credits
        );

        logger.info('Processed expired credits', {
          userId: transaction.userId,
          credits: transaction.credits,
          transactionId: transaction.id
        });
      }
    } catch (error) {
      logger.error('Failed to process expired credits', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async validateCreditOperation(
    userId: number,
    operation: 'purchase' | 'usage' | 'refund',
    amount: number
  ): Promise<CreditValidationResult> {
    try {
      const user = await this.userService.getUserById(userId);
      
      if (!user) {
        return {
          valid: false,
          reason: 'User not found'
        };
      }

      const limits = getLimitsForRole(user.role as UserRole);
      const balance = await this.getCreditBalance(userId);

      switch (operation) {
        case 'purchase':
          if (balance.currentBalance + amount > limits.maxCreditBalance) {
            return {
              valid: false,
              reason: `Credit balance would exceed maximum limit of ${limits.maxCreditBalance}`
            };
          }
          break;

        case 'usage':
          if (balance.currentBalance < amount) {
            return {
              valid: false,
              reason: 'Insufficient credit balance',
              suggestedAction: 'Purchase more credits to continue'
            };
          }
          break;

        case 'refund':
          if (amount <= 0) {
            return {
              valid: false,
              reason: 'Refund amount must be positive'
            };
          }
          break;
      }

      return { valid: true };
    } catch (error) {
      logger.error('Failed to validate credit operation', {
        userId,
        operation,
        amount,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        valid: false,
        reason: 'Validation failed due to system error'
      };
    }
  }

  private async checkAndTriggerNotifications(userId: number, currentBalance: number): Promise<void> {
    try {
      if (shouldTriggerCriticalBalanceAlert(currentBalance)) {
        await this.notificationService.sendCriticalBalanceAlert(userId, currentBalance);
      } else if (shouldTriggerLowBalanceAlert(currentBalance)) {
        await this.notificationService.sendLowBalanceAlert(userId, currentBalance);
      }
    } catch (error) {
      logger.error('Failed to check and trigger notifications', {
        userId,
        currentBalance,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async checkAutoTopupTrigger(userId: number, currentBalance: number): Promise<void> {
    try {
      const autoTopupSettings = await this.creditRepository.getAutoTopupSettings(userId);
      
      if (autoTopupSettings && autoTopupSettings.shouldTrigger(currentBalance)) {
        await this.autoTopupService.triggerAutoTopup(userId);
      }
    } catch (error) {
      logger.error('Failed to check auto topup trigger', {
        userId,
        currentBalance,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
