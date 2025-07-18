import { 
  CreditPackageType, 
  CreditUsageType, 
  CreditTransactionType,
  CreditTransactionStatus,
  AutoTopupStatus,
  UserRole 
} from '../../shared/types';
import { 
  CreditBalance, 
  CreditUsage, 
  AutoTopup, 
  CreditNotification,
  CreditDashboard,
  CreditLimits 
} from '../types';

export class CreditBalanceModel implements CreditBalance {
  public id: number;
  public userId: number;
  public currentBalance: number;
  public totalPurchased: number;
  public totalUsed: number;
  public totalRefunded: number;
  public lastPurchaseAt?: Date;
  public lastUsageAt?: Date;
  public createdAt: Date;
  public updatedAt: Date;

  constructor(data: Partial<CreditBalance>) {
    this.id = data.id || 0;
    this.userId = data.userId || 0;
    this.currentBalance = data.currentBalance || 0;
    this.totalPurchased = data.totalPurchased || 0;
    this.totalUsed = data.totalUsed || 0;
    this.totalRefunded = data.totalRefunded || 0;
    this.lastPurchaseAt = data.lastPurchaseAt;
    this.lastUsageAt = data.lastUsageAt;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  public addCredits(credits: number): void {
    this.currentBalance += credits;
    this.totalPurchased += credits;
    this.lastPurchaseAt = new Date();
    this.updatedAt = new Date();
  }

  public deductCredits(credits: number): boolean {
    if (this.currentBalance < credits) {
      return false;
    }
    this.currentBalance -= credits;
    this.totalUsed += credits;
    this.lastUsageAt = new Date();
    this.updatedAt = new Date();
    return true;
  }

  public refundCredits(credits: number): void {
    this.currentBalance += credits;
    this.totalRefunded += credits;
    this.updatedAt = new Date();
  }

  public hasSufficientBalance(requiredCredits: number): boolean {
    return this.currentBalance >= requiredCredits;
  }

  public isLowBalance(threshold: number = 10): boolean {
    return this.currentBalance <= threshold;
  }

  public isCriticalBalance(threshold: number = 3): boolean {
    return this.currentBalance <= threshold;
  }

  public getUtilizationRate(): number {
    if (this.totalPurchased === 0) return 0;
    return Math.round((this.totalUsed / this.totalPurchased) * 100);
  }

  public toJSON(): CreditBalance {
    return {
      id: this.id,
      userId: this.userId,
      currentBalance: this.currentBalance,
      totalPurchased: this.totalPurchased,
      totalUsed: this.totalUsed,
      totalRefunded: this.totalRefunded,
      lastPurchaseAt: this.lastPurchaseAt,
      lastUsageAt: this.lastUsageAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

export class CreditUsageModel implements CreditUsage {
  public id: number;
  public userId: number;
  public transactionId: number;
  public usageType: CreditUsageType;
  public creditsUsed: number;
  public referenceId?: number;
  public referenceType?: string;
  public description: string;
  public metadata: Record<string, any>;
  public createdAt: Date;

  constructor(data: Partial<CreditUsage>) {
    this.id = data.id || 0;
    this.userId = data.userId || 0;
    this.transactionId = data.transactionId || 0;
    this.usageType = data.usageType || CreditUsageType.JOB_APPLICATION;
    this.creditsUsed = data.creditsUsed || 0;
    this.referenceId = data.referenceId;
    this.referenceType = data.referenceType;
    this.description = data.description || '';
    this.metadata = data.metadata || {};
    this.createdAt = data.createdAt || new Date();
  }

  public isJobApplication(): boolean {
    return this.usageType === CreditUsageType.JOB_APPLICATION;
  }

  public isProfileBoost(): boolean {
    return this.usageType === CreditUsageType.PROFILE_BOOST;
  }

  public isPremiumUnlock(): boolean {
    return this.usageType === CreditUsageType.PREMIUM_JOB_UNLOCK;
  }

  public isDirectMessage(): boolean {
    return this.usageType === CreditUsageType.DIRECT_MESSAGE;
  }

  public isFeaturedListing(): boolean {
    return this.usageType === CreditUsageType.FEATURED_LISTING;
  }

  public hasReference(): boolean {
    return this.referenceId !== undefined && this.referenceType !== undefined;
  }

  public toJSON(): CreditUsage {
    return {
      id: this.id,
      userId: this.userId,
      transactionId: this.transactionId,
      usageType: this.usageType,
      creditsUsed: this.creditsUsed,
      referenceId: this.referenceId,
      referenceType: this.referenceType,
      description: this.description,
      metadata: this.metadata,
      createdAt: this.createdAt
    };
  }
}

export class AutoTopupModel implements AutoTopup {
  public id: number;
  public userId: number;
  public status: AutoTopupStatus;
  public triggerBalance: number;
  public topupAmount: number;
  public packageType: CreditPackageType;
  public paymentMethodId: number;
  public lastTriggeredAt?: Date;
  public failureCount: number;
  public createdAt: Date;
  public updatedAt: Date;

  constructor(data: Partial<AutoTopup>) {
    this.id = data.id || 0;
    this.userId = data.userId || 0;
    this.status = data.status || AutoTopupStatus.DISABLED;
    this.triggerBalance = data.triggerBalance || 5;
    this.topupAmount = data.topupAmount || 25;
    this.packageType = data.packageType || CreditPackageType.STANDARD;
    this.paymentMethodId = data.paymentMethodId || 0;
    this.lastTriggeredAt = data.lastTriggeredAt;
    this.failureCount = data.failureCount || 0;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  public enable(): void {
    this.status = AutoTopupStatus.ENABLED;
    this.updatedAt = new Date();
  }

  public disable(): void {
    this.status = AutoTopupStatus.DISABLED;
    this.updatedAt = new Date();
  }

  public suspend(): void {
    this.status = AutoTopupStatus.SUSPENDED;
    this.updatedAt = new Date();
  }

  public isEnabled(): boolean {
    return this.status === AutoTopupStatus.ENABLED;
  }

  public isDisabled(): boolean {
    return this.status === AutoTopupStatus.DISABLED;
  }

  public isSuspended(): boolean {
    return this.status === AutoTopupStatus.SUSPENDED;
  }

  public isProcessing(): boolean {
    return this.status === AutoTopupStatus.PROCESSING;
  }

  public shouldTrigger(currentBalance: number): boolean {
    return this.isEnabled() && currentBalance <= this.triggerBalance;
  }

  public recordFailure(): void {
    this.failureCount += 1;
    this.updatedAt = new Date();
    
    if (this.failureCount >= 3) {
      this.suspend();
    }
  }

  public recordSuccess(): void {
    this.failureCount = 0;
    this.lastTriggeredAt = new Date();
    this.updatedAt = new Date();
  }

  public resetFailures(): void {
    this.failureCount = 0;
    this.updatedAt = new Date();
  }

  public toJSON(): AutoTopup {
    return {
      id: this.id,
      userId: this.userId,
      status: this.status,
      triggerBalance: this.triggerBalance,
      topupAmount: this.topupAmount,
      packageType: this.packageType,
      paymentMethodId: this.paymentMethodId,
      lastTriggeredAt: this.lastTriggeredAt,
      failureCount: this.failureCount,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

export class CreditNotificationModel implements CreditNotification {
  public id: number;
  public userId: number;
  public notificationType: string;
  public thresholdBalance: number;
  public isSent: boolean;
  public sentAt?: Date;
  public createdAt: Date;

  constructor(data: Partial<CreditNotification>) {
    this.id = data.id || 0;
    this.userId = data.userId || 0;
    this.notificationType = data.notificationType || '';
    this.thresholdBalance = data.thresholdBalance || 0;
    this.isSent = data.isSent || false;
    this.sentAt = data.sentAt;
    this.createdAt = data.createdAt || new Date();
  }

  public markAsSent(): void {
    this.isSent = true;
    this.sentAt = new Date();
  }

  public isLowBalanceNotification(): boolean {
    return this.notificationType === 'low_balance';
  }

  public isCriticalBalanceNotification(): boolean {
    return this.notificationType === 'critical_balance';
  }

  public isPurchaseNotification(): boolean {
    return this.notificationType.includes('purchase');
  }

  public toJSON(): CreditNotification {
    return {
      id: this.id,
      userId: this.userId,
      notificationType: this.notificationType,
      thresholdBalance: this.thresholdBalance,
      isSent: this.isSent,
      sentAt: this.sentAt,
      createdAt: this.createdAt
    };
  }
}
