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
      const snapshot = await db.collection(this.creditBalancesCollection)
        .where('userId', '==', userId)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      const data = doc.data() as CreditBalanceDatabaseRecord;
      
      return new CreditBalanceModel({
        id: parseInt(doc.id),
        userId: data.userId,
        currentBalance: data.currentBalance,
        totalPurchased: data.totalPurchased,
        totalUsed: data.totalUsed,
        totalRefunded: data.totalRefunded,
        lastPurchaseAt: data.lastPurchaseAt?.toDate(),
        lastUsageAt: data.lastUsageAt?.toDate(),
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate()
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
        userId,
        currentBalance: initialCredits,
        totalPurchased: initialCredits,
        totalUsed: 0,
        totalRefunded: 0,
        lastPurchaseAt: initialCredits > 0 ? now : null,
        lastUsageAt: null,
        createdAt: now,
        updatedAt: now
      };

      const docRef = await db.collection(this.creditBalancesCollection).add(balanceData);
      
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
      const snapshot = await db.collection(this.creditBalancesCollection)
        .where('userId', '==', userId)
        .limit(1)
        .get();

      if (snapshot.empty) {
        throw new Error('Credit balance not found');
      }

      const doc = snapshot.docs[0];
      const updateData = {
        ...balance,
        updatedAt: new Date()
      };

      await doc.ref.update(updateData);
      
      const updatedDoc = await doc.ref.get();
      const data = updatedDoc.data() as CreditBalanceDatabaseRecord;
      
      return new CreditBalanceModel({
        id: parseInt(doc.id),
        userId: data.userId,
        currentBalance: data.currentBalance,
        totalPurchased: data.totalPurchased,
        totalUsed: data.totalUsed,
        totalRefunded: data.totalRefunded,
        lastPurchaseAt: data.lastPurchaseAt?.toDate(),
        lastUsageAt: data.lastUsageAt?.toDate(),
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate()
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
      let query = db.collection(this.creditUsagesCollection)
        .where('userId', '==', userId);

      if (filter?.dateFrom) {
        query = query.where('createdAt', '>=', filter.dateFrom);
      }

      if (filter?.dateTo) {
        query = query.where('createdAt', '<=', filter.dateTo);
      }

      if (filter?.sortBy === 'createdAt') {
        query = query.orderBy('createdAt', filter.sortOrder === 'asc' ? 'asc' : 'desc');
      }

      if (filter?.limit) {
        query = query.limit(filter.limit);
      }

      const snapshot = await query.get();
      
      return snapshot.docs.map(doc => {
        const data = doc.data() as CreditUsageDatabaseRecord;
        return new CreditUsageModel({
          id: parseInt(doc.id),
          userId: data.userId,
          transactionId: data.transactionId,
          usageType: data.usageType,
          creditsUsed: data.creditsUsed,
          referenceId: data.referenceId,
          referenceType: data.referenceType,
          description: data.description,
          metadata: data.metadata,
          createdAt: data.createdAt.toDate()
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
        userId: usage.userId,
        transactionId: usage.transactionId,
        usageType: usage.usageType,
        creditsUsed: usage.creditsUsed,
        referenceId: usage.referenceId,
        referenceType: usage.referenceType,
        description: usage.description,
        metadata: usage.metadata,
        createdAt: now
      };

      const docRef = await db.collection(this.creditUsagesCollection).add(usageData);
      
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
      const snapshot = await db.collection(this.autoTopupsCollection)
        .where('userId', '==', userId)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      const data = doc.data() as AutoTopupDatabaseRecord;
      
      return new AutoTopupModel({
        id: parseInt(doc.id),
        userId: data.userId,
        status: data.status,
        triggerBalance: data.triggerBalance,
        topupAmount: data.topupAmount,
        packageType: data.packageType,
        paymentMethodId: data.paymentMethodId,
        lastTriggeredAt: data.lastTriggeredAt?.toDate(),
        failureCount: data.failureCount,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate()
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
        userId: settings.userId,
        status: settings.status,
        triggerBalance: settings.triggerBalance,
        topupAmount: settings.topupAmount,
        packageType: settings.packageType,
        paymentMethodId: settings.paymentMethodId,
        lastTriggeredAt: settings.lastTriggeredAt || null,
        failureCount: settings.failureCount,
        createdAt: now,
        updatedAt: now
      };

      const docRef = await db.collection(this.autoTopupsCollection).add(settingsData);
      
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
      const snapshot = await db.collection(this.autoTopupsCollection)
        .where('userId', '==', userId)
        .limit(1)
        .get();

      if (snapshot.empty) {
        throw new Error('Auto topup settings not found');
      }

      const doc = snapshot.docs[0];
      const updateData = {
        ...settings,
        updatedAt: new Date()
      };

      await doc.ref.update(updateData);
      
      const updatedDoc = await doc.ref.get();
      const data = updatedDoc.data() as AutoTopupDatabaseRecord;
      
      return new AutoTopupModel({
        id: parseInt(doc.id),
        userId: data.userId,
        status: data.status,
        triggerBalance: data.triggerBalance,
        topupAmount: data.topupAmount,
        packageType: data.packageType,
        paymentMethodId: data.paymentMethodId,
        lastTriggeredAt: data.lastTriggeredAt?.toDate(),
        failureCount: data.failureCount,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate()
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
      const snapshot = await db.collection(this.creditNotificationsCollection)
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => {
        const data = doc.data() as CreditNotificationDatabaseRecord;
        return new CreditNotificationModel({
          id: parseInt(doc.id),
          userId: data.userId,
          notificationType: data.notificationType,
          thresholdBalance: data.thresholdBalance,
          isSent: data.isSent,
          sentAt: data.sentAt?.toDate(),
          createdAt: data.createdAt.toDate()
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
        userId: notification.userId,
        notificationType: notification.notificationType,
        thresholdBalance: notification.thresholdBalance,
        isSent: notification.isSent,
        sentAt: notification.sentAt || null,
        createdAt: now
      };

      const docRef = await db.collection(this.creditNotificationsCollection).add(notificationData);
      
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
      const doc = await db.collection(this.creditNotificationsCollection).doc(notificationId.toString()).get();
      
      if (!doc.exists) {
        throw new Error('Notification not found');
      }

      await doc.ref.update({
        isSent: true,
        sentAt: new Date()
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
      const snapshot = await db.collection(this.creditBalancesCollection)
        .where('currentBalance', '<=', threshold)
        .get();

      return snapshot.docs.map(doc => {
        const data = doc.data() as CreditBalanceDatabaseRecord;
        return data.userId;
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
