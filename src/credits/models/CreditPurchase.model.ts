import { 
  CreditPackageType, 
  CreditTransactionStatus 
} from '../../shared/types';
import { 
  CreditPurchase, 
  CreditPurchaseRequest,
  CreditPurchaseResponse,
  CreditPurchaseCalculation,
  CreditPurchaseReceipt,
  BusinessDetails 
} from '../types';
import { 
  generatePurchaseId,
  generateReceiptNumber,
  formatCurrency 
} from '../utils';
import { 
  CREDIT_PACKAGES,
  calculateCreditPurchase 
} from '../../config/credits';

export class CreditPurchaseModel implements CreditPurchase {
  public id: number;
  public userId: number;
  public paymentId: number;
  public packageType: CreditPackageType;
  public creditsAmount: number;
  public purchasePrice: number;
  public currency: string;
  public bonusCredits: number;
  public status: CreditTransactionStatus;
  public expiresAt?: Date;
  public metadata: Record<string, any>;
  public createdAt: Date;
  public updatedAt: Date;

  constructor(data: Partial<CreditPurchase>) {
    this.id = data.id || 0;
    this.userId = data.userId || 0;
    this.paymentId = data.paymentId || 0;
    this.packageType = data.packageType || CreditPackageType.STARTER;
    this.creditsAmount = data.creditsAmount || 0;
    this.purchasePrice = data.purchasePrice || 0;
    this.currency = data.currency || 'AUD';
    this.bonusCredits = data.bonusCredits || 0;
    this.status = data.status || CreditTransactionStatus.PENDING;
    this.expiresAt = data.expiresAt;
    this.metadata = data.metadata || {};
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  public static fromRequest(
    userId: number,
    request: CreditPurchaseRequest
  ): CreditPurchaseModel {
    const packageInfo = CREDIT_PACKAGES[request.packageType];
    const calculation = calculateCreditPurchase(request.packageType, request.promoCode);

    return new CreditPurchaseModel({
      userId,
      packageType: request.packageType,
      creditsAmount: packageInfo.creditsAmount,
      purchasePrice: calculation.finalAmount,
      currency: packageInfo.currency,
      bonusCredits: packageInfo.bonusCredits,
      metadata: {
        autoTopup: request.autoTopup || false,
        promoCode: request.promoCode,
        paymentMethodId: request.paymentMethodId
      }
    });
  }

  public complete(paymentId: number): void {
    this.paymentId = paymentId;
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

  public getTotalCredits(): number {
    return this.creditsAmount + this.bonusCredits;
  }

  public getPricePerCredit(): number {
    const totalCredits = this.getTotalCredits();
    return totalCredits > 0 ? this.purchasePrice / totalCredits : 0;
  }

  public hasAutoTopup(): boolean {
    return this.metadata.autoTopup === true;
  }

  public hasPromoCode(): boolean {
    return !!this.metadata.promoCode;
  }

  public getPromoCode(): string | undefined {
    return this.metadata.promoCode;
  }

  public isExpired(): boolean {
    if (!this.expiresAt) return false;
    return new Date() > new Date(this.expiresAt);
  }

  public getDaysUntilExpiry(): number | null {
    if (!this.expiresAt) return null;
    const now = new Date();
    const expiry = new Date(this.expiresAt);
    const diffTime = expiry.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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

  public toResponse(paymentIntentId: string, clientSecret: string): CreditPurchaseResponse {
    return {
      purchaseId: this.id,
      creditsAmount: this.creditsAmount,
      bonusCredits: this.bonusCredits,
      totalCredits: this.getTotalCredits(),
      purchasePrice: this.purchasePrice,
      currency: this.currency,
      paymentIntentId,
      clientSecret,
      status: this.status,
      expiresAt: this.expiresAt
    };
  }

  public toReceipt(businessDetails: BusinessDetails): CreditPurchaseReceipt {
    const packageInfo = CREDIT_PACKAGES[this.packageType];
    const calculation = calculateCreditPurchase(this.packageType, this.getPromoCode());

    return {
      purchaseId: this.id,
      receiptNumber: generateReceiptNumber(),
      userId: this.userId,
      packageType: this.packageType,
      creditsAmount: this.creditsAmount,
      bonusCredits: this.bonusCredits,
      totalCredits: this.getTotalCredits(),
      baseAmount: calculation.basePrice,
      discountAmount: calculation.discountAmount,
      taxAmount: calculation.taxAmount,
      processingFee: calculation.processingFee,
      totalAmount: this.purchasePrice,
      currency: this.currency,
      paymentMethod: this.metadata.paymentMethod || 'Card',
      purchaseDate: this.createdAt,
      expiryDate: this.expiresAt,
      businessDetails
    };
  }

  public getPackageInfo(): any {
    return CREDIT_PACKAGES[this.packageType];
  }

  public getFormattedPrice(): string {
    return formatCurrency(this.purchasePrice, this.currency);
  }

  public getFormattedPricePerCredit(): string {
    return formatCurrency(this.getPricePerCredit(), this.currency);
  }

  public toJSON(): CreditPurchase {
    return {
      id: this.id,
      userId: this.userId,
      paymentId: this.paymentId,
      packageType: this.packageType,
      creditsAmount: this.creditsAmount,
      purchasePrice: this.purchasePrice,
      currency: this.currency,
      bonusCredits: this.bonusCredits,
      status: this.status,
      expiresAt: this.expiresAt,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}
