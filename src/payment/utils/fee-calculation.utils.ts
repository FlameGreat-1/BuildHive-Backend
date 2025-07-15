import { PAYMENT_CONSTANTS } from '../../config/payment/constants';
import { PaymentMethod } from '../../shared/types';
import { PaymentFeeCalculation } from '../types';

export const calculateStripeFee = (amount: number, paymentMethod: PaymentMethod): number => {
  const STRIPE_PERCENTAGE = PAYMENT_CONSTANTS.FEES.STRIPE.PERCENTAGE;
  const STRIPE_FIXED = PAYMENT_CONSTANTS.FEES.STRIPE.FIXED;
  const APPLE_PAY_PERCENTAGE = PAYMENT_CONSTANTS.FEES.STRIPE.PERCENTAGE;
  const GOOGLE_PAY_PERCENTAGE = PAYMENT_CONSTANTS.FEES.STRIPE.PERCENTAGE;
  
  let percentage: number;
  
  switch (paymentMethod) {
    case PaymentMethod.APPLE_PAY:
      percentage = APPLE_PAY_PERCENTAGE;
      break;
    case PaymentMethod.GOOGLE_PAY:
      percentage = GOOGLE_PAY_PERCENTAGE;
      break;
    default:
      percentage = STRIPE_PERCENTAGE;
  }
  
  const percentageFee = Math.round((amount * percentage) / 100);
  const fixedFee = STRIPE_FIXED;
  
  return percentageFee + fixedFee;
};

export const calculatePlatformFee = (amount: number): number => {
  const PLATFORM_PERCENTAGE = PAYMENT_CONSTANTS.FEES.PLATFORM.PERCENTAGE;
  return Math.round((amount * PLATFORM_PERCENTAGE) / 100);
};

export const calculateTotalFees = (amount: number, paymentMethod: PaymentMethod): PaymentFeeCalculation => {
  const stripeFee = calculateStripeFee(amount, paymentMethod);
  const platformFee = calculatePlatformFee(amount);
  const totalFees = stripeFee + platformFee;
  const netAmount = amount - totalFees;
  
  return {
    subtotal: amount,
    stripeFee,
    platformFee,
    total: amount,
    netAmount: Math.max(0, netAmount)
  };
};

export const calculateProcessingFee = (amount: number, currency: string, paymentMethod: PaymentMethod): number => {
  const fees = calculateTotalFees(amount, paymentMethod);
  return fees.stripeFee + fees.platformFee;
};

export const calculateNetAmount = (grossAmount: number, paymentMethod: PaymentMethod): number => {
  const fees = calculateTotalFees(grossAmount, paymentMethod);
  return fees.netAmount;
};

export const calculateGrossAmount = (netAmount: number, paymentMethod: PaymentMethod): number => {
  const STRIPE_PERCENTAGE = PAYMENT_CONSTANTS.FEES.STRIPE.PERCENTAGE;
  const STRIPE_FIXED = PAYMENT_CONSTANTS.FEES.STRIPE.FIXED;
  const PLATFORM_PERCENTAGE = PAYMENT_CONSTANTS.FEES.PLATFORM.PERCENTAGE;
  const APPLE_PAY_PERCENTAGE = PAYMENT_CONSTANTS.FEES.STRIPE.PERCENTAGE;
  const GOOGLE_PAY_PERCENTAGE = PAYMENT_CONSTANTS.FEES.STRIPE.PERCENTAGE;
  
  let stripePercentage: number;
  
  switch (paymentMethod) {
    case PaymentMethod.APPLE_PAY:
      stripePercentage = APPLE_PAY_PERCENTAGE;
      break;
    case PaymentMethod.GOOGLE_PAY:
      stripePercentage = GOOGLE_PAY_PERCENTAGE;
      break;
    default:
      stripePercentage = STRIPE_PERCENTAGE;
  }
  
  const totalPercentage = stripePercentage + PLATFORM_PERCENTAGE;
  const grossAmount = Math.round((netAmount + STRIPE_FIXED) / (1 - totalPercentage / 100));
  
  return grossAmount;
};

export const getFeeBreakdown = (amount: number, paymentMethod: PaymentMethod): {
  amount: number;
  stripePercentageFee: number;
  stripeFixedFee: number;
  platformFee: number;
  totalFees: number;
  netAmount: number;
} => {
  const STRIPE_FIXED = PAYMENT_CONSTANTS.FEES.STRIPE.FIXED;
  const PLATFORM_PERCENTAGE = PAYMENT_CONSTANTS.FEES.PLATFORM.PERCENTAGE;
  
  const stripePercentageFee = calculateStripeFee(amount, paymentMethod) - STRIPE_FIXED;
  const stripeFixedFee = STRIPE_FIXED;
  const platformFee = calculatePlatformFee(amount);
  const totalFees = stripePercentageFee + stripeFixedFee + platformFee;
  const netAmount = amount - totalFees;
  
  return {
    amount,
    stripePercentageFee,
    stripeFixedFee,
    platformFee,
    totalFees,
    netAmount: Math.max(0, netAmount)
  };
};

export const calculateRefundFees = (originalAmount: number, refundAmount: number, paymentMethod: PaymentMethod): {
  refundAmount: number;
  stripeRefundFee: number;
  platformRefundFee: number;
  netRefund: number;
} => {
  const originalFees = calculateTotalFees(originalAmount, paymentMethod);
  const refundRatio = refundAmount / originalAmount;
  
  const stripeRefundFee = Math.round(originalFees.stripeFee * refundRatio);
  const platformRefundFee = Math.round(originalFees.platformFee * refundRatio);
  const netRefund = refundAmount - stripeRefundFee - platformRefundFee;
  
  return {
    refundAmount,
    stripeRefundFee,
    platformRefundFee,
    netRefund: Math.max(0, netRefund)
  };
};

export const validateMinimumAmount = (amount: number, paymentMethod: PaymentMethod): boolean => {
  const fees = calculateTotalFees(amount, paymentMethod);
  return fees.netAmount > 0;
};

export const getMinimumChargeAmount = (paymentMethod: PaymentMethod): number => {
  const MIN_AMOUNT = PAYMENT_CONSTANTS.STRIPE.LIMITS.MIN_AMOUNT;
  const fees = calculateTotalFees(MIN_AMOUNT, paymentMethod);
  
  if (fees.netAmount <= 0) {
    return calculateGrossAmount(1, paymentMethod);
  }
  
  return MIN_AMOUNT;
};

export const formatFeeBreakdown = (feeBreakdown: ReturnType<typeof getFeeBreakdown>, currency: string): {
  amount: string;
  stripePercentageFee: string;
  stripeFixedFee: string;
  platformFee: string;
  totalFees: string;
  netAmount: string;
} => {
  const formatter = new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  };
  
  return {
    amount: formatter.format(feeBreakdown.amount / 100),
    stripePercentageFee: formatter.format(feeBreakdown.stripePercentageFee / 100),
    stripeFixedFee: formatter.format(feeBreakdown.stripeFixedFee / 100),
    platformFee: formatter.format(feeBreakdown.platformFee / 100),
    totalFees: formatter.format(feeBreakdown.totalFees / 100),
    netAmount: formatter.format(feeBreakdown.netAmount / 100)
  };
};
