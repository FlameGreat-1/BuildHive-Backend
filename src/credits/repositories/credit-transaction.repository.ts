import { db } from '../../shared/database/connection';
import { 
  CreditTransactionDatabaseRecord,
  CreditTransactionStatus,
  CreditTransactionType
} from '../../shared/types';
import { 
  CreditTransaction,
  CreditTransactionFilter,
  CreditTransactionHistory,
  CreditTransactionSummary,
  CreditTransactionRecord
} from '../types';
import { CreditTransactionModel } from '../models';
import { logger } from '../../shared/utils';

export class CreditTransactionRepository {
  private readonly transactionsCollection = 'credit_transactions';

  async createTransaction(transaction: Omit<CreditTransaction, 'id' | 'createdAt' | 'updatedAt'>): Promise<CreditTransactionModel> {
    try {
      const now = new Date();
      const transactionData: Omit<CreditTransactionDatabaseRecord, 'id'> = {
        userId: transaction.userId,
        transactionType: transaction.transactionType,
        credits: transaction.credits,
        status: transaction.status,
        description: transaction.description,
        referenceId: transaction.referenceId,
        referenceType: transaction.referenceType,
        expiresAt: transaction.expiresAt || null,
        metadata: transaction.metadata,
        createdAt: now,
        updatedAt: now
      };

      const docRef = await db.collection(this.transactionsCollection).add(transactionData);
      
      return new CreditTransactionModel({
        id: parseInt(docRef.id),
        ...transaction,
        createdAt: now,
        updatedAt: now
      });
    } catch (error) {
      logger.error('Failed to create credit transaction', {
        transaction,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async getTransactionById(transactionId: number): Promise<CreditTransactionModel | null> {
    try {
      const doc = await db.collection(this.transactionsCollection).doc(transactionId.toString()).get();
      
      if (!doc.exists) {
        return null;
      }

      const data = doc.data() as CreditTransactionDatabaseRecord;
      
      return new CreditTransactionModel({
        id: parseInt(doc.id),
        userId: data.userId,
        transactionType: data.transactionType,
        credits: data.credits,
        status: data.status,
        description: data.description,
        referenceId: data.referenceId,
        referenceType: data.referenceType,
        expiresAt: data.expiresAt?.toDate(),
        metadata: data.metadata,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate()
      });
    } catch (error) {
      logger.error('Failed to get transaction by ID', {
        transactionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async updateTransactionStatus(transactionId: number, status: CreditTransactionStatus, metadata?: Record<string, any>): Promise<CreditTransactionModel> {
    try {
      const doc = await db.collection(this.transactionsCollection).doc(transactionId.toString()).get();
      
      if (!doc.exists) {
        throw new Error('Transaction not found');
      }

      const updateData: Partial<CreditTransactionDatabaseRecord> = {
        status,
        updatedAt: new Date()
      };

      if (metadata) {
        const existingData = doc.data() as CreditTransactionDatabaseRecord;
        updateData.metadata = { ...existingData.metadata, ...metadata };
      }

      await doc.ref.update(updateData);
      
      const updatedDoc = await doc.ref.get();
      const data = updatedDoc.data() as CreditTransactionDatabaseRecord;
      
      return new CreditTransactionModel({
        id: parseInt(doc.id),
        userId: data.userId,
        transactionType: data.transactionType,
        credits: data.credits,
        status: data.status,
        description: data.description,
        referenceId: data.referenceId,
        referenceType: data.referenceType,
        expiresAt: data.expiresAt?.toDate(),
        metadata: data.metadata,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate()
      });
    } catch (error) {
      logger.error('Failed to update transaction status', {
        transactionId,
        status,
        metadata,
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
      let query = db.collection(this.transactionsCollection)
        .where('userId', '==', userId);

      if (filter?.transactionType) {
        query = query.where('transactionType', '==', filter.transactionType);
      }

      if (filter?.status) {
        query = query.where('status', '==', filter.status);
      }

      if (filter?.dateFrom) {
        query = query.where('createdAt', '>=', filter.dateFrom);
      }

      if (filter?.dateTo) {
        query = query.where('createdAt', '<=', filter.dateTo);
      }

      if (filter?.minCredits) {
        query = query.where('credits', '>=', filter.minCredits);
      }

      if (filter?.maxCredits) {
        query = query.where('credits', '<=', filter.maxCredits);
      }

      if (filter?.referenceType) {
        query = query.where('referenceType', '==', filter.referenceType);
      }

      if (filter?.sortBy) {
        query = query.orderBy(filter.sortBy, filter.sortOrder || 'desc');
      } else {
        query = query.orderBy('createdAt', 'desc');
      }

      const totalQuery = query;
      const totalSnapshot = await totalQuery.get();
      const totalRecords = totalSnapshot.size;

      if (filter?.page && filter?.limit) {
        const offset = (filter.page - 1) * filter.limit;
        query = query.offset(offset).limit(filter.limit);
      } else if (filter?.limit) {
        query = query.limit(filter.limit);
      }

      const snapshot = await query.get();
      
      const transactions: CreditTransactionRecord[] = snapshot.docs.map(doc => {
        const data = doc.data() as CreditTransactionDatabaseRecord;
        return {
          id: parseInt(doc.id),
          transactionType: data.transactionType,
          credits: data.credits,
          status: data.status,
          description: data.description,
          balanceAfter: 0,
          createdAt: data.createdAt.toDate(),
          expiresAt: data.expiresAt?.toDate(),
          referenceType: data.referenceType,
          referenceId: data.referenceId
        };
      });

      const totalCreditsEarned = totalSnapshot.docs
        .filter(doc => {
          const data = doc.data() as CreditTransactionDatabaseRecord;
          return [
            CreditTransactionType.PURCHASE,
            CreditTransactionType.BONUS,
            CreditTransactionType.REFUND,
            CreditTransactionType.TRIAL,
            CreditTransactionType.SUBSCRIPTION
          ].includes(data.transactionType);
        })
        .reduce((sum, doc) => {
          const data = doc.data() as CreditTransactionDatabaseRecord;
          return sum + data.credits;
        }, 0);

      const totalCreditsSpent = totalSnapshot.docs
        .filter(doc => {
          const data = doc.data() as CreditTransactionDatabaseRecord;
          return [
            CreditTransactionType.USAGE,
            CreditTransactionType.EXPIRY
          ].includes(data.transactionType);
        })
        .reduce((sum, doc) => {
          const data = doc.data() as CreditTransactionDatabaseRecord;
          return sum + data.credits;
        }, 0);

      const page = filter?.page || 1;
      const limit = filter?.limit || transactions.length;
      const totalPages = Math.ceil(totalRecords / limit);

      return {
        transactions,
        totalTransactions: totalRecords,
        totalCreditsEarned,
        totalCreditsSpent,
        netCredits: totalCreditsEarned - totalCreditsSpent,
        pagination: {
          currentPage: page,
          totalPages,
          totalRecords,
          recordsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1
        }
      };
    } catch (error) {
      logger.error('Failed to get transaction history', {
        userId,
        filter,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async getTransactionSummary(userId: number, dateFrom?: Date, dateTo?: Date): Promise<CreditTransactionSummary> {
    try {
      let query = db.collection(this.transactionsCollection)
        .where('userId', '==', userId);

      if (dateFrom) {
        query = query.where('createdAt', '>=', dateFrom);
      }

      if (dateTo) {
        query = query.where('createdAt', '<=', dateTo);
      }

      const snapshot = await query.get();
      const transactions = snapshot.docs.map(doc => doc.data() as CreditTransactionDatabaseRecord);

      const totalTransactions = transactions.length;
      const totalCreditsIn = transactions
        .filter(t => [
          CreditTransactionType.PURCHASE,
          CreditTransactionType.BONUS,
          CreditTransactionType.REFUND,
          CreditTransactionType.TRIAL,
          CreditTransactionType.SUBSCRIPTION
        ].includes(t.transactionType))
        .reduce((sum, t) => sum + t.credits, 0);

      const totalCreditsOut = transactions
        .filter(t => [
          CreditTransactionType.USAGE,
          CreditTransactionType.EXPIRY
        ].includes(t.transactionType))
        .reduce((sum, t) => sum + t.credits, 0);

      const transactionsByType = Object.values(CreditTransactionType).map(type => {
        const typeTransactions = transactions.filter(t => t.transactionType === type);
        const count = typeTransactions.length;
        const totalCredits = typeTransactions.reduce((sum, t) => sum + t.credits, 0);
        
        return {
          transactionType: type,
          count,
          totalCredits,
          percentage: totalTransactions > 0 ? Math.round((count / totalTransactions) * 100) : 0
        };
      }).filter(item => item.count > 0);

      const transactionsByStatus = Object.values(CreditTransactionStatus).map(status => {
        const statusTransactions = transactions.filter(t => t.status === status);
        const count = statusTransactions.length;
        
        return {
          status,
          count,
          percentage: totalTransactions > 0 ? Math.round((count / totalTransactions) * 100) : 0
        };
      }).filter(item => item.count > 0);

      const monthlyActivity = this.groupTransactionsByMonth(transactions);

      return {
        totalTransactions,
        totalCreditsIn,
        totalCreditsOut,
        netCredits: totalCreditsIn - totalCreditsOut,
        transactionsByType,
        transactionsByStatus,
        monthlyActivity
      };
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

  async getExpiringTransactions(daysThreshold: number = 7): Promise<CreditTransactionModel[]> {
    try {
      const now = new Date();
      const thresholdDate = new Date(now.getTime() + (daysThreshold * 24 * 60 * 60 * 1000));

      const snapshot = await db.collection(this.transactionsCollection)
        .where('expiresAt', '<=', thresholdDate)
        .where('expiresAt', '>', now)
        .where('status', '==', CreditTransactionStatus.COMPLETED)
        .get();

      return snapshot.docs.map(doc => {
        const data = doc.data() as CreditTransactionDatabaseRecord;
        return new CreditTransactionModel({
          id: parseInt(doc.id),
          userId: data.userId,
          transactionType: data.transactionType,
          credits: data.credits,
          status: data.status,
          description: data.description,
          referenceId: data.referenceId,
          referenceType: data.referenceType,
          expiresAt: data.expiresAt?.toDate(),
          metadata: data.metadata,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate()
        });
      });
    } catch (error) {
      logger.error('Failed to get expiring transactions', {
        daysThreshold,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async deleteTransaction(transactionId: number): Promise<void> {
    try {
      await db.collection(this.transactionsCollection).doc(transactionId.toString()).delete();
    } catch (error) {
      logger.error('Failed to delete transaction', {
        transactionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private groupTransactionsByMonth(transactions: CreditTransactionDatabaseRecord[]) {
    const monthlyMap = new Map<string, {
      totalTransactions: number;
      totalCreditsIn: number;
      totalCreditsOut: number;
    }>();

    transactions.forEach(transaction => {
      const date = transaction.createdAt.toDate();
      const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      
      const existing = monthlyMap.get(monthKey) || {
        totalTransactions: 0,
        totalCreditsIn: 0,
        totalCreditsOut: 0
      };

      existing.totalTransactions += 1;

      if ([
        CreditTransactionType.PURCHASE,
        CreditTransactionType.BONUS,
        CreditTransactionType.REFUND,
        CreditTransactionType.TRIAL,
        CreditTransactionType.SUBSCRIPTION
      ].includes(transaction.transactionType)) {
        existing.totalCreditsIn += transaction.credits;
      } else if ([
        CreditTransactionType.USAGE,
        CreditTransactionType.EXPIRY
      ].includes(transaction.transactionType)) {
        existing.totalCreditsOut += transaction.credits;
      }

      monthlyMap.set(monthKey, existing);
    });

    return Array.from(monthlyMap.entries()).map(([monthKey, data]) => {
      const [year, month] = monthKey.split('-');
      return {
        month,
        year: parseInt(year),
        totalTransactions: data.totalTransactions,
        totalCreditsIn: data.totalCreditsIn,
        totalCreditsOut: data.totalCreditsOut,
        netCredits: data.totalCreditsIn - data.totalCreditsOut
      };
    }).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return parseInt(b.month) - parseInt(a.month);
    });
  }
}

