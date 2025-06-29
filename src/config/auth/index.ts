// Authentication & Profile Configuration Module Exports
// Centralized export for all auth-related configurations

// Environment configuration
export {
  env,
  isDevelopment,
  isProduction,
  isTest,
  getDatabaseConfig,
  getRedisConfig,
  getJWTConfig,
  getEmailConfig,
  default as environment,
} from './environment';

// Constants and types
export {
  USER_ROLES,
  USER_STATUS,
  VERIFICATION_STATUS,
  TOKEN_TYPES,
  SESSION_CONFIG,
  PASSWORD_CONFIG,
  UPLOAD_CONFIG,
  BUSINESS_CONFIG,
  SERVICE_CATEGORIES,
  RATE_LIMITS,
  VALIDATION_MESSAGES,
  RESPONSE_MESSAGES,
  HTTP_STATUS,
  COLLECTIONS,
  CACHE_KEYS,
  EVENTS,
  default as constants,
} from './constants';

// Type exports
export type {
  UserRole,
  UserStatus,
  VerificationStatus,
  TokenType,
  ServiceCategory,
} from './constants';

// Database configuration
export {
  databaseManager,
  connectDatabase,
  disconnectDatabase,
  getDatabaseHealth,
  getSchemaOptions,
  collections,
  redisClient,
  default as database,
} from './database';

// Re-export commonly used configurations as a single object
export const authConfig = {
  jwt: getJWTConfig(),
  email: getEmailConfig(),
  database: getDatabaseConfig(),
  redis: getRedisConfig(),
  session: SESSION_CONFIG,
  password: PASSWORD_CONFIG,
  upload: UPLOAD_CONFIG,
  business: BUSINESS_CONFIG,
  rateLimits: RATE_LIMITS,
} as const;

// Configuration validation function
export const validateAuthConfig = (): boolean => {
  try {
    const requiredConfigs = [
      env.JWT_SECRET,
      env.DATABASE_URL,
      env.REDIS_URL,
      env.SMTP_HOST,
      env.SMTP_USER,
    ];

    const missingConfigs = requiredConfigs.filter(config => !config);
    
    if (missingConfigs.length > 0) {
      throw new Error('Missing required authentication configurations');
    }

    return true;
  } catch (error) {
    console.error('❌ Auth configuration validation failed:', error);
    return false;
  }
};

// Initialize auth configuration
export const initializeAuthConfig = async (): Promise<void> => {
  console.log('🔧 Initializing authentication configuration...');
  
  if (!validateAuthConfig()) {
    throw new Error('Authentication configuration validation failed');
  }

  try {
    // Initialize database connections
    await connectDatabase();
    console.log('✅ Authentication configuration initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize authentication configuration:', error);
    throw error;
  }
};

export default {
  environment,
  constants,
  database,
  authConfig,
  validateAuthConfig,
  initializeAuthConfig,
};
