import { CreditRepository } from '../repositories';
import { AutoTopup, AutoTopupSettings, CreditPurchaseRequest } from '../types';
import { AutoTopupModel } from '../models';
import { CreditService } from './credit.service';
import { CreditPurchaseService } from './credit-purchase.service';
import { CreditNotificationService } from './credit-notification.service';
import { UserService } from '../../auth/services';
import { StripeService } from '../../payment/services/stripe.service';
import { 
  validateAutoTopupSettings,
  calculateAutoTopupAmount,
  shouldTriggerLowBalanceAlert
} from '../utils';
import { logger } from '../../shared/utils';
import { 
  AutoTopupStatus,
  CreditPackageType,
  CreditTransactionStatus,
  PaymentMethod,
  PaymentType
} from '../../shared/types';
import { 
  AUTO_TOPUP_LIMITS,
  CREDIT_PACKAGES
} from '../../config/credits';

export class AutoTopupService {
  private creditRepository: CreditRepository;
  private _creditService?: CreditService;
  private purchaseService: CreditPurchaseService;
  private notificationService: CreditNotificationService;
  private userService: UserService;
  private stripeService: StripeService;

  constructor() {
    this.creditRepository = new CreditRepository();
    this.purchaseService = new CreditPurchaseService();
    this.notificationService = new CreditNotificationService();
    this.userService = new UserService();
    this.stripeService = new StripeService();
  }

  private get creditService(): CreditService {
    if (!this._creditService) {
      this._creditService = new CreditService();
    }
    return this._creditService;
  }

