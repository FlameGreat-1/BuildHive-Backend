import { UserRole } from '../../shared/types';

export interface CreditLimitsConfig {
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

export interface RoleLimitsConfig {
  role: UserRole;
  limits: CreditLimitsConfig;
  features: string[];
}

export const DEFAULT_LIMITS: CreditLimitsConfig = {
  maxDailyPurchase: 200.00,
  maxMonthlyPurchase: 1000.00,
  maxCreditBalance: 500,
  minCreditBalance: 0,
  lowBalanceThreshold: 10,
  criticalBalanceThreshold: 3,
  maxTransactionsPerDay: 50,
  maxTransactionsPerMonth: 200,
  cooldownPeriodMinutes: 5
};

export const ROLE_LIMITS: Record<UserRole, RoleLimitsConfig> = {
  [UserRole.CLIENT]: {
    role: UserRole.CLIENT,
    limits: {
      maxDailyPurchase: 100.00,
      maxMonthlyPurchase: 500.00,
      maxCreditBalance: 200,
      minCreditBalance: 0,
      lowBalanceThreshold: 5,
      criticalBalanceThreshold: 2,
      maxTransactionsPerDay: 20,
      maxTransactionsPerMonth: 100,
      cooldownPeriodMinutes: 10
    },
    features: [
      'Basic credit purchases',
      'Job applications',
      'Profile visibility'
    ]
  },
  [UserRole.TRADIE]: {
    role: UserRole.TRADIE,
    limits: {
      maxDailyPurchase: 200.00,
      maxMonthlyPurchase: 1000.00,
      maxCreditBalance: 500,
      minCreditBalance: 0,
      lowBalanceThreshold: 10,
      criticalBalanceThreshold: 3,
      maxTransactionsPerDay: 50,
      maxTransactionsPerMonth: 200,
      cooldownPeriodMinutes: 5
    },
    features: [
      'Standard credit purchases',
      'Job applications',
      'Profile boosts',
      'Premium job unlocks',
      'Direct messaging'
    ]
  },
  [UserRole.ENTERPRISE]: {
    role: UserRole.ENTERPRISE,
    limits: {
      maxDailyPurchase: 500.00,
      maxMonthlyPurchase: 2500.00,
      maxCreditBalance: 1000,
      minCreditBalance: 0,
      lowBalanceThreshold: 25,
      criticalBalanceThreshold: 10,
      maxTransactionsPerDay: 100,
      maxTransactionsPerMonth: 500,
      cooldownPeriodMinutes: 2
    },
    features: [
      'Enterprise credit purchases',
      'Unlimited job applications',
      'Premium profile boosts',
      'Priority premium unlocks',
      'Direct messaging',
      'Featured listings',
      'Bulk operations'
    ]
  }
};

export const TRANSACTION_LIMITS = {
  MIN_PURCHASE_AMOUNT: 5.00,
  MAX_PURCHASE_AMOUNT: 500.00,
  MIN_CREDITS_PURCHASE: 5,
  MAX_CREDITS_PURCHASE: 500,
  MIN_CREDITS_USAGE: 1,
  MAX_CREDITS_USAGE: 50,
  REFUND_WINDOW_DAYS: 30,
  MAX_REFUND_PERCENTAGE: 100
};

export const AUTO_TOPUP_LIMITS = {
  MIN_TRIGGER_BALANCE: 1,
  MAX_TRIGGER_BALANCE: 50,
  MIN_TOPUP_AMOUNT: 10,
  MAX_TOPUP_AMOUNT: 100,
  MAX_FAILURES_BEFORE_DISABLE: 3,
  RETRY_DELAY_HOURS: 24
};

export const getLimitsForRole = (role: UserRole): CreditLimitsConfig => {
  return ROLE_LIMITS[role]?.limits || DEFAULT_LIMITS;
};

export const getFeaturesForRole = (role: UserRole): string[] => {
  return ROLE_LIMITS[role]?.features || [];
};

export const validatePurchaseLimit = (
  role: UserRole,
  amount: number,
  dailySpent: number,
  monthlySpent: number
): { valid: boolean; reason?: string } => {
  const limits = getLimitsForRole(role);
  
  if (amount < TRANSACTION_LIMITS.MIN_PURCHASE_AMOUNT) {
    return {
      valid: false,
      reason: `Minimum purchase amount is $${TRANSACTION_LIMITS.MIN_PURCHASE_AMOUNT}`
    };
  }
  
  if (amount > TRANSACTION_LIMITS.MAX_PURCHASE_AMOUNT) {
    return {
      valid: false,
      reason: `Maximum purchase amount is $${TRANSACTION_LIMITS.MAX_PURCHASE_AMOUNT}`
    };
  }
  
  if (dailySpent + amount > limits.maxDailyPurchase) {
    return {
      valid: false,
      reason: `Daily purchase limit of $${limits.maxDailyPurchase} would be exceeded`
    };
  }
  
  if (monthlySpent + amount > limits.maxMonthlyPurchase) {
    return {
      valid: false,
      reason: `Monthly purchase limit of $${limits.maxMonthlyPurchase} would be exceeded`
    };
  }
  
  return { valid: true };
};

export const validateCreditBalance = (
  role: UserRole,
  currentBalance: number,
  creditsToAdd: number
): { valid: boolean; reason?: string } => {
  const limits = getLimitsForRole(role);
  const newBalance = currentBalance + creditsToAdd;
  
  if (newBalance > limits.maxCreditBalance) {
    return {
      valid: false,
      reason: `Maximum credit balance of ${limits.maxCreditBalance} would be exceeded`
    };
  }
  
  return { valid: true };
};
