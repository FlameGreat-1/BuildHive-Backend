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

export const validatePassword = (password: string): ValidationError[] => {
  const errors: ValidationError[] = [];
  const requirements = AUTH_CONSTANTS.PASSWORD_REQUIREMENTS;

  if (!password || password.trim().length === 0) {
    errors.push({
      field: 'password',
      message: 'Password is required',
      code: 'PASSWORD_REQUIRED'
    });
    return errors;
  }

  if (password.length < requirements.MIN_LENGTH) {
    errors.push({
      field: 'password',
      message: `Password must be at least ${requirements.MIN_LENGTH} characters long`,
      code: 'PASSWORD_TOO_SHORT'
    });
  }

  if (password.length > requirements.MAX_LENGTH) {
    errors.push({
      field: 'password',
      message: `Password must not exceed ${requirements.MAX_LENGTH} characters`,
      code: 'PASSWORD_TOO_LONG'
    });
  }

  if (requirements.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    errors.push({
      field: 'password',
      message: 'Password must contain at least one uppercase letter',
      code: 'PASSWORD_MISSING_UPPERCASE'
    });
  }

  if (requirements.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    errors.push({
      field: 'password',
      message: 'Password must contain at least one lowercase letter',
      code: 'PASSWORD_MISSING_LOWERCASE'
    });
  }

  if (requirements.REQUIRE_NUMBERS && !/\d/.test(password)) {
    errors.push({
      field: 'password',
      message: 'Password must contain at least one number',
      code: 'PASSWORD_MISSING_NUMBER'
    });
  }

  if (requirements.REQUIRE_SPECIAL_CHARS && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push({
      field: 'password',
      message: 'Password must contain at least one special character',
      code: 'PASSWORD_MISSING_SPECIAL'
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

export const validateLoginCredentials = (data: {
  email: string;
  password: string;
}): ValidationError[] => {
  const errors: ValidationError[] = [];

  errors.push(...validateEmail(data.email));

  if (!data.password || data.password.trim().length === 0) {
    errors.push({
      field: 'password',
      message: 'Password is required',
      code: 'PASSWORD_REQUIRED'
    });
  }

  return errors;
};

export const validatePasswordReset = (data: {
  token: string;
  newPassword: string;
  confirmPassword: string;
}): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!data.token || data.token.trim().length === 0) {
    errors.push({
      field: 'token',
      message: 'Reset token is required',
      code: 'TOKEN_REQUIRED'
    });
  }

  errors.push(...validatePassword(data.newPassword));

  if (!data.confirmPassword || data.confirmPassword.trim().length === 0) {
    errors.push({
      field: 'confirmPassword',
      message: 'Password confirmation is required',
      code: 'CONFIRM_PASSWORD_REQUIRED'
    });
  }

  if (data.newPassword !== data.confirmPassword) {
    errors.push({
      field: 'confirmPassword',
      message: 'Passwords do not match',
      code: 'PASSWORDS_MISMATCH'
    });
  }

  return errors;
};

export const validateChangePassword = (data: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!data.currentPassword || data.currentPassword.trim().length === 0) {
    errors.push({
      field: 'currentPassword',
      message: 'Current password is required',
      code: 'CURRENT_PASSWORD_REQUIRED'
    });
  }

  errors.push(...validatePassword(data.newPassword));

  if (!data.confirmPassword || data.confirmPassword.trim().length === 0) {
    errors.push({
      field: 'confirmPassword',
      message: 'Password confirmation is required',
      code: 'CONFIRM_PASSWORD_REQUIRED'
    });
  }

  if (data.newPassword !== data.confirmPassword) {
    errors.push({
      field: 'confirmPassword',
      message: 'Passwords do not match',
      code: 'PASSWORDS_MISMATCH'
    });
  }

  if (data.currentPassword === data.newPassword) {
    errors.push({
      field: 'newPassword',
      message: 'New password must be different from current password',
      code: 'SAME_PASSWORD'
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

  if (data.password && data.authProvider === 'local') {
    errors.push(...validatePassword(data.password));
  }

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

export const validatePasswordResetRequest = (data: {
  email: string;
}): ValidationError[] => {
  const errors: ValidationError[] = [];

  errors.push(...validateEmail(data.email));

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

export const isPasswordStrong = (password: string): boolean => {
  const requirements = AUTH_CONSTANTS.PASSWORD_REQUIREMENTS;
  
  if (password.length < requirements.MIN_LENGTH) return false;
  if (requirements.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) return false;
  if (requirements.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) return false;
  if (requirements.REQUIRE_NUMBERS && !/\d/.test(password)) return false;
  if (requirements.REQUIRE_SPECIAL_CHARS && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) return false;
  
  return true;
};

export const getPasswordStrength = (password: string): {
  score: number;
  feedback: string[];
} => {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 8) score += 1;
  else feedback.push('Use at least 8 characters');

  if (/[A-Z]/.test(password)) score += 1;
  else feedback.push('Include uppercase letters');

  if (/[a-z]/.test(password)) score += 1;
  else feedback.push('Include lowercase letters');

  if (/\d/.test(password)) score += 1;
  else feedback.push('Include numbers');

  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;
  else feedback.push('Include special characters');

  return { score, feedback };
};
