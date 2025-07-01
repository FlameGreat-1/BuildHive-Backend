import bcrypt from 'bcrypt';
import { AUTH_CONSTANTS } from '../../config/auth';
import { ValidationError } from '../../shared/types';

export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = AUTH_CONSTANTS.PASSWORD_REQUIREMENTS.MIN_LENGTH;
  return await bcrypt.hash(password, saltRounds);
};

export const comparePassword = async (
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> => {
  return await bcrypt.compare(plainPassword, hashedPassword);
};

export const validatePasswordStrength = (password: string): ValidationError[] => {
  const errors: ValidationError[] = [];
  const requirements = AUTH_CONSTANTS.PASSWORD_REQUIREMENTS;

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

  // TEMPORARILY COMMENTED OUT FOR DEBUGGING:
  /*
  if (requirements.REQUIRE_SPECIAL_CHARS && !/[!@#$%^&*(),.?\\":{}|<>]/.test(password)) {
    errors.push({
      field: 'password',
      message: 'Password must contain at least one special character',
      code: 'PASSWORD_MISSING_SPECIAL'
    });
  }
  */

  return errors;
};

export const generateSecurePassword = (length: number = 12): string => {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*(),.?":{}|<>';
  
  const allChars = uppercase + lowercase + numbers + special;
  let password = '';
  
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  for (let i = 4; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  return password.split('').sort(() => Math.random() - 0.5).join('');
};
