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
      .isLength({ max: 200 })
      .withMessage('Bio must not exceed 200 characters'),

    body('location')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Location must be between 2 and 100 characters')
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
      .isIn(['en'])
      .withMessage('Language must be: en'),

    body('preferences.currency')
      .optional()
      .isIn(['AUD'])
      .withMessage('Currency must be: AUD')
  ];
};
