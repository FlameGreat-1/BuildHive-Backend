// Import all validators
import registerValidators from './register.validator';
import loginValidators from './login.validator';
import profileValidators from './profile.validator';

// Export individual schemas
export { registerSchema } from './register.validator';
export { 
  loginSchema, 
  forgotPasswordSchema, 
  resetPasswordSchema, 
  changePasswordSchema, 
  refreshTokenSchema 
} from './login.validator';
export { 
  createProfileSchema, 
  updateProfileSchema, 
  tradieProfileSchema, 
  searchProfilesSchema, 
  uploadImageSchema 
} from './profile.validator';

// Export grouped validators
export const authValidationSchemas = {
  ...registerValidators,
  ...loginValidators
};

export const profileValidationSchemas = {
  ...profileValidators
};

export const validationSchemas = {
  ...authValidationSchemas,
  ...profileValidationSchemas
};

// Default export
export default {
  auth: authValidationSchemas,
  profile: profileValidationSchemas,
  all: validationSchemas
};
