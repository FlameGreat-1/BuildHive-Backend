import { body, ValidationChain } from 'express-validator';
import { AUTH_CONSTANTS } from '../../config/auth';
import { UserRole, AuthProvider } from '../../shared/types';

export const validateLocalRegistration = (): ValidationChain[] => {
  return [
    body('username')
      .trim()
      .isLength({ min: AUTH_CONSTANTS.USERNAME_REQUIREMENTS.MIN_LENGTH, max: AUTH_CONSTANTS.USERNAME_REQUIREMENTS.MAX_LENGTH })
      .withMessage(`Username must be between ${AUTH_CONSTANTS.USERNAME_REQUIREMENTS.MIN_LENGTH} and ${AUTH_CONSTANTS.USERNAME_REQUIREMENTS.MAX_LENGTH} characters`)
      .matches(AUTH_CONSTANTS.USERNAME_REQUIREMENTS.ALLOWED_PATTERN)
      .withMessage('Username can only contain letters, numbers, underscores, and hyphens')
      .toLowerCase(),

    body('email')
      .trim()
      .isEmail()
      .withMessage('Please provide a valid email address')
      .isLength({ max: AUTH_CONSTANTS.EMAIL_REQUIREMENTS.MAX_LENGTH })
      .withMessage(`Email must not exceed ${AUTH_CONSTANTS.EMAIL_REQUIREMENTS.MAX_LENGTH} characters`)
      .normalizeEmail(),

    body('password')
      .isLength({ min: AUTH_CONSTANTS.PASSWORD_REQUIREMENTS.MIN_LENGTH, max: AUTH_CONSTANTS.PASSWORD_REQUIREMENTS.MAX_LENGTH })
      .withMessage(`Password must be between ${AUTH_CONSTANTS.PASSWORD_REQUIREMENTS.MIN_LENGTH} and ${AUTH_CONSTANTS.PASSWORD_REQUIREMENTS.MAX_LENGTH} characters`)
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*$/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),

    body('role')
      .isIn(Object.values(AUTH_CONSTANTS.USER_ROLES))
      .withMessage(`Role must be one of: ${Object.values(AUTH_CONSTANTS.USER_ROLES).join(', ')}`),

    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Password confirmation does not match password');
        }
        return true;
      })
  ];
};

export const validateSocialRegistration = (): ValidationChain[] => {
  return [
    body('authProvider')
      .isIn([AuthProvider.GOOGLE, AuthProvider.LINKEDIN, AuthProvider.FACEBOOK])
      .withMessage('Invalid social authentication provider'),

    body('socialId')
      .notEmpty()
      .withMessage('Social ID is required')
      .isLength({ min: 1, max: 255 })
      .withMessage('Social ID must be between 1 and 255 characters'),

    body('socialData')
      .isObject()
      .withMessage('Social data must be an object'),

    body('socialData.email')
      .isEmail()
      .withMessage('Valid email is required from social provider')
      .normalizeEmail(),

    body('socialData.name')
      .notEmpty()
      .withMessage('Name is required from social provider')
      .isLength({ min: 1, max: 100 })
      .withMessage('Name must be between 1 and 100 characters'),

    body('socialData.provider')
      .isIn([AuthProvider.GOOGLE, AuthProvider.LINKEDIN, AuthProvider.FACEBOOK])
      .withMessage('Invalid social provider in social data'),

    body('role')
      .isIn(Object.values(AUTH_CONSTANTS.USER_ROLES))
      .withMessage(`Role must be one of: ${Object.values(AUTH_CONSTANTS.USER_ROLES).join(', ')}`),

    body('socialData.picture')
      .optional()
      .isURL()
      .withMessage('Profile picture must be a valid URL')
  ];
};

export const validateEmailVerification = (): ValidationChain[] => {
  return [
    body('token')
      .notEmpty()
      .withMessage('Verification token is required')
      .isLength({ min: 10 })
      .withMessage('Invalid verification token format'),

    body('email')
      .isEmail()
      .withMessage('Valid email address is required')
      .normalizeEmail()
  ];
};

export const validateResendVerification = (): ValidationChain[] => {
  return [
    body('email')
      .isEmail()
      .withMessage('Valid email address is required')
      .normalizeEmail()
  ];
};

export const validateUsernameAvailability = (): ValidationChain[] => {
  return [
    body('username')
      .trim()
      .isLength({ min: AUTH_CONSTANTS.USERNAME_REQUIREMENTS.MIN_LENGTH, max: AUTH_CONSTANTS.USERNAME_REQUIREMENTS.MAX_LENGTH })
      .withMessage(`Username must be between ${AUTH_CONSTANTS.USERNAME_REQUIREMENTS.MIN_LENGTH} and ${AUTH_CONSTANTS.USERNAME_REQUIREMENTS.MAX_LENGTH} characters`)
      .matches(AUTH_CONSTANTS.USERNAME_REQUIREMENTS.ALLOWED_PATTERN)
      .withMessage('Username can only contain letters, numbers, underscores, and hyphens')
      .toLowerCase()
  ];
};

export const validateEmailAvailability = (): ValidationChain[] => {
  return [
    body('email')
      .isEmail()
      .withMessage('Valid email address is required')
      .isLength({ max: AUTH_CONSTANTS.EMAIL_REQUIREMENTS.MAX_LENGTH })
      .withMessage(`Email must not exceed ${AUTH_CONSTANTS.EMAIL_REQUIREMENTS.MAX_LENGTH} characters`)
      .normalizeEmail()
  ];
};
