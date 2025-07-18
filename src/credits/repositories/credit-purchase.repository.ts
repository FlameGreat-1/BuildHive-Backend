import { db } from '../../shared/database/connection';
import { 
  CreditPurchaseDatabaseRecord,
  CreditTransactionStatus,
  CreditPackageType
} from '../../shared/types';
import { 
  CreditPurchase,
  CreditPurchaseHistory,
  CreditPurchaseMetrics,
  CreditPurchaseRecord,
  PackagePopularity,
  MonthlyPurchaseTrend
} from '../types';
import { CreditPurchaseModel } from '../models';
import { logger } from '../../shared/utils';

export class CreditPurchaseRepository {
  private readonly purchasesCollection = 'credit_purchases';

  async createPurchase(purchase: Omit<CreditPurchase, 'id' | 'createdAt' | 'updatedAt'>): Promise<CreditPurchaseModel> {
    try {
      const now = new Date();
      const purchaseData: Omit<CreditPurchaseDatabaseRecord, 'id'> = {
        userId: purchase.userId,
        paymentId: purchase.paymentId,
        packageType: purchase.packageType,
        creditsAmount: purchase.creditsAmount,
        purchasePrice: purchase.purchasePrice,
        currency: purchase.currency,
        bonusCredits: purchase.bonusCredits,
        status: purchase.status,
        expiresAt: purchase.expiresAt || null,
        metadata: purchase.metadata,
        createdAt: now,
        updatedAt: now
      };

      const docRef = await db.collection(this.purchasesCollection).add(purchaseData);
      
      return new CreditPurchaseModel({
        id: parseInt(docRef.id),
        ...purchase,
        createdAt: now,
        updatedAt: now
      });
    } catch (error) {
      logger.error('Failed to create credit purchase', {
        purchase,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async getPurchaseById(purchaseId: number): Promise<CreditPurchaseModel | null> {
    try {
      const doc = await db.collection(this.purchasesCollection).doc(purchaseId.toString()).get();
      
      if (!doc.exists) {
        return null;
      }

      const data = doc.data() as CreditPurchaseDatabaseRecord;
      
      return new CreditPurchaseModel({
        id: parseInt(doc.id),
        userId: data.userId,
        paymentId: data.paymentId,
        packageType: data.packageType,
        creditsAmount: data.creditsAmount,
        purchasePrice: data.purchasePrice,
        currency: data.currency,
        bonusCredits: data.bonusCredits,
        status: data.status,
        expiresAt: data.expiresAt?.toDate(),
        metadata: data.metadata,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate()
      });
    } catch (error) {
      logger.error('Failed to get purchase by ID', {
        purchaseId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async updatePurchaseStatus(
    purchaseId: number, 
    status: CreditTransactionStatus, 
    paymentId?: number,
    metadata?: Record<string, any>
  ): Promise<CreditPurchaseModel> {
    try {
      const doc = await db.collection(this.purchasesCollection).doc(purchaseId.toString()).get();
      
      if (!doc.exists) {
        throw new Error('Purchase not found');
      }

      const updateData: Partial<CreditPurchaseDatabaseRecord> = {
        status,
        updatedAt: new Date()
      };

      if (paymentId) {
        updateData.paymentId = paymentId;
      }

      if (metadata) {
        const existingData = doc.data() as CreditPurchaseDatabaseRecord;
        updateData.metadata = { ...existingData.metadata, ...metadata };
      }

      await doc.ref.update(updateData);
      
      const updatedDoc = await doc.ref.get();
      const data = updatedDoc.data() as CreditPurchaseDatabaseRecord;
      
      return new CreditPurchaseModel({
        id: parseInt(doc.id),
        userId: data.userId,
        paymentId: data.paymentId,
        packageType: data.packageType,
        creditsAmount: data.creditsAmount,
        purchasePrice: data.purchasePrice,
        currency: data.currency,
        bonusCredits: data.bonusCredits,
        status: data.status,
        expiresAt: data.expiresAt?.toDate(),
        metadata: data.metadata,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate()
      });
    } catch (error) {
      logger.error('Failed to update purchase status', {
        purchaseId,
        status,
        paymentId,
        metadata,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
  
    async getPurchaseHistory(
    userId: number,
    page: number = 1,
    limit: number = 10,
    status?: CreditTransactionStatus,
    packageType?: CreditPackageType,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<CreditPurchaseHistory> {
    try {
      let query = db.collection(this.purchasesCollection)
        .where('userId', '==', userId);

      if (status) {
        query = query.where('status', '==', status);
      }

      if (packageType) {
        query = query.where('packageType', '==', packageType);
      }

      if (dateFrom) {
        query = query.where('createdAt', '>=', dateFrom);
      }

      if (dateTo) {
        query = query.where('createdAt', '<=', dateTo);
      }

      const totalQuery = query;
      const totalSnapshot = await totalQuery.get();
      const totalPurchases = totalSnapshot.size;

      query = query.orderBy('createdAt', 'desc');
      
      const offset = (page - 1) * limit;
      query = query.offset(offset).limit(limit);

      const snapshot = await query.get();
      
      const purchases: CreditPurchaseRecord[] = snapshot.docs.map(doc => {
        const data = doc.data() as CreditPurchaseDatabaseRecord;
        return {
          id: parseInt(doc.id),
          packageType: data.packageType,
          creditsAmount: data.creditsAmount,
          bonusCredits: data.bonusCredits,
          totalCredits: data.creditsAmount + data.bonusCredits,
          purchasePrice: data.purchasePrice,
          currency: data.currency,
          status: data.status,
          paymentMethod: data.metadata?.paymentMethod || 'Card',
          purchaseDate: data.createdAt.toDate(),
          expiryDate: data.expiresAt?.toDate()
        };
      });

      const totalSpent = totalSnapshot.docs.reduce((sum, doc) => {
        const data = doc.data() as CreditPurchaseDatabaseRecord;
        return sum + data.purchasePrice;
      }, 0);

      const totalCreditsReceived = totalSnapshot.docs.reduce((sum, doc) => {
        const data = doc.data() as CreditPurchaseDatabaseRecord;
        return sum + data.creditsAmount + data.bonusCredits;
      }, 0);

      const averagePurchaseAmount = totalPurchases > 0 ? totalSpent / totalPurchases : 0;

      const packageCounts = new Map<CreditPackageType, number>();
      totalSnapshot.docs.forEach(doc => {
        const data = doc.data() as CreditPurchaseDatabaseRecord;
        const count = packageCounts.get(data.packageType) || 0;
        packageCounts.set(data.packageType, count + 1);
      });

      const mostPopularPackage = Array.from(packageCounts.entries())
        .sort((a, b) => b[1] - a[1])[0]?.[0] || CreditPackageType.STARTER;

      return {
        purchases,
        totalPurchases,
        totalSpent,
        totalCreditsReceived,
        averagePurchaseAmount,
        mostPopularPackage
      };
    } catch (error) {
      logger.error('Failed to get purchase history', {
        userId,
        page,
        limit,
        status,
        packageType,
        dateFrom,
        dateTo,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async getPurchaseMetrics(
    startDate?: Date,
    endDate?: Date,
    groupBy?: 'packageType' | 'userRole' | 'paymentMethod'
  ): Promise<CreditPurchaseMetrics> {
    try {
      let query = db.collection(this.purchasesCollection)
        .where('status', '==', CreditTransactionStatus.COMPLETED);

      if (startDate) {
        query = query.where('createdAt', '>=', startDate);
      }

      if (endDate) {
        query = query.where('createdAt', '<=', endDate);
      }

      const snapshot = await query.get();
      const purchases = snapshot.docs.map(doc => doc.data() as CreditPurchaseDatabaseRecord);

      const totalPurchases = purchases.length;
      const totalRevenue = purchases.reduce((sum, p) => sum + p.purchasePrice, 0);
      const averageOrderValue = totalPurchases > 0 ? totalRevenue / totalPurchases : 0;

      const uniqueUsers = new Set(purchases.map(p => p.userId)).size;
      const conversionRate = uniqueUsers > 0 ? (totalPurchases / uniqueUsers) * 100 : 0;

      const packagePopularity: PackagePopularity[] = Object.values(CreditPackageType).map(packageType => {
        const packagePurchases = purchases.filter(p => p.packageType === packageType);
        const purchaseCount = packagePurchases.length;
        const revenue = packagePurchases.reduce((sum, p) => sum + p.purchasePrice, 0);
        const percentage = totalPurchases > 0 ? Math.round((purchaseCount / totalPurchases) * 100) : 0;

        return {
          packageType,
          purchaseCount,
          revenue,
          percentage
        };
      }).filter(item => item.purchaseCount > 0)
        .sort((a, b) => b.purchaseCount - a.purchaseCount);

      const monthlyTrends = this.groupPurchasesByMonth(purchases);

      return {
        totalPurchases,
        totalRevenue,
        averageOrderValue,
        conversionRate,
        popularPackages: packagePopularity,
        monthlyTrends
      };
    } catch (error) {
      logger.error('Failed to get purchase metrics', {
        startDate,
        endDate,
        groupBy,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async getUserPurchaseStats(userId: number): Promise<{
    totalPurchases: number;
    totalSpent: number;
    totalCreditsReceived: number;
    averageOrderValue: number;
    firstPurchaseDate?: Date;
    lastPurchaseDate?: Date;
    favoritePackage?: CreditPackageType;
  }> {
    try {
      const snapshot = await db.collection(this.purchasesCollection)
        .where('userId', '==', userId)
        .where('status', '==', CreditTransactionStatus.COMPLETED)
        .orderBy('createdAt', 'asc')
        .get();

      const purchases = snapshot.docs.map(doc => doc.data() as CreditPurchaseDatabaseRecord);

      if (purchases.length === 0) {
        return {
          totalPurchases: 0,
          totalSpent: 0,
          totalCreditsReceived: 0,
          averageOrderValue: 0
        };
      }

      const totalPurchases = purchases.length;
      const totalSpent = purchases.reduce((sum, p) => sum + p.purchasePrice, 0);
      const totalCreditsReceived = purchases.reduce((sum, p) => sum + p.creditsAmount + p.bonusCredits, 0);
      const averageOrderValue = totalSpent / totalPurchases;
      const firstPurchaseDate = purchases[0].createdAt.toDate();
      const lastPurchaseDate = purchases[purchases.length - 1].createdAt.toDate();

      const packageCounts = new Map<CreditPackageType, number>();
      purchases.forEach(p => {
        const count = packageCounts.get(p.packageType) || 0;
        packageCounts.set(p.packageType, count + 1);
      });

      const favoritePackage = Array.from(packageCounts.entries())
        .sort((a, b) => b[1] - a[1])[0]?.[0];

      return {
        totalPurchases,
        totalSpent,
        totalCreditsReceived,
        averageOrderValue,
        firstPurchaseDate,
        lastPurchaseDate,
        favoritePackage
      };
    } catch (error) {
      logger.error('Failed to get user purchase stats', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async getFailedPurchases(userId?: number, limit: number = 50): Promise<CreditPurchaseModel[]> {
    try {
      let query = db.collection(this.purchasesCollection)
        .where('status', '==', CreditTransactionStatus.FAILED);

      if (userId) {
        query = query.where('userId', '==', userId);
      }

      query = query.orderBy('createdAt', 'desc').limit(limit);

      const snapshot = await query.get();

      return snapshot.docs.map(doc => {
        const data = doc.data() as CreditPurchaseDatabaseRecord;
        return new CreditPurchaseModel({
          id: parseInt(doc.id),
          userId: data.userId,
          paymentId: data.paymentId,
          packageType: data.packageType,
          creditsAmount: data.creditsAmount,
          purchasePrice: data.purchasePrice,
          currency: data.currency,
          bonusCredits: data.bonusCredits,
          status: data.status,
          expiresAt: data.expiresAt?.toDate(),
          metadata: data.metadata,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate()
        });
      });
    } catch (error) {
      logger.error('Failed to get failed purchases', {
        userId,
        limit,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async deletePurchase(purchaseId: number): Promise<void> {
    try {
      await db.collection(this.purchasesCollection).doc(purchaseId.toString()).delete();
    } catch (error) {
      logger.error('Failed to delete purchase', {
        purchaseId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private groupPurchasesByMonth(purchases: CreditPurchaseDatabaseRecord[]): MonthlyPurchaseTrend[] {
    const monthlyMap = new Map<string, {
      totalPurchases: number;
      totalRevenue: number;
    }>();

    purchases.forEach(purchase => {
      const date = purchase.createdAt.toDate();
      const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      
      const existing = monthlyMap.get(monthKey) || {
        totalPurchases: 0,
        totalRevenue: 0
      };

      existing.totalPurchases += 1;
      existing.totalRevenue += purchase.purchasePrice;

      monthlyMap.set(monthKey, existing);
    });

    return Array.from(monthlyMap.entries()).map(([monthKey, data]) => {
      const [year, month] = monthKey.split('-');
      const averageOrderValue = data.totalPurchases > 0 ? data.totalRevenue / data.totalPurchases : 0;

      return {
        month,
        year: parseInt(year),
        totalPurchases: data.totalPurchases,
        totalRevenue: data.totalRevenue,
        averageOrderValue
      };
    }).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return parseInt(b.month) - parseInt(a.month);
    });
  }
}

