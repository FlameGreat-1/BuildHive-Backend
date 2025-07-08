import Joi from 'joi';
import { QUOTE_CONSTANTS, QUOTE_ITEM_TYPE, MATERIAL_UNITS } from '../../config/quotes';

export const createQuoteSchema = Joi.object({
  clientId: Joi.number().integer().positive().optional(),
  jobId: Joi.number().integer().positive().optional(),
  title: Joi.string()
    .trim()
    .min(1)
    .max(QUOTE_CONSTANTS.MAX_TITLE_LENGTH)
    .required()
    .messages({
      'string.empty': 'Quote title is required',
      'string.max': `Quote title cannot exceed ${QUOTE_CONSTANTS.MAX_TITLE_LENGTH} characters`,
      'any.required': 'Quote title is required'
    }),
  description: Joi.string()
    .trim()
    .max(QUOTE_CONSTANTS.MAX_DESCRIPTION_LENGTH)
    .optional()
    .allow('')
    .messages({
      'string.max': `Quote description cannot exceed ${QUOTE_CONSTANTS.MAX_DESCRIPTION_LENGTH} characters`
    }),
  items: Joi.array()
    .items(
      Joi.object({
        itemType: Joi.string()
          .valid(...Object.values(QUOTE_ITEM_TYPE))
          .required()
          .messages({
            'any.only': 'Invalid item type',
            'any.required': 'Item type is required'
          }),
        description: Joi.string()
          .trim()
          .min(1)
          .max(QUOTE_CONSTANTS.MAX_ITEM_DESCRIPTION_LENGTH)
          .required()
          .messages({
            'string.empty': 'Item description is required',
            'string.max': `Item description cannot exceed ${QUOTE_CONSTANTS.MAX_ITEM_DESCRIPTION_LENGTH} characters`,
            'any.required': 'Item description is required'
          }),
        quantity: Joi.number()
          .positive()
          .precision(2)
          .required()
          .messages({
            'number.positive': 'Quantity must be greater than 0',
            'any.required': 'Quantity is required'
          }),
        unit: Joi.string()
          .valid(...Object.values(MATERIAL_UNITS))
          .required()
          .messages({
            'any.only': 'Invalid unit type',
            'any.required': 'Unit is required'
          }),
        unitPrice: Joi.number()
          .min(0)
          .precision(2)
          .required()
          .messages({
            'number.min': 'Unit price cannot be negative',
            'any.required': 'Unit price is required'
          })
      })
    )
    .min(1)
    .max(QUOTE_CONSTANTS.MAX_ITEMS_PER_QUOTE)
    .required()
    .messages({
      'array.min': 'At least one quote item is required',
      'array.max': `Maximum ${QUOTE_CONSTANTS.MAX_ITEMS_PER_QUOTE} items allowed per quote`,
      'any.required': 'Quote items are required'
    }),
  gstEnabled: Joi.boolean()
    .required()
    .messages({
      'any.required': 'GST enabled flag is required'
    }),
  validUntil: Joi.date()
    .greater('now')
    .required()
    .messages({
      'date.greater': 'Quote valid until date must be in the future',
      'any.required': 'Quote valid until date is required'
    }),
  termsConditions: Joi.string()
    .trim()
    .max(QUOTE_CONSTANTS.MAX_TERMS_CONDITIONS_LENGTH)
    .optional()
    .allow('')
    .messages({
      'string.max': `Terms and conditions cannot exceed ${QUOTE_CONSTANTS.MAX_TERMS_CONDITIONS_LENGTH} characters`
    }),
  notes: Joi.string()
    .trim()
    .max(QUOTE_CONSTANTS.MAX_NOTES_LENGTH)
    .optional()
    .allow('')
    .messages({
      'string.max': `Notes cannot exceed ${QUOTE_CONSTANTS.MAX_NOTES_LENGTH} characters`
    })
});

