import { body, param, query, ValidationChain } from 'express-validator';
import { CreditTransactionType, CreditUsageType } from '../../shared/types';
import { isValidTransactionType, isValidUsageType, isValidCreditAmount } from '../utils';

export const validateCreditTransactionRequest = (): ValidationChain[] => [
  body('transactionType')
    .notEmpty()
    .withMessage('Transaction type is required')
    .custom((value) => {
      if (!isValidTransactionType(value)) {
        throw new Error('Invalid transaction type');
      }
      return true;
    }),

  body('credits')
    .notEmpty()
    .withMessage('Credits amount is required')
    .isInt({ min: 1, max: 1000 })
    .withMessage('Credits must be between 1 and 1000')
    .custom((value) => {
      if (!isValidCreditAmount(value)) {
        throw new Error('Invalid credit amount');
      }
      return true;
    }),

  body('description')
    .notEmpty()
    .withMessage('Description is required')
    .isString()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Description must be between 3 and 200 characters'),

  body('referenceId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Reference ID must be a positive integer'),

  body('referenceType')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Reference type must be between 3 and 50 characters')
    .matches(/^[a-zA-Z_]+$/)
    .withMessage('Reference type must contain only letters and underscores'),

  body('usageType')
    .if(body('transactionType').equals(CreditTransactionType.USAGE))
    .notEmpty()
    .withMessage('Usage type is required for usage transactions')
    .custom((value) => {
      if (!isValidUsageType(value)) {
        throw new Error('Invalid usage type');
      }
      return true;
    }),

  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object')
    .custom((value) => {
      const metadataString = JSON.stringify(value);
      if (metadataString.length > 5000) {
        throw new Error('Metadata size exceeds maximum limit');
      }
      return true;
    })
];

export const validateCreditUsageRequest = (): ValidationChain[] => [
  body('usageType')
    .notEmpty()
    .withMessage('Usage type is required')
    .custom((value) => {
      if (!isValidUsageType(value)) {
        throw new Error('Invalid usage type');
      }
      return true;
    }),

  body('creditsToUse')
    .notEmpty()
    .withMessage('Credits to use is required')
    .isInt({ min: 1, max: 50 })
    .withMessage('Credits to use must be between 1 and 50'),

  body('description')
    .notEmpty()
    .withMessage('Description is required')
    .isString()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Description must be between 3 and 200 characters'),

  body('referenceId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Reference ID must be a positive integer'),

  body('referenceType')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Reference type must be between 3 and 50 characters'),

  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object')
];

export const validateTransactionId = (): ValidationChain[] => [
  param('transactionId')
    .isInt({ min: 1 })
    .withMessage('Transaction ID must be a positive integer')
];

export const validateTransactionHistory = (): ValidationChain[] => [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  query('transactionType')
    .optional()
    .custom((value) => {
      if (!isValidTransactionType(value)) {
        throw new Error('Invalid transaction type filter');
      }
      return true;
    }),

  query('status')
    .optional()
    .isIn(['pending', 'completed', 'failed', 'cancelled'])
    .withMessage('Invalid status filter'),

  query('dateFrom')
    .optional()
    .isISO8601()
    .withMessage('Date from must be a valid ISO 8601 date'),

  query('dateTo')
    .optional()
    .isISO8601()
    .withMessage('Date to must be a valid ISO 8601 date')
    .custom((value, { req }) => {
      if (req.query?.dateFrom && new Date(value) <= new Date(req.query.dateFrom as string)) {
        throw new Error('Date to must be after date from');
      }
      return true;
    }),

  query('minCredits')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Min credits must be a positive integer'),

  query('maxCredits')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Max credits must be a positive integer')
    .custom((value, { req }) => {
      if (req.query?.minCredits && parseInt(value) <= parseInt(req.query.minCredits as string)) {
        throw new Error('Max credits must be greater than min credits');
      }
      return true;
    }),

  query('referenceType')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Reference type must be between 3 and 50 characters'),

  query('sortBy')
    .optional()
    .isIn(['createdAt', 'credits', 'status'])
    .withMessage('Invalid sort field'),

  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
];

export const validateBulkTransactionRequest = (): ValidationChain[] => [
  body('transactions')
    .isArray({ min: 1, max: 100 })
    .withMessage('Transactions must be an array with 1 to 100 items'),

  body('transactions.*.transactionType')
    .custom((value) => {
      if (!isValidTransactionType(value)) {
        throw new Error('Invalid transaction type in bulk request');
      }
      return true;
    }),

  body('transactions.*.credits')
    .isInt({ min: 1, max: 50 })
    .withMessage('Credits must be between 1 and 50 in bulk request'),

  body('transactions.*.description')
    .isString()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Description must be between 3 and 200 characters in bulk request')
];

export const validateTransactionSummary = (): ValidationChain[] => [
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
      if (req.query?.startDate && new Date(value) <= new Date(req.query.startDate as string)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),

  query('groupBy')
    .optional()
    .isIn(['transactionType', 'status', 'usageType'])
    .withMessage('Invalid group by field')
];

export const validateTransactionExport = (): ValidationChain[] => [
  body('dateFrom')
    .notEmpty()
    .withMessage('Date from is required')
    .isISO8601()
    .withMessage('Date from must be a valid ISO 8601 date'),

  body('dateTo')
    .notEmpty()
    .withMessage('Date to is required')
    .isISO8601()
    .withMessage('Date to must be a valid ISO 8601 date')
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.dateFrom)) {
        throw new Error('Date to must be after date from');
      }
      const daysDiff = (new Date(value).getTime() - new Date(req.body.dateFrom).getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff > 365) {
        throw new Error('Export period cannot exceed 365 days');
      }
      return true;
    }),

  body('format')
    .notEmpty()
    .withMessage('Export format is required')
    .isIn(['csv', 'pdf', 'excel'])
    .withMessage('Format must be csv, pdf, or excel'),

  body('includeMetadata')
    .optional()
    .isBoolean()
    .withMessage('Include metadata must be a boolean value')
];

export const validateJobApplicationCredit = (): ValidationChain[] => [
  body('jobId')
    .notEmpty()
    .withMessage('Job ID is required')
    .isInt({ min: 1 })
    .withMessage('Job ID must be a positive integer'),

  body('creditsRequired')
    .notEmpty()
    .withMessage('Credits required is required')
    .isInt({ min: 1, max: 10 })
    .withMessage('Credits required must be between 1 and 10')
];

export const validateProfileBoostCredit = (): ValidationChain[] => [
  body('boostType')
    .notEmpty()
    .withMessage('Boost type is required')
    .isIn(['basic', 'premium', 'featured'])
    .withMessage('Boost type must be basic, premium, or featured'),

  body('duration')
    .notEmpty()
    .withMessage('Duration is required')
    .isInt({ min: 1, max: 30 })
    .withMessage('Duration must be between 1 and 30 days'),

  body('creditsRequired')
    .notEmpty()
    .withMessage('Credits required is required')
    .isInt({ min: 1, max: 20 })
    .withMessage('Credits required must be between 1 and 20')
];

export const validatePremiumJobUnlock = (): ValidationChain[] => [
  body('jobId')
    .notEmpty()
    .withMessage('Job ID is required')
    .isInt({ min: 1 })
    .withMessage('Job ID must be a positive integer'),

  body('creditsRequired')
    .notEmpty()
    .withMessage('Credits required is required')
    .isInt({ min: 1, max: 20 })
    .withMessage('Credits required must be between 1 and 20')
];
