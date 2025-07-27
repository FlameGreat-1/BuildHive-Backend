import { CreditUsageType } from '../../shared/types';

export interface CreditUsageConfig {
  type: CreditUsageType;
  name: string;
  description: string;
  creditsRequired: number;
  maxPerDay: number;
  maxPerMonth: number;
  enabled: boolean;
  category: string;
  priority: number;
}

export const CREDIT_USAGE_CONFIGS: Record<CreditUsageType, CreditUsageConfig> = {
  [CreditUsageType.JOB_APPLICATION]: {
    type: CreditUsageType.JOB_APPLICATION,
    name: 'Job Application',
    description: 'Apply to job postings',
    creditsRequired: 1,
    maxPerDay: 20,
    maxPerMonth: 100,
    enabled: true,
    category: 'applications',
    priority: 1
  },
  [CreditUsageType.PROFILE_BOOST]: {
    type: CreditUsageType.PROFILE_BOOST,
    name: 'Profile Boost',
    description: 'Boost profile visibility for 24 hours',
    creditsRequired: 5,
    maxPerDay: 3,
    maxPerMonth: 30,
    enabled: true,
    category: 'visibility',
    priority: 2
  },
  [CreditUsageType.PREMIUM_JOB_UNLOCK]: {
    type: CreditUsageType.PREMIUM_JOB_UNLOCK,
    name: 'Premium Job Unlock',
    description: 'Unlock premium job details',
    creditsRequired: 3,
    maxPerDay: 10,
    maxPerMonth: 50,
    enabled: true,
    category: 'premium',
    priority: 3
  },
  [CreditUsageType.DIRECT_MESSAGE]: {
    type: CreditUsageType.DIRECT_MESSAGE,
    name: 'Direct Message',
    description: 'Send direct message to employers',
    creditsRequired: 2,
    maxPerDay: 15,
    maxPerMonth: 75,
    enabled: true,
    category: 'communication',
    priority: 4
  },
  [CreditUsageType.FEATURED_LISTING]: {
    type: CreditUsageType.FEATURED_LISTING,
    name: 'Featured Listing',
    description: 'Feature your profile in search results',
    creditsRequired: 10,
    maxPerDay: 1,
    maxPerMonth: 5,
    enabled: true,
    category: 'premium',
    priority: 5
  },
  [CreditUsageType.MARKETPLACE_APPLICATION]: {
    type: CreditUsageType.MARKETPLACE_APPLICATION,
    name: 'Marketplace Application',
    description: 'Apply to marketplace job postings',
    creditsRequired: 2,
    maxPerDay: 15,
    maxPerMonth: 75,
    enabled: true,
    category: 'applications',
    priority: 6
  }
};

export const USAGE_CATEGORIES = {
  APPLICATIONS: 'applications',
  VISIBILITY: 'visibility',
  PREMIUM: 'premium',
  COMMUNICATION: 'communication'
};

export const getCreditUsageConfig = (usageType: CreditUsageType): CreditUsageConfig => {
  return CREDIT_USAGE_CONFIGS[usageType];
};

export const getAllUsageConfigs = (): CreditUsageConfig[] => {
  return Object.values(CREDIT_USAGE_CONFIGS);
};

export const getUsageConfigsByCategory = (category: string): CreditUsageConfig[] => {
  return Object.values(CREDIT_USAGE_CONFIGS).filter(config => config.category === category);
};

export const getEnabledUsageConfigs = (): CreditUsageConfig[] => {
  return Object.values(CREDIT_USAGE_CONFIGS).filter(config => config.enabled);
};

export const calculateCreditsRequired = (usageType: CreditUsageType, quantity: number = 1): number => {
  const config = getCreditUsageConfig(usageType);
  return config.creditsRequired * quantity;
};

export const validateUsageLimit = (
  usageType: CreditUsageType,
  currentDailyUsage: number,
  currentMonthlyUsage: number,
  requestedQuantity: number = 1
): { valid: boolean; reason?: string } => {
  const config = getCreditUsageConfig(usageType);
  
  if (currentDailyUsage + requestedQuantity > config.maxPerDay) {
    return {
      valid: false,
      reason: `Daily limit exceeded for ${config.name}. Maximum ${config.maxPerDay} per day.`
    };
  }
  
  if (currentMonthlyUsage + requestedQuantity > config.maxPerMonth) {
    return {
      valid: false,
      reason: `Monthly limit exceeded for ${config.name}. Maximum ${config.maxPerMonth} per month.`
    };
  }
  
  return { valid: true };
};