export const updateQuoteSchema = Joi.object({
  title: Joi.string()
    .trim()
    .min(1)
    .max(QUOTE_CONSTANTS.MAX_TITLE_LENGTH)
    .optional()
    .messages({
      'string.empty': 'Quote title cannot be empty',
      'string.max': `Quote title cannot exceed ${QUOTE_CONSTANTS.MAX_TITLE_LENGTH} characters`
    }),
  description: Joi.string()
    .trim()
    .max(QUOTE_CONSTANTS.MAX_DESCRIPTION_LENGTH)
    .optional()
    .allow('')
    .messages({
      'string.max': `Quote description cannot exceed ${QUOTE_CONSTANTS.MAX_DESCRIPTION_LENGTH} characters`
    }),
  items: Joi.array()
    .items(
      Joi.object({
        id: Joi.number().integer().positive().optional(),
        itemType: Joi.string()
          .valid(...Object.values(QUOTE_ITEM_TYPE))
          .optional()
          .messages({
            'any.only': 'Invalid item type'
          }),
        description: Joi.string()
          .trim()
          .min(1)
          .max(QUOTE_CONSTANTS.MAX_ITEM_DESCRIPTION_LENGTH)
          .optional()
          .messages({
            'string.empty': 'Item description cannot be empty',
            'string.max': `Item description cannot exceed ${QUOTE_CONSTANTS.MAX_ITEM_DESCRIPTION_LENGTH} characters`
          }),
        quantity: Joi.number()
          .positive()
          .precision(2)
          .optional()
          .messages({
            'number.positive': 'Quantity must be greater than 0'
          }),
        unit: Joi.string()
          .valid(...Object.values(MATERIAL_UNITS))
          .optional()
          .messages({
            'any.only': 'Invalid unit type'
          }),
        unitPrice: Joi.number()
          .min(0)
          .precision(2)
          .optional()
          .messages({
            'number.min': 'Unit price cannot be negative'
          }),
        sortOrder: Joi.number()
          .integer()
          .min(1)
          .optional()
          .messages({
            'number.min': 'Sort order must be at least 1'
          })
      })
    )
    .min(1)
    .max(QUOTE_CONSTANTS.MAX_ITEMS_PER_QUOTE)
    .optional()
    .messages({
      'array.min': 'At least one quote item is required',
      'array.max': `Maximum ${QUOTE_CONSTANTS.MAX_ITEMS_PER_QUOTE} items allowed per quote`
    }),
  gstEnabled: Joi.boolean().optional(),
  validUntil: Joi.date()
    .greater('now')
    .optional()
    .messages({
      'date.greater': 'Quote valid until date must be in the future'
    }),
  termsConditions: Joi.string()
    .trim()
    .max(QUOTE_CONSTANTS.MAX_TERMS_CONDITIONS_LENGTH)
    .optional()
    .allow('')
    .messages({
      'string.max': `Terms and conditions cannot exceed ${QUOTE_CONSTANTS.MAX_TERMS_CONDITIONS_LENGTH} characters`
    }),
  notes: Joi.string()
    .trim()
    .max(QUOTE_CONSTANTS.MAX_NOTES_LENGTH)
    .optional()
    .allow('')
    .messages({
      'string.max': `Notes cannot exceed ${QUOTE_CONSTANTS.MAX_NOTES_LENGTH} characters`
    })
});

export const quoteStatusUpdateSchema = Joi.object({
  status: Joi.string()
    .valid('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'cancelled')
    .required()
    .messages({
      'any.only': 'Invalid quote status',
      'any.required': 'Quote status is required'
    }),
  reason: Joi.string()
    .trim()
    .max(500)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Reason cannot exceed 500 characters'
    })
});

export const quoteDeliverySchema = Joi.object({
  deliveryMethods: Joi.array()
    .items(Joi.string().valid('email', 'sms', 'pdf', 'portal'))
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one delivery method is required',
      'any.only': 'Invalid delivery method',
      'any.required': 'Delivery methods are required'
    }),
  recipientEmail: Joi.string()
    .email()
    .optional()
    .messages({
      'string.email': 'Invalid email format'
    }),
  recipientPhone: Joi.string()
    .pattern(/^\+?[\d\s\-\(\)]{10,}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid phone number format'
    }),
  customMessage: Joi.string()
    .trim()
    .max(1000)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Custom message cannot exceed 1000 characters'
    })
}).custom((value, helpers) => {
  if (value.deliveryMethods.includes('email') && !value.recipientEmail) {
    return helpers.error('custom.emailRequired');
  }
  if (value.deliveryMethods.includes('sms') && !value.recipientPhone) {
    return helpers.error('custom.phoneRequired');
  }
  return value;
}, 'Delivery method validation').messages({
  'custom.emailRequired': 'Recipient email is required for email delivery',
  'custom.phoneRequired': 'Recipient phone is required for SMS delivery'
});

export const aiPricingRequestSchema = Joi.object({
  jobDescription: Joi.string()
    .trim()
    .min(10)
    .max(2000)
    .required()
    .messages({
      'string.min': 'Job description must be at least 10 characters long',
      'string.max': 'Job description cannot exceed 2000 characters',
      'any.required': 'Job description is required'
    }),
  jobType: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.empty': 'Job type is required',
      'string.max': 'Job type cannot exceed 100 characters',
      'any.required': 'Job type is required'
    }),
  tradieHourlyRate: Joi.number()
    .positive()
    .min(10)
    .max(500)
    .precision(2)
    .required()
    .messages({
      'number.positive': 'Tradie hourly rate must be positive',
      'number.min': 'Tradie hourly rate must be at least $10',
      'number.max': 'Tradie hourly rate cannot exceed $500',
      'any.required': 'Tradie hourly rate is required'
    }),
  estimatedDuration: Joi.number()
    .positive()
    .min(0.5)
    .max(2000)
    .precision(2)
    .optional()
    .messages({
      'number.positive': 'Estimated duration must be positive',
      'number.min': 'Estimated duration must be at least 0.5 hours',
      'number.max': 'Estimated duration cannot exceed 2000 hours'
    }),
  location: Joi.string()
    .trim()
    .max(200)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Location cannot exceed 200 characters'
    })
});

export const quoteFilterSchema = Joi.object({
  status: Joi.string()
    .valid('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'cancelled')
    .optional(),
  clientId: Joi.number().integer().positive().optional(),
  jobId: Joi.number().integer().positive().optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().min(Joi.ref('startDate')).optional(),
  searchTerm: Joi.string().trim().max(100).optional().allow(''),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string()
    .valid('created_at', 'updated_at', 'total_amount', 'valid_until', 'status', 'quote_number')
    .default('created_at'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});
