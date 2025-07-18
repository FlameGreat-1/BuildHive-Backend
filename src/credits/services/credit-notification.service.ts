import { CreditRepository } from '../repositories';
import { CreditTransaction, CreditPurchase, CreditNotification } from '../types';
import { CreditNotificationModel } from '../models';
import { EmailService } from '../../auth/services/email.service';
import { SMSService } from '../../auth/services/sms.service';
import { UserService } from '../../auth/services';
import { logger } from '../../shared/utils';
import { formatCreditAmount, formatCurrency } from '../utils';

export class CreditNotificationService {
  private creditRepository: CreditRepository;
  private emailService: EmailService;
  private smsService: SMSService;
  private userService: UserService;

  constructor() {
    this.creditRepository = new CreditRepository();
    this.emailService = new EmailService();
    this.smsService = new SMSService();
    this.userService = new UserService();
  }

  async sendLowBalanceAlert(userId: number, currentBalance: number): Promise<void> {
    try {
      const user = await this.userService.getUserById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      const notification = await this.creditRepository.createCreditNotification({
        userId,
        notificationType: 'low_balance',
        thresholdBalance: currentBalance,
        isSent: false
      });

      const emailData = {
        to: user.email,
        subject: 'Low Credit Balance Alert - BuildHire',
        template: 'credit-low-balance',
        data: {
          userName: user.firstName,
          currentBalance: formatCreditAmount(currentBalance),
          recommendedTopup: formatCreditAmount(25),
          dashboardUrl: `${process.env.FRONTEND_URL}/dashboard/credits`
        }
      };

      await this.emailService.sendEmail(emailData);

      if (user.phone && user.smsNotifications) {
        const smsMessage = `BuildHire Alert: Your credit balance is low (${formatCreditAmount(currentBalance)}). Top up now to continue applying for jobs.`;
        await this.smsService.sendSMS(user.phone, smsMessage);
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
      const user = await this.userService.getUserById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      const notification = await this.creditRepository.createCreditNotification({
        userId,
        notificationType: 'critical_balance',
        thresholdBalance: currentBalance,
        isSent: false
      });

      const emailData = {
        to: user.email,
        subject: 'URGENT: Critical Credit Balance - BuildHire',
        template: 'credit-critical-balance',
        data: {
          userName: user.firstName,
          currentBalance: formatCreditAmount(currentBalance),
          urgentTopup: formatCreditAmount(25),
          dashboardUrl: `${process.env.FRONTEND_URL}/dashboard/credits`,
          topupUrl: `${process.env.FRONTEND_URL}/credits/purchase`
        }
      };

      await this.emailService.sendEmail(emailData);

      if (user.phone) {
        const smsMessage = `URGENT - BuildHire: Critical credit balance (${formatCreditAmount(currentBalance)}). Top up immediately to avoid service interruption.`;
        await this.smsService.sendSMS(user.phone, smsMessage);
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
      const user = await this.userService.getUserById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      const emailData = {
        to: user.email,
        subject: 'Welcome! Your Free Credits Are Ready - BuildHire',
        template: 'credit-trial-awarded',
        data: {
          userName: user.firstName,
          creditsAwarded: formatCreditAmount(creditsAwarded),
          dashboardUrl: `${process.env.FRONTEND_URL}/dashboard/credits`,
          jobsUrl: `${process.env.FRONTEND_URL}/jobs`,
          howToUseUrl: `${process.env.FRONTEND_URL}/help/credits`
        }
      };

      await this.emailService.sendEmail(emailData);

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
      const user = await this.userService.getUserById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      const totalCredits = purchase.creditsAmount + purchase.bonusCredits;

      const emailData = {
        to: user.email,
        subject: 'Credit Purchase Confirmed - BuildHire',
        template: 'credit-purchase-confirmation',
        data: {
          userName: user.firstName,
          purchaseId: purchase.id,
          creditsAmount: formatCreditAmount(purchase.creditsAmount),
          bonusCredits: formatCreditAmount(purchase.bonusCredits),
          totalCredits: formatCreditAmount(totalCredits),
          amount: formatCurrency(purchase.purchasePrice, purchase.currency),
          receiptUrl: `${process.env.FRONTEND_URL}/credits/receipt/${purchase.id}`,
          dashboardUrl: `${process.env.FRONTEND_URL}/dashboard/credits`
        }
      };

      await this.emailService.sendEmail(emailData);

      if (user.phone && user.smsNotifications) {
        const smsMessage = `BuildHire: Credit purchase confirmed! ${formatCreditAmount(totalCredits)} added to your account. Start applying for jobs now.`;
        await this.smsService.sendSMS(user.phone, smsMessage);
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
      const user = await this.userService.getUserById(userId);
      
      if (!user || !user.transactionNotifications) {
        return;
      }

      const emailData = {
        to: user.email,
        subject: 'Credit Transaction Completed - BuildHire',
        template: 'credit-transaction',
        data: {
          userName: user.firstName,
          transactionId: transaction.id,
          transactionType: transaction.transactionType,
          credits: formatCreditAmount(transaction.credits),
          description: transaction.description,
          dashboardUrl: `${process.env.FRONTEND_URL}/dashboard/credits`
        }
      };

      await this.emailService.sendEmail(emailData);

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
      const user = await this.userService.getUserById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      const emailData = {
        to: user.email,
        subject: 'Credit Refund Processed - BuildHire',
        template: 'credit-refund',
        data: {
          userName: user.firstName,
          creditsRefunded: formatCreditAmount(creditsRefunded),
          reason,
          dashboardUrl: `${process.env.FRONTEND_URL}/dashboard/credits`,
          supportUrl: `${process.env.FRONTEND_URL}/support`
        }
      };

      await this.emailService.sendEmail(emailData);

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
      const user = await this.userService.getUserById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      const emailData = {
        to: user.email,
        subject: 'Credits Expired - BuildHire',
        template: 'credit-expiry',
        data: {
          userName: user.firstName,
          creditsExpired: formatCreditAmount(creditsExpired),
          topupUrl: `${process.env.FRONTEND_URL}/credits/purchase`,
          dashboardUrl: `${process.env.FRONTEND_URL}/dashboard/credits`
        }
      };

      await this.emailService.sendEmail(emailData);

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
      const user = await this.userService.getUserById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      const emailData = {
        to: user.email,
        subject: 'Auto Top-up Completed - BuildHire',
        template: 'credit-auto-topup',
        data: {
          userName: user.firstName,
          creditsAdded: formatCreditAmount(creditsAdded),
          amount: formatCurrency(amount),
          dashboardUrl: `${process.env.FRONTEND_URL}/dashboard/credits`,
          settingsUrl: `${process.env.FRONTEND_URL}/settings/auto-topup`
        }
      };

      await this.emailService.sendEmail(emailData);

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
      const user = await this.userService.getUserById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      const emailData = {
        to: user.email,
        subject: 'Transaction Cancelled - BuildHire',
        template: 'credit-transaction-cancelled',
        data: {
          userName: user.firstName,
          transactionId: transaction.id,
          credits: formatCreditAmount(transaction.credits),
          reason,
          dashboardUrl: `${process.env.FRONTEND_URL}/dashboard/credits`,
          supportUrl: `${process.env.FRONTEND_URL}/support`
        }
      };

      await this.emailService.sendEmail(emailData);

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
      const user = await this.userService.getUserById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      const emailData = {
        to: user.email,
        subject: 'Purchase Cancelled - BuildHire',
        template: 'credit-purchase-cancelled',
        data: {
          userName: user.firstName,
          purchaseId: purchase.id,
          amount: formatCurrency(purchase.purchasePrice, purchase.currency),
          reason,
          topupUrl: `${process.env.FRONTEND_URL}/credits/purchase`,
          supportUrl: `${process.env.FRONTEND_URL}/support`
        }
      };

      await this.emailService.sendEmail(emailData);

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
