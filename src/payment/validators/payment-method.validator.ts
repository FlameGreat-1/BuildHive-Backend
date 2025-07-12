import Joi from 'joi';
import { PAYMENT_CONSTANTS } from '../../config/payment';
import { PaymentMethod } from '../../shared/types';

export const createPaymentMethodSchema = Joi.object({
  type: Joi.string()
    .valid(...Object.values(PaymentMethod))
    .required()
    .messages({
      'string.base': 'Payment method type must be a string',
      'any.only': `Payment method type must be one of: ${Object.values(PaymentMethod).join(', ')}`,
      'any.required': 'Payment method type is required'
    }),

  card: Joi.when('type', {
    is: PaymentMethod.CARD,
    then: Joi.object({
      number: Joi.string()
        .creditCard()
        .required()
        .messages({
          'string.base': 'Card number must be a string',
          'string.creditCard': 'Card number must be a valid credit card number',
          'any.required': 'Card number is required'
        }),

      expMonth: Joi.number()
        .integer()
        .min(1)
        .max(12)
        .required()
        .messages({
          'number.base': 'Expiry month must be a number',
          'number.integer': 'Expiry month must be an integer',
          'number.min': 'Expiry month must be between 1 and 12',
          'number.max': 'Expiry month must be between 1 and 12',
          'any.required': 'Expiry month is required'
        }),

      expYear: Joi.number()
        .integer()
        .min(new Date().getFullYear())
        .max(new Date().getFullYear() + 20)
        .required()
        .messages({
          'number.base': 'Expiry year must be a number',
          'number.integer': 'Expiry year must be an integer',
          'number.min': 'Expiry year cannot be in the past',
          'number.max': 'Expiry year cannot be more than 20 years in the future',
          'any.required': 'Expiry year is required'
        }),

      cvc: Joi.string()
        .pattern(/^[0-9]{3,4}$/)
        .required()
        .messages({
          'string.base': 'CVC must be a string',
          'string.pattern.base': 'CVC must be 3 or 4 digits',
          'any.required': 'CVC is required'
        })
    }).required(),
    otherwise: Joi.forbidden()
  }),

  billingDetails: Joi.object({
    name: Joi.string()
      .max(100)
      .optional()
      .messages({
        'string.base': 'Name must be a string',
        'string.max': 'Name cannot exceed 100 characters'
      }),

    email: Joi.string()
      .email()
      .max(255)
      .optional()
      .messages({
        'string.base': 'Email must be a string',
        'string.email': 'Email must be a valid email address',
        'string.max': 'Email cannot exceed 255 characters'
      }),

    phone: Joi.string()
      .pattern(/^\+?[1-9]\d{1,14}$/)
      .optional()
      .messages({
        'string.base': 'Phone must be a string',
        'string.pattern.base': 'Phone must be a valid phone number'
      }),

    address: Joi.object({
      line1: Joi.string()
        .max(200)
        .optional()
        .messages({
          'string.base': 'Address line 1 must be a string',
          'string.max': 'Address line 1 cannot exceed 200 characters'
        }),

      line2: Joi.string()
        .max(200)
        .optional()
        .messages({
          'string.base': 'Address line 2 must be a string',
          'string.max': 'Address line 2 cannot exceed 200 characters'
        }),

      city: Joi.string()
        .max(100)
        .optional()
        .messages({
          'string.base': 'City must be a string',
          'string.max': 'City cannot exceed 100 characters'
        }),

      state: Joi.string()
        .max(100)
        .optional()
        .messages({
          'string.base': 'State must be a string',
          'string.max': 'State cannot exceed 100 characters'
        }),

      postalCode: Joi.string()
        .max(20)
        .optional()
        .messages({
          'string.base': 'Postal code must be a string',
          'string.max': 'Postal code cannot exceed 20 characters'
        }),

      country: Joi.string()
        .length(2)
        .uppercase()
        .optional()
        .messages({
          'string.base': 'Country must be a string',
          'string.length': 'Country must be a 2-letter country code',
          'string.uppercase': 'Country must be uppercase'
        })
    }).optional()
  }).optional()
});

export const attachPaymentMethodSchema = Joi.object({
  paymentMethodId: Joi.string()
    .pattern(/^pm_[a-zA-Z0-9_]+$/)
    .required()
    .messages({
      'string.base': 'Payment method ID must be a string',
      'string.pattern.base': 'Payment method ID must be a valid Stripe payment method ID',
      'any.required': 'Payment method ID is required'
    }),

  customerId: Joi.string()
    .pattern(/^cus_[a-zA-Z0-9_]+$/)
    .required()
    .messages({
      'string.base': 'Customer ID must be a string',
      'string.pattern.base': 'Customer ID must be a valid Stripe customer ID',
      'any.required': 'Customer ID is required'
    })
});

export const detachPaymentMethodSchema = Joi.object({
  paymentMethodId: Joi.string()
    .pattern(/^pm_[a-zA-Z0-9_]+$/)
    .required()
    .messages({
      'string.base': 'Payment method ID must be a string',
      'string.pattern.base': 'Payment method ID must be a valid Stripe payment method ID',
      'any.required': 'Payment method ID is required'
    })
});

export const setDefaultPaymentMethodSchema = Joi.object({
  paymentMethodId: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      'number.base': 'Payment method ID must be a number',
      'number.integer': 'Payment method ID must be an integer',
      'number.positive': 'Payment method ID must be positive',
      'any.required': 'Payment method ID is required'
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
    })
});

export const validateCreatePaymentMethod = (data: any) => {
  const { error, value } = createPaymentMethodSchema.validate(data, {
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

  const customValidation = validatePaymentMethodBusinessRules(value);
  if (!customValidation.isValid) {
    return customValidation;
  }

  return {
    isValid: true,
    errors: [],
    data: value
  };
};

export const validateAttachPaymentMethod = (data: any) => {
  const { error, value } = attachPaymentMethodSchema.validate(data, {
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

export const validateDetachPaymentMethod = (data: any) => {
  const { error, value } = detachPaymentMethodSchema.validate(data, {
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

export const validateSetDefaultPaymentMethod = (data: any) => {
  const { error, value } = setDefaultPaymentMethodSchema.validate(data, {
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

const validatePaymentMethodBusinessRules = (data: any) => {
  if (data.type === PaymentMethod.CARD && data.card) {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    
    if (data.card.expYear === currentYear && data.card.expMonth < currentMonth) {
      return {
        isValid: false,
        errors: [{ field: 'card', message: 'Card has expired' }],
        data: null
      };
    }
  }

  return {
    isValid: true,
    errors: [],
    data
  };
};
