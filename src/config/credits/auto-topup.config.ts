import { CreditPackageType, AutoTopupStatus } from '../../shared/types';

export interface AutoTopupConfig {
  enabled: boolean;
  defaultTriggerBalance: number;
  defaultTopupAmount: number;
  defaultPackageType: CreditPackageType;
  maxFailures: number;
  retryDelayHours: number;
  cooldownHours: number;
  notificationEnabled: boolean;
}

export interface AutoTopupRule {
  triggerBalance: number;
  packageType: CreditPackageType;
  priority: number;
  description: string;
}

export const AUTO_TOPUP_CONFIG: AutoTopupConfig = {
  enabled: true,
  defaultTriggerBalance: 5,
  defaultTopupAmount: 25,
  defaultPackageType: CreditPackageType.STANDARD,
  maxFailures: 3,
  retryDelayHours: 24,
  cooldownHours: 1,
  notificationEnabled: true
};

export const AUTO_TOPUP_RULES: AutoTopupRule[] = [
  {
    triggerBalance: 0,
    packageType: CreditPackageType.STARTER,
    priority: 1,
    description: 'Emergency topup when balance reaches zero'
  },
  {
    triggerBalance: 3,
    packageType: CreditPackageType.STARTER,
    priority: 2,
    description: 'Critical balance topup'
  },
  {
    triggerBalance: 5,
    packageType: CreditPackageType.STANDARD,
    priority: 3,
    description: 'Low balance topup'
  },
  {
    triggerBalance: 10,
    packageType: CreditPackageType.STANDARD,
    priority: 4,
    description: 'Preventive topup'
  },
  {
    triggerBalance: 20,
    packageType: CreditPackageType.PREMIUM,
    priority: 5,
    description: 'Bulk user topup'
  }
];

export const TOPUP_SCHEDULES = {
  IMMEDIATE: 0,
  HOURLY: 60,
  DAILY: 1440,
  WEEKLY: 10080
};

export const TOPUP_LIMITS = {
  MIN_TRIGGER_BALANCE: 0,
  MAX_TRIGGER_BALANCE: 50,
  MIN_TOPUP_CREDITS: 5,
  MAX_TOPUP_CREDITS: 100,
  MAX_TOPUPS_PER_DAY: 5,
  MAX_TOPUPS_PER_MONTH: 20
};

export const FAILURE_HANDLING = {
  MAX_CONSECUTIVE_FAILURES: 3,
  FAILURE_COOLDOWN_HOURS: 24,
  EXPONENTIAL_BACKOFF_BASE: 2,
  MAX_RETRY_DELAY_HOURS: 168, // 7 days
  DISABLE_AFTER_FAILURES: true,
  NOTIFY_ON_FAILURE: true
};

export const STATUS_TRANSITIONS: Record<AutoTopupStatus, AutoTopupStatus[]> = {
  [AutoTopupStatus.ENABLED]: [
    AutoTopupStatus.DISABLED,
    AutoTopupStatus.SUSPENDED,
    AutoTopupStatus.PROCESSING
  ],
  [AutoTopupStatus.DISABLED]: [
    AutoTopupStatus.ENABLED
  ],
  [AutoTopupStatus.SUSPENDED]: [
    AutoTopupStatus.ENABLED,
    AutoTopupStatus.DISABLED
  ],
  [AutoTopupStatus.PROCESSING]: [
    AutoTopupStatus.ENABLED,
    AutoTopupStatus.SUSPENDED,
    AutoTopupStatus.DISABLED
  ]
};

export const getRecommendedTopupPackage = (currentBalance: number, averageUsage: number): CreditPackageType => {
  if (averageUsage <= 10) return CreditPackageType.STARTER;
  if (averageUsage <= 25) return CreditPackageType.STANDARD;
  if (averageUsage <= 50) return CreditPackageType.PREMIUM;
  return CreditPackageType.ENTERPRISE;
};

export const calculateNextRetryDelay = (failureCount: number): number => {
  const baseDelay = FAILURE_HANDLING.EXPONENTIAL_BACKOFF_BASE;
  const calculatedDelay = Math.pow(baseDelay, failureCount) * 60; // minutes
  const maxDelay = FAILURE_HANDLING.MAX_RETRY_DELAY_HOURS * 60; // minutes
  
  return Math.min(calculatedDelay, maxDelay);
};

export const shouldTriggerTopup = (
  currentBalance: number,
  triggerBalance: number,
  lastTopupTime: Date,
  cooldownHours: number = AUTO_TOPUP_CONFIG.cooldownHours
): boolean => {
  if (currentBalance > triggerBalance) return false;
  
  const cooldownMs = cooldownHours * 60 * 60 * 1000;
  const timeSinceLastTopup = Date.now() - lastTopupTime.getTime();
  
  return timeSinceLastTopup >= cooldownMs;
};

export const validateAutoTopupSettings = (
  triggerBalance: number,
  topupAmount: number,
  packageType: CreditPackageType
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (triggerBalance < TOPUP_LIMITS.MIN_TRIGGER_BALANCE) {
    errors.push(`Trigger balance must be at least ${TOPUP_LIMITS.MIN_TRIGGER_BALANCE}`);
  }
  
  if (triggerBalance > TOPUP_LIMITS.MAX_TRIGGER_BALANCE) {
    errors.push(`Trigger balance cannot exceed ${TOPUP_LIMITS.MAX_TRIGGER_BALANCE}`);
  }
  
  if (topupAmount < TOPUP_LIMITS.MIN_TOPUP_CREDITS) {
    errors.push(`Topup amount must be at least ${TOPUP_LIMITS.MIN_TOPUP_CREDITS} credits`);
  }
  
  if (topupAmount > TOPUP_LIMITS.MAX_TOPUP_CREDITS) {
    errors.push(`Topup amount cannot exceed ${TOPUP_LIMITS.MAX_TOPUP_CREDITS} credits`);
  }
  
  if (!Object.values(CreditPackageType).includes(packageType)) {
    errors.push('Invalid package type specified');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

export const canTransitionStatus = (
  currentStatus: AutoTopupStatus,
  newStatus: AutoTopupStatus
): boolean => {
  const allowedTransitions = STATUS_TRANSITIONS[currentStatus] || [];
  return allowedTransitions.includes(newStatus);
};
