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
  EMAIL_FROM: process.env.EMAIL_FROM || 'BuildHive noreply@buildhive.com',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  
  // Stripe Configuration
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
  
  // Apple Pay Configuration
  APPLE_PAY_MERCHANT_ID: process.env.APPLE_PAY_MERCHANT_ID || '',
  APPLE_PAY_DOMAIN: process.env.APPLE_PAY_DOMAIN || '',
  
  // Google Pay Configuration
  GOOGLE_PAY_MERCHANT_ID: process.env.GOOGLE_PAY_MERCHANT_ID || '',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  
  // Social Auth Configuration
  LINKEDIN_CLIENT_ID: process.env.LINKEDIN_CLIENT_ID || '',
  LINKEDIN_CLIENT_SECRET: process.env.LINKEDIN_CLIENT_SECRET || '',
  FACEBOOK_APP_ID: process.env.FACEBOOK_APP_ID || '',
  FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET || '',
  
  // Firebase/Firestore Configuration
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID!,
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL!,
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY!,
  FIREBASE_DATABASE_URL: process.env.FIREBASE_DATABASE_URL!,
  FIREBASE_API_KEY: process.env.FIREBASE_API_KEY || '',
  FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN || '',
  FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET || '',
  FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
  FIREBASE_APP_ID: process.env.FIREBASE_APP_ID || '',
  FIREBASE_TOKEN: process.env.FIREBASE_TOKEN!,
  
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
    'CORS_ORIGIN',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'FIREBASE_PROJECT_ID',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_PRIVATE_KEY',
    'FIREBASE_DATABASE_URL',
    'FIREBASE_TOKEN'
  ];
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
};

