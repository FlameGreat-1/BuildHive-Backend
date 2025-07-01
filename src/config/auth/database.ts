import { environment } from './environment';
import { DatabaseConnection } from '../../shared/types';

const parseDatabaseUrl = (url: string) => {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port) || 5432,
    database: parsed.pathname.slice(1),
    username: parsed.username,
    password: parsed.password,
    ssl: true,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
    max: 20
  };
};

export const databaseConfig: DatabaseConnection = parseDatabaseUrl(process.env.DATABASE_URL!);

export const redisConfig = {
  url: process.env.REDIS_URL!,
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

