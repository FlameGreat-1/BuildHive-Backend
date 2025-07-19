import { CreditRepository } from '../repositories';
import { CreditTransaction, CreditPurchase, CreditNotification } from '../types';
import { EmailService, SmsService, UserService, ProfileService } from '../../auth/services';
import { logger } from '../../shared/utils';
import { formatCreditAmount, formatCurrency } from '../utils';

export class CreditNotificationService {
  private creditRepository: CreditRepository;
  private emailService: EmailService;
  private smsService: SmsService;
  private userService: UserService;
  private profileService: ProfileService;

  constructor() {
    this.creditRepository = new CreditRepository();
    this.emailService = new EmailService();
    this.smsService = new SmsService();
    this.userService = new UserService();
    this.profileService = new ProfileService();
  }

  async sendLowBalanceAlert(userId: number, currentBalance: number): Promise<void> {
    try {
      const user = await this.userService.getUserById(userId.toString());
      const profile = await this.profileService.getProfileByUserId(userId.toString());
      
      if (!user) {
        throw new Error('User not found');
      }

      const notification = await this.creditRepository.createCreditNotification({
        userId,
        notificationType: 'low_balance',
        thresholdBalance: currentBalance,
        isSent: false
      });

      if (!profile || profile.preferences.emailNotifications) {
        await this.emailService.sendCreditLowBalanceAlert(user.email, user.username, currentBalance);
      }

      if (profile?.phone && profile?.preferences?.smsNotifications && this.smsService.isServiceEnabled()) {
        await this.smsService.sendCreditLowBalanceAlert(profile.phone, user.username, currentBalance);
      }

      await this.creditRepository.markNotificationAsSent(notification.id);

      logger.info('Low balance alert sent', {
        userId,
        currentBalance,
        notificationId: notification.id
      });
    } catch (error) {
      logger.error('Failed to send low balance alert', {
        userId,
        currentBalance,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async sendCriticalBalanceAlert(userId: number, currentBalance: number): Promise<void> {
    try {
      const user = await this.userService.getUserById(userId.toString());
      const profile = await this.profileService.getProfileByUserId(userId.toString());
      
      if (!user) {
        throw new Error('User not found');
      }

      const notification = await this.creditRepository.createCreditNotification({
        userId,
        notificationType: 'critical_balance',
        thresholdBalance: currentBalance,
        isSent: false
      });

      if (!profile || profile.preferences.emailNotifications) {
        await this.emailService.sendCreditCriticalBalanceAlert(user.email, user.username, currentBalance);
      }

      if (profile?.phone && this.smsService.isServiceEnabled()) {
        await this.smsService.sendCreditCriticalBalanceAlert(profile.phone, user.username, currentBalance);
      }

      await this.creditRepository.markNotificationAsSent(notification.id);

      logger.info('Critical balance alert sent', {
        userId,
        currentBalance,
        notificationId: notification.id
      });
    } catch (error) {
      logger.error('Failed to send critical balance alert', {
        userId,
        currentBalance,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async sendTrialCreditsNotification(userId: number, creditsAwarded: number): Promise<void> {
    try {
      const user = await this.userService.getUserById(userId.toString());
      const profile = await this.profileService.getProfileByUserId(userId.toString());
      
      if (!user) {
        throw new Error('User not found');
      }

      if (!profile || profile.preferences.emailNotifications) {
        await this.emailService.sendCreditTrialNotification(user.email, user.username, creditsAwarded);
      }

      logger.info('Trial credits notification sent', {
        userId,
        creditsAwarded
      });
    } catch (error) {
      logger.error('Failed to send trial credits notification', {
        userId,
        creditsAwarded,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async sendPurchaseConfirmationNotification(userId: number, purchase: CreditPurchase): Promise<void> {
    try {
      const user = await this.userService.getUserById(userId.toString());
      const profile = await this.profileService.getProfileByUserId(userId.toString());
      
      if (!user) {
        throw new Error('User not found');
      }

      const totalCredits = purchase.creditsAmount + purchase.bonusCredits;

      const purchaseData = {
        id: purchase.id,
        creditsAmount: purchase.creditsAmount,
        bonusCredits: purchase.bonusCredits,
        purchasePrice: purchase.purchasePrice,
        currency: purchase.currency
      };

      if (!profile || profile.preferences.emailNotifications) {
        await this.emailService.sendCreditPurchaseConfirmation(user.email, user.username, purchaseData);
      }

      if (profile?.phone && profile?.preferences?.smsNotifications && this.smsService.isServiceEnabled()) {
        await this.smsService.sendCreditPurchaseConfirmation(profile.phone, user.username, totalCredits);
      }

      logger.info('Purchase confirmation notification sent', {
        userId,
        purchaseId: purchase.id,
        totalCredits
      });
    } catch (error) {
      logger.error('Failed to send purchase confirmation notification', {
        userId,
        purchaseId: purchase.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async sendTransactionNotification(userId: number, transaction: CreditTransaction): Promise<void> {
    try {
      const user = await this.userService.getUserById(userId.toString());
      const profile = await this.profileService.getProfileByUserId(userId.toString());
      
      if (!user) {
        return;
      }

      if (profile?.phone && profile?.preferences?.smsNotifications && this.smsService.isServiceEnabled()) {
        const smsMessage = `BuildHive: Transaction completed - ${transaction.transactionType}: ${formatCreditAmount(transaction.credits)} credits. ${transaction.description}`;
        await this.smsService.sendSMS(profile.phone, smsMessage);
      }

      logger.info('Transaction notification sent', {
        userId,
        transactionId: transaction.id,
        transactionType: transaction.transactionType
      });
    } catch (error) {
      logger.error('Failed to send transaction notification', {
        userId,
        transactionId: transaction.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async sendRefundNotification(userId: number, creditsRefunded: number, reason: string): Promise<void> {
    try {
      const user = await this.userService.getUserById(userId.toString());
      const profile = await this.profileService.getProfileByUserId(userId.toString());
      
      if (!user) {
        throw new Error('User not found');
      }

      if (!profile || profile.preferences.emailNotifications) {
        await this.emailService.sendCreditRefundNotification(user.email, user.username, creditsRefunded, reason);
      }

      logger.info('Refund notification sent', {
        userId,
        creditsRefunded,
        reason
      });
    } catch (error) {
      logger.error('Failed to send refund notification', {
        userId,
        creditsRefunded,
        reason,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async sendCreditExpiryNotification(userId: number, creditsExpired: number): Promise<void> {
    try {
      const user = await this.userService.getUserById(userId.toString());
      const profile = await this.profileService.getProfileByUserId(userId.toString());
      
      if (!user) {
        throw new Error('User not found');
      }

      if (!profile || profile.preferences.emailNotifications) {
        await this.emailService.sendCreditExpiryNotification(user.email, user.username, creditsExpired);
      }

      logger.info('Credit expiry notification sent', {
        userId,
        creditsExpired
      });
    } catch (error) {
      logger.error('Failed to send credit expiry notification', {
        userId,
        creditsExpired,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async sendAutoTopupNotification(userId: number, creditsAdded: number, amount: number): Promise<void> {
    try {
      const user = await this.userService.getUserById(userId.toString());
      const profile = await this.profileService.getProfileByUserId(userId.toString());
      
      if (!user) {
        throw new Error('User not found');
      }

      if (!profile || profile.preferences.emailNotifications) {
        await this.emailService.sendCreditAutoTopupNotification(user.email, user.username, creditsAdded, amount);
      }

      if (profile?.phone && profile?.preferences?.smsNotifications && this.smsService.isServiceEnabled()) {
        await this.smsService.sendCreditAutoTopupNotification(profile.phone, user.username, creditsAdded);
      }

      logger.info('Auto topup notification sent', {
        userId,
        creditsAdded,
        amount
      });
    } catch (error) {
      logger.error('Failed to send auto topup notification', {
        userId,
        creditsAdded,
        amount,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async sendTransactionCancellationNotification(
    userId: number,
    transaction: CreditTransaction,
    reason: string
  ): Promise<void> {
    try {
      const user = await this.userService.getUserById(userId.toString());
      const profile = await this.profileService.getProfileByUserId(userId.toString());
      
      if (!user) {
        throw new Error('User not found');
      }

      if (profile?.phone && profile?.preferences?.smsNotifications && this.smsService.isServiceEnabled()) {
        const smsMessage = `BuildHive: Transaction cancelled - ${transaction.transactionType}: ${formatCreditAmount(transaction.credits)} credits. Reason: ${reason}`;
        await this.smsService.sendSMS(profile.phone, smsMessage);
      }

      logger.info('Transaction cancellation notification sent', {
        userId,
        transactionId: transaction.id,
        reason
      });
    } catch (error) {
      logger.error('Failed to send transaction cancellation notification', {
        userId,
        transactionId: transaction.id,
        reason,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async sendPurchaseCancellationNotification(
    userId: number,
    purchase: CreditPurchase,
    reason: string
  ): Promise<void> {
    try {
      const user = await this.userService.getUserById(userId.toString());
      const profile = await this.profileService.getProfileByUserId(userId.toString());
      
      if (!user) {
        throw new Error('User not found');
      }

      if (profile?.phone && profile?.preferences?.smsNotifications && this.smsService.isServiceEnabled()) {
        const smsMessage = `BuildHive: Purchase cancelled - ${formatCurrency(purchase.purchasePrice, purchase.currency)}. Reason: ${reason}`;
        await this.smsService.sendSMS(profile.phone, smsMessage);
      }

      logger.info('Purchase cancellation notification sent', {
        userId,
        purchaseId: purchase.id,
        reason
      });
    } catch (error) {
      logger.error('Failed to send purchase cancellation notification', {
        userId,
        purchaseId: purchase.id,
        reason,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
