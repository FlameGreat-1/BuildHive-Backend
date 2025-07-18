import { CreditPackageType } from '../../shared/types';

export interface CreditPackageConfig {
  type: CreditPackageType;
  name: string;
  description: string;
  creditsAmount: number;
  bonusCredits: number;
  totalCredits: number;
  price: number;
  currency: string;
  savings: number;
  popular: boolean;
  features: string[];
  validityDays?: number;
}

export const CREDIT_PACKAGES: Record<CreditPackageType, CreditPackageConfig> = {
  [CreditPackageType.STARTER]: {
    type: CreditPackageType.STARTER,
    name: 'Starter Pack',
    description: 'Perfect for getting started with job applications',
    creditsAmount: 10,
    bonusCredits: 0,
    totalCredits: 10,
    price: 9.99,
    currency: 'AUD',
    savings: 0,
    popular: false,
    features: [
      '10 job applications',
      'Basic profile visibility',
      'Standard support'
    ]
  },
  [CreditPackageType.STANDARD]: {
    type: CreditPackageType.STANDARD,
    name: 'Standard Pack',
    description: 'Great value for regular job seekers',
    creditsAmount: 25,
    bonusCredits: 5,
    totalCredits: 30,
    price: 19.99,
    currency: 'AUD',
    savings: 4.99,
    popular: true,
    features: [
      '25 job applications + 5 bonus',
      'Enhanced profile visibility',
      'Priority support',
      '1 profile boost included'
    ]
  },
  [CreditPackageType.PREMIUM]: {
    type: CreditPackageType.PREMIUM,
    name: 'Premium Pack',
    description: 'Maximum value for serious professionals',
    creditsAmount: 50,
    bonusCredits: 15,
    totalCredits: 65,
    price: 34.99,
    currency: 'AUD',
    savings: 14.99,
    popular: false,
    features: [
      '50 job applications + 15 bonus',
      'Premium profile visibility',
      'VIP support',
      '3 profile boosts included',
      'Premium job unlocks'
    ]
  },
  [CreditPackageType.ENTERPRISE]: {
    type: CreditPackageType.ENTERPRISE,
    name: 'Enterprise Pack',
    description: 'Ultimate package for enterprise users',
    creditsAmount: 100,
    bonusCredits: 30,
    totalCredits: 130,
    price: 59.99,
    currency: 'AUD',
    savings: 29.99,
    popular: false,
    features: [
      '100 job applications + 30 bonus',
      'Maximum profile visibility',
      'Dedicated support',
      '5 profile boosts included',
      'Unlimited premium unlocks',
      'Featured listings'
    ],
    validityDays: 90
  }
};

export const DEFAULT_PACKAGE = CreditPackageType.STANDARD;

export const PACKAGE_RECOMMENDATIONS = {
  NEW_USER: CreditPackageType.STARTER,
  REGULAR_USER: CreditPackageType.STANDARD,
  POWER_USER: CreditPackageType.PREMIUM,
  ENTERPRISE_USER: CreditPackageType.ENTERPRISE
};

export const getCreditPackage = (packageType: CreditPackageType): CreditPackageConfig => {
  return CREDIT_PACKAGES[packageType];
};

export const getAllCreditPackages = (): CreditPackageConfig[] => {
  return Object.values(CREDIT_PACKAGES);
};

export const getRecommendedPackage = (userType: keyof typeof PACKAGE_RECOMMENDATIONS): CreditPackageType => {
  return PACKAGE_RECOMMENDATIONS[userType];
};
