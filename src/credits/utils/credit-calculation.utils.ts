import { CreditPackageType, UserRole } from '../../shared/types';
import { 
  CreditCalculation, 
  CreditPurchaseCalculation,
  CreditPackageInfo 
} from '../types';
import { 
  CREDIT_PACKAGES,
  PRICING_CONFIG,
  BULK_PRICING_TIERS,
  calculatePrice,
  calculateTax,
  calculateProcessingFee,
  calculateTotalAmount,
  applyDiscount
} from '../../config/credits';

export const calculateCreditPurchase = (
  packageType: CreditPackageType,
  promoCode?: string
): CreditPurchaseCalculation => {
  const packageInfo = CREDIT_PACKAGES[packageType];
  const basePrice = packageInfo.price;
  const creditsAmount = packageInfo.creditsAmount;
  const bonusCredits = packageInfo.bonusCredits;
  const totalCredits = packageInfo.totalCredits;

  let discountAmount = 0;
  if (promoCode) {
    const discount = applyDiscount(basePrice);
    discountAmount = discount.discountAmount;
  }

  const discountedPrice = basePrice - discountAmount;
  const taxAmount = calculateTax(discountedPrice);
  const processingFee = calculateProcessingFee(discountedPrice);
  const finalAmount = discountedPrice + taxAmount + processingFee;
  
  const pricePerCredit = totalCredits > 0 ? finalAmount / totalCredits : 0;
  const savings = packageInfo.savings + discountAmount;

  return {
    packageType,
    basePrice,
    creditsAmount,
    bonusCredits,
    totalCredits,
    discountAmount,
    taxAmount,
    processingFee,
    finalAmount,
    pricePerCredit,
    savings
  };
};

export const calculateBulkPricing = (credits: number): number => {
  const tier = Object.values(BULK_PRICING_TIERS).find(
    t => credits >= t.minCredits && credits <= t.maxCredits
  );
  
  return tier ? credits * tier.pricePerCredit : calculatePrice(credits);
};

export const calculateCreditsValue = (credits: number): CreditCalculation => {
  const baseAmount = calculateBulkPricing(credits);
  const bonusCredits = calculateBonusCredits(credits);
  const totalCredits = credits + bonusCredits;
  const pricePerCredit = baseAmount / totalCredits;
  const savings = calculateSavings(credits, baseAmount);

  return {
    baseAmount,
    bonusCredits,
    totalCredits,
    pricePerCredit,
    savings
  };
};

export const calculateBonusCredits = (purchasedCredits: number): number => {
  if (purchasedCredits >= 100) return Math.floor(purchasedCredits * 0.30);
  if (purchasedCredits >= 50) return Math.floor(purchasedCredits * 0.20);
  if (purchasedCredits >= 25) return Math.floor(purchasedCredits * 0.15);
  if (purchasedCredits >= 10) return Math.floor(purchasedCredits * 0.10);
  return 0;
};

export const calculateSavings = (credits: number, actualPrice: number): number => {
  const regularPrice = credits * 0.99;
  return Math.max(0, regularPrice - actualPrice);
};

export const calculateRefundAmount = (
  originalPrice: number,
  creditsUsed: number,
  totalCredits: number,
  refundType: 'full' | 'partial' = 'partial'
): number => {
  if (refundType === 'full') return originalPrice;
  
  const unusedCredits = totalCredits - creditsUsed;
  const refundPercentage = unusedCredits / totalCredits;
  
  return originalPrice * refundPercentage;
};

export const calculateAutoTopupAmount = (
  currentBalance: number,
  triggerBalance: number,
  packageType: CreditPackageType
): number => {
  if (currentBalance > triggerBalance) return 0;
  
  const packageInfo = CREDIT_PACKAGES[packageType];
  return packageInfo.totalCredits;
};

export const calculateMonthlyUsageAverage = (
  usageHistory: { credits: number; date: Date }[],
  months: number = 3
): number => {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - months);
  
  const recentUsage = usageHistory.filter(usage => 
    new Date(usage.date) >= cutoffDate
  );
  
  if (recentUsage.length === 0) return 0;
  
  const totalCredits = recentUsage.reduce((sum, usage) => sum + usage.credits, 0);
  return Math.ceil(totalCredits / months);
};

