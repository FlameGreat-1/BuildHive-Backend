import { PAYMENT_CONSTANTS } from '../../config/payment/constants';

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  minorUnit: number;
}

export const SUPPORTED_CURRENCIES: Record<string, CurrencyInfo> = {
  AUD: {
    code: 'AUD',
    name: 'Australian Dollar',
    symbol: 'A$',
    decimalPlaces: 2,
    minorUnit: 100
  },
  USD: {
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
    decimalPlaces: 2,
    minorUnit: 100
  }
};

export const formatCurrency = (
  amount: number,
  currency: string,
  locale: string = 'en-AU'
): string => {
  const currencyInfo = SUPPORTED_CURRENCIES[currency.toUpperCase()];
  
  if (!currencyInfo) {
    throw new Error(`Unsupported currency: ${currency}`);
  }
  
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyInfo.code,
    minimumFractionDigits: currencyInfo.decimalPlaces,
    maximumFractionDigits: currencyInfo.decimalPlaces
  });
  
  return formatter.format(amount / currencyInfo.minorUnit);
};

export const parseCurrencyAmount = (
  amountString: string,
  currency: string
): number => {
  const currencyInfo = SUPPORTED_CURRENCIES[currency.toUpperCase()];
  
  if (!currencyInfo) {
    throw new Error(`Unsupported currency: ${currency}`);
  }
  
  const cleanAmount = amountString
    .replace(/[^\d.,]/g, '')
    .replace(',', '.');
  
  const parsedAmount = parseFloat(cleanAmount);
  
  if (isNaN(parsedAmount)) {
    throw new Error(`Invalid amount format: ${amountString}`);
  }
  
  return Math.round(parsedAmount * currencyInfo.minorUnit);
};

export const convertToMinorUnits = (amount: number, currency: string): number => {
  const currencyInfo = SUPPORTED_CURRENCIES[currency.toUpperCase()];
  
  if (!currencyInfo) {
    throw new Error(`Unsupported currency: ${currency}`);
  }
  
  return Math.round(amount * currencyInfo.minorUnit);
};

export const convertFromMinorUnits = (amount: number, currency: string): number => {
  const currencyInfo = SUPPORTED_CURRENCIES[currency.toUpperCase()];
  
  if (!currencyInfo) {
    throw new Error(`Unsupported currency: ${currency}`);
  }
  
  return amount / currencyInfo.minorUnit;
};

export const getCurrencySymbol = (currency: string): string => {
  const currencyInfo = SUPPORTED_CURRENCIES[currency.toUpperCase()];
  
  if (!currencyInfo) {
    return currency.toUpperCase();
  }
  
  return currencyInfo.symbol;
};

export const getCurrencyName = (currency: string): string => {
  const currencyInfo = SUPPORTED_CURRENCIES[currency.toUpperCase()];
  
  if (!currencyInfo) {
    return currency.toUpperCase();
  }
  
  return currencyInfo.name;
};

export const isSupportedCurrency = (currency: string): boolean => {
  return PAYMENT_CONSTANTS.STRIPE.CURRENCY.SUPPORTED.includes(currency.toUpperCase());
};

export const getDefaultCurrency = (): string => {
  return PAYMENT_CONSTANTS.STRIPE.CURRENCY.DEFAULT;
};

export const validateCurrencyAmount = (amount: number, currency: string): boolean => {
  if (!isSupportedCurrency(currency)) {
    return false;
  }
  
  const minAmount = PAYMENT_CONSTANTS.STRIPE.LIMITS.MIN_AMOUNT;
  const maxAmount = PAYMENT_CONSTANTS.STRIPE.LIMITS.MAX_AMOUNT;
  
  return amount >= minAmount && amount <= maxAmount;
};

export const roundCurrencyAmount = (amount: number, currency: string): number => {
  const currencyInfo = SUPPORTED_CURRENCIES[currency.toUpperCase()];
  
  if (!currencyInfo) {
    return Math.round(amount);
  }
  
  const factor = Math.pow(10, currencyInfo.decimalPlaces);
  return Math.round(amount * factor) / factor;
};
