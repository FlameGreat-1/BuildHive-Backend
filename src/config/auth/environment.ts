import { config } from 'dotenv';

config();

// ORIGINAL PRODUCTION CODE (COMMENTED OUT FOR TESTING PHASE)
/*
export const environment = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  
  JWT_SECRET: process.env.JWT_SECRET || '',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  
  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
  
  EMAIL_SERVICE: process.env.EMAIL_SERVICE || 'gmail',
  EMAIL_USER: process.env.EMAIL_USER || '',
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD || '',
  EMAIL_FROM: process.env.EMAIL_FROM || '',
  
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  
  LINKEDIN_CLIENT_ID: process.env.LINKEDIN_CLIENT_ID || '',
  LINKEDIN_CLIENT_SECRET: process.env.LINKEDIN_CLIENT_SECRET || '',
  
  FACEBOOK_APP_ID: process.env.FACEBOOK_APP_ID || '',
  FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET || '',
  
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  
  LOG_LEVEL: process.env.LOG_LEVEL || 'info'
} as const;

export const validateEnvironment = (): void => {
  const requiredVars = [
    'JWT_SECRET',
    'DATABASE_URL',
    'EMAIL_USER',
    'EMAIL_PASSWORD'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
};
*/

// TEMPORARY TESTING IMPLEMENTATION WITH DUMMY VALUES
export const environment = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  HOST: process.env.HOST || '0.0.0.0',
  
  JWT_SECRET: process.env.JWT_SECRET || 'buildhive-temp-jwt-secret-key-for-testing-only-2024',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  
  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
  
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://localhost:5432/buildhive_test',
  
  EMAIL_SERVICE: process.env.EMAIL_SERVICE || 'gmail',
  EMAIL_USER: process.env.EMAIL_USER || 'test@buildhive.com',
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD || 'temp-email-password',
  EMAIL_FROM: process.env.EMAIL_FROM || 'BuildHive <noreply@buildhive.com>',
  
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || 'dummy-google-client-id',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || 'dummy-google-client-secret',
  
  LINKEDIN_CLIENT_ID: process.env.LINKEDIN_CLIENT_ID || 'dummy-linkedin-client-id',
  LINKEDIN_CLIENT_SECRET: process.env.LINKEDIN_CLIENT_SECRET || 'dummy-linkedin-client-secret',
  
  FACEBOOK_APP_ID: process.env.FACEBOOK_APP_ID || 'dummy-facebook-app-id',
  FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET || 'dummy-facebook-app-secret',
  
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  
  LOG_LEVEL: process.env.LOG_LEVEL || 'info'
} as const;

// TEMPORARY: Disabled validation for testing phase
export const validateEnvironment = (): void => {
  console.log('Environment validation disabled for testing phase');
  // Validation will be re-enabled in production
};
