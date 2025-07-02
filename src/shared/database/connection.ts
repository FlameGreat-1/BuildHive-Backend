import { Pool, PoolClient, QueryResult } from 'pg';
import Redis from 'ioredis';
import { databaseConfig, redisConfig } from '../../config/auth';
import { DatabaseClient, DatabaseTransaction, QueryResult as CustomQueryResult } from '../types';
import { logger } from '../utils/logger.util';

class DatabaseConnection implements DatabaseClient {
  private pool: Pool;
  private redis: Redis;
  private isConnected: boolean = false;

  constructor() {
    this.pool = new Pool({
      host: databaseConfig.host,
      port: databaseConfig.port,
      database: databaseConfig.database,
      user: databaseConfig.username,
      password: databaseConfig.password,
      ssl: databaseConfig.ssl,
      connectionTimeoutMillis: databaseConfig.connectionTimeoutMillis,
      idleTimeoutMillis: databaseConfig.idleTimeoutMillis,
      max: databaseConfig.max
    });

    this.redis = new Redis(redisConfig.url, {
      enableReadyCheck: redisConfig.enableReadyCheck,
      maxRetriesPerRequest: redisConfig.maxRetriesPerRequest,
      lazyConnect: redisConfig.lazyConnect
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.pool.on('connect', () => {
      logger.info('Database connection established');
      this.isConnected = true;
    });

    this.pool.on('error', (err: any) => {
      logger.error('Database connection error:', err);
      this.isConnected = false;
    });

    this.redis.on('connect', () => {
      logger.info('Redis connection established');
    });

    this.redis.on('error', (err: any) => {
      logger.error('Redis connection error:', err);
    });
  }

  async query<T = any>(text: string, params?: any[]): Promise<CustomQueryResult<T>> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return {
        rows: result.rows,
        rowCount: result.rowCount || 0,
        command: result.command
      };
    } finally {
      client.release();
    }
  }

  async transaction(): Promise<DatabaseTransaction> {
    const client = await this.pool.connect();
    await client.query('BEGIN');

    return {
      query: async <T = any>(text: string, params?: any[]): Promise<CustomQueryResult<T>> => {
        const result = await client.query(text, params);
        return {
          rows: result.rows,
          rowCount: result.rowCount || 0,
          command: result.command
        };
      },
      commit: async (): Promise<void> => {
        try {
          await client.query('COMMIT');
        } finally {
          client.release();
        }
      },
      rollback: async (): Promise<void> => {
        try {
          await client.query('ROLLBACK');
        } finally {
          client.release();
        }
      }
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      logger.error('Database connection test failed:', error);
      return false;
    }
  }

  async createTables(): Promise<void> {
    try {
      const createUsersTable = `
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255),
          role VARCHAR(20) NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          auth_provider VARCHAR(20) NOT NULL,
          social_id VARCHAR(255),
          email_verified BOOLEAN DEFAULT FALSE,
          email_verification_token VARCHAR(255),
          email_verification_expires TIMESTAMP,
          password_reset_token VARCHAR(255),
          password_reset_expires TIMESTAMP,
          login_attempts INTEGER DEFAULT 0,
          locked_until TIMESTAMP,
          last_login_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `;

      await this.query(createUsersTable);
      
      await this.query('DROP TABLE IF EXISTS profiles CASCADE');

      const createProfilesTable = `
        CREATE TABLE IF NOT EXISTS profiles (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          first_name VARCHAR(50),
          last_name VARCHAR(50),
          phone VARCHAR(20),
          avatar VARCHAR(500),
          bio TEXT,
          location VARCHAR(100),
          timezone VARCHAR(50),
          preferences JSONB DEFAULT '{}',
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `;

      const createSessionsTable = `
        CREATE TABLE IF NOT EXISTS sessions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          token TEXT UNIQUE NOT NULL,
          type VARCHAR(50) NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `;

      await this.query(createProfilesTable);
      await this.query(createSessionsTable);
      
      logger.info('Database tables created successfully');
    } catch (error) {
      logger.error('Failed to create database tables:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.pool.end();
      try {
        await this.redis.quit();
      } catch (redisError) {
        logger.warn('Redis disconnect failed (expected if Redis unavailable):', redisError);
      }
      this.isConnected = false;
      logger.info('Database connections closed');
    } catch (error) {
      logger.error('Error closing database connections:', error);
      throw error;
    }
  }

  async end(): Promise<void> {
    await this.disconnect();
  }

  getRedisClient(): Redis {
    return this.redis;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      logger.error('Database health check failed:', error);
      return false;
    }
  }

  isHealthy(): boolean {
    return this.isConnected;
  }
}

export const database = new DatabaseConnection();

export const connectDatabase = async (): Promise<void> => {
  try {
    const isHealthy = await database.healthCheck();
    if (!isHealthy) {
      throw new Error('Database health check failed');
    }
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    throw error;
  }
};

export const initializeDatabase = async (): Promise<void> => {
  try {
    const isHealthy = await database.healthCheck();
    if (!isHealthy) {
      throw new Error('Database health check failed');
    }
    
    await database.createTables();
    
    logger.info('Database initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    throw error;
  }
};

export const closeDatabase = async (): Promise<void> => {
  try {
    await database.end();
    logger.info('Database connections closed successfully');
  } catch (error) {
    logger.error('Error closing database connections:', error);
    throw error;
  }
};

