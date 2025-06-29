import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// ===================================================================
// DEVELOPMENT VERSION - WITH DEFAULTS FOR MISSING ENV VARS
// ===================================================================

// Environment validation schema - Development friendly with defaults
const envSchema = z.object({
  // Server Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default(3000),
  API_VERSION: z.string().default('v1'),
  
  // Database Configuration - WITH DEVELOPMENT DEFAULTS
  DATABASE_URL: z.string().default('mongodb://localhost:27017/buildhive'),
  DATABASE_NAME: z.string().default('buildhive'),
  
  // Redis Configuration - WITH DEVELOPMENT DEFAULTS
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_PASSWORD: z.string().optional(),
  
  // JWT Configuration - WITH DEVELOPMENT DEFAULTS
  JWT_SECRET: z.string().default('dev-jwt-secret-change-in-production-must-be-32-chars-minimum'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  JWT_REFRESH_SECRET: z.string().default('dev-refresh-secret-change-in-production-32-chars-min'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  
  // Email Configuration - WITH DEVELOPMENT DEFAULTS
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.string().transform(Number).default(587),
  SMTP_USER: z.string().default('dev@buildhive.com'),
  SMTP_PASS: z.string().default('dev-password'),
  FROM_EMAIL: z.string().default('noreply@buildhive.com'),
  
  // Security
  BCRYPT_SALT_ROUNDS: z.string().transform(Number).default(12),
  SESSION_SECRET: z.string().default('dev-session-secret-change-in-production-32-chars-minimum'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default(100),
  
  // File Upload (for profile images)
  MAX_FILE_SIZE: z.string().transform(Number).default(5242880), // 5MB
  ALLOWED_IMAGE_TYPES: z.string().default('image/jpeg,image/png,image/webp'),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

// Validate environment variables - WITH GRACEFUL ERROR HANDLING
const parseEnv = () => {
  try {
    const parsed = envSchema.parse(process.env);
    
    // Warn about development defaults being used
    if (parsed.NODE_ENV === 'development') {
      const devDefaults = [];
      if (parsed.DATABASE_URL === 'mongodb://localhost:27017/buildhive') devDefaults.push('DATABASE_URL');
      if (parsed.REDIS_URL === 'redis://localhost:6379') devDefaults.push('REDIS_URL');
      if (parsed.JWT_SECRET.includes('dev-')) devDefaults.push('JWT_SECRET');
      if (parsed.SMTP_HOST === 'localhost') devDefaults.push('SMTP_HOST');
      if (parsed.SESSION_SECRET.includes('dev-')) devDefaults.push('SESSION_SECRET');
      
      if (devDefaults.length > 0) {
        console.warn(`⚠️  Using development defaults for: ${devDefaults.join(', ')}`);
        console.warn('💡 Create a .env file with proper values for production');
      }
    }
    
    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment validation failed:');
      error.errors.forEach(err => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      
      // In development, try to continue with defaults
      if (process.env.NODE_ENV !== 'production') {
        console.warn('⚠️  Attempting to use fallback defaults for development...');
        try {
          return envSchema.parse({});
        } catch (fallbackError) {
          console.error('❌ Even fallback defaults failed. Check your environment configuration.');
          throw fallbackError;
        }
      }
    }
    throw error;
  }
};

// Export validated environment configuration
export const env = parseEnv();

// Environment helper functions
export const isDevelopment = () => env.NODE_ENV === 'development';
export const isProduction = () => env.NODE_ENV === 'production';
export const isTest = () => env.NODE_ENV === 'test';

// Database configuration
export const getDatabaseConfig = () => ({
  url: env.DATABASE_URL,
  name: env.DATABASE_NAME,
  options: {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: isProduction() ? 20 : 5,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  },
});

// Redis configuration
export const getRedisConfig = () => ({
  url: env.REDIS_URL,
  password: env.REDIS_PASSWORD,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: 3,
});

// JWT configuration
export const getJWTConfig = () => ({
  secret: env.JWT_SECRET,
  expiresIn: env.JWT_EXPIRES_IN,
  refreshSecret: env.JWT_REFRESH_SECRET,
  refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
});

// Email configuration
export const getEmailConfig = () => ({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
  from: env.FROM_EMAIL,
});

export default env;

// ===================================================================
// PRODUCTION VERSION - STRICT VALIDATION (COMMENTED OUT)
// ===================================================================
// Uncomment this section when you have all environment variables configured for production

/*
import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Environment validation schema - Authentication & Profile focused
const envSchema = z.object({
  // Server Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default(3000),
  API_VERSION: z.string().default('v1'),
  
  // Database Configuration
  DATABASE_URL: z.string().min(1, 'Database URL is required'),
  DATABASE_NAME: z.string().min(1, 'Database name is required'),
  
  // Redis Configuration (for session management)
  REDIS_URL: z.string().min(1, 'Redis URL is required'),
  REDIS_PASSWORD: z.string().optional(),
  
  // JWT Configuration
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT refresh secret must be at least 32 characters'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  
  // Email Configuration (for verification)
  SMTP_HOST: z.string().min(1, 'SMTP host is required'),
  SMTP_PORT: z.string().transform(Number).default(587),
  SMTP_USER: z.string().email('Valid email required for SMTP user'),
  SMTP_PASS: z.string().min(1, 'SMTP password is required'),
  FROM_EMAIL: z.string().email('Valid from email is required'),
  
  // Security
  BCRYPT_SALT_ROUNDS: z.string().transform(Number).default(12),
  SESSION_SECRET: z.string().min(32, 'Session secret must be at least 32 characters'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default(100),
  
  // File Upload (for profile images)
  MAX_FILE_SIZE: z.string().transform(Number).default(5242880), // 5MB
  ALLOWED_IMAGE_TYPES: z.string().default('image/jpeg,image/png,image/webp'),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

// Validate environment variables
const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      throw new Error(`Environment validation failed:\n${missingVars.join('\n')}`);
    }
    throw error;
  }
};

// Export validated environment configuration
export const env = parseEnv();

// Environment helper functions
export const isDevelopment = () => env.NODE_ENV === 'development';
export const isProduction = () => env.NODE_ENV === 'production';
export const isTest = () => env.NODE_ENV === 'test';

// Database configuration
export const getDatabaseConfig = () => ({
  url: env.DATABASE_URL,
  name: env.DATABASE_NAME,
  options: {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: isProduction() ? 20 : 5,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  },
});

// Redis configuration
export const getRedisConfig = () => ({
  url: env.REDIS_URL,
  password: env.REDIS_PASSWORD,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: 3,
});

// JWT configuration
export const getJWTConfig = () => ({
  secret: env.JWT_SECRET,
  expiresIn: env.JWT_EXPIRES_IN,
  refreshSecret: env.JWT_REFRESH_SECRET,
  refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
});

// Email configuration
export const getEmailConfig = () => ({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
  from: env.FROM_EMAIL,
});

export default env;
*/
