import { 
  CreditPackageType, 
  CreditUsageType, 
  CreditTransactionType,
  CreditTransactionStatus,
  AutoTopupStatus 
} from '../../shared/types';
import { 
  CreditBalance, 
  CreditTransaction, 
  CreditUsage,
  CreditDashboard,
  CreditTransactionSummary,
  CreditUsageBreakdown,
  CreditExpiry
} from '../types';
import { 
  CREDIT_PACKAGES,
  CREDIT_USAGE_CONFIGS,
  AUTO_TOPUP_CONFIG
} from '../../config/credits';

export const generateTransactionId = (): string => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `CT_${timestamp}_${randomStr}`.toUpperCase();
};

export const generatePurchaseId = (): string => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `CP_${timestamp}_${randomStr}`.toUpperCase();
};

export const formatCreditAmount = (credits: number): string => {
  if (credits === 1) return '1 credit';
  return `${credits.toLocaleString()} credits`;
};

export const formatCurrency = (amount: number, currency: string = 'AUD'): string => {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: currency
  }).format(amount);
};

export const calculateBalanceAfterTransaction = (
  currentBalance: number,
  credits: number,
  transactionType: CreditTransactionType
): number => {
  switch (transactionType) {
    case CreditTransactionType.PURCHASE:
    case CreditTransactionType.BONUS:
    case CreditTransactionType.REFUND:
    case CreditTransactionType.TRIAL:
    case CreditTransactionType.SUBSCRIPTION:
      return currentBalance + credits;
    case CreditTransactionType.USAGE:
    case CreditTransactionType.EXPIRY:
      return Math.max(0, currentBalance - credits);
    default:
      return currentBalance;
  }
};

export const getTransactionDescription = (
  transactionType: CreditTransactionType,
  credits: number,
  usageType?: CreditUsageType,
  packageType?: CreditPackageType
): string => {
  switch (transactionType) {
    case CreditTransactionType.PURCHASE:
      const packageName = packageType ? CREDIT_PACKAGES[packageType].name : 'Credit Package';
      return `Purchased ${formatCreditAmount(credits)} - ${packageName}`;
    case CreditTransactionType.USAGE:
      const usageName = usageType ? CREDIT_USAGE_CONFIGS[usageType].name : 'Credit Usage';
      return `Used ${formatCreditAmount(credits)} - ${usageName}`;
    case CreditTransactionType.BONUS:
      return `Bonus ${formatCreditAmount(credits)} awarded`;
    case CreditTransactionType.REFUND:
      return `Refund of ${formatCreditAmount(credits)}`;
    case CreditTransactionType.TRIAL:
      return `Trial ${formatCreditAmount(credits)} awarded`;
    case CreditTransactionType.SUBSCRIPTION:
      return `Subscription ${formatCreditAmount(credits)} awarded`;
    case CreditTransactionType.EXPIRY:
      return `${formatCreditAmount(credits)} expired`;
    default:
      return `Credit transaction: ${formatCreditAmount(credits)}`;
  }
};

export const isTransactionExpired = (transaction: CreditTransaction): boolean => {
  if (!transaction.expiresAt) return false;
  return new Date() > new Date(transaction.expiresAt);
};

