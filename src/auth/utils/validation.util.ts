import { AUTH_CONSTANTS } from '../../config/auth';
import { ValidationError, UserRole } from '../../shared/types';

export const validateEmail = (email: string): ValidationError[] => {
  const errors: ValidationError[] = [];
  const requirements = AUTH_CONSTANTS.EMAIL_REQUIREMENTS;

  if (!email || email.trim().length === 0) {
    errors.push({
      field: 'email',
      message: 'Email is required',
      code: 'EMAIL_REQUIRED'
    });
    return errors;
  }

  if (email.length > requirements.MAX_LENGTH) {
    errors.push({
      field: 'email',
      message: `Email must not exceed ${requirements.MAX_LENGTH} characters`,
      code: 'EMAIL_TOO_LONG'
    });
  }

  if (!requirements.PATTERN.test(email)) {
    errors.push({
      field: 'email',
      message: 'Please provide a valid email address',
      code: 'EMAIL_INVALID_FORMAT'
    });
  }

  return errors;
};

export const validateUsername = (username: string): ValidationError[] => {
  const errors: ValidationError[] = [];
  const requirements = AUTH_CONSTANTS.USERNAME_REQUIREMENTS;

  if (!username || username.trim().length === 0) {
    errors.push({
      field: 'username',
      message: 'Username is required',
      code: 'USERNAME_REQUIRED'
    });
    return errors;
  }

  if (username.length < requirements.MIN_LENGTH) {
    errors.push({
      field: 'username',
      message: `Username must be at least ${requirements.MIN_LENGTH} characters long`,
      code: 'USERNAME_TOO_SHORT'
    });
  }

  if (username.length > requirements.MAX_LENGTH) {
    errors.push({
      field: 'username',
      message: `Username must not exceed ${requirements.MAX_LENGTH} characters`,
      code: 'USERNAME_TOO_LONG'
    });
  }

  if (!requirements.ALLOWED_PATTERN.test(username)) {
    errors.push({
      field: 'username',
      message: 'Username can only contain letters, numbers, underscores, and hyphens',
      code: 'USERNAME_INVALID_FORMAT'
    });
  }

  return errors;
};

export const validateUserRole = (role: string): ValidationError[] => {
  const errors: ValidationError[] = [];
  const validRoles = Object.values(AUTH_CONSTANTS.USER_ROLES);

  if (!role || role.trim().length === 0) {
    errors.push({
      field: 'role',
      message: 'User role is required',
      code: 'ROLE_REQUIRED'
    });
    return errors;
  }

  if (!validRoles.includes(role as UserRole)) {
    errors.push({
      field: 'role',
      message: `Role must be one of: ${validRoles.join(', ')}`,
      code: 'ROLE_INVALID'
    });
  }

  return errors;
};

export const validateRegistrationData = (data: {
  username: string;
  email: string;
  password?: string;
  role: string;
  authProvider: string;
}): ValidationError[] => {
  const errors: ValidationError[] = [];

  errors.push(...validateUsername(data.username));
  errors.push(...validateEmail(data.email));
  errors.push(...validateUserRole(data.role));

  if (data.authProvider === 'local' && data.password) {

  const validProviders = Object.values(AUTH_CONSTANTS.AUTH_PROVIDERS);
  if (!validProviders.includes(data.authProvider as any)) {
    errors.push({
      field: 'authProvider',
      message: `Auth provider must be one of: ${validProviders.join(', ')}`,
      code: 'AUTH_PROVIDER_INVALID'
    });
  }

  return errors;
};

export const sanitizeInput = (input: string): string => {
  return input.trim().toLowerCase();
};

export const sanitizeEmail = (email: string): string => {
  return email.trim().toLowerCase();
};

export const sanitizeUsername = (username: string): string => {
  return username.trim().toLowerCase();
};
