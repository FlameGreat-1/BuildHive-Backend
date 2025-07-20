import { 
  CreditPackageType, 
  CreditUsageType, 
  CreditTransactionType, 
  CreditTransactionStatus,
  AutoTopupStatus,
  UserRole 
} from '../../shared/types';

export interface CreditBalance {
  id: number;
  userId: number;
  currentBalance: number;
  totalPurchased: number;
  totalUsed: number;
  totalRefunded: number;
  lastPurchaseAt?: Date;
  lastUsageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreditUsage {
  id: number;
  userId: number;
  transactionId: number;
  usageType: CreditUsageType;
  creditsUsed: number;
  referenceId?: number;
  referenceType?: string;
  description: string;
  metadata: Record<string, any>;
  createdAt: Date;
}

export interface AutoTopup {
  id: number;
  userId: number;
  status: AutoTopupStatus;
  triggerBalance: number;
  topupAmount: number;
  packageType: CreditPackageType;
  paymentMethodId: number;
  lastTriggeredAt?: Date;
  failureCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutoTopupSettings {
  enabled: boolean;
  triggerBalance: number;
  topupAmount: number;
  packageType: CreditPackageType;
  paymentMethodId: number;
  maxTopupsPerDay?: number;
  maxTopupsPerMonth?: number;
  notifyOnTopup?: boolean;
  lastModified?: Date;
}

export interface CreditNotification {
  id: number;
  userId: number;
  notificationType: string;
  thresholdBalance: number;
  isSent: boolean;
  sentAt?: Date;
  createdAt: Date;
}

export interface CreditDashboard {
  currentBalance: number;
  totalPurchased: number;
  totalUsed: number;
  totalRefunded: number;
  recentTransactions: CreditTransactionSummary[];
  usageBreakdown: CreditUsageBreakdown[];
  autoTopupStatus: AutoTopupStatus;
  lowBalanceAlert: boolean;
}

export interface CreditTransactionSummary {
  id: number;
  type: CreditTransactionType;
  credits: number;
  description: string;
  createdAt: Date;
}

export interface CreditUsageBreakdown {
  usageType: CreditUsageType;
  totalCredits: number;
  transactionCount: number;
  percentage: number;
}

export interface CreditLimits {
  maxDailyPurchase: number;
  maxMonthlyPurchase: number;
  maxCreditBalance: number;
  minCreditBalance: number;
  lowBalanceThreshold: number;
  criticalBalanceThreshold: number;
  maxTransactionsPerDay: number;
  maxTransactionsPerMonth: number;
  cooldownPeriodMinutes: number;
}

export interface CreditValidationResult {
  valid: boolean;
  reason?: string;
  suggestedAction?: string;
}

export interface CreditCalculation {
  baseAmount: number;
  bonusCredits: number;
  totalCredits: number;
  pricePerCredit: number;
  savings: number;
}

export interface CreditPackageInfo {
  type: CreditPackageType;
  name: string;
  description: string;
  creditsAmount: number;
  bonusCredits: number;
  totalCredits: number;
  price: number;
  currency: string;
  savings: number;
  popular: boolean;
  features: string[];
  validityDays?: number;
}

export interface CreditUsageConfig {
  type: CreditUsageType;
  name: string;
  description: string;
  creditsRequired: number;
  maxPerDay: number;
  maxPerMonth: number;
  enabled: boolean;
  category: string;
  priority: number;
}

export interface CreditBalanceCheck {
  userId: number;
  currentBalance: number;
  requiredCredits: number;
  sufficient: boolean;
  shortfall?: number;
}

export interface CreditExpiry {
  transactionId: number;
  userId: number;
  creditsToExpire: number;
  expiryDate: Date;
  daysUntilExpiry: number;
}

export interface CreditRefund {
  transactionId: number;
  userId: number;
  creditsToRefund: number;
  reason: string;
  refundType: 'full' | 'partial';
  originalPurchaseId: number;
}

export interface CreditAnalytics {
  totalUsers: number;
  totalCreditsIssued: number;
  totalCreditsUsed: number;
  totalRevenue: number;
  averageCreditsPerUser: number;
  mostPopularUsageType: CreditUsageType;
  conversionRate: number;
}

export interface CreditEvent {
  eventType: 'purchase' | 'usage' | 'refund' | 'expiry' | 'topup';
  userId: number;
  credits: number;
  metadata: Record<string, any>;
  timestamp: Date;
}

export interface CreditSubscriptionBenefit {
  packageType: CreditPackageType;
  monthlyCredits: number;
  bonusPercentage: number;
  prioritySupport: boolean;
  unlimitedFeatures: string[];
}