  async setupAutoTopup(userId: number, settings: AutoTopupSettings): Promise<AutoTopupModel> {
    try {
      const validation = validateAutoTopupSettings(
        settings.triggerBalance,
        settings.topupAmount,
        settings.packageType
      );

      if (!validation.valid) {
        throw new Error(validation.reason);
      }

      const user = await this.userService.getUserById(userId.toString());
      if (!user) {
        throw new Error('User not found');
      }

      const existingSettings = await this.creditRepository.getAutoTopupSettings(userId);
      
      if (existingSettings) {
        const updatedSettings = await this.creditRepository.updateAutoTopupSettings(userId, {
          status: settings.enabled ? AutoTopupStatus.ENABLED : AutoTopupStatus.DISABLED,
          triggerBalance: settings.triggerBalance,
          topupAmount: settings.topupAmount,
          packageType: settings.packageType,
          paymentMethodId: settings.paymentMethodId,
          failureCount: 0
        });

        logger.info('Auto topup settings updated', {
          userId,
          enabled: settings.enabled,
          triggerBalance: settings.triggerBalance,
          topupAmount: settings.topupAmount
        });

        return updatedSettings;
      } else {
        const newSettings = await this.creditRepository.createAutoTopupSettings({
          userId,
          status: settings.enabled ? AutoTopupStatus.ENABLED : AutoTopupStatus.DISABLED,
          triggerBalance: settings.triggerBalance,
          topupAmount: settings.topupAmount,
          packageType: settings.packageType,
          paymentMethodId: settings.paymentMethodId,
          failureCount: 0
        });

        logger.info('Auto topup settings created', {
          userId,
          enabled: settings.enabled,
          triggerBalance: settings.triggerBalance,
          topupAmount: settings.topupAmount
        });

        return newSettings;
      }
    } catch (error) {
      logger.error('Failed to setup auto topup', {
        userId,
        settings,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async getAutoTopupSettings(userId: number): Promise<AutoTopupModel | null> {
    try {
      return await this.creditRepository.getAutoTopupSettings(userId);
    } catch (error) {
      logger.error('Failed to get auto topup settings', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async enableAutoTopup(userId: number): Promise<AutoTopupModel> {
    try {
      const settings = await this.creditRepository.getAutoTopupSettings(userId);
      
      if (!settings) {
        throw new Error('Auto topup settings not found');
      }

      const updatedSettings = await this.creditRepository.updateAutoTopupSettings(userId, {
        status: AutoTopupStatus.ENABLED,
        failureCount: 0
      });

      logger.info('Auto topup enabled', { userId });

      return updatedSettings;
    } catch (error) {
      logger.error('Failed to enable auto topup', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async disableAutoTopup(userId: number): Promise<AutoTopupModel> {
    try {
      const settings = await this.creditRepository.getAutoTopupSettings(userId);
      
      if (!settings) {
        throw new Error('Auto topup settings not found');
      }

      const updatedSettings = await this.creditRepository.updateAutoTopupSettings(userId, {
        status: AutoTopupStatus.DISABLED
      });

      logger.info('Auto topup disabled', { userId });

      return updatedSettings;
    } catch (error) {
      logger.error('Failed to disable auto topup', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async triggerAutoTopup(userId: number): Promise<void> {
    try {
      const settings = await this.creditRepository.getAutoTopupSettings(userId);
      
      if (!settings || !settings.isEnabled()) {
        logger.warn('Auto topup not enabled for user', { userId });
        return;
      }

      const balance = await this.creditService.getCreditBalance(userId);
      
      if (!settings.shouldTrigger(balance.currentBalance)) {
        logger.info('Auto topup trigger condition not met', {
          userId,
          currentBalance: balance.currentBalance,
          triggerBalance: settings.triggerBalance
        });
        return;
      }

      await this.creditRepository.updateAutoTopupSettings(userId, {
        status: AutoTopupStatus.PROCESSING
      });

      try {
        const packageInfo = CREDIT_PACKAGES[settings.packageType];
        
        const purchaseRequest: CreditPurchaseRequest = {
          packageType: settings.packageType,
          paymentMethodId: settings.paymentMethodId,
          autoTopup: true
        };

        const paymentIntent = await this.stripeService.createPaymentIntent({
          amount: Math.round(packageInfo.price * 100),
          currency: 'aud',
          paymentMethod: PaymentMethod.STRIPE_CARD,
          paymentType: PaymentType.CREDIT_PURCHASE,
          metadata: {
            userId: userId.toString(),
            autoTopup: 'true',
            packageType: settings.packageType,
            credits: packageInfo.totalCredits.toString()
          }
        });

        if (paymentIntent.status === 'succeeded') {
          await this.creditService.addCredits(
            userId,
            packageInfo.totalCredits,
            'auto-topup'
          );

          await this.creditRepository.updateAutoTopupSettings(userId, {
            status: AutoTopupStatus.ENABLED,
            lastTriggeredAt: new Date(),
            failureCount: 0
          });

          await this.notificationService.sendAutoTopupNotification(
            userId,
            packageInfo.totalCredits,
            packageInfo.price
          );

          logger.info('Auto topup completed successfully', {
            userId,
            credits: packageInfo.totalCredits,
            amount: packageInfo.price,
            paymentIntentId: paymentIntent.paymentIntentId
          });
        } else {
          throw new Error(`Payment failed with status: ${paymentIntent.status}`);
        }
      } catch (error) {
        await this.handleAutoTopupFailure(userId, error instanceof Error ? error.message : 'Unknown error');
        throw error;
      }
    } catch (error) {
      logger.error('Failed to trigger auto topup', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async checkAndProcessAutoTopups(): Promise<void> {
    try {
      const lowBalanceUsers = await this.creditRepository.getUsersWithLowBalance(
        AUTO_TOPUP_LIMITS.MIN_TRIGGER_BALANCE
      );

      for (const userId of lowBalanceUsers) {
        try {
          await this.triggerAutoTopup(userId);
        } catch (error) {
          logger.error('Failed to process auto topup for user', {
            userId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      logger.info('Auto topup check completed', {
        usersChecked: lowBalanceUsers.length
      });
    } catch (error) {
      logger.error('Failed to check and process auto topups', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async updatePaymentMethod(userId: number, paymentMethodId: number): Promise<AutoTopupModel> {
    try {
      const settings = await this.creditRepository.getAutoTopupSettings(userId);
      
      if (!settings) {
        throw new Error('Auto topup settings not found');
      }

      const updatedSettings = await this.creditRepository.updateAutoTopupSettings(userId, {
        paymentMethodId,
        failureCount: 0
      });

      if (settings.isSuspended()) {
        await this.creditRepository.updateAutoTopupSettings(userId, {
          status: AutoTopupStatus.ENABLED
        });
      }

      logger.info('Auto topup payment method updated', {
        userId,
        paymentMethodId
      });

      return updatedSettings;
    } catch (error) {
      logger.error('Failed to update auto topup payment method', {
        userId,
        paymentMethodId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async getAutoTopupHistory(userId: number, limit: number = 10): Promise<any[]> {
    try {
      const history = await this.creditRepository.getCreditUsageHistory(userId, {
        limit,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });

      return history
        .filter(usage => usage.description.includes('auto-topup'))
        .map(usage => ({
          id: usage.id,
          credits: usage.creditsUsed,
          description: usage.description,
          createdAt: usage.createdAt,
          metadata: usage.metadata
        }));
    } catch (error) {
      logger.error('Failed to get auto topup history', {
        userId,
        limit,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async validateAutoTopupEligibility(userId: number): Promise<{
    eligible: boolean;
    reason?: string;
  }> {
    try {
      const user = await this.userService.getUserById(userId.toString());
      
      if (!user) {
        return {
          eligible: false,
          reason: 'User not found'
        };
      }

      const balance = await this.creditService.getCreditBalance(userId);
      
      if (balance.currentBalance > AUTO_TOPUP_LIMITS.MAX_TRIGGER_BALANCE) {
        return {
          eligible: false,
          reason: 'Current balance is too high for auto topup'
        };
      }

      const settings = await this.creditRepository.getAutoTopupSettings(userId);
      
      if (settings && settings.failureCount >= 3) {
        return {
          eligible: false,
          reason: 'Auto topup suspended due to multiple failures'
        };
      }

      return { eligible: true };
    } catch (error) {
      logger.error('Failed to validate auto topup eligibility', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        eligible: false,
        reason: 'System error during validation'
      };
    }
  }

  private async handleAutoTopupFailure(userId: number, errorMessage: string): Promise<void> {
    try {
      const settings = await this.creditRepository.getAutoTopupSettings(userId);
      
      if (!settings) {
        return;
      }

      const newFailureCount = settings.failureCount + 1;
      const shouldSuspend = newFailureCount >= 3;

      await this.creditRepository.updateAutoTopupSettings(userId, {
        status: shouldSuspend ? AutoTopupStatus.SUSPENDED : AutoTopupStatus.ENABLED,
        failureCount: newFailureCount
      });

      if (shouldSuspend) {
        const user = await this.userService.getUserById(userId.toString());
        
        if (user) {
          await this.notificationService.sendAutoTopupNotification(
            userId,
            0,
            0
          );
        }

        logger.warn('Auto topup suspended due to multiple failures', {
          userId,
          failureCount: newFailureCount,
          errorMessage
        });
      } else {
        logger.warn('Auto topup failed', {
          userId,
          failureCount: newFailureCount,
          errorMessage
        });
      }
    } catch (error) {
      logger.error('Failed to handle auto topup failure', {
        userId,
        errorMessage,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
