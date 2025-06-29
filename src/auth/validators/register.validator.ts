import Joi from 'joi';

// Password validation schema
const passwordSchema = Joi.string()
  .min(8)
  .max(128)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/)
  .required()
  .messages({
    'string.min': 'Password must be at least 8 characters long',
    'string.max': 'Password cannot exceed 128 characters',
    'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    'any.required': 'Password is required'
  });

// Email validation schema
const emailSchema = Joi.string()
  .email({ tlds: { allow: false } })
  .lowercase()
  .trim()
  .max(255)
  .required()
  .messages({
    'string.email': 'Please provide a valid email address',
    'string.max': 'Email cannot exceed 255 characters',
    'any.required': 'Email is required'
  });

// Australian phone number schema
const phoneSchema = Joi.string()
  .pattern(/^(\+61|0)[2-9]\d{8}$/)
  .required()
  .messages({
    'string.pattern.base': 'Please provide a valid Australian phone number',
    'any.required': 'Phone number is required'
  });

// Name validation schema
const nameSchema = Joi.string()
  .trim()
  .min(2)
  .max(50)
  .pattern(/^[a-zA-Z\s'-]+$/)
  .required()
  .messages({
    'string.min': 'Name must be at least 2 characters long',
    'string.max': 'Name cannot exceed 50 characters',
    'string.pattern.base': 'Name can only contain letters, spaces, hyphens, and apostrophes',
    'any.required': 'Name is required'
  });

// User registration schema
export const registerSchema = Joi.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: Joi.string()
    .valid(Joi.ref('password'))
    .required()
    .messages({
      'any.only': 'Passwords do not match',
      'any.required': 'Password confirmation is required'
    }),
  firstName: nameSchema,
  lastName: nameSchema,
  phone: phoneSchema,
  role: Joi.string()
    .valid('homeowner', 'tradie', 'business')
    .required()
    .messages({
      'any.only': 'Role must be either homeowner, tradie, or business',
      'any.required': 'Role is required'
    }),
  acceptTerms: Joi.boolean()
    .valid(true)
    .required()
    .messages({
      'any.only': 'You must accept the terms and conditions',
      'any.required': 'Terms acceptance is required'
    }),
  marketingConsent: Joi.boolean().default(false),
  referralCode: Joi.string()
    .alphanum()
    .min(6)
    .max(20)
    .optional()
    .messages({
      'string.alphanum': 'Referral code must contain only letters and numbers',
      'string.min': 'Referral code must be at least 6 characters',
      'string.max': 'Referral code cannot exceed 20 characters'
    })
}).options({ stripUnknown: true });

export default registerSchema;
