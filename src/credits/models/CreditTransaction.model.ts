import { 
  CreditTransactionType, 
  CreditTransactionStatus, 
  CreditUsageType 
} from '../../shared/types';
import { 
  CreditTransaction, 
  CreditTransactionRequest,
  CreditTransactionResponse,
  CreditTransactionResult 
} from '../types';
import { 
  generateTransactionId,
  getTransactionDescription,
  calculateBalanceAfterTransaction,
  isTransactionExpired,
  getDaysUntilExpiry 
} from '../utils';

export class CreditTransactionModel implements CreditTransaction {
  public id: number;
  public userId: number;
  public transactionType: CreditTransactionType;
  public credits: number;
  public status: CreditTransactionStatus;
  public description: string;
  public referenceId?: number;
  public referenceType?: string;
  public expiresAt?: Date;
  public metadata: Record<string, any>;
  public createdAt: Date;
  public updatedAt: Date;

  constructor(data: Partial<CreditTransaction>) {
    this.id = data.id || 0;
    this.userId = data.userId || 0;
    this.transactionType = data.transactionType || CreditTransactionType.PURCHASE;
    this.credits = data.credits || 0;
    this.status = data.status || CreditTransactionStatus.PENDING;
    this.description = data.description || '';
    this.referenceId = data.referenceId;
    this.referenceType = data.referenceType;
    this.expiresAt = data.expiresAt;
    this.metadata = data.metadata || {};
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  public static fromRequest(
    userId: number,
    request: CreditTransactionRequest
  ): CreditTransactionModel {
    const description = request.description || getTransactionDescription(
      request.transactionType,
      request.credits,
      request.usageType
    );

    return new CreditTransactionModel({
      userId,
      transactionType: request.transactionType,
      credits: request.credits,
      description,
      referenceId: request.referenceId,
      referenceType: request.referenceType,
      metadata: request.metadata || {}
    });
  }

  public complete(): void {
    this.status = CreditTransactionStatus.COMPLETED;
    this.updatedAt = new Date();
  }

  public fail(reason?: string): void {
    this.status = CreditTransactionStatus.FAILED;
    if (reason) {
      this.metadata.failureReason = reason;
    }
    this.updatedAt = new Date();
  }

  public cancel(): void {
    this.status = CreditTransactionStatus.CANCELLED;
    this.updatedAt = new Date();
  }

  public isPending(): boolean {
    return this.status === CreditTransactionStatus.PENDING;
  }

  public isCompleted(): boolean {
    return this.status === CreditTransactionStatus.COMPLETED;
  }

  public isFailed(): boolean {
    return this.status === CreditTransactionStatus.FAILED;
  }

  public isCancelled(): boolean {
    return this.status === CreditTransactionStatus.CANCELLED;
  }

  public isPurchase(): boolean {
    return this.transactionType === CreditTransactionType.PURCHASE;
  }

  public isUsage(): boolean {
    return this.transactionType === CreditTransactionType.USAGE;
  }

  public isRefund(): boolean {
    return this.transactionType === CreditTransactionType.REFUND;
  }

  public isBonus(): boolean {
    return this.transactionType === CreditTransactionType.BONUS;
  }

  public isTrial(): boolean {
    return this.transactionType === CreditTransactionType.TRIAL;
  }

  public isSubscription(): boolean {
    return this.transactionType === CreditTransactionType.SUBSCRIPTION;
  }

  public isExpiry(): boolean {
    return this.transactionType === CreditTransactionType.EXPIRY;
  }

  public isExpired(): boolean {
    return isTransactionExpired(this);
  }

  public getDaysUntilExpiry(): number | null {
    if (!this.expiresAt) return null;
    return getDaysUntilExpiry(this.expiresAt);
  }

  public isCreditsAddition(): boolean {
    return [
      CreditTransactionType.PURCHASE,
      CreditTransactionType.BONUS,
      CreditTransactionType.REFUND,
      CreditTransactionType.TRIAL,
      CreditTransactionType.SUBSCRIPTION
    ].includes(this.transactionType);
  }

  public isCreditsDeduction(): boolean {
    return [
      CreditTransactionType.USAGE,
      CreditTransactionType.EXPIRY
    ].includes(this.transactionType);
  }

  public hasReference(): boolean {
    return this.referenceId !== undefined && this.referenceType !== undefined;
  }

  public setExpiry(expiryDate: Date): void {
    this.expiresAt = expiryDate;
    this.updatedAt = new Date();
  }

  public addMetadata(key: string, value: any): void {
    this.metadata[key] = value;
    this.updatedAt = new Date();
  }

  public getMetadata(key: string): any {
    return this.metadata[key];
  }

  public toResponse(balanceBefore: number, balanceAfter: number): CreditTransactionResponse {
    return {
      transactionId: this.id,
      userId: this.userId,
      transactionType: this.transactionType,
      credits: this.credits,
      status: this.status,
      description: this.description,
      balanceBefore,
      balanceAfter,
      createdAt: this.createdAt,
      expiresAt: this.expiresAt
    };
  }

  public toResult(balanceBefore: number, balanceAfter: number): CreditTransactionResult {
    return {
      success: this.isCompleted(),
      transactionId: this.id,
      balanceBefore,
      balanceAfter,
      credits: this.credits,
      message: this.isCompleted() ? 'Transaction completed successfully' : 'Transaction failed',
      errorCode: this.isFailed() ? this.metadata.failureReason : undefined
    };
  }

  public toJSON(): CreditTransaction {
    return {
      id: this.id,
      userId: this.userId,
      transactionType: this.transactionType,
      credits: this.credits,
      status: this.status,
      description: this.description,
      referenceId: this.referenceId,
      referenceType: this.referenceType,
      expiresAt: this.expiresAt,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}
