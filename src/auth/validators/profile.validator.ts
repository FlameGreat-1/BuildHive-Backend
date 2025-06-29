import Joi from 'joi';

// Reusable field schemas
const nameSchema = Joi.string()
  .trim()
  .min(2)
  .max(50)
  .pattern(/^[a-zA-Z\s'-]+$/)
  .messages({
    'string.min': 'Name must be at least 2 characters long',
    'string.max': 'Name cannot exceed 50 characters',
    'string.pattern.base': 'Name can only contain letters, spaces, hyphens, and apostrophes'
  });

const emailSchema = Joi.string()
  .email({ tlds: { allow: false } })
  .lowercase()
  .trim()
  .max(255)
  .messages({
    'string.email': 'Please provide a valid email address',
    'string.max': 'Email cannot exceed 255 characters'
  });

const phoneSchema = Joi.string()
  .pattern(/^(\+61|0)[2-9]\d{8}$/)
  .messages({
    'string.pattern.base': 'Please provide a valid Australian phone number'
  });

const postcodeSchema = Joi.string()
  .pattern(/^\d{4}$/)
  .messages({
    'string.pattern.base': 'Postcode must be 4 digits'
  });

const abnSchema = Joi.string()
  .pattern(/^\d{11}$/)
  .messages({
    'string.pattern.base': 'ABN must be 11 digits'
  });

// Address schema
const addressSchema = Joi.object({
  street: Joi.string()
    .trim()
    .min(5)
    .max(100)
    .required()
    .messages({
      'string.min': 'Street address must be at least 5 characters',
      'string.max': 'Street address cannot exceed 100 characters',
      'any.required': 'Street address is required'
    }),
  suburb: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required()
    .messages({
      'string.min': 'Suburb must be at least 2 characters',
      'string.max': 'Suburb cannot exceed 50 characters',
      'any.required': 'Suburb is required'
    }),
  state: Joi.string()
    .valid('NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT')
    .required()
    .messages({
      'any.only': 'State must be a valid Australian state or territory',
      'any.required': 'State is required'
    }),
  postcode: postcodeSchema.required().messages({
    'any.required': 'Postcode is required'
  }),
  country: Joi.string()
    .valid('Australia')
    .default('Australia')
});

// Create profile schema
export const createProfileSchema = Joi.object({
  firstName: nameSchema.required().messages({ 'any.required': 'First name is required' }),
  lastName: nameSchema.required().messages({ 'any.required': 'Last name is required' }),
  email: emailSchema.required().messages({ 'any.required': 'Email is required' }),
  phone: phoneSchema.required().messages({ 'any.required': 'Phone number is required' }),
  role: Joi.string()
    .valid('homeowner', 'tradie', 'business')
    .required()
    .messages({
      'any.only': 'Role must be homeowner, tradie, or business',
      'any.required': 'Role is required'
    }),
  address: addressSchema.required().messages({ 'any.required': 'Address is required' }),
  dateOfBirth: Joi.date()
    .max('now')
    .min('1900-01-01')
    .when('role', {
      is: 'homeowner',
      then: Joi.required(),
      otherwise: Joi.optional()
    })
    .messages({
      'date.max': 'Date of birth cannot be in the future',
      'date.min': 'Please provide a valid date of birth',
      'any.required': 'Date of birth is required for homeowners'
    }),
  bio: Joi.string()
    .max(500)
    .trim()
    .optional()
    .messages({
      'string.max': 'Bio cannot exceed 500 characters'
    })
}).options({ stripUnknown: true });

// Update profile schema
export const updateProfileSchema = Joi.object({
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  phone: phoneSchema.optional(),
  address: addressSchema.optional(),
  dateOfBirth: Joi.date()
    .max('now')
    .min('1900-01-01')
    .optional()
    .messages({
      'date.max': 'Date of birth cannot be in the future',
      'date.min': 'Please provide a valid date of birth'
    }),
  bio: Joi.string()
    .max(500)
    .trim()
    .optional()
    .messages({
      'string.max': 'Bio cannot exceed 500 characters'
    }),
  website: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .max(255)
    .optional()
    .messages({
      'string.uri': 'Please provide a valid website URL',
      'string.max': 'Website URL cannot exceed 255 characters'
    }),
  socialMedia: Joi.object({
    facebook: Joi.string().uri().max(255).optional(),
    instagram: Joi.string().uri().max(255).optional(),
    linkedin: Joi.string().uri().max(255).optional(),
    twitter: Joi.string().uri().max(255).optional()
  }).optional(),
  preferences: Joi.object({
    emailNotifications: Joi.boolean().default(true),
    smsNotifications: Joi.boolean().default(false),
    marketingEmails: Joi.boolean().default(false),
    profileVisibility: Joi.string().valid('public', 'private', 'contacts_only').default('public'),
    showContactInfo: Joi.boolean().default(true)
  }).optional()
}).options({ stripUnknown: true });

// Tradie-specific schemas
export const tradieProfileSchema = Joi.object({
  businessName: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .required()
    .messages({
      'string.min': 'Business name must be at least 2 characters',
      'string.max': 'Business name cannot exceed 100 characters',
      'any.required': 'Business name is required'
    }),
  abn: abnSchema.required().messages({ 'any.required': 'ABN is required for tradies' }),
  services: Joi.array()
    .items(Joi.string().trim().max(50))
    .min(1)
    .max(20)
    .required()
    .messages({
      'array.min': 'At least one service must be specified',
      'array.max': 'Maximum 20 services allowed',
      'any.required': 'Services are required'
    }),
  experience: Joi.number()
    .min(0)
    .max(50)
    .required()
    .messages({
      'number.min': 'Experience cannot be negative',
      'number.max': 'Experience cannot exceed 50 years',
      'any.required': 'Years of experience is required'
    }),
  hourlyRate: Joi.number()
    .min(20)
    .max(500)
    .optional()
    .messages({
      'number.min': 'Hourly rate must be at least $20',
      'number.max': 'Hourly rate cannot exceed $500'
    }),
  availability: Joi.string()
    .valid('available', 'busy', 'unavailable')
    .default('available'),
  serviceAreas: Joi.array()
    .items(postcodeSchema)
    .min(1)
    .max(50)
    .required()
    .messages({
      'array.min': 'At least one service area must be specified',
      'array.max': 'Maximum 50 service areas allowed',
      'any.required': 'Service areas are required'
    }),
  qualifications: Joi.array()
    .items(Joi.object({
      name: Joi.string().trim().max(100).required(),
      issuer: Joi.string().trim().max(100).required(),
      dateObtained: Joi.date().max('now').required(),
      expiryDate: Joi.date().min('now').optional(),
      certificateNumber: Joi.string().trim().max(50).optional()
    }))
    .max(20)
    .optional()
    .messages({
      'array.max': 'Maximum 20 qualifications allowed'
    }),
  insurance: Joi.object({
    publicLiability: Joi.boolean().default(false),
    workersCompensation: Joi.boolean().default(false),
    professionalIndemnity: Joi.boolean().default(false),
    amount: Joi.number().min(0).optional(),
    expiryDate: Joi.date().min('now').optional()
  }).optional()
}).options({ stripUnknown: true });

// Search profiles schema
export const searchProfilesSchema = Joi.object({
  query: Joi.string()
    .trim()
    .min(2)
    .max(100)
    .optional()
    .messages({
      'string.min': 'Search query must be at least 2 characters',
      'string.max': 'Search query cannot exceed 100 characters'
    }),
  role: Joi.string()
    .valid('homeowner', 'tradie', 'business')
    .optional(),
  location: Joi.object({
    suburb: Joi.string().trim().max(50).optional(),
    state: Joi.string().valid('NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT').optional(),
    postcode: postcodeSchema.optional(),
    radius: Joi.number().min(1).max(100).default(10).optional()
  }).optional(),
  services: Joi.array()
    .items(Joi.string().trim().max(50))
    .max(10)
    .optional()
    .messages({
      'array.max': 'Maximum 10 services can be selected'
    }),
  priceRange: Joi.object({
    min: Joi.number().min(0).optional(),
    max: Joi.number().min(0).optional()
  }).optional(),
  rating: Joi.number()
    .min(1)
    .max(5)
    .optional()
    .messages({
      'number.min': 'Rating must be at least 1',
      'number.max': 'Rating cannot exceed 5'
    }),
  verified: Joi.boolean().optional(),
  availability: Joi.string()
    .valid('available', 'busy', 'unavailable')
    .optional(),
  sortBy: Joi.string()
    .valid('relevance', 'rating', 'distance', 'price', 'reviews', 'newest')
    .default('relevance')
    .optional(),
  sortOrder: Joi.string()
    .valid('asc', 'desc')
    .default('desc')
    .optional(),
  page: Joi.number()
    .min(1)
    .default(1)
    .optional(),
  limit: Joi.number()
    .min(1)
    .max(50)
    .default(20)
    .optional()
}).options({ stripUnknown: true });

// Image upload schema
export const uploadImageSchema = Joi.object({
  imageType: Joi.string()
    .valid('profile', 'cover', 'portfolio', 'certificate')
    .default('profile')
    .optional(),
  caption: Joi.string()
    .max(200)
    .trim()
    .optional()
    .messages({
      'string.max': 'Caption cannot exceed 200 characters'
    })
}).options({ stripUnknown: true });

export default {
  createProfileSchema,
  updateProfileSchema,
  tradieProfileSchema,
  searchProfilesSchema,
  uploadImageSchema
};
