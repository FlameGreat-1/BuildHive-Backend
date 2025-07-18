import { CreditPackageType, CreditTransactionStatus } from '../../shared/types';

export interface CreditPurchase {
  id: number;
  userId: number;
  paymentId: number;
  packageType: CreditPackageType;
  creditsAmount: number;
  purchasePrice: number;
  currency: string;
  bonusCredits: number;
  status: CreditTransactionStatus;
  expiresAt?: Date;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreditPurchaseRequest {
  packageType: CreditPackageType;
  paymentMethodId?: number;
  autoTopup?: boolean;
  promoCode?: string;
}

export interface CreditPurchaseResponse {
  purchaseId: number;
  creditsAmount: number;
  bonusCredits: number;
  totalCredits: number;
  purchasePrice: number;
  currency: string;
  paymentIntentId: string;
  clientSecret: string;
  status: CreditTransactionStatus;
  expiresAt?: Date;
}

export interface CreditPurchaseValidation {
  packageType: CreditPackageType;
  userId: number;
  userRole: string;
  currentBalance: number;
  dailySpent: number;
  monthlySpent: number;
  paymentMethodId?: number;
}

export interface CreditPurchaseCalculation {
  packageType: CreditPackageType;
  basePrice: number;
  creditsAmount: number;
  bonusCredits: number;
  totalCredits: number;
  discountAmount: number;
  taxAmount: number;
  processingFee: number;
  finalAmount: number;
  pricePerCredit: number;
  savings: number;
}

export interface CreditPurchaseHistory {
  purchases: CreditPurchaseRecord[];
  totalPurchases: number;
  totalSpent: number;
  totalCreditsReceived: number;
  averagePurchaseAmount: number;
  mostPopularPackage: CreditPackageType;
}

export interface CreditPurchaseRecord {
  id: number;
  packageType: CreditPackageType;
  creditsAmount: number;
  bonusCredits: number;
  totalCredits: number;
  purchasePrice: number;
  currency: string;
  status: CreditTransactionStatus;
  paymentMethod: string;
  purchaseDate: Date;
  expiryDate?: Date;
}

export interface CreditPurchaseMetrics {
  totalPurchases: number;
  totalRevenue: number;
  averageOrderValue: number;
  conversionRate: number;
  popularPackages: PackagePopularity[];
  monthlyTrends: MonthlyPurchaseTrend[];
}

export interface PackagePopularity {
  packageType: CreditPackageType;
  purchaseCount: number;
  revenue: number;
  percentage: number;
}

export interface MonthlyPurchaseTrend {
  month: string;
  year: number;
  totalPurchases: number;
  totalRevenue: number;
  averageOrderValue: number;
}

export interface CreditPurchasePromo {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minimumPurchase: number;
  maximumDiscount: number;
  validFrom: Date;
  validUntil: Date;
  usageLimit: number;
  currentUsage: number;
  applicablePackages: CreditPackageType[];
  active: boolean;
}

export interface CreditPurchaseReceipt {
  purchaseId: number;
  receiptNumber: string;
  userId: number;
  packageType: CreditPackageType;
  creditsAmount: number;
  bonusCredits: number;
  totalCredits: number;
  baseAmount: number;
  discountAmount: number;
  taxAmount: number;
  processingFee: number;
  totalAmount: number;
  currency: string;
  paymentMethod: string;
  purchaseDate: Date;
  expiryDate?: Date;
  businessDetails: BusinessDetails;
}

export interface BusinessDetails {
  businessName: string;
  abn: string;
  address: string;
  email: string;
  phone: string;
}

export interface CreditPurchaseFailure {
  purchaseId: number;
  userId: number;
  packageType: CreditPackageType;
  attemptedAmount: number;
  failureReason: string;
  errorCode: string;
  paymentMethodId?: number;
  retryCount: number;
  lastAttemptAt: Date;
  canRetry: boolean;
}
