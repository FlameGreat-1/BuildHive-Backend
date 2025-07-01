import { environment } from './environment';
import { DatabaseConnection } from '../../shared/types';

export const databaseConfig: DatabaseConnection = {
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  database: process.env.DATABASE_NAME || 'buildhive',
  username: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || '',
  ssl: environment.NODE_ENV === 'production',
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
  max: 20
};

export const redisConfig = {
  url: environment.REDIS_URL,
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  lazyConnect: true
};

export const DATABASE_TABLES = {
  USERS: 'users',
  PROFILES: 'profiles',
  SESSIONS: 'sessions'
} as const;

export const DATABASE_INDEXES = {
  USERS_EMAIL: 'idx_users_email',
  USERS_USERNAME: 'idx_users_username',
  USERS_SOCIAL_ID: 'idx_users_social_id',
  SESSIONS_USER_ID: 'idx_sessions_user_id',
  SESSIONS_TOKEN: 'idx_sessions_token'
} as const;
