import { 
  CreditTransactionType, 
  CreditTransactionStatus, 
  CreditUsageType 
} from '../../shared/types';

export interface CreditTransaction {
  id: number;
  userId: number;
  paymentId?: number;
  transactionType: CreditTransactionType;
  credits: number;
  status: CreditTransactionStatus;
  description: string;
  referenceId?: number;
  referenceType?: string;
  expiresAt?: Date;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreditTransactionRequest {
  transactionType: CreditTransactionType;
  credits: number;
  description: string;
  referenceId?: number;
  referenceType?: string;
  usageType?: CreditUsageType;
  metadata?: Record<string, any>;
}

export interface CreditTransactionResponse {
  transactionId: number;
  userId: number;
  transactionType: CreditTransactionType;
  credits: number;
  status: CreditTransactionStatus;
  description: string;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: Date;
  expiresAt?: Date;
}

export interface CreditTransactionHistory {
  transactions: CreditTransactionRecord[];
  totalTransactions: number;
  totalCreditsEarned: number;
  totalCreditsSpent: number;
  netCredits: number;
  pagination: TransactionPagination;
}

export interface CreditTransactionRecord {
  id: number;
  transactionType: CreditTransactionType;
  credits: number;
  status: CreditTransactionStatus;
  description: string;
  balanceAfter: number;
  createdAt: Date;
  expiresAt?: Date;
  referenceType?: string;
  referenceId?: number;
}

export interface TransactionPagination {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  recordsPerPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface CreditTransactionFilter {
  userId: number;
  transactionType?: CreditTransactionType;
  status?: CreditTransactionStatus;
  dateFrom?: Date;
  dateTo?: Date;
  minCredits?: number;
  maxCredits?: number;
  referenceType?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'credits' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface CreditTransactionSummary {
  totalTransactions: number;
  totalCreditsIn: number;
  totalCreditsOut: number;
  netCredits: number;
  transactionsByType: TransactionTypeBreakdown[];
  transactionsByStatus: TransactionStatusBreakdown[];
  monthlyActivity: MonthlyTransactionActivity[];
}

export interface TransactionTypeBreakdown {
  transactionType: CreditTransactionType;
  count: number;
  totalCredits: number;
  percentage: number;
}

export interface TransactionStatusBreakdown {
  status: CreditTransactionStatus;
  count: number;
  percentage: number;
}

export interface MonthlyTransactionActivity {
  month: string;
  year: number;
  totalTransactions: number;
  totalCreditsIn: number;
  totalCreditsOut: number;
  netCredits: number;
}

export interface CreditTransactionValidation {
  userId: number;
  transactionType: CreditTransactionType;
  credits: number;
  currentBalance: number;
  dailyUsage: number;
  monthlyUsage: number;
  usageType?: CreditUsageType;
}

export interface CreditTransactionResult {
  success: boolean;
  transactionId?: number;
  balanceBefore: number;
  balanceAfter: number;
  credits: number;
  message: string;
  errorCode?: string;
}

export interface CreditTransactionBatch {
  batchId: string;
  userId: number;
  transactions: CreditTransactionRequest[];
  totalCredits: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  processedCount: number;
  failedCount: number;
  createdAt: Date;
  completedAt?: Date;
}

export interface CreditTransactionAudit {
  transactionId: number;
  userId: number;
  action: string;
  oldValues: Record<string, any>;
  newValues: Record<string, any>;
  performedBy: number;
  performedAt: Date;
  ipAddress: string;
  userAgent: string;
}

export interface CreditTransactionAlert {
  alertType: 'low_balance' | 'high_usage' | 'suspicious_activity' | 'failed_transaction';
  userId: number;
  transactionId?: number;
  threshold: number;
  currentValue: number;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Date;
  acknowledged: boolean;
}

export interface CreditTransactionExport {
  userId: number;
  dateFrom: Date;
  dateTo: Date;
  format: 'csv' | 'pdf' | 'excel';
  includeMetadata: boolean;
  transactions: CreditTransactionRecord[];
  generatedAt: Date;
  fileUrl: string;
}
