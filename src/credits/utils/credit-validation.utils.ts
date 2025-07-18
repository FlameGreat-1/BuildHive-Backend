import { 
  CreditPackageType, 
  CreditUsageType, 
  CreditTransactionType,
  UserRole 
} from '../../shared/types';
import { 
  CreditValidationResult,
  CreditBalanceCheck,
  CreditTransactionValidation,
  CreditPurchaseValidation 
} from '../types';
import { 
  CREDIT_USAGE_CONFIGS,
  TRANSACTION_LIMITS,
  AUTO_TOPUP_LIMITS,
  getLimitsForRole,
  validatePurchaseLimit,
  validateCreditBalance,
  validateUsageLimit
} from '../../config/credits';

export const validateCreditSufficiency = (
  userId: number,
  currentBalance: number,
  requiredCredits: number
): CreditBalanceCheck => {
  const sufficient = currentBalance >= requiredCredits;
  const shortfall = sufficient ? undefined : requiredCredits - currentBalance;

  return {
    userId,
    currentBalance,
    requiredCredits,
    sufficient,
    shortfall
  };
};

export const validateCreditUsage = (
  usageType: CreditUsageType,
  creditsToUse: number,
  currentBalance: number,
  dailyUsage: number,
  monthlyUsage: number
): CreditValidationResult => {
  if (!Object.values(CreditUsageType).includes(usageType)) {
    return {
      valid: false,
      reason: 'Invalid usage type specified'
    };
  }

  const config = CREDIT_USAGE_CONFIGS[usageType];
  
  if (!config.enabled) {
    return {
      valid: false,
      reason: `${config.name} is currently disabled`
    };
  }

  if (creditsToUse !== config.creditsRequired) {
    return {
      valid: false,
      reason: `${config.name} requires exactly ${config.creditsRequired} credits`
    };
  }

  if (currentBalance < creditsToUse) {
    return {
      valid: false,
      reason: 'Insufficient credit balance',
      suggestedAction: 'Purchase more credits to continue'
    };
  }

  const usageLimitCheck = validateUsageLimit(usageType, dailyUsage, monthlyUsage, 1);
  if (!usageLimitCheck.valid) {
    return {
      valid: false,
      reason: usageLimitCheck.reason
    };
  }

  return { valid: true };
};

export const validateCreditPurchase = (
  validation: CreditPurchaseValidation
): CreditValidationResult => {
  const { packageType, userId, userRole, currentBalance, dailySpent, monthlySpent } = validation;

  if (!Object.values(CreditPackageType).includes(packageType)) {
    return {
      valid: false,
      reason: 'Invalid package type specified'
    };
  }

  const purchaseLimitCheck = validatePurchaseLimit(
    userRole as UserRole,
    TRANSACTION_LIMITS.MIN_PURCHASE_AMOUNT,
    dailySpent,
    monthlySpent
  );

  if (!purchaseLimitCheck.valid) {
    return {
      valid: false,
      reason: purchaseLimitCheck.reason
    };
  }

  const limits = getLimitsForRole(userRole as UserRole);
  const balanceCheck = validateCreditBalance(
    userRole as UserRole,
    currentBalance,
    0
  );

  if (!balanceCheck.valid) {
    return {
      valid: false,
      reason: balanceCheck.reason
    };
  }

  return { valid: true };
};

export const validateTransactionAmount = (
  credits: number,
  transactionType: CreditTransactionType
): CreditValidationResult => {
  if (!Number.isInteger(credits) || credits <= 0) {
    return {
      valid: false,
      reason: 'Credit amount must be a positive integer'
    };
  }

  if (credits < TRANSACTION_LIMITS.MIN_CREDITS_USAGE) {
    return {
      valid: false,
      reason: `Minimum credit amount is ${TRANSACTION_LIMITS.MIN_CREDITS_USAGE}`
    };
  }

  if (credits > TRANSACTION_LIMITS.MAX_CREDITS_USAGE) {
    return {
      valid: false,
      reason: `Maximum credit amount is ${TRANSACTION_LIMITS.MAX_CREDITS_USAGE}`
    };
  }

  return { valid: true };
};

export const validateAutoTopupSettings = (
  triggerBalance: number,
  topupAmount: number,
  packageType: CreditPackageType
): CreditValidationResult => {
  if (triggerBalance < AUTO_TOPUP_LIMITS.MIN_TRIGGER_BALANCE) {
    return {
      valid: false,
      reason: `Trigger balance must be at least ${AUTO_TOPUP_LIMITS.MIN_TRIGGER_BALANCE}`
    };
  }

  if (triggerBalance > AUTO_TOPUP_LIMITS.MAX_TRIGGER_BALANCE) {
    return {
      valid: false,
      reason: `Trigger balance cannot exceed ${AUTO_TOPUP_LIMITS.MAX_TRIGGER_BALANCE}`
    };
  }

  if (topupAmount < AUTO_TOPUP_LIMITS.MIN_TOPUP_AMOUNT) {
    return {
      valid: false,
      reason: `Topup amount must be at least ${AUTO_TOPUP_LIMITS.MIN_TOPUP_AMOUNT}`
    };
  }

  if (topupAmount > AUTO_TOPUP_LIMITS.MAX_TOPUP_AMOUNT) {
    return {
      valid: false,
      reason: `Topup amount cannot exceed ${AUTO_TOPUP_LIMITS.MAX_TOPUP_AMOUNT}`
    };
  }

  if (!Object.values(CreditPackageType).includes(packageType)) {
    return {
      valid: false,
      reason: 'Invalid package type specified'
    };
  }

  return { valid: true };
};

