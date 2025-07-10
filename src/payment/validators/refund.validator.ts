import Joi from 'joi';
import { PAYMENT_CONSTANTS } from '../../config/payment';
import { RefundStatus } from '../../shared/types';

export const createRefundSchema = Joi.object({
  paymentId: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      'number.base': 'Payment ID must be a number',
      'number.integer': 'Payment ID must be an integer',
      'number.positive': 'Payment ID must be positive',
      'any.required': 'Payment ID is required'
    }),

  userId: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      'number.base': 'User ID must be a number',
      'number.integer': 'User ID must be an integer',
      'number.positive': 'User ID must be positive',
      'any.required': 'User ID is required'
    }),

  amount: Joi.number()
    .integer()
    .min(PAYMENT_CONSTANTS.STRIPE.LIMITS.MIN_AMOUNT)
    .max(PAYMENT_CONSTANTS.STRIPE.LIMITS.MAX_AMOUNT)
    .required()
    .messages({
      'number.base': 'Refund amount must be a number',
      'number.integer': 'Refund amount must be an integer',
      'number.min': `Refund amount must be at least ${PAYMENT_CONSTANTS.STRIPE.LIMITS.MIN_AMOUNT} cents`,
      'number.max': `Refund amount cannot exceed ${PAYMENT_CONSTANTS.STRIPE.LIMITS.MAX_AMOUNT} cents`,
      'any.required': 'Refund amount is required'
    }),

  reason: Joi.string()
    .valid('duplicate', 'fraudulent', 'requested_by_customer', 'expired_uncaptured_charge')
    .required()
    .messages({
      'string.base': 'Refund reason must be a string',
      'any.only': 'Refund reason must be one of: duplicate, fraudulent, requested_by_customer, expired_uncaptured_charge',
      'any.required': 'Refund reason is required'
    }),

  description: Joi.string()
    .max(500)
    .optional()
    .messages({
      'string.base': 'Description must be a string',
      'string.max': 'Description cannot exceed 500 characters'
    }),

  metadata: Joi.object()
    .pattern(Joi.string().max(40), Joi.alternatives().try(Joi.string().max(500), Joi.number()))
    .max(50)
    .optional()
    .messages({
      'object.base': 'Metadata must be an object',
      'object.max': 'Metadata cannot have more than 50 keys'
    }),

  stripeRefundId: Joi.string()
    .pattern(/^re_[a-zA-Z0-9_]+$/)
    .optional()
    .messages({
      'string.base': 'Stripe refund ID must be a string',
      'string.pattern.base': 'Stripe refund ID must be a valid Stripe refund ID'
    })
});

export const updateRefundStatusSchema = Joi.object({
  refundId: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      'number.base': 'Refund ID must be a number',
      'number.integer': 'Refund ID must be an integer',
      'number.positive': 'Refund ID must be positive',
      'any.required': 'Refund ID is required'
    }),

  status: Joi.string()
    .valid('pending', 'processing', 'processed', 'failed', 'cancelled')
    .required()
    .messages({
      'string.base': 'Status must be a string',
      'any.only': 'Status must be one of: pending, processing, processed, failed, cancelled',
      'any.required': 'Status is required'
    }),

  processedAt: Joi.date()
    .when('status', {
      is: 'processed',
      then: Joi.required(),
      otherwise: Joi.optional()
    })
    .messages({
      'date.base': 'Processed at must be a valid date',
      'any.required': 'Processed at is required when status is processed'
    }),

  failureReason: Joi.string()
    .max(500)
    .when('status', {
      is: 'failed',
      then: Joi.optional(),
      otherwise: Joi.forbidden()
    })
    .messages({
      'string.base': 'Failure reason must be a string',
      'string.max': 'Failure reason cannot exceed 500 characters',
      'any.unknown': 'Failure reason is only allowed when status is failed'
    })
});

export const refundQuerySchema = Joi.object({
  paymentId: Joi.number()
    .integer()
    .positive()
    .optional()
    .messages({
      'number.base': 'Payment ID must be a number',
      'number.integer': 'Payment ID must be an integer',
      'number.positive': 'Payment ID must be positive'
    }),

  userId: Joi.number()
    .integer()
    .positive()
    .optional()
    .messages({
      'number.base': 'User ID must be a number',
      'number.integer': 'User ID must be an integer',
      'number.positive': 'User ID must be positive'
    }),

  status: Joi.string()
    .valid('pending', 'processing', 'processed', 'failed', 'cancelled')
    .optional()
    .messages({
      'string.base': 'Status must be a string',
      'any.only': 'Status must be one of: pending, processing, processed, failed, cancelled'
    }),

  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .optional()
    .default(50)
    .messages({
      'number.base': 'Limit must be a number',
      'number.integer': 'Limit must be an integer',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100'
    }),

  offset: Joi.number()
    .integer()
    .min(0)
    .optional()
    .default(0)
    .messages({
      'number.base': 'Offset must be a number',
      'number.integer': 'Offset must be an integer',
      'number.min': 'Offset cannot be negative'
    })
});

export const validateCreateRefund = (data: any) => {
  const { error, value } = createRefundSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const validationErrors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));
    
    return {
      isValid: false,
      errors: validationErrors,
      data: null
    };
  }

  const customValidation = validateRefundBusinessRules(value);
  if (!customValidation.isValid) {
    return customValidation;
  }

  return {
    isValid: true,
    errors: [],
    data: value
  };
};

export const validateUpdateRefundStatus = (data: any) => {
  const { error, value } = updateRefundStatusSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const validationErrors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));
    
    return {
      isValid: false,
      errors: validationErrors,
      data: null
    };
  }

  return {
    isValid: true,
    errors: [],
    data: value
  };
};

export const validateRefundQuery = (data: any) => {
  const { error, value } = refundQuerySchema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const validationErrors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));
    
    return {
      isValid: false,
      errors: validationErrors,
      data: null
    };
  }

  return {
    isValid: true,
    errors: [],
    data: value
  };
};

const validateRefundBusinessRules = (data: any) => {
  if (data.amount <= 0) {
    return {
      isValid: false,
      errors: [{ field: 'amount', message: 'Refund amount must be greater than zero' }],
      data: null
    };
  }

  if (data.status === 'processed' && !data.processedAt) {
    return {
      isValid: false,
      errors: [{ field: 'processedAt', message: 'Processed at date is required when status is processed' }],
      data: null
    };
  }

  return {
    isValid: true,
    errors: [],
    data
  };
};
