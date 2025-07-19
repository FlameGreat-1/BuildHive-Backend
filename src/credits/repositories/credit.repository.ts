import { db } from '../../shared/database/connection';
import { 
  CreditBalanceDatabaseRecord,
  CreditUsageDatabaseRecord,
  AutoTopupDatabaseRecord,
  CreditNotificationDatabaseRecord
} from '../../shared/types';
import { 
  CreditBalance,
  CreditUsage,
  AutoTopup,
  CreditNotification,
  CreditTransactionFilter
} from '../types';
import { 
  CreditBalanceModel,
  CreditUsageModel,
  AutoTopupModel,
  CreditNotificationModel
} from '../models';
import { logger } from '../../shared/utils';

export class CreditRepository {
  private readonly creditBalancesCollection = 'credit_balances';
  private readonly creditUsagesCollection = 'credit_usages';
  private readonly autoTopupsCollection = 'auto_topups';
  private readonly creditNotificationsCollection = 'credit_notifications';

  async getCreditBalance(userId: number): Promise<CreditBalanceModel | null> {
    try {
      const snapshot = await db!.collection(this.creditBalancesCollection)
        .where('user_id', '==', userId)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      const data = doc.data() as CreditBalanceDatabaseRecord;
      
      return new CreditBalanceModel({
        id: parseInt(doc.id),
        userId: data.user_id,
        currentBalance: data.current_balance,
        totalPurchased: data.total_purchased,
        totalUsed: data.total_used,
        totalRefunded: data.total_refunded,
        lastPurchaseAt: data.last_purchase_at,
        lastUsageAt: data.last_usage_at,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      });
    } catch (error) {
      logger.error('Failed to get credit balance', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async createCreditBalance(userId: number, initialCredits: number = 0): Promise<CreditBalanceModel> {
    try {
      const now = new Date();
      const balanceData: Omit<CreditBalanceDatabaseRecord, 'id'> = {
        user_id: userId,
        current_balance: initialCredits,
        total_purchased: initialCredits,
        total_used: 0,
        total_refunded: 0,
        last_purchase_at: initialCredits > 0 ? now : null,
        last_usage_at: null,
        created_at: now,
        updated_at: now
      };

      const docRef = await db!.collection(this.creditBalancesCollection).add(balanceData);
      
      return new CreditBalanceModel({
        id: parseInt(docRef.id),
        userId,
        currentBalance: initialCredits,
        totalPurchased: initialCredits,
        totalUsed: 0,
        totalRefunded: 0,
        lastPurchaseAt: initialCredits > 0 ? now : undefined,
        createdAt: now,
        updatedAt: now
      });
    } catch (error) {
      logger.error('Failed to create credit balance', {
        userId,
        initialCredits,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async updateCreditBalance(userId: number, balance: Partial<CreditBalance>): Promise<CreditBalanceModel> {
    try {
      const snapshot = await db!.collection(this.creditBalancesCollection)
        .where('user_id', '==', userId)
        .limit(1)
        .get();

      if (snapshot.empty) {
        throw new Error('Credit balance not found');
      }

      const doc = snapshot.docs[0];
      const updateData: Partial<CreditBalanceDatabaseRecord> = {
        updated_at: new Date()
      };

      if (balance.currentBalance !== undefined) {
        updateData.current_balance = balance.currentBalance;
      }
      if (balance.totalPurchased !== undefined) {
        updateData.total_purchased = balance.totalPurchased;
      }
      if (balance.totalUsed !== undefined) {
        updateData.total_used = balance.totalUsed;
      }
      if (balance.totalRefunded !== undefined) {
        updateData.total_refunded = balance.totalRefunded;
      }
      if (balance.lastPurchaseAt !== undefined) {
        updateData.last_purchase_at = balance.lastPurchaseAt;
      }
      if (balance.lastUsageAt !== undefined) {
        updateData.last_usage_at = balance.lastUsageAt;
      }

      await doc.ref.update(updateData);
      
      const updatedDoc = await doc.ref.get();
      const data = updatedDoc.data() as CreditBalanceDatabaseRecord;
      
      return new CreditBalanceModel({
        id: parseInt(doc.id),
        userId: data.user_id,
        currentBalance: data.current_balance,
        totalPurchased: data.total_purchased,
        totalUsed: data.total_used,
        totalRefunded: data.total_refunded,
        lastPurchaseAt: data.last_purchase_at,
        lastUsageAt: data.last_usage_at,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      });
    } catch (error) {
      logger.error('Failed to update credit balance', {
        userId,
        balance,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async getCreditUsageHistory(
    userId: number,
    filter?: Partial<CreditTransactionFilter>
  ): Promise<CreditUsageModel[]> {
    try {
      let query = db!.collection(this.creditUsagesCollection)
        .where('user_id', '==', userId);

      if (filter?.dateFrom) {
        query = query.where('created_at', '>=', filter.dateFrom);
      }

      if (filter?.dateTo) {
        query = query.where('created_at', '<=', filter.dateTo);
      }

      if (filter?.sortBy === 'createdAt') {
        query = query.orderBy('created_at', filter.sortOrder === 'asc' ? 'asc' : 'desc');
      }

      if (filter?.limit) {
        query = query.limit(filter.limit);
      }

      const snapshot = await query.get();
      
      return snapshot.docs.map(doc => {
        const data = doc.data() as CreditUsageDatabaseRecord;
        return new CreditUsageModel({
          id: parseInt(doc.id),
          userId: data.user_id,
          transactionId: data.transaction_id,
          usageType: data.usage_type,
          creditsUsed: data.credits_used,
          referenceId: data.reference_id,
          referenceType: data.reference_type,
          description: data.description,
          metadata: data.metadata,
          createdAt: data.created_at
        });
      });
    } catch (error) {
      logger.error('Failed to get credit usage history', {
        userId,
        filter,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async createCreditUsage(usage: Omit<CreditUsage, 'id' | 'createdAt'>): Promise<CreditUsageModel> {
    try {
      const now = new Date();
      const usageData: Omit<CreditUsageDatabaseRecord, 'id'> = {
        user_id: usage.userId,
        transaction_id: usage.transactionId,
        usage_type: usage.usageType,
        credits_used: usage.creditsUsed,
        reference_id: usage.referenceId,
        reference_type: usage.referenceType,
        description: usage.description,
        metadata: usage.metadata,
        created_at: now
      };

      const docRef = await db!.collection(this.creditUsagesCollection).add(usageData);
      
      return new CreditUsageModel({
        id: parseInt(docRef.id),
        ...usage,
        createdAt: now
      });
    } catch (error) {
      logger.error('Failed to create credit usage', {
        usage,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async getAutoTopupSettings(userId: number): Promise<AutoTopupModel | null> {
    try {
      const snapshot = await db!.collection(this.autoTopupsCollection)
        .where('user_id', '==', userId)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      const data = doc.data() as AutoTopupDatabaseRecord;
      
      return new AutoTopupModel({
        id: parseInt(doc.id),
        userId: data.user_id,
        status: data.status,
        triggerBalance: data.trigger_balance,
        topupAmount: data.topup_amount,
        packageType: data.package_type,
        paymentMethodId: data.payment_method_id,
        lastTriggeredAt: data.last_triggered_at,
        failureCount: data.failure_count,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      });
    } catch (error) {
      logger.error('Failed to get auto topup settings', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async createAutoTopupSettings(settings: Omit<AutoTopup, 'id' | 'createdAt' | 'updatedAt'>): Promise<AutoTopupModel> {
    try {
      const now = new Date();
      const settingsData: Omit<AutoTopupDatabaseRecord, 'id'> = {
        user_id: settings.userId,
        status: settings.status,
        trigger_balance: settings.triggerBalance,
        topup_amount: settings.topupAmount,
        package_type: settings.packageType,
        payment_method_id: settings.paymentMethodId,
        last_triggered_at: settings.lastTriggeredAt || null,
        failure_count: settings.failureCount,
        created_at: now,
        updated_at: now
      };

      const docRef = await db!.collection(this.autoTopupsCollection).add(settingsData);
      
      return new AutoTopupModel({
        id: parseInt(docRef.id),
        ...settings,
        createdAt: now,
        updatedAt: now
      });
    } catch (error) {
      logger.error('Failed to create auto topup settings', {
        settings,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async updateAutoTopupSettings(userId: number, settings: Partial<AutoTopup>): Promise<AutoTopupModel> {
    try {
      const snapshot = await db!.collection(this.autoTopupsCollection)
        .where('user_id', '==', userId)
        .limit(1)
        .get();

      if (snapshot.empty) {
        throw new Error('Auto topup settings not found');
      }

      const doc = snapshot.docs[0];
      const updateData: Partial<AutoTopupDatabaseRecord> = {
        updated_at: new Date()
      };

      if (settings.status !== undefined) {
        updateData.status = settings.status;
      }
      if (settings.triggerBalance !== undefined) {
        updateData.trigger_balance = settings.triggerBalance;
      }
      if (settings.topupAmount !== undefined) {
        updateData.topup_amount = settings.topupAmount;
      }
      if (settings.packageType !== undefined) {
        updateData.package_type = settings.packageType;
      }
      if (settings.paymentMethodId !== undefined) {
        updateData.payment_method_id = settings.paymentMethodId;
      }
      if (settings.lastTriggeredAt !== undefined) {
        updateData.last_triggered_at = settings.lastTriggeredAt;
      }
      if (settings.failureCount !== undefined) {
        updateData.failure_count = settings.failureCount;
      }

      await doc.ref.update(updateData);
      
      const updatedDoc = await doc.ref.get();
      const data = updatedDoc.data() as AutoTopupDatabaseRecord;
      
      return new AutoTopupModel({
        id: parseInt(doc.id),
        userId: data.user_id,
        status: data.status,
        triggerBalance: data.trigger_balance,
        topupAmount: data.topup_amount,
        packageType: data.package_type,
        paymentMethodId: data.payment_method_id,
        lastTriggeredAt: data.last_triggered_at,
        failureCount: data.failure_count,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      });
    } catch (error) {
      logger.error('Failed to update auto topup settings', {
        userId,
        settings,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async getCreditNotifications(userId: number, limit: number = 10): Promise<CreditNotificationModel[]> {
    try {
      const snapshot = await db!.collection(this.creditNotificationsCollection)
        .where('user_id', '==', userId)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => {
        const data = doc.data() as CreditNotificationDatabaseRecord;
        return new CreditNotificationModel({
          id: parseInt(doc.id),
          userId: data.user_id,
          notificationType: data.notification_type,
          thresholdBalance: data.threshold_balance,
          isSent: data.is_sent,
          sentAt: data.sent_at,
          createdAt: data.created_at
        });
      });
    } catch (error) {
      logger.error('Failed to get credit notifications', {
        userId,
        limit,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async createCreditNotification(notification: Omit<CreditNotification, 'id' | 'createdAt'>): Promise<CreditNotificationModel> {
    try {
      const now = new Date();
      const notificationData: Omit<CreditNotificationDatabaseRecord, 'id'> = {
        user_id: notification.userId,
        notification_type: notification.notificationType,
        threshold_balance: notification.thresholdBalance,
        is_sent: notification.isSent,
        sent_at: notification.sentAt || null,
        created_at: now
      };

      const docRef = await db!.collection(this.creditNotificationsCollection).add(notificationData);
      
      return new CreditNotificationModel({
        id: parseInt(docRef.id),
        ...notification,
        createdAt: now
      });
    } catch (error) {
      logger.error('Failed to create credit notification', {
        notification,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async markNotificationAsSent(notificationId: number): Promise<void> {
    try {
      const doc = await db!.collection(this.creditNotificationsCollection).doc(notificationId.toString()).get();
      
      if (!doc.exists) {
        throw new Error('Notification not found');
      }

      await doc.ref.update({
        is_sent: true,
        sent_at: new Date()
      });
    } catch (error) {
      logger.error('Failed to mark notification as sent', {
        notificationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async getUsersWithLowBalance(threshold: number): Promise<number[]> {
    try {
      const snapshot = await db!.collection(this.creditBalancesCollection)
        .where('current_balance', '<=', threshold)
        .get();

      return snapshot.docs.map(doc => {
        const data = doc.data() as CreditBalanceDatabaseRecord;
        return data.user_id;
      });
    } catch (error) {
      logger.error('Failed to get users with low balance', {
        threshold,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}