export const validateRefundEligibility = (
  purchaseDate: Date,
  creditsUsed: number,
  totalCredits: number
): CreditValidationResult => {
  const daysSincePurchase = Math.floor(
    (Date.now() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSincePurchase > TRANSACTION_LIMITS.REFUND_WINDOW_DAYS) {
    return {
      valid: false,
      reason: `Refund window of ${TRANSACTION_LIMITS.REFUND_WINDOW_DAYS} days has expired`
    };
  }

  const usagePercentage = (creditsUsed / totalCredits) * 100;
  const maxRefundPercentage = TRANSACTION_LIMITS.MAX_REFUND_PERCENTAGE;

  if (usagePercentage > (100 - maxRefundPercentage)) {
    return {
      valid: false,
      reason: 'Too many credits have been used for a refund'
    };
  }

  return { valid: true };
};

export const validateUserRole = (
  userRole: string,
  requiredRoles: UserRole[]
): CreditValidationResult => {
  if (!Object.values(UserRole).includes(userRole as UserRole)) {
    return {
      valid: false,
      reason: 'Invalid user role'
    };
  }

  if (!requiredRoles.includes(userRole as UserRole)) {
    return {
      valid: false,
      reason: 'Insufficient permissions for this operation'
    };
  }

  return { valid: true };
};

export const validateTransactionMetadata = (
  metadata: Record<string, any>
): CreditValidationResult => {
  if (!metadata || typeof metadata !== 'object') {
    return {
      valid: false,
      reason: 'Metadata must be a valid object'
    };
  }

  const metadataString = JSON.stringify(metadata);
  if (metadataString.length > 5000) {
    return {
      valid: false,
      reason: 'Metadata size exceeds maximum limit'
    };
  }

  const forbiddenKeys = ['password', 'token', 'secret', 'key'];
  const hasRestrictedKeys = Object.keys(metadata).some(key => 
    forbiddenKeys.some(forbidden => key.toLowerCase().includes(forbidden))
  );

  if (hasRestrictedKeys) {
    return {
      valid: false,
      reason: 'Metadata contains restricted keys'
    };
  }

  return { valid: true };
};

export const validateCreditExpiry = (expiryDate: Date): CreditValidationResult => {
  const now = new Date();
  
  if (expiryDate <= now) {
    return {
      valid: false,
      reason: 'Credits have already expired'
    };
  }

  const maxExpiryDate = new Date();
  maxExpiryDate.setFullYear(maxExpiryDate.getFullYear() + 2);

  if (expiryDate > maxExpiryDate) {
    return {
      valid: false,
      reason: 'Expiry date cannot be more than 2 years in the future'
    };
  }

  return { valid: true };
};

export const validateBulkTransaction = (
  transactions: CreditTransactionValidation[]
): CreditValidationResult => {
  if (transactions.length === 0) {
    return {
      valid: false,
      reason: 'No transactions provided'
    };
  }

  if (transactions.length > 100) {
    return {
      valid: false,
      reason: 'Maximum 100 transactions allowed per batch'
    };
  }

  const totalCredits = transactions.reduce((sum, t) => sum + t.credits, 0);
  if (totalCredits > 1000) {
    return {
      valid: false,
      reason: 'Total credits in batch cannot exceed 1000'
    };
  }

  for (let i = 0; i < transactions.length; i++) {
    const transaction = transactions[i];
    const amountValidation = validateTransactionAmount(
      transaction.credits,
      transaction.transactionType
    );
    
    if (!amountValidation.valid) {
      return {
        valid: false,
        reason: `Transaction ${i + 1}: ${amountValidation.reason}`
      };
    }
  }

  return { valid: true };
};

export const validateRateLimit = (
  userId: number,
  action: string,
  lastActionTime: Date,
  cooldownMinutes: number
): CreditValidationResult => {
  const now = new Date();
  const timeSinceLastAction = now.getTime() - lastActionTime.getTime();
  const cooldownMs = cooldownMinutes * 60 * 1000;

  if (timeSinceLastAction < cooldownMs) {
    const remainingMinutes = Math.ceil((cooldownMs - timeSinceLastAction) / (60 * 1000));
    return {
      valid: false,
      reason: `Please wait ${remainingMinutes} minutes before performing this action again`
    };
  }

  return { valid: true };
};

export const validateBusinessHours = (): CreditValidationResult => {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();

  if (day === 0 || day === 6) {
    return {
      valid: false,
      reason: 'Credit operations are not available on weekends'
    };
  }

  if (hour < 6 || hour > 22) {
    return {
      valid: false,
      reason: 'Credit operations are only available between 6 AM and 10 PM'
    };
  }

  return { valid: true };
};

export const validatePromoCode = (
  promoCode: string,
  packageType: CreditPackageType,
  userId: number
): CreditValidationResult => {
  if (!promoCode || promoCode.length < 3) {
    return {
      valid: false,
      reason: 'Invalid promo code format'
    };
  }

  const alphanumericRegex = /^[A-Z0-9]+$/;
  if (!alphanumericRegex.test(promoCode)) {
    return {
      valid: false,
      reason: 'Promo code must contain only letters and numbers'
    };
  }

  return { valid: true };
};
