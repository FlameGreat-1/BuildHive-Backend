import Joi from 'joi';
import { PAYMENT_CONSTANTS } from '../../config/payment';
import { InvoiceStatus } from '../../shared/types';

export const createInvoiceSchema = Joi.object({
  quoteId: Joi.number()
    .integer()
    .positive()
    .optional()
    .messages({
      'number.base': 'Quote ID must be a number',
      'number.integer': 'Quote ID must be an integer',
      'number.positive': 'Quote ID must be positive'
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

  invoiceNumber: Joi.string()
    .pattern(/^INV-\d{4}-\d{6}$/)
    .required()
    .messages({
      'string.base': 'Invoice number must be a string',
      'string.pattern.base': 'Invoice number must follow format INV-YYYY-XXXXXX',
      'any.required': 'Invoice number is required'
    }),

  amount: Joi.number()
    .integer()
    .min(PAYMENT_CONSTANTS.STRIPE.LIMITS.MIN_AMOUNT)
    .max(PAYMENT_CONSTANTS.STRIPE.LIMITS.MAX_AMOUNT)
    .required()
    .messages({
      'number.base': 'Amount must be a number',
      'number.integer': 'Amount must be an integer',
      'number.min': `Amount must be at least ${PAYMENT_CONSTANTS.STRIPE.LIMITS.MIN_AMOUNT} cents`,
      'number.max': `Amount cannot exceed ${PAYMENT_CONSTANTS.STRIPE.LIMITS.MAX_AMOUNT} cents`,
      'any.required': 'Amount is required'
    }),

  currency: Joi.string()
    .valid(...PAYMENT_CONSTANTS.STRIPE.CURRENCY.SUPPORTED)
    .required()
    .messages({
      'string.base': 'Currency must be a string',
      'any.only': `Currency must be one of: ${PAYMENT_CONSTANTS.STRIPE.CURRENCY.SUPPORTED.join(', ')}`,
      'any.required': 'Currency is required'
    }),

  status: Joi.string()
    .valid('draft', 'sent', 'paid', 'overdue', 'cancelled')
    .optional()
    .default('draft')
    .messages({
      'string.base': 'Status must be a string',
      'any.only': 'Status must be one of: draft, sent, paid, overdue, cancelled'
    }),

  dueDate: Joi.date()
    .min('now')
    .required()
    .messages({
      'date.base': 'Due date must be a valid date',
      'date.min': 'Due date must be in the future',
      'any.required': 'Due date is required'
    }),

  paymentLink: Joi.string()
    .uri()
    .optional()
    .messages({
      'string.base': 'Payment link must be a string',
      'string.uri': 'Payment link must be a valid URI'
    }),

  stripeInvoiceId: Joi.string()
    .pattern(/^in_[a-zA-Z0-9_]+$/)
    .optional()
    .messages({
      'string.base': 'Stripe invoice ID must be a string',
      'string.pattern.base': 'Stripe invoice ID must be a valid Stripe invoice ID'
    }),

  description: Joi.string()
    .max(1000)
    .optional()
    .messages({
      'string.base': 'Description must be a string',
      'string.max': 'Description cannot exceed 1000 characters'
    }),

  metadata: Joi.object()
    .pattern(Joi.string().max(40), Joi.alternatives().try(Joi.string().max(500), Joi.number()))
    .max(50)
    .optional()
    .messages({
      'object.base': 'Metadata must be an object',
      'object.max': 'Metadata cannot have more than 50 keys'
    })
});

export const updateInvoiceStatusSchema = Joi.object({
  invoiceId: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      'number.base': 'Invoice ID must be a number',
      'number.integer': 'Invoice ID must be an integer',
      'number.positive': 'Invoice ID must be positive',
      'any.required': 'Invoice ID is required'
    }),

  status: Joi.string()
    .valid('draft', 'sent', 'paid', 'overdue', 'cancelled')
    .required()
    .messages({
      'string.base': 'Status must be a string',
      'any.only': 'Status must be one of: draft, sent, paid, overdue, cancelled',
      'any.required': 'Status is required'
    }),

  paidAt: Joi.date()
    .when('status', {
      is: 'paid',
      then: Joi.required(),
      otherwise: Joi.optional()
    })
    .messages({
      'date.base': 'Paid at must be a valid date',
      'any.required': 'Paid at is required when status is paid'
    })
});

export const invoiceQuerySchema = Joi.object({
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
    .valid('draft', 'sent', 'paid', 'overdue', 'cancelled')
    .optional()
    .messages({
      'string.base': 'Status must be a string',
      'any.only': 'Status must be one of: draft, sent, paid, overdue, cancelled'
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

export const validateCreateInvoice = (data: any) => {
  const { error, value } = createInvoiceSchema.validate(data, {
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

  const customValidation = validateInvoiceBusinessRules(value);
  if (!customValidation.isValid) {
    return customValidation;
  }

  return {
    isValid: true,
    errors: [],
    data: value
  };
};

export const validateUpdateInvoiceStatus = (data: any) => {
  const { error, value } = updateInvoiceStatusSchema.validate(data, {
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

export const validateInvoiceQuery = (data: any) => {
  const { error, value } = invoiceQuerySchema.validate(data, {
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

const validateInvoiceBusinessRules = (data: any) => {
  const dueDate = new Date(data.dueDate);
  const maxDueDate = new Date();
  maxDueDate.setDate(maxDueDate.getDate() + 365);

  if (dueDate > maxDueDate) {
    return {
      isValid: false,
      errors: [{ field: 'dueDate', message: 'Due date cannot be more than 1 year in the future' }],
      data: null
    };
  }

  if (data.status === 'paid' && !data.paidAt) {
    return {
      isValid: false,
      errors: [{ field: 'paidAt', message: 'Paid at date is required when status is paid' }],
      data: null
    };
  }

  return {
    isValid: true,
    errors: [],
    data
  };
};