export const calculateCreditUtilizationRate = (
  totalPurchased: number,
  totalUsed: number
): number => {
  if (totalPurchased === 0) return 0;
  return Math.round((totalUsed / totalPurchased) * 100);
};

export const calculateBreakEvenPoint = (
  monthlyUsage: number,
  subscriptionCredits: number,
  subscriptionPrice: number,
  creditPrice: number = 0.99
): number => {
  const payAsYouGoMonthlyCost = monthlyUsage * creditPrice;
  const subscriptionMonthlyCost = subscriptionPrice;
  
  if (payAsYouGoMonthlyCost <= subscriptionMonthlyCost) return 0;
  
  return Math.ceil(subscriptionMonthlyCost / creditPrice);
};

export const calculateROI = (
  creditsSpent: number,
  jobsWon: number,
  averageJobValue: number,
  creditCost: number = 0.99
): number => {
  const totalInvestment = creditsSpent * creditCost;
  const totalReturn = jobsWon * averageJobValue;
  
  if (totalInvestment === 0) return 0;
  
  return Math.round(((totalReturn - totalInvestment) / totalInvestment) * 100);
};

export const calculateOptimalPackage = (
  monthlyUsage: number,
  userRole: UserRole
): CreditPackageType => {
  const usageWithBuffer = monthlyUsage * 1.2;
  
  if (userRole === UserRole.ENTERPRISE) {
    return CreditPackageType.ENTERPRISE;
  }
  
  if (usageWithBuffer <= 10) return CreditPackageType.STARTER;
  if (usageWithBuffer <= 30) return CreditPackageType.STANDARD;
  if (usageWithBuffer <= 65) return CreditPackageType.PREMIUM;
  
  return CreditPackageType.ENTERPRISE;
};

export const calculatePriceComparison = (
  targetCredits: number
): { packageType: CreditPackageType; efficiency: number }[] => {
  const packages = Object.values(CREDIT_PACKAGES);
  
  return packages
    .map(pkg => {
      const packagesNeeded = Math.ceil(targetCredits / pkg.totalCredits);
      const totalCost = packagesNeeded * pkg.price;
      const totalCreditsReceived = packagesNeeded * pkg.totalCredits;
      const efficiency = totalCreditsReceived / totalCost;
      
      return {
        packageType: pkg.type,
        efficiency
      };
    })
    .sort((a, b) => b.efficiency - a.efficiency);
};

export const calculateSeasonalDiscount = (
  basePrice: number,
  season: 'spring' | 'summer' | 'autumn' | 'winter'
): number => {
  const seasonalMultipliers = {
    spring: 0.95,
    summer: 1.0,
    autumn: 0.90,
    winter: 0.85
  };
  
  return basePrice * seasonalMultipliers[season];
};

export const calculateLoyaltyBonus = (
  totalPurchases: number,
  membershipMonths: number
): number => {
  let bonusPercentage = 0;
  
  if (membershipMonths >= 12) bonusPercentage += 5;
  if (membershipMonths >= 24) bonusPercentage += 5;
  if (totalPurchases >= 10) bonusPercentage += 3;
  if (totalPurchases >= 25) bonusPercentage += 7;
  
  return Math.min(bonusPercentage, 20);
};

export const calculateDynamicPricing = (
  basePrice: number,
  demand: number,
  supply: number,
  timeOfDay: number
): number => {
  const demandMultiplier = Math.min(Math.max(demand / supply, 0.8), 1.3);
  const timeMultiplier = timeOfDay >= 9 && timeOfDay <= 17 ? 1.1 : 0.95;
  
  return basePrice * demandMultiplier * timeMultiplier;
};

export const calculateCreditExpiry = (
  purchaseDate: Date,
  packageType: CreditPackageType
): Date | null => {
  const packageInfo = CREDIT_PACKAGES[packageType];
  if (!packageInfo.validityDays) return null;
  
  const expiryDate = new Date(purchaseDate);
  expiryDate.setDate(expiryDate.getDate() + packageInfo.validityDays);
  
  return expiryDate;
};

export const calculateProRatedRefund = (
  originalAmount: number,
  purchaseDate: Date,
  refundDate: Date,
  validityDays: number
): number => {
  const totalDays = validityDays;
  const usedDays = Math.floor((refundDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
  const remainingDays = Math.max(0, totalDays - usedDays);
  
  return (remainingDays / totalDays) * originalAmount;
};
