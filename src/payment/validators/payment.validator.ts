import Joi from 'joi';
import { PAYMENT_CONSTANTS } from '../../config/payment';
import { PaymentMethod, PaymentType } from '../../shared/types';

export const createPaymentIntentSchema = Joi.object({
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

  paymentMethod: Joi.string()
    .valid(...Object.values(PaymentMethod))
    .required()
    .messages({
      'string.base': 'Payment method must be a string',
      'any.only': `Payment method must be one of: ${Object.values(PaymentMethod).join(', ')}`,
      'any.required': 'Payment method is required'
    }),

  paymentType: Joi.string()
    .valid('credit_purchase', 'subscription', 'job_application', 'invoice_payment')
    .required()
    .messages({
      'string.base': 'Payment type must be a string',
      'any.only': 'Payment type must be one of: credit_purchase, subscription, job_application, invoice_payment',
      'any.required': 'Payment type is required'
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

  automaticPaymentMethods: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': 'Automatic payment methods must be a boolean'
    }),

  returnUrl: Joi.string()
    .uri()
    .optional()
    .messages({
      'string.base': 'Return URL must be a string',
      'string.uri': 'Return URL must be a valid URI'
    })
});

export const confirmPaymentSchema = Joi.object({
  paymentIntentId: Joi.string()
    .pattern(/^pi_[a-zA-Z0-9_]+$/)
    .required()
    .messages({
      'string.base': 'Payment intent ID must be a string',
      'string.pattern.base': 'Payment intent ID must be a valid Stripe payment intent ID',
      'any.required': 'Payment intent ID is required'
    }),

  paymentMethodId: Joi.string()
    .pattern(/^pm_[a-zA-Z0-9_]+$/)
    .optional()
    .messages({
      'string.base': 'Payment method ID must be a string',
      'string.pattern.base': 'Payment method ID must be a valid Stripe payment method ID'
    }),

  returnUrl: Joi.string()
    .uri()
    .optional()
    .messages({
      'string.base': 'Return URL must be a string',
      'string.uri': 'Return URL must be a valid URI'
    })
});

export const paymentLinkSchema = Joi.object({
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

  expiresAt: Joi.date()
    .min('now')
    .max(new Date(Date.now() + (24 * 60 * 60 * 1000)))
    .optional()
    .messages({
      'date.base': 'Expires at must be a valid date',
      'date.min': 'Expires at must be in the future',
      'date.max': 'Expires at cannot be more than 24 hours from now'
    }),

  returnUrl: Joi.string()
    .uri()
    .optional()
    .messages({
      'string.base': 'Return URL must be a string',
      'string.uri': 'Return URL must be a valid URI'
    }),

  automaticTax: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': 'Automatic tax must be a boolean'
    })
});

export const paymentRetrySchema = Joi.object({
  paymentIntentId: Joi.string()
    .pattern(/^pi_[a-zA-Z0-9_]+$/)
    .required()
    .messages({
      'string.base': 'Payment intent ID must be a string',
      'string.pattern.base': 'Payment intent ID must be a valid Stripe payment intent ID',
      'any.required': 'Payment intent ID is required'
    }),

  paymentMethodId: Joi.string()
    .pattern(/^pm_[a-zA-Z0-9_]+$/)
    .optional()
    .messages({
      'string.base': 'Payment method ID must be a string',
      'string.pattern.base': 'Payment method ID must be a valid Stripe payment method ID'
    })
});

export const paymentCancelSchema = Joi.object({
  paymentIntentId: Joi.string()
    .pattern(/^pi_[a-zA-Z0-9_]+$/)
    .required()
    .messages({
      'string.base': 'Payment intent ID must be a string',
      'string.pattern.base': 'Payment intent ID must be a valid Stripe payment intent ID',
      'any.required': 'Payment intent ID is required'
    }),

  reason: Joi.string()
    .max(500)
    .optional()
    .messages({
      'string.base': 'Reason must be a string',
      'string.max': 'Reason cannot exceed 500 characters'
    })
});

export const validateCreatePaymentIntent = (data: any) => {
  const { error, value } = createPaymentIntentSchema.validate(data, {
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

  const customValidation = validatePaymentBusinessRules(value);
  if (!customValidation.isValid) {
    return customValidation;
  }

  return {
    isValid: true,
    errors: [],
    data: value
  };
};

export const validateConfirmPayment = (data: any) => {
  const { error, value } = confirmPaymentSchema.validate(data, {
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

export const validatePaymentLink = (data: any) => {
  const { error, value } = paymentLinkSchema.validate(data, {
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

export const validatePaymentRetry = (data: any) => {
  const { error, value } = paymentRetrySchema.validate(data, {
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

export const validatePaymentCancel = (data: any) => {
  const { error, value } = paymentCancelSchema.validate(data, {
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

const validatePaymentBusinessRules = (data: any) => {
  if (data.amount <= 0) {
    return {
      isValid: false,
      errors: [{ field: 'amount', message: 'Payment amount must be greater than zero' }],
      data: null
    };
  }

  const supportedCurrencies = PAYMENT_CONSTANTS.STRIPE.CURRENCY.SUPPORTED;
  if (!supportedCurrencies.includes(data.currency)) {
    return {
      isValid: false,
      errors: [{ field: 'currency', message: 'Unsupported currency' }],
      data: null
    };
  }

  return {
    isValid: true,
    errors: [],
    data
  };
};
