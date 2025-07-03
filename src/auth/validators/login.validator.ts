import { body, ValidationChain } from 'express-validator';
import { AUTH_CONSTANTS } from '../../config/auth';

export const validateLogin = (): ValidationChain[] => {
  return [
    body('email')
      .trim()
      .isEmail()
      .withMessage('Please provide a valid email address')
      .normalizeEmail(),

    body('password')
      .notEmpty()
      .withMessage('Password is required'),

    body('rememberMe')
      .optional()
      .isBoolean()
      .withMessage('Remember me must be a boolean value')
  ];
};

export const validateRefreshToken = (): ValidationChain[] => {
  return [
    body('refreshToken')
      .notEmpty()
      .withMessage('Refresh token is required')
      .isLength({ min: 10 })
      .withMessage('Invalid refresh token format')
  ];
};

export const validatePasswordResetRequest = (): ValidationChain[] => {
  return [
    body('email')
      .trim()
      .isEmail()
      .withMessage('Please provide a valid email address')
      .normalizeEmail()
  ];
};

export const validatePasswordResetConfirm = (): ValidationChain[] => {
  return [
    body('token')
      .notEmpty()
      .withMessage('Reset token is required')
      .isLength({ min: 10 })
      .withMessage('Invalid reset token format'),

    body('newPassword')
      .isLength({ min: AUTH_CONSTANTS.PASSWORD_REQUIREMENTS.MIN_LENGTH, max: AUTH_CONSTANTS.PASSWORD_REQUIREMENTS.MAX_LENGTH })
      .withMessage(`Password must be between ${AUTH_CONSTANTS.PASSWORD_REQUIREMENTS.MIN_LENGTH} and ${AUTH_CONSTANTS.PASSWORD_REQUIREMENTS.MAX_LENGTH} characters`)
      .custom((value) => {
        if (AUTH_CONSTANTS.PASSWORD_REQUIREMENTS.REQUIRE_UPPERCASE && !/[A-Z]/.test(value)) {
          throw new Error('Password must contain at least one uppercase letter');
        }
        if (AUTH_CONSTANTS.PASSWORD_REQUIREMENTS.REQUIRE_LOWERCASE && !/[a-z]/.test(value)) {
          throw new Error('Password must contain at least one lowercase letter');
        }
        if (AUTH_CONSTANTS.PASSWORD_REQUIREMENTS.REQUIRE_NUMBERS && !/\d/.test(value)) {
          throw new Error('Password must contain at least one number');
        }
        // TODO: Re-enable special character validation later
        // Temporarily disabled special character validation for testing
        // if (AUTH_CONSTANTS.PASSWORD_REQUIREMENTS.REQUIRE_SPECIAL_CHARS && !/[!@#$%^&*(),.?":{}|<>]/.test(value)) {
        //   throw new Error('Password must contain at least one special character');
        // }
        return true;
      }),

    body('confirmPassword')
      .custom((value, { req }) => {
      console.log('DEBUG CHANGE PASSWORD - req.body.newPassword:', JSON.stringify(req.body.newPassword));
     console.log('DEBUG CHANGE PASSWORD - confirmPassword value:', JSON.stringify(value));
     console.log('DEBUG CHANGE PASSWORD - Are they equal?:', value === req.body.newPassword);
       

        if (value !== req.body.newPassword) {
          throw new Error('Password confirmation does not match new password');
        }
        return true;
      })
  ];
};

export const validateChangePassword = (): ValidationChain[] => {
  return [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),

    body('newPassword')
      .isLength({ min: AUTH_CONSTANTS.PASSWORD_REQUIREMENTS.MIN_LENGTH, max: AUTH_CONSTANTS.PASSWORD_REQUIREMENTS.MAX_LENGTH })
      .withMessage(`Password must be between ${AUTH_CONSTANTS.PASSWORD_REQUIREMENTS.MIN_LENGTH} and ${AUTH_CONSTANTS.PASSWORD_REQUIREMENTS.MAX_LENGTH} characters`)
      .custom((value, { req }) => {
        if (value === req.body.currentPassword) {
          throw new Error('New password must be different from current password');
        }
        if (AUTH_CONSTANTS.PASSWORD_REQUIREMENTS.REQUIRE_UPPERCASE && !/[A-Z]/.test(value)) {
          throw new Error('Password must contain at least one uppercase letter');
        }
        if (AUTH_CONSTANTS.PASSWORD_REQUIREMENTS.REQUIRE_LOWERCASE && !/[a-z]/.test(value)) {
          throw new Error('Password must contain at least one lowercase letter');
        }
        if (AUTH_CONSTANTS.PASSWORD_REQUIREMENTS.REQUIRE_NUMBERS && !/\d/.test(value)) {
          throw new Error('Password must contain at least one number');
        }
        // TODO: Re-enable special character validation later
        // Temporarily disabled special character validation for testing
        // if (AUTH_CONSTANTS.PASSWORD_REQUIREMENTS.REQUIRE_SPECIAL_CHARS && !/[!@#$%^&*(),.?":{}|<>]/.test(value)) {
        //   throw new Error('Password must contain at least one special character');
        // }
        return true;
      }),

    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== req.body.newPassword) {
          throw new Error('Password confirmation does not match new password');
        }
        return true;
      })
  ];
};

export const validateLogout = (): ValidationChain[] => {
  return [
    body('refreshToken')
      .optional()
      .isLength({ min: 10 })
      .withMessage('Invalid refresh token format'),

    body('logoutAllDevices')
      .optional()
      .isBoolean()
      .withMessage('Logout all devices must be a boolean value')
  ];
};
