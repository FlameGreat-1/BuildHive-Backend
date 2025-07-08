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
    let isReleased = false;

    const releaseClient = () => {
      if (!isReleased) {
        client.release();
        isReleased = true;
      }
    };

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
          releaseClient();
        }
      },
      rollback: async (): Promise<void> => {
        try {
          await client.query('ROLLBACK');
        } finally {
          releaseClient();
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

  async addMissingColumns(): Promise<void> {
    try {
      logger.info('Checking and adding missing columns to users table...');

      const alterQueries = [
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255);`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMP;`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255);`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP;`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0;`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;`
         ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);

      ];

      for (const query of alterQueries) {
        try {
          await this.query(query);
          logger.info(`Executed: ${query}`);
        } catch (error: any) {
          logger.warn(`Column might already exist: ${error.message}`);
        }
      }

      logger.info('Missing columns check completed');
    } catch (error) {
      logger.error('Failed to add missing columns:', error);
      throw error;
    }
  }

  async createTables(): Promise<void> {
    try {
      logger.info('Creating database tables...');

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
      logger.info('Users table created/verified');

      await this.addMissingColumns();
      
      await this.query('DROP TABLE IF EXISTS profiles CASCADE');
      await this.query('DROP TABLE IF EXISTS sessions CASCADE');

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
      logger.info('Profiles table created/verified');
      
      await this.query(createSessionsTable);
      logger.info('Sessions table created/verified');

      await this.createJobTables();
      
      logger.info('Database tables created successfully');
    } catch (error) {
      logger.error('Failed to create database tables:', error);
      throw error;
    }
  }

  async createJobTables(): Promise<void> {
    try {
      logger.info('Creating job management tables...');

      const createClientsTable = `
        CREATE TABLE IF NOT EXISTS clients (
          id SERIAL PRIMARY KEY,
          tradie_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(255) NOT NULL,
          phone VARCHAR(20) NOT NULL,
          company VARCHAR(100),
          address TEXT,
          city VARCHAR(50),
          state VARCHAR(50),
          postcode VARCHAR(10),
          notes TEXT,
          tags TEXT[] DEFAULT '{}',
          total_jobs INTEGER DEFAULT 0,
          total_revenue DECIMAL(10,2) DEFAULT 0.00,
          last_job_date TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(tradie_id, email)
        );
      `;

      const createJobsTable = `
        CREATE TABLE IF NOT EXISTS jobs (
          id SERIAL PRIMARY KEY,
          tradie_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
          title VARCHAR(200) NOT NULL,
          description TEXT NOT NULL,
          job_type VARCHAR(50) NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          priority VARCHAR(20) NOT NULL DEFAULT 'medium',
          client_name VARCHAR(100) NOT NULL,
          client_email VARCHAR(255) NOT NULL,
          client_phone VARCHAR(20) NOT NULL,
          client_company VARCHAR(100),
          site_address TEXT NOT NULL,
          site_city VARCHAR(50) NOT NULL,
          site_state VARCHAR(50) NOT NULL,
          site_postcode VARCHAR(10) NOT NULL,
          site_access_instructions TEXT,
          start_date TIMESTAMP NOT NULL,
          due_date TIMESTAMP NOT NULL,
          estimated_duration INTEGER NOT NULL,
          hours_worked DECIMAL(5,2) DEFAULT 0.00,
          notes TEXT[] DEFAULT '{}',
          tags TEXT[] DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `;

      const createMaterialsTable = `
        CREATE TABLE IF NOT EXISTS materials (
          id SERIAL PRIMARY KEY,
          job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
          name VARCHAR(200) NOT NULL,
          quantity DECIMAL(10,2) NOT NULL,
          unit VARCHAR(20) NOT NULL,
          unit_cost DECIMAL(10,2) NOT NULL,
          total_cost DECIMAL(10,2) NOT NULL,
          supplier VARCHAR(100),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `;

      const createJobAttachmentsTable = `
        CREATE TABLE IF NOT EXISTS job_attachments (
          id SERIAL PRIMARY KEY,
          job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
          filename VARCHAR(255) NOT NULL,
          original_name VARCHAR(255) NOT NULL,
          file_path TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          mime_type VARCHAR(100) NOT NULL,
          uploaded_at TIMESTAMP DEFAULT NOW()
        );
      `;

      const createQuotesTable = `
        CREATE TABLE IF NOT EXISTS quotes (
          id SERIAL PRIMARY KEY,
          tradie_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
          job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
          quote_number VARCHAR(50) UNIQUE NOT NULL,
          title VARCHAR(200) NOT NULL,
          description TEXT,
          status VARCHAR(20) NOT NULL DEFAULT 'draft',
          subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
          gst_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
          total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
          gst_enabled BOOLEAN DEFAULT TRUE,
          valid_until TIMESTAMP NOT NULL,
          terms_conditions TEXT,
          notes TEXT,
          sent_at TIMESTAMP,
          viewed_at TIMESTAMP,
          accepted_at TIMESTAMP,
          rejected_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `;
      
      -- Payment tables needed for Stripe integration
CREATE TABLE IF NOT EXISTS quote_payments (
  id SERIAL PRIMARY KEY,
  quote_id INTEGER REFERENCES quotes(id) ON DELETE CASCADE,
  payment_intent_id VARCHAR(255) UNIQUE,
  payment_id VARCHAR(255),
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'AUD',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  payment_method_type VARCHAR(50),
  stripe_customer_id VARCHAR(255),
  refund_id VARCHAR(255),
  refund_status VARCHAR(20),
  invoice_id VARCHAR(255),
  invoice_number VARCHAR(50),
  failure_reason TEXT,
  paid_at TIMESTAMP,
  refunded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_payment_methods (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  payment_method_id VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  card_brand VARCHAR(20),
  card_last4 VARCHAR(4),
  card_expiry_month INTEGER,
  card_expiry_year INTEGER,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, payment_method_id)
);

CREATE TABLE IF NOT EXISTS payment_webhooks (
  id SERIAL PRIMARY KEY,
  stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  payload JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP
);

      const createQuoteItemsTable = `
        CREATE TABLE IF NOT EXISTS quote_items (
          id SERIAL PRIMARY KEY,
          quote_id INTEGER REFERENCES quotes(id) ON DELETE CASCADE,
          item_type VARCHAR(30) NOT NULL,
          description TEXT NOT NULL,
          quantity DECIMAL(10,2) NOT NULL,
          unit VARCHAR(20) NOT NULL,
          unit_price DECIMAL(10,2) NOT NULL,
          total_price DECIMAL(12,2) NOT NULL,
          sort_order INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `;

      await this.query(createClientsTable);
      logger.info('Clients table created/verified');

      await this.query(createJobsTable);
      logger.info('Jobs table created/verified');

      await this.query(createMaterialsTable);
      logger.info('Materials table created/verified');

      await this.query(createJobAttachmentsTable);
      logger.info('Job attachments table created/verified');

      await this.query(createQuotesTable);
      logger.info('Quotes table created/verified');

      await this.query(createQuoteItemsTable);
      logger.info('Quote items table created/verified');

      await this.createJobIndexes();

      logger.info('Job management tables created successfully');
    } catch (error) {
      logger.error('Failed to create job management tables:', error);
      throw error;
    }
  }

  async createJobIndexes(): Promise<void> {
    try {
      logger.info('Creating job management indexes...');

      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_jobs_tradie_id ON jobs(tradie_id);',
        'CREATE INDEX IF NOT EXISTS idx_jobs_client_id ON jobs(client_id);',
        'CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);',
        'CREATE INDEX IF NOT EXISTS idx_jobs_job_type ON jobs(job_type);',
        'CREATE INDEX IF NOT EXISTS idx_jobs_priority ON jobs(priority);',
        'CREATE INDEX IF NOT EXISTS idx_jobs_start_date ON jobs(start_date);',
        'CREATE INDEX IF NOT EXISTS idx_jobs_due_date ON jobs(due_date);',
        'CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);',
        'CREATE INDEX IF NOT EXISTS idx_clients_tradie_id ON clients(tradie_id);',
        'CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);',
        'CREATE INDEX IF NOT EXISTS idx_materials_job_id ON materials(job_id);',
        'CREATE INDEX IF NOT EXISTS idx_job_attachments_job_id ON job_attachments(job_id);',
        'CREATE INDEX IF NOT EXISTS idx_quotes_tradie_id ON quotes(tradie_id);',
        'CREATE INDEX IF NOT EXISTS idx_quotes_client_id ON quotes(client_id);',
        'CREATE INDEX IF NOT EXISTS idx_quotes_job_id ON quotes(job_id);',
        'CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);',
        'CREATE INDEX IF NOT EXISTS idx_quotes_quote_number ON quotes(quote_number);',
        'CREATE INDEX IF NOT EXISTS idx_quotes_valid_until ON quotes(valid_until);',
        'CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON quotes(created_at);',
        'CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON quote_items(quote_id);',
        'CREATE INDEX IF NOT EXISTS idx_quote_items_sort_order ON quote_items(sort_order);'
 
CREATE INDEX IF NOT EXISTS idx_quote_payments_quote_id ON quote_payments(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_payments_payment_intent_id ON quote_payments(payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_quote_payments_status ON quote_payments(status);
CREATE INDEX IF NOT EXISTS idx_user_payment_methods_user_id ON user_payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_webhooks_stripe_event_id ON payment_webhooks(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_payment_webhooks_processed ON payment_webhooks(processed);

      ];

      for (const indexQuery of indexes) {
        try {
          await this.query(indexQuery);
        } catch (error: any) {
          logger.warn(`Index might already exist: ${error.message}`);
        }
      }

      logger.info('Job management indexes created successfully');
    } catch (error) {
      logger.error('Failed to create job management indexes:', error);
      throw error;
    }
  }

  async recreateTables(): Promise<void> {
    try {
      logger.info('Recreating database tables...');

      await this.query('DROP TABLE IF EXISTS quote_items CASCADE');
      await this.query('DROP TABLE IF EXISTS quotes CASCADE');
      await this.query('DROP TABLE IF EXISTS job_attachments CASCADE');
      await this.query('DROP TABLE IF EXISTS materials CASCADE');
      await this.query('DROP TABLE IF EXISTS jobs CASCADE');
      await this.query('DROP TABLE IF EXISTS clients CASCADE');
      await this.query('DROP TABLE IF EXISTS sessions CASCADE');
      await this.query('DROP TABLE IF EXISTS profiles CASCADE');
      await this.query('DROP TABLE IF EXISTS users CASCADE');
      await this.query('DROP TABLE IF EXISTS payment_webhooks CASCADE');
      await this.query('DROP TABLE IF EXISTS user_payment_methods CASCADE');
      await this.query('DROP TABLE IF EXISTS quote_payments CASCADE');


      await this.createTables();
      
      logger.info('Database tables recreated successfully');
    } catch (error) {
      logger.error('Failed to recreate database tables:', error);
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

export const recreateDatabase = async (): Promise<void> => {
  try {
    const isHealthy = await database.healthCheck();
    if (!isHealthy) {
      throw new Error('Database health check failed');
    }
    
    await database.recreateTables();
    
    logger.info('Database recreated successfully');
  } catch (error) {
    logger.error('Failed to recreate database:', error);
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
