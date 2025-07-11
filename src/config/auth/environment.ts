import { config } from 'dotenv';

config();

export const environment = {
  NODE_ENV: process.env.NODE_ENV!,
  PORT: parseInt(process.env.PORT!, 10),
  HOST: '0.0.0.0',
  
  JWT_SECRET: process.env.JWT_SECRET!,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  
  BCRYPT_SALT_ROUNDS: 12,
  
  DATABASE_URL: process.env.DATABASE_URL!,
  
  DB_HOST: process.env.DB_HOST || process.env.DATABASE_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT || process.env.DATABASE_PORT || '5432'),
  DB_NAME: process.env.DB_NAME || process.env.DATABASE_NAME || 'buildhive',
  DB_USER: process.env.DB_USER || process.env.DATABASE_USER || 'postgres',
  DB_PASSWORD: process.env.DB_PASSWORD || process.env.DATABASE_PASSWORD || '',
  DB_SSL: process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production',
  DB_CONNECTION_TIMEOUT: parseInt(process.env.DB_CONNECTION_TIMEOUT || '30000'),
  DB_IDLE_TIMEOUT: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
  DB_MAX_CONNECTIONS: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
  
  EMAIL_SERVICE: 'gmail',
  EMAIL_USER: process.env.EMAIL_USER || '',
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD || '',
  EMAIL_FROM: process.env.EMAIL_FROM || 'BuildHive <noreply@buildhive.com>',
  
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  
  LINKEDIN_CLIENT_ID: process.env.LINKEDIN_CLIENT_ID || '',
  LINKEDIN_CLIENT_SECRET: process.env.LINKEDIN_CLIENT_SECRET || '',
  
  FACEBOOK_APP_ID: process.env.FACEBOOK_APP_ID || '',
  FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET || '',
  
  REDIS_URL: process.env.REDIS_URL!,
  
  RATE_LIMIT_WINDOW_MS: 900000,
  RATE_LIMIT_MAX_REQUESTS: 100,
  
  CORS_ORIGIN: process.env.CORS_ORIGIN!,
  
  LOG_LEVEL: 'info'
} as const;

export const validateEnvironment = (): void => {
  const requiredVars = [
    'NODE_ENV',
    'PORT', 
    'JWT_SECRET',
    'DATABASE_URL',
    'REDIS_URL',
    'CORS_ORIGIN'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
};
