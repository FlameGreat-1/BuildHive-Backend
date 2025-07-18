import { CreditPackageType } from '../../shared/types';

export interface PricingConfig {
  currency: string;
  taxRate: number;
  processingFeeRate: number;
  minimumPurchase: number;
  maximumPurchase: number;
  discountThresholds: DiscountThreshold[];
  promotionalOffers: PromotionalOffer[];
}

export interface DiscountThreshold {
  minimumAmount: number;
  discountPercentage: number;
  description: string;
}

export interface PromotionalOffer {
  code: string;
  discountPercentage: number;
  validFrom: Date;
  validUntil: Date;
  maxUses: number;
  currentUses: number;
  applicablePackages: CreditPackageType[];
  description: string;
  active: boolean;
}

export const PRICING_CONFIG: PricingConfig = {
  currency: 'AUD',
  taxRate: 0.10, // 10% GST
  processingFeeRate: 0.029, // 2.9% processing fee
  minimumPurchase: 5.00,
  maximumPurchase: 500.00,
  discountThresholds: [
    {
      minimumAmount: 50.00,
      discountPercentage: 5,
      description: '5% off orders over $50'
    },
    {
      minimumAmount: 100.00,
      discountPercentage: 10,
      description: '10% off orders over $100'
    },
    {
      minimumAmount: 200.00,
      discountPercentage: 15,
      description: '15% off orders over $200'
    }
  ],
  promotionalOffers: []
};

export const CREDIT_COST_PER_UNIT = 0.99; // Base cost per credit

export const BULK_PRICING_TIERS = {
  TIER_1: { minCredits: 1, maxCredits: 10, pricePerCredit: 0.99 },
  TIER_2: { minCredits: 11, maxCredits: 30, pricePerCredit: 0.89 },
  TIER_3: { minCredits: 31, maxCredits: 65, pricePerCredit: 0.79 },
  TIER_4: { minCredits: 66, maxCredits: 130, pricePerCredit: 0.69 }
};

export const calculatePrice = (credits: number): number => {
  const tier = Object.values(BULK_PRICING_TIERS).find(
    t => credits >= t.minCredits && credits <= t.maxCredits
  );
  
  return tier ? credits * tier.pricePerCredit : credits * CREDIT_COST_PER_UNIT;
};

export const calculateTax = (amount: number): number => {
  return amount * PRICING_CONFIG.taxRate;
};

export const calculateProcessingFee = (amount: number): number => {
  return amount * PRICING_CONFIG.processingFeeRate;
};

export const calculateTotalAmount = (baseAmount: number): {
  baseAmount: number;
  tax: number;
  processingFee: number;
  totalAmount: number;
} => {
  const tax = calculateTax(baseAmount);
  const processingFee = calculateProcessingFee(baseAmount);
  const totalAmount = baseAmount + tax + processingFee;

  return {
    baseAmount,
    tax,
    processingFee,
    totalAmount
  };
};

export const applyDiscount = (amount: number): {
  originalAmount: number;
  discountPercentage: number;
  discountAmount: number;
  finalAmount: number;
} => {
  const applicableDiscount = PRICING_CONFIG.discountThresholds
    .filter(threshold => amount >= threshold.minimumAmount)
    .sort((a, b) => b.discountPercentage - a.discountPercentage)[0];

  if (!applicableDiscount) {
    return {
      originalAmount: amount,
      discountPercentage: 0,
      discountAmount: 0,
      finalAmount: amount
    };
  }

  const discountAmount = amount * (applicableDiscount.discountPercentage / 100);
  const finalAmount = amount - discountAmount;

  return {
    originalAmount: amount,
    discountPercentage: applicableDiscount.discountPercentage,
    discountAmount,
    finalAmount
  };
};
