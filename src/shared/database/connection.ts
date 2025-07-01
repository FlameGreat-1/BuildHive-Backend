import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
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
      retryDelayOnFailover: redisConfig.retryDelayOnFailover,
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

  async query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<CustomQueryResult<T>> {
    const client = await this.pool.connect();
    try {
      const result: QueryResult<T> = await client.query<T>(text, params);
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
      query: async <T extends QueryResultRow = any>(text: string, params?: any[]): Promise<CustomQueryResult<T>> => {
        const result: QueryResult<T> = await client.query<T>(text, params);
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
      await this.redis.ping();
      return true;
    } catch (error) {
      logger.error('Database connection test failed:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.pool.end();
      await this.redis.quit();
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
      await this.redis.ping();
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
