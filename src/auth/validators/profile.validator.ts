import { body, ValidationChain } from 'express-validator';

export const validateProfileCreation = (): ValidationChain[] => {
  return [
    body('firstName')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('First name must be between 1 and 50 characters')
      .matches(/^[a-zA-Z\s'-]+$/)
      .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),

    body('lastName')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Last name must be between 1 and 50 characters')
      .matches(/^[a-zA-Z\s'-]+$/)
      .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),

    body('phone')
      .optional()
      .isMobilePhone('any')
      .withMessage('Please provide a valid phone number'),

    body('avatar')
      .optional()
      .isURL()
      .withMessage('Avatar must be a valid URL'),

    body('bio')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Bio must not exceed 500 characters'),

    body('location')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Location must be between 2 and 100 characters'),

    body('timezone')
      .optional()
      .trim()
      .isLength({ min: 3, max: 50 })
      .withMessage('Timezone must be between 3 and 50 characters')
  ];
};

export const validateProfileUpdate = (): ValidationChain[] => {
  return [
    body('firstName')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('First name must be between 1 and 50 characters')
      .matches(/^[a-zA-Z\s'-]+$/)
      .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),

    body('lastName')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Last name must be between 1 and 50 characters')
      .matches(/^[a-zA-Z\s'-]+$/)
      .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),

    body('phone')
      .optional()
      .isMobilePhone('any')
      .withMessage('Please provide a valid phone number'),

    body('avatar')
      .optional()
      .isURL()
      .withMessage('Avatar must be a valid URL'),

    body('bio')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Bio must not exceed 500 characters'),

    body('location')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Location must be between 2 and 100 characters'),

    body('timezone')
      .optional()
      .trim()
      .isLength({ min: 3, max: 50 })
      .withMessage('Timezone must be between 3 and 50 characters')
  ];
};

export const validateRegistrationPreferences = (): ValidationChain[] => {
  return [
    body('preferences.emailNotifications')
      .optional()
      .isBoolean()
      .withMessage('Email notifications preference must be a boolean'),

    body('preferences.smsNotifications')
      .optional()
      .isBoolean()
      .withMessage('SMS notifications preference must be a boolean'),

    body('preferences.marketingEmails')
      .optional()
      .isBoolean()
      .withMessage('Marketing emails preference must be a boolean'),

    body('preferences.language')
      .optional()
      .isIn(['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko'])
      .withMessage('Language must be a supported language code'),

    body('preferences.currency')
      .optional()
      .isIn(['AUD', 'USD', 'EUR', 'GBP', 'CAD', 'NZD'])
      .withMessage('Currency must be a supported currency code')
  ];
};

export const validatePreferencesUpdate = (): ValidationChain[] => {
  return [
    body('emailNotifications')
      .optional()
      .isBoolean()
      .withMessage('Email notifications preference must be a boolean'),

    body('smsNotifications')
      .optional()
      .isBoolean()
      .withMessage('SMS notifications preference must be a boolean'),

    body('marketingEmails')
      .optional()
      .isBoolean()
      .withMessage('Marketing emails preference must be a boolean'),

    body('language')
      .optional()
      .isIn(['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko'])
      .withMessage('Language must be a supported language code'),

    body('currency')
      .optional()
      .isIn(['AUD', 'USD', 'EUR', 'GBP', 'CAD', 'NZD'])
      .withMessage('Currency must be a supported currency code')
  ];
};

export const validateClientProfile = (): ValidationChain[] => {
  return [
    body('companyName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Company name must be between 2 and 100 characters'),

    body('industry')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Industry must be between 2 and 50 characters'),

    body('jobsPosted')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Jobs posted must be a non-negative integer'),

    body('totalSpent')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Total spent must be a non-negative number')
  ];
};

export const validateTradieProfile = (): ValidationChain[] => {
  return [
    body('abn')
      .optional()
      .trim()
      .matches(/^\d{11}$/)
      .withMessage('ABN must be 11 digits'),

    body('qualifications')
      .optional()
      .isArray()
      .withMessage('Qualifications must be an array'),

    body('qualifications.*')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Each qualification must be between 2 and 100 characters'),

    body('hourlyRate')
      .optional()
      .isFloat({ min: 0, max: 1000 })
      .withMessage('Hourly rate must be between 0 and 1000'),

    body('serviceTypes')
      .optional()
      .isArray()
      .withMessage('Service types must be an array'),

    body('serviceTypes.*')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Each service type must be between 2 and 50 characters'),

    body('availability')
      .optional()
      .isIn(['full-time', 'part-time', 'weekends', 'evenings', 'flexible'])
      .withMessage('Availability must be one of: full-time, part-time, weekends, evenings, flexible'),

    body('skills')
      .optional()
      .isArray()
      .withMessage('Skills must be an array'),

    body('skills.*')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Each skill must be between 2 and 50 characters'),

    body('experienceYears')
      .optional()
      .isInt({ min: 0, max: 50 })
      .withMessage('Experience years must be between 0 and 50')
  ];
};

export const validateEnterpriseProfile = (): ValidationChain[] => {
  return [
    body('companyName')
      .notEmpty()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Company name is required and must be between 2 and 100 characters'),

    body('abn')
      .notEmpty()
      .trim()
      .matches(/^\d{11}$/)
      .withMessage('ABN is required and must be 11 digits'),

    body('industry')
      .notEmpty()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Industry is required and must be between 2 and 50 characters'),

    body('teamSize')
      .isInt({ min: 1, max: 10000 })
      .withMessage('Team size must be between 1 and 10000'),

    body('departments')
      .optional()
      .isArray()
      .withMessage('Departments must be an array'),

    body('departments.*')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Each department must be between 2 and 50 characters'),

    body('adminUsers')
      .optional()
      .isArray()
      .withMessage('Admin users must be an array'),

    body('adminUsers.*')
      .optional()
      .isEmail()
      .withMessage('Each admin user must be a valid email address')
  ];
};

export const validateRoleSpecificProfile = (role: string): ValidationChain[] => {
  switch (role) {
    case 'client':
      return validateClientProfile();
    case 'tradie':
      return validateTradieProfile();
    case 'enterprise':
      return validateEnterpriseProfile();
    default:
      return [];
  }
};