export const getDaysUntilExpiry = (expiryDate: Date): number => {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const getExpiringCredits = (
  transactions: CreditTransaction[],
  daysThreshold: number = 7
): CreditExpiry[] => {
  const now = new Date();
  const thresholdDate = new Date(now.getTime() + (daysThreshold * 24 * 60 * 60 * 1000));
  
  return transactions
    .filter(t => 
      t.expiresAt && 
      t.status === CreditTransactionStatus.COMPLETED &&
      new Date(t.expiresAt) <= thresholdDate &&
      new Date(t.expiresAt) > now
    )
    .map(t => ({
      transactionId: t.id,
      userId: t.userId,
      creditsToExpire: t.credits,
      expiryDate: new Date(t.expiresAt!),
      daysUntilExpiry: getDaysUntilExpiry(new Date(t.expiresAt!))
    }));
};

export const buildCreditDashboard = (
  balance: CreditBalance,
  recentTransactions: CreditTransaction[],
  usageData: CreditUsage[],
  autoTopupStatus: AutoTopupStatus
): CreditDashboard => {
  const transactionSummary: CreditTransactionOverview[] = recentTransactions
    .slice(0, 10)
    .map(t => ({
      id: t.id,
      type: t.transactionType,
      credits: t.credits,
      description: t.description,
      createdAt: t.createdAt
    }));

  const usageBreakdown = calculateUsageBreakdown(usageData);
  const lowBalanceAlert = balance.currentBalance <= 10;

  return {
    currentBalance: balance.currentBalance,
    totalPurchased: balance.totalPurchased,
    totalUsed: balance.totalUsed,
    totalRefunded: balance.totalRefunded,
    recentTransactions: transactionSummary,
    usageBreakdown,
    autoTopupStatus,
    lowBalanceAlert
  };
};

export const calculateUsageBreakdown = (usageData: CreditUsage[]): CreditUsageBreakdown[] => {
  const usageMap = new Map<CreditUsageType, { credits: number; count: number }>();
  let totalCredits = 0;

  usageData.forEach(usage => {
    const existing = usageMap.get(usage.usageType) || { credits: 0, count: 0 };
    usageMap.set(usage.usageType, {
      credits: existing.credits + usage.creditsUsed,
      count: existing.count + 1
    });
    totalCredits += usage.creditsUsed;
  });

  return Array.from(usageMap.entries()).map(([usageType, data]) => ({
    usageType,
    totalCredits: data.credits,
    transactionCount: data.count,
    percentage: totalCredits > 0 ? Math.round((data.credits / totalCredits) * 100) : 0
  }));
};

export const shouldTriggerLowBalanceAlert = (
  currentBalance: number,
  threshold: number = 10
): boolean => {
  return currentBalance <= threshold;
};

export const shouldTriggerCriticalBalanceAlert = (
  currentBalance: number,
  threshold: number = 3
): boolean => {
  return currentBalance <= threshold;
};

export const getRecommendedTopupAmount = (
  currentBalance: number,
  averageMonthlyUsage: number
): number => {
  if (averageMonthlyUsage <= 10) return 25;
  if (averageMonthlyUsage <= 30) return 50;
  if (averageMonthlyUsage <= 60) return 100;
  return 130;
};

export const sanitizeTransactionMetadata = (metadata: Record<string, any>): Record<string, any> => {
  const sanitized: Record<string, any> = {};
  
  Object.keys(metadata).forEach(key => {
    const value = metadata[key];
    if (typeof value === 'string') {
      sanitized[key] = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeTransactionMetadata(value);
    }
  });
  
  return sanitized;
};

export const generateReceiptNumber = (): string => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  return `BH${year}${month}${day}${random}`;
};

export const isValidCreditAmount = (credits: number): boolean => {
  return Number.isInteger(credits) && credits > 0 && credits <= 1000;
};

export const isValidTransactionType = (type: string): type is CreditTransactionType => {
  return Object.values(CreditTransactionType).includes(type as CreditTransactionType);
};

export const isValidUsageType = (type: string): type is CreditUsageType => {
  return Object.values(CreditUsageType).includes(type as CreditUsageType);
};

export const isValidPackageType = (type: string): type is CreditPackageType => {
  return Object.values(CreditPackageType).includes(type as CreditPackageType);
};

export const getTransactionStatusColor = (status: CreditTransactionStatus): string => {
  switch (status) {
    case CreditTransactionStatus.COMPLETED:
      return '#10B981';
    case CreditTransactionStatus.PENDING:
      return '#F59E0B';
    case CreditTransactionStatus.FAILED:
      return '#EF4444';
    case CreditTransactionStatus.CANCELLED:
      return '#6B7280';
    default:
      return '#6B7280';
  }
};

export const sortTransactionsByDate = (
  transactions: CreditTransaction[],
  order: 'asc' | 'desc' = 'desc'
): CreditTransaction[] => {
  return [...transactions].sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return order === 'desc' ? dateB - dateA : dateA - dateB;
  });
};

export const groupTransactionsByMonth = (
  transactions: CreditTransaction[]
): Record<string, CreditTransaction[]> => {
  return transactions.reduce((groups, transaction) => {
    const date = new Date(transaction.createdAt);
    const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    
    if (!groups[monthKey]) {
      groups[monthKey] = [];
    }
    groups[monthKey].push(transaction);
    
    return groups;
  }, {} as Record<string, CreditTransaction[]>);
};
