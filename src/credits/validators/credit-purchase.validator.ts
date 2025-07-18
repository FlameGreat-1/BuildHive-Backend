import { body, param, query, ValidationChain } from 'express-validator';
import { CreditPackageType } from '../../shared/types';
import { isValidPackageType } from '../utils';

export const validateCreditPurchaseRequest = (): ValidationChain[] => [
  body('packageType')
    .notEmpty()
    .withMessage('Package type is required')
    .custom((value) => {
      if (!isValidPackageType(value)) {
        throw new Error('Invalid package type');
      }
      return true;
    }),

  body('paymentMethodId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Payment method ID must be a positive integer'),

  body('autoTopup')
    .optional()
    .isBoolean()
    .withMessage('Auto topup must be a boolean value'),

  body('promoCode')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Promo code must be between 3 and 20 characters')
    .matches(/^[A-Z0-9]+$/)
    .withMessage('Promo code must contain only uppercase letters and numbers')
];

export const validateCreditPurchaseId = (): ValidationChain[] => [
  param('purchaseId')
    .isInt({ min: 1 })
    .withMessage('Purchase ID must be a positive integer')
];

export const validateCreditPurchaseHistory = (): ValidationChain[] => [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  query('status')
    .optional()
    .isIn(['pending', 'completed', 'failed', 'cancelled'])
    .withMessage('Invalid status filter'),

  query('packageType')
    .optional()
    .custom((value) => {
      if (!isValidPackageType(value)) {
        throw new Error('Invalid package type filter');
      }
      return true;
    }),

  query('dateFrom')
    .optional()
    .isISO8601()
    .withMessage('Date from must be a valid ISO 8601 date'),

  query('dateTo')
    .optional()
    .isISO8601()
    .withMessage('Date to must be a valid ISO 8601 date')
    .custom((value, { req }) => {
      if (req.query.dateFrom && new Date(value) <= new Date(req.query.dateFrom)) {
        throw new Error('Date to must be after date from');
      }
      return true;
    }),

  query('sortBy')
    .optional()
    .isIn(['createdAt', 'purchasePrice', 'creditsAmount'])
    .withMessage('Invalid sort field'),

  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
];

export const validateAutoTopupSettings = (): ValidationChain[] => [
  body('enabled')
    .isBoolean()
    .withMessage('Enabled must be a boolean value'),

  body('triggerBalance')
    .if(body('enabled').equals(true))
    .notEmpty()
    .withMessage('Trigger balance is required when auto topup is enabled')
    .isInt({ min: 0, max: 50 })
    .withMessage('Trigger balance must be between 0 and 50'),

  body('topupAmount')
    .if(body('enabled').equals(true))
    .notEmpty()
    .withMessage('Topup amount is required when auto topup is enabled')
    .isInt({ min: 10, max: 100 })
    .withMessage('Topup amount must be between 10 and 100'),

  body('packageType')
    .if(body('enabled').equals(true))
    .notEmpty()
    .withMessage('Package type is required when auto topup is enabled')
    .custom((value) => {
      if (!isValidPackageType(value)) {
        throw new Error('Invalid package type');
      }
      return true;
    }),

  body('paymentMethodId')
    .if(body('enabled').equals(true))
    .notEmpty()
    .withMessage('Payment method ID is required when auto topup is enabled')
    .isInt({ min: 1 })
    .withMessage('Payment method ID must be a positive integer')
];

export const validateCreditRefundRequest = (): ValidationChain[] => [
  body('transactionId')
    .notEmpty()
    .withMessage('Transaction ID is required')
    .isInt({ min: 1 })
    .withMessage('Transaction ID must be a positive integer'),

  body('reason')
    .notEmpty()
    .withMessage('Refund reason is required')
    .isString()
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('Refund reason must be between 5 and 500 characters'),

  body('refundType')
    .optional()
    .isIn(['full', 'partial'])
    .withMessage('Refund type must be either full or partial')
];

export const validatePromoCodeRequest = (): ValidationChain[] => [
  body('promoCode')
    .notEmpty()
    .withMessage('Promo code is required')
    .isString()
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Promo code must be between 3 and 20 characters')
    .matches(/^[A-Z0-9]+$/)
    .withMessage('Promo code must contain only uppercase letters and numbers'),

  body('packageType')
    .notEmpty()
    .withMessage('Package type is required')
    .custom((value) => {
      if (!isValidPackageType(value)) {
        throw new Error('Invalid package type');
      }
      return true;
    })
];

export const validateCreditPackageQuery = (): ValidationChain[] => [
  query('userRole')
    .optional()
    .isIn(['client', 'tradie', 'enterprise'])
    .withMessage('Invalid user role'),

  query('includeDisabled')
    .optional()
    .isBoolean()
    .withMessage('Include disabled must be a boolean value')
];

export const validatePurchaseMetrics = (): ValidationChain[] => [
  query('period')
    .optional()
    .isIn(['day', 'week', 'month', 'quarter', 'year'])
    .withMessage('Invalid period filter'),

  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),

  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
    .custom((value, { req }) => {
      if (req.query.startDate && new Date(value) <= new Date(req.query.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),

  query('groupBy')
    .optional()
    .isIn(['packageType', 'userRole', 'paymentMethod'])
    .withMessage('Invalid group by field')
];

export const validateBulkPurchaseRequest = (): ValidationChain[] => [
  body('purchases')
    .isArray({ min: 1, max: 10 })
    .withMessage('Purchases must be an array with 1 to 10 items'),

  body('purchases.*.packageType')
    .custom((value) => {
      if (!isValidPackageType(value)) {
        throw new Error('Invalid package type in bulk purchase');
      }
      return true;
    }),

  body('purchases.*.quantity')
    .isInt({ min: 1, max: 5 })
    .withMessage('Quantity must be between 1 and 5'),

  body('paymentMethodId')
    .notEmpty()
    .withMessage('Payment method ID is required for bulk purchase')
    .isInt({ min: 1 })
    .withMessage('Payment method ID must be a positive integer')
];
