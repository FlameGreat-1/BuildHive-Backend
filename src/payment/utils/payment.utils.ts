import { PaymentStatus, PaymentMethod } from '../../shared/types';
import { PAYMENT_CONSTANTS } from '../../config/payment';
import { PaymentError } from '../types';

export const formatPaymentAmount = (amount: number, currency: string): string => {
  const formatter = new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
  return formatter.format(amount / 100);
};

export const validatePaymentAmount = (amount: number, currency: string): boolean => {
  const { MIN_AMOUNT, MAX_AMOUNT } = PAYMENT_CONSTANTS.STRIPE.LIMITS;
  
  if (!Number.isInteger(amount) || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
    return false;
  }
  
  return true;
};

export const validateCurrency = (currency: string): boolean => {
  return PAYMENT_CONSTANTS.STRIPE.CURRENCY.SUPPORTED.includes(currency.toUpperCase());
};

export const validatePaymentMethod = (paymentMethod: string): boolean => {
  return Object.values(PAYMENT_CONSTANTS.PAYMENT_METHODS).includes(paymentMethod as PaymentMethod);
};

export const generatePaymentReference = (userId: number, timestamp?: Date): string => {
  const date = timestamp || new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = date.getTime().toString().slice(-6);
  
  return `PAY-${userId}-${dateStr}-${timeStr}`;
};

export const generatePaymentDescription = (
  paymentType: string,
  metadata?: Record<string, any>
): string => {
  const baseDescription = `BuildHive ${paymentType.replace('_', ' ')}`;
  
  if (metadata?.jobId) {
    return `${baseDescription} - Job #${metadata.jobId}`;
  }
  
  if (metadata?.invoiceId) {
    return `${baseDescription} - Invoice #${metadata.invoiceId}`;
  }
  
  return baseDescription;
};

export const isPaymentSuccessful = (status: PaymentStatus): boolean => {
  return status === PaymentStatus.COMPLETED;
};

export const isPaymentFailed = (status: PaymentStatus): boolean => {
  return status === PaymentStatus.FAILED || status === PaymentStatus.CANCELLED;
};

export const isPaymentPending = (status: PaymentStatus): boolean => {
  return status === PaymentStatus.PENDING || status === PaymentStatus.PROCESSING;
};

export const getPaymentStatusMessage = (status: PaymentStatus): string => {
  const statusMessages: Record<PaymentStatus, string> = {
    [PaymentStatus.PENDING]: 'Payment is being processed',
    [PaymentStatus.PROCESSING]: 'Payment is currently processing',
    [PaymentStatus.COMPLETED]: 'Payment completed successfully',
    [PaymentStatus.FAILED]: 'Payment failed',
    [PaymentStatus.CANCELLED]: 'Payment was cancelled',
    [PaymentStatus.REFUNDED]: 'Payment has been refunded',
    [PaymentStatus.PARTIALLY_REFUNDED]: 'Payment has been partially refunded'
  };
  
  return statusMessages[status] || 'Unknown payment status';
};

export const sanitizePaymentMetadata = (metadata: Record<string, any>): Record<string, string> => {
  const sanitized: Record<string, string> = {};
  const maxValueLength = 500;
  const maxKeys = 50;
  
  let keyCount = 0;
  for (const [key, value] of Object.entries(metadata)) {
    if (keyCount >= maxKeys) break;
    
    if (typeof value === 'string' || typeof value === 'number') {
      const sanitizedKey = key.replace(/[^a-zA-Z0-9_]/g, '').substring(0, 40);
      const sanitizedValue = String(value).substring(0, maxValueLength);
      
      if (sanitizedKey && sanitizedValue) {
        sanitized[sanitizedKey] = sanitizedValue;
        keyCount++;
      }
    }
  }
  
  return sanitized;
};

export const parseStripeError = (error: any): PaymentError => {
  const stripeError = error.error || error;
  
  return {
    code: stripeError.code || 'unknown_error',
    message: stripeError.message || 'An unknown error occurred',
    type: stripeError.type || 'api_error',
    declineCode: stripeError.decline_code,
    param: stripeError.param
  };
};

export const shouldRetryPayment = (error: PaymentError): boolean => {
  const retryableCodes = [
    'card_declined',
    'insufficient_funds',
    'processing_error',
    'rate_limit'
  ];
  
  const nonRetryableCodes = [
    'card_not_supported',
    'currency_not_supported',
    'expired_card',
    'incorrect_cvc',
    'invalid_expiry_month',
    'invalid_expiry_year'
  ];
  
  if (nonRetryableCodes.includes(error.code)) {
    return false;
  }
  
  return retryableCodes.includes(error.code) || error.type === 'api_error';
};

export const maskCardNumber = (cardNumber: string): string => {
  if (!cardNumber || cardNumber.length < 4) {
    return '****';
  }
  
  const last4 = cardNumber.slice(-4);
  const masked = '*'.repeat(Math.max(0, cardNumber.length - 4));
  
  return `${masked}${last4}`;
};

export const formatCardExpiry = (month: number, year: number): string => {
  const paddedMonth = month.toString().padStart(2, '0');
  const shortYear = year.toString().slice(-2);
  
  return `${paddedMonth}/${shortYear}`;
};

export const isCardExpired = (month: number, year: number): boolean => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  if (year < currentYear) {
    return true;
  }
  
  if (year === currentYear && month < currentMonth) {
    return true;
  }
  
  return false;
};

export const getPaymentMethodDisplayName = (paymentMethod: PaymentMethod): string => {
  const displayNames: Record<PaymentMethod, string> = {
    [PaymentMethod.STRIPE_CARD]: 'Credit/Debit Card',
    [PaymentMethod.APPLE_PAY]: 'Apple Pay',
    [PaymentMethod.GOOGLE_PAY]: 'Google Pay',
    [PaymentMethod.BANK_TRANSFER]: 'Bank Transfer',
    [PaymentMethod.CASH]: 'Cash'
  };
  
  return displayNames[paymentMethod] || 'Unknown Payment Method';
};

export const convertAmountToStripeFormat = (amount: number): number => {
  return Math.round(amount * 100);
};

export const convertAmountFromStripeFormat = (amount: number): number => {
  return amount / 100;
};

export const generateIdempotencyKey = (userId: number, amount: number, timestamp?: Date): string => {
  const date = timestamp || new Date();
  const key = `${userId}-${amount}-${date.getTime()}`;
  
  return Buffer.from(key).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
};
