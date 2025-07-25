import { Pool, PoolClient, QueryResult } from 'pg';
import Redis from 'ioredis';
import { databaseConfig, redisConfig } from '../../config/auth';
import { DatabaseClient, DatabaseTransaction, QueryResult as CustomQueryResult } from '../types';
import { logger } from '../utils/logger.util';
import { initializeApp, cert, App, ServiceAccount, deleteApp } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { environment } from '../../config/auth';

export class DatabaseConnection implements DatabaseClient {
  private pool: Pool;
  private redis: Redis;
  private isConnected: boolean = false;
  private firebaseApp: App | null = null;
  private firestore: Firestore | null = null;
  private isFirestoreConnected: boolean = false;

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

    this.initializeFirebase();
    this.setupEventHandlers();
  }

  private initializeFirebase(): void {
    try {
      const serviceAccount: ServiceAccount = {
        projectId: environment.FIREBASE_PROJECT_ID,
        privateKey: environment.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: environment.FIREBASE_CLIENT_EMAIL
      };
      this.firebaseApp = initializeApp({
        credential: cert(serviceAccount),
        databaseURL: environment.FIREBASE_DATABASE_URL
      });

      this.firestore = getFirestore(this.firebaseApp);
      this.isFirestoreConnected = true;
      
      logger.info('Firebase/Firestore connection established');
    } catch (error) {
      logger.error('Firebase/Firestore connection error:', error);
      this.isFirestoreConnected = false;
    }
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
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS credit_balance INTEGER DEFAULT 0;`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_usage INTEGER DEFAULT 0;`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_usage INTEGER DEFAULT 0;`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_spent DECIMAL(10,2) DEFAULT 0.00;`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_spent DECIMAL(10,2) DEFAULT 0.00;`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_transactions INTEGER DEFAULT 0;`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_transactions INTEGER DEFAULT 0;`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_id INTEGER;`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20);`
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

  async addMarketplaceColumns(): Promise<void> {
    try {
      logger.info('Adding marketplace-specific columns...');

      const marketplaceAlterQueries = [
        `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS marketplace_job_id INTEGER;`,
        `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) DEFAULT 'direct';`,
        `ALTER TABLE credit_transactions ADD COLUMN IF NOT EXISTS marketplace_job_id INTEGER;`,
        `ALTER TABLE credit_transactions ADD COLUMN IF NOT EXISTS application_id INTEGER;`,
        `ALTER TABLE credit_transactions ADD COLUMN IF NOT EXISTS urgency_multiplier DECIMAL(3,2) DEFAULT 1.00;`,
        `ALTER TABLE credit_transactions ADD COLUMN IF NOT EXISTS job_type_multiplier DECIMAL(3,2) DEFAULT 1.00;`
      ];

      for (const query of marketplaceAlterQueries) {
        try {
          await this.query(query);
          logger.info(`Executed: ${query}`);
        } catch (error: any) {
          logger.warn(`Column might already exist: ${error.message}`);
        }
      }

      logger.info('Marketplace columns added successfully');
    } catch (error) {
      logger.error('Failed to add marketplace columns:', error);
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
          stripe_customer_id VARCHAR(255),
          credit_balance INTEGER DEFAULT 0,
          daily_usage INTEGER DEFAULT 0,
          monthly_usage INTEGER DEFAULT 0,
          daily_spent DECIMAL(10,2) DEFAULT 0.00,
          monthly_spent DECIMAL(10,2) DEFAULT 0.00,
          daily_transactions INTEGER DEFAULT 0,
          monthly_transactions INTEGER DEFAULT 0,
          subscription_id INTEGER,
          subscription_status VARCHAR(20),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `;

      await this.query(createUsersTable);
      logger.info('Users table created/verified');

      await this.addMissingColumns();
      await this.addMarketplaceColumns();
      
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
      await this.createPaymentTables();
      await this.createMarketplaceTables();
      
      logger.info('Database tables created successfully');
    } catch (error) {
      logger.error('Failed to create database tables:', error);
      throw error;
    }
  }

  async createMarketplaceTables(): Promise<void> {
    try {
      logger.info('Creating marketplace tables...');

      const createMarketplaceJobsTable = `
        CREATE TABLE IF NOT EXISTS marketplace_jobs (
          id SERIAL PRIMARY KEY,
          client_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          title VARCHAR(200) NOT NULL,
          description TEXT NOT NULL,
          job_type VARCHAR(50) NOT NULL,
          location VARCHAR(100) NOT NULL,
          estimated_budget DECIMAL(12,2),
          date_required TIMESTAMP NOT NULL,
          urgency_level VARCHAR(20) NOT NULL DEFAULT 'medium',
          photos TEXT[] DEFAULT '{}',
          status VARCHAR(20) NOT NULL DEFAULT 'available',
          application_count INTEGER DEFAULT 0,
          view_count INTEGER DEFAULT 0,
          client_name VARCHAR(100) NOT NULL,
          client_email VARCHAR(255) NOT NULL,
          client_phone VARCHAR(20) NOT NULL,
          client_company VARCHAR(100),
          expires_at TIMESTAMP,
          source_type VARCHAR(20) DEFAULT 'marketplace',
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `;

      const createJobApplicationsTable = `
        CREATE TABLE IF NOT EXISTS job_applications (
          id SERIAL PRIMARY KEY,
          marketplace_job_id INTEGER REFERENCES marketplace_jobs(id) ON DELETE CASCADE,
          tradie_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          custom_quote DECIMAL(12,2) NOT NULL,
          proposed_timeline TEXT NOT NULL,
          approach_description TEXT NOT NULL,
          materials_list TEXT,
          availability_dates TEXT[] NOT NULL,
          cover_message TEXT,
          relevant_experience TEXT,
          additional_photos TEXT[] DEFAULT '{}',
          questions_for_client TEXT,
          special_offers TEXT,
          credits_used INTEGER NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'submitted',
          application_timestamp TIMESTAMP DEFAULT NOW(),
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(marketplace_job_id, tradie_id)
        );
      `;

      const createMarketplaceJobAssignmentsTable = `
        CREATE TABLE IF NOT EXISTS marketplace_job_assignments (
          id SERIAL PRIMARY KEY,
          marketplace_job_id INTEGER REFERENCES marketplace_jobs(id) ON DELETE CASCADE,
          selected_tradie_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          selected_application_id INTEGER REFERENCES job_applications(id) ON DELETE CASCADE,
          existing_job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
          selection_reason TEXT,
          negotiated_quote DECIMAL(12,2),
          project_start_date TIMESTAMP,
          assignment_timestamp TIMESTAMP DEFAULT NOW(),
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(marketplace_job_id)
        );
      `;

      const createMarketplaceNotificationsTable = `
        CREATE TABLE IF NOT EXISTS marketplace_notifications (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          notification_type VARCHAR(50) NOT NULL,
          title VARCHAR(200) NOT NULL,
          message TEXT NOT NULL,
          read BOOLEAN DEFAULT FALSE,
          marketplace_job_id INTEGER REFERENCES marketplace_jobs(id) ON DELETE SET NULL,
          application_id INTEGER REFERENCES job_applications(id) ON DELETE SET NULL,
          assignment_id INTEGER REFERENCES marketplace_job_assignments(id) ON DELETE SET NULL,
          metadata JSONB DEFAULT '{}',
          expires_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          read_at TIMESTAMP
        );
      `;

      const createMarketplaceAnalyticsTable = `
        CREATE TABLE IF NOT EXISTS marketplace_analytics (
          id SERIAL PRIMARY KEY,
          date DATE NOT NULL,
          total_jobs_posted INTEGER DEFAULT 0,
          total_applications INTEGER DEFAULT 0,
          total_credits_spent INTEGER DEFAULT 0,
          total_assignments INTEGER DEFAULT 0,
          average_applications_per_job DECIMAL(5,2) DEFAULT 0.00,
          conversion_rate DECIMAL(5,4) DEFAULT 0.0000,
          top_job_types JSONB DEFAULT '{}',
          top_locations JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(date)
        );
      `;

      const createTradieMarketplaceStatsTable = `
        CREATE TABLE IF NOT EXISTS tradie_marketplace_stats (
          id SERIAL PRIMARY KEY,
          tradie_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
          total_applications INTEGER DEFAULT 0,
          successful_applications INTEGER DEFAULT 0,
          total_credits_spent INTEGER DEFAULT 0,
          conversion_rate DECIMAL(5,4) DEFAULT 0.0000,
          average_quote DECIMAL(12,2) DEFAULT 0.00,
          last_application_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `;

      const createClientMarketplaceStatsTable = `
        CREATE TABLE IF NOT EXISTS client_marketplace_stats (
          id SERIAL PRIMARY KEY,
          client_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
          total_jobs_posted INTEGER DEFAULT 0,
          total_applications_received INTEGER DEFAULT 0,
          total_hires_made INTEGER DEFAULT 0,
          average_applications_per_job DECIMAL(5,2) DEFAULT 0.00,
          average_hire_time_hours DECIMAL(8,2) DEFAULT 0.00,
          last_job_posted_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `;

      await this.query(createMarketplaceJobsTable);
      logger.info('Marketplace jobs table created/verified');

      await this.query(createJobApplicationsTable);
      logger.info('Job applications table created/verified');

      await this.query(createMarketplaceJobAssignmentsTable);
      logger.info('Marketplace job assignments table created/verified');

      await this.query(createMarketplaceNotificationsTable);
      logger.info('Marketplace notifications table created/verified');

      await this.query(createMarketplaceAnalyticsTable);
      logger.info('Marketplace analytics table created/verified');

      await this.query(createTradieMarketplaceStatsTable);
      logger.info('Tradie marketplace stats table created/verified');

      await this.query(createClientMarketplaceStatsTable);
      logger.info('Client marketplace stats table created/verified');

      await this.createMarketplaceIndexes();

      logger.info('Marketplace tables created successfully');
    } catch (error) {
      logger.error('Failed to create marketplace tables:', error);
      throw error;
    }
  }

  async createMarketplaceIndexes(): Promise<void> {
    try {
      logger.info('Creating marketplace indexes...');

      const marketplaceIndexes = [
        'CREATE INDEX IF NOT EXISTS idx_marketplace_jobs_client_id ON marketplace_jobs(client_id);',
        'CREATE INDEX IF NOT EXISTS idx_marketplace_jobs_job_type ON marketplace_jobs(job_type);',
        'CREATE INDEX IF NOT EXISTS idx_marketplace_jobs_location ON marketplace_jobs(location);',
        'CREATE INDEX IF NOT EXISTS idx_marketplace_jobs_status ON marketplace_jobs(status);',
        'CREATE INDEX IF NOT EXISTS idx_marketplace_jobs_urgency_level ON marketplace_jobs(urgency_level);',
        'CREATE INDEX IF NOT EXISTS idx_marketplace_jobs_date_required ON marketplace_jobs(date_required);',
        'CREATE INDEX IF NOT EXISTS idx_marketplace_jobs_estimated_budget ON marketplace_jobs(estimated_budget);',
        'CREATE INDEX IF NOT EXISTS idx_marketplace_jobs_created_at ON marketplace_jobs(created_at);',
        'CREATE INDEX IF NOT EXISTS idx_marketplace_jobs_expires_at ON marketplace_jobs(expires_at);',
        'CREATE INDEX IF NOT EXISTS idx_job_applications_marketplace_job_id ON job_applications(marketplace_job_id);',
        'CREATE INDEX IF NOT EXISTS idx_job_applications_tradie_id ON job_applications(tradie_id);',
        'CREATE INDEX IF NOT EXISTS idx_job_applications_status ON job_applications(status);',
        'CREATE INDEX IF NOT EXISTS idx_job_applications_custom_quote ON job_applications(custom_quote);',
        'CREATE INDEX IF NOT EXISTS idx_job_applications_created_at ON job_applications(created_at);',
        'CREATE INDEX IF NOT EXISTS idx_job_applications_credits_used ON job_applications(credits_used);',
        'CREATE INDEX IF NOT EXISTS idx_marketplace_job_assignments_marketplace_job_id ON marketplace_job_assignments(marketplace_job_id);',
        'CREATE INDEX IF NOT EXISTS idx_marketplace_job_assignments_selected_tradie_id ON marketplace_job_assignments(selected_tradie_id);',
        'CREATE INDEX IF NOT EXISTS idx_marketplace_job_assignments_selected_application_id ON marketplace_job_assignments(selected_application_id);',
        'CREATE INDEX IF NOT EXISTS idx_marketplace_job_assignments_existing_job_id ON marketplace_job_assignments(existing_job_id);',
        'CREATE INDEX IF NOT EXISTS idx_marketplace_job_assignments_created_at ON marketplace_job_assignments(created_at);',
        'CREATE INDEX IF NOT EXISTS idx_marketplace_notifications_user_id ON marketplace_notifications(user_id);',
        'CREATE INDEX IF NOT EXISTS idx_marketplace_notifications_notification_type ON marketplace_notifications(notification_type);',
        'CREATE INDEX IF NOT EXISTS idx_marketplace_notifications_read ON marketplace_notifications(read);',
        'CREATE INDEX IF NOT EXISTS idx_marketplace_notifications_marketplace_job_id ON marketplace_notifications(marketplace_job_id);',
        'CREATE INDEX IF NOT EXISTS idx_marketplace_notifications_application_id ON marketplace_notifications(application_id);',
        'CREATE INDEX IF NOT EXISTS idx_marketplace_notifications_created_at ON marketplace_notifications(created_at);',
        'CREATE INDEX IF NOT EXISTS idx_marketplace_analytics_date ON marketplace_analytics(date);',
        'CREATE INDEX IF NOT EXISTS idx_tradie_marketplace_stats_tradie_id ON tradie_marketplace_stats(tradie_id);',
        'CREATE INDEX IF NOT EXISTS idx_tradie_marketplace_stats_conversion_rate ON tradie_marketplace_stats(conversion_rate);',
        'CREATE INDEX IF NOT EXISTS idx_tradie_marketplace_stats_last_application_at ON tradie_marketplace_stats(last_application_at);',
        'CREATE INDEX IF NOT EXISTS idx_client_marketplace_stats_client_id ON client_marketplace_stats(client_id);',
        'CREATE INDEX IF NOT EXISTS idx_client_marketplace_stats_last_job_posted_at ON client_marketplace_stats(last_job_posted_at);',
        'CREATE INDEX IF NOT EXISTS idx_jobs_marketplace_job_id ON jobs(marketplace_job_id);',
        'CREATE INDEX IF NOT EXISTS idx_jobs_source_type ON jobs(source_type);',
        'CREATE INDEX IF NOT EXISTS idx_credit_transactions_marketplace_job_id ON credit_transactions(marketplace_job_id);',
        'CREATE INDEX IF NOT EXISTS idx_credit_transactions_application_id ON credit_transactions(application_id);'
      ];

      for (const indexQuery of marketplaceIndexes) {
        try {
          await this.query(indexQuery);
        } catch (error: any) {
          logger.warn(`Index might already exist: ${error.message}`);
        }
      }

      logger.info('Marketplace indexes created successfully');
    } catch (error) {
      logger.error('Failed to create marketplace indexes:', error);
      throw error;
    }
  }

  async createPaymentTables(): Promise<void> {
    try {
      logger.info('Creating payment tables...');

      const createPaymentsTable = `
        CREATE TABLE IF NOT EXISTS payments (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          stripe_payment_intent_id VARCHAR(255) UNIQUE,
          amount DECIMAL(12,2) NOT NULL,
          currency VARCHAR(3) NOT NULL DEFAULT 'AUD',
          payment_method VARCHAR(50) NOT NULL,
          payment_type VARCHAR(50) NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          description TEXT,
          metadata JSONB DEFAULT '{}',
          invoice_id INTEGER,
          subscription_id INTEGER,
          credits_purchased INTEGER,
          stripe_fee DECIMAL(10,2),
          platform_fee DECIMAL(10,2),
          processing_fee DECIMAL(10,2),
          failure_reason TEXT,
          net_amount DECIMAL(12,2),
          processed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `;

      const createPaymentMethodsTable = `
        CREATE TABLE IF NOT EXISTS payment_methods (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          stripe_payment_method_id VARCHAR(255) NOT NULL,
          type VARCHAR(50) NOT NULL,
          card_last_four VARCHAR(4),
          card_brand VARCHAR(20),
          card_exp_month INTEGER,
          card_exp_year INTEGER,
          is_default BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(user_id, stripe_payment_method_id)
        );
      `;

      const createInvoicesTable = `
        CREATE TABLE IF NOT EXISTS invoices (
          id SERIAL PRIMARY KEY,
          quote_id INTEGER,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          invoice_number VARCHAR(50) UNIQUE NOT NULL,
          amount DECIMAL(12,2) NOT NULL,
          currency VARCHAR(3) NOT NULL DEFAULT 'AUD',
          status VARCHAR(20) NOT NULL DEFAULT 'draft',
          due_date TIMESTAMP NOT NULL,
          description TEXT,
          processing_fee DECIMAL(10,2),
          metadata JSONB DEFAULT '{}',
          payment_link TEXT,
          stripe_invoice_id VARCHAR(255),
          paid_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `;

      const createRefundsTable = `
        CREATE TABLE IF NOT EXISTS refunds (
          id SERIAL PRIMARY KEY,
          payment_id INTEGER REFERENCES payments(id) ON DELETE CASCADE,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          amount DECIMAL(12,2) NOT NULL,
          reason TEXT,
          description TEXT,
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          stripe_refund_id VARCHAR(255),
          failure_reason TEXT,
          metadata JSONB DEFAULT '{}',
          processed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `;
      
      const createSubscriptionsTable = `
        CREATE TABLE IF NOT EXISTS subscriptions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          stripe_subscription_id VARCHAR(255) UNIQUE NOT NULL,
          plan VARCHAR(50) NOT NULL,
          status VARCHAR(20) NOT NULL,
          current_period_start TIMESTAMP NOT NULL,
          current_period_end TIMESTAMP NOT NULL,
          credits_included INTEGER NOT NULL,
          price DECIMAL(10,2) NOT NULL,
          currency VARCHAR(3) NOT NULL DEFAULT 'AUD',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `;
      
      const createCreditTransactionsTable = `
        CREATE TABLE IF NOT EXISTS credit_transactions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,
          transaction_type VARCHAR(20) NOT NULL,
          credits INTEGER NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'completed',
          description TEXT NOT NULL,
          reference_id INTEGER,
          reference_type VARCHAR(50),
          marketplace_job_id INTEGER,
          application_id INTEGER,
          urgency_multiplier DECIMAL(3,2) DEFAULT 1.00,
          job_type_multiplier DECIMAL(3,2) DEFAULT 1.00,
          expires_at TIMESTAMP,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `;

      const createWebhookEventsTable = `
        CREATE TABLE IF NOT EXISTS webhook_events (
          id SERIAL PRIMARY KEY,
          stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
          event_type VARCHAR(100) NOT NULL,
          processed BOOLEAN DEFAULT FALSE,
          data JSONB NOT NULL,
          retry_count INTEGER DEFAULT 0,
          failure_reason TEXT,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW(),
          processed_at TIMESTAMP
        );
      `;

      const createCreditBalancesTable = `
        CREATE TABLE IF NOT EXISTS credit_balances (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
          current_balance INTEGER NOT NULL DEFAULT 0,
          total_purchased INTEGER NOT NULL DEFAULT 0,
          total_used INTEGER NOT NULL DEFAULT 0,
          total_refunded INTEGER NOT NULL DEFAULT 0,
          last_purchase_at TIMESTAMP,
          last_usage_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `;

      const createCreditPurchasesTable = `
        CREATE TABLE IF NOT EXISTS credit_purchases (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          payment_id INTEGER REFERENCES payments(id) ON DELETE CASCADE,
          package_type VARCHAR(20) NOT NULL,
          credits_amount INTEGER NOT NULL,
          purchase_price DECIMAL(10,2) NOT NULL,
          currency VARCHAR(3) NOT NULL DEFAULT 'AUD',
          bonus_credits INTEGER DEFAULT 0,
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          expires_at TIMESTAMP,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `;

      const createCreditUsagesTable = `
        CREATE TABLE IF NOT EXISTS credit_usages (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          transaction_id INTEGER REFERENCES credit_transactions(id) ON DELETE CASCADE,
          usage_type VARCHAR(30) NOT NULL,
          credits_used INTEGER NOT NULL,
          reference_id INTEGER,
          reference_type VARCHAR(50),
          description TEXT NOT NULL,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW()
        );
      `;

      const createAutoTopupsTable = `
        CREATE TABLE IF NOT EXISTS auto_topups (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
          status VARCHAR(20) NOT NULL DEFAULT 'disabled',
          trigger_balance INTEGER NOT NULL,
          topup_amount INTEGER NOT NULL,
          package_type VARCHAR(20) NOT NULL,
          payment_method_id INTEGER REFERENCES payment_methods(id) ON DELETE CASCADE,
          last_triggered_at TIMESTAMP,
          failure_count INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `;

      const createCreditNotificationsTable = `
        CREATE TABLE IF NOT EXISTS credit_notifications (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          notification_type VARCHAR(30) NOT NULL,
          threshold_balance INTEGER NOT NULL,
          is_sent BOOLEAN DEFAULT FALSE,
          sent_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `;

      await this.query(createPaymentsTable);
      logger.info('Payments table created/verified');

      await this.query(createPaymentMethodsTable);
      logger.info('Payment methods table created/verified');

      await this.query(createInvoicesTable);
      logger.info('Invoices table created/verified');

      await this.query(createRefundsTable);
      logger.info('Refunds table created/verified');

      await this.query(createSubscriptionsTable);
      logger.info('Subscriptions table created/verified');

      await this.query(createCreditTransactionsTable);
      logger.info('Credit transactions table created/verified');

      await this.query(createWebhookEventsTable);
      logger.info('Webhook events table created/verified');
      
      await this.query(createCreditBalancesTable);
      logger.info('Credit balances table created/verified');

      await this.query(createCreditPurchasesTable);
      logger.info('Credit purchases table created/verified');

      await this.query(createCreditUsagesTable);
      logger.info('Credit usages table created/verified');

      await this.query(createAutoTopupsTable);
      logger.info('Auto topups table created/verified');

      await this.query(createCreditNotificationsTable);
      logger.info('Credit notifications table created/verified');

      await this.createPaymentIndexes();

      logger.info('Payment tables created successfully');
    } catch (error) {
      logger.error('Failed to create payment tables:', error);
      throw error;
    }
  }

  async createPaymentIndexes(): Promise<void> {
    try {
      logger.info('Creating payment indexes...');

      const paymentIndexes = [
        'CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);',
        'CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent_id ON payments(stripe_payment_intent_id);',
        'CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);',
        'CREATE INDEX IF NOT EXISTS idx_payments_payment_type ON payments(payment_type);',
        'CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);',
        'CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);',
        'CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON payment_methods(user_id);',
        'CREATE INDEX IF NOT EXISTS idx_payment_methods_is_default ON payment_methods(is_default);',
        'CREATE INDEX IF NOT EXISTS idx_payment_methods_stripe_id ON payment_methods(stripe_payment_method_id);',
        'CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);',
        'CREATE INDEX IF NOT EXISTS idx_invoices_quote_id ON invoices(quote_id);',
        'CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);',
        'CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);',
        'CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);',
        'CREATE INDEX IF NOT EXISTS idx_refunds_payment_id ON refunds(payment_id);',
        'CREATE INDEX IF NOT EXISTS idx_refunds_user_id ON refunds(user_id);',
        'CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);',
        'CREATE INDEX IF NOT EXISTS idx_refunds_stripe_refund_id ON refunds(stripe_refund_id);',
        'CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);',
        'CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);',
        'CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);',
        'CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);',
        'CREATE INDEX IF NOT EXISTS idx_credit_transactions_payment_id ON credit_transactions(payment_id);',
        'CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(transaction_type);',
        'CREATE INDEX IF NOT EXISTS idx_webhook_events_stripe_event_id ON webhook_events(stripe_event_id);',
        'CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed);',
        'CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON webhook_events(event_type);',
        'CREATE INDEX IF NOT EXISTS idx_webhook_events_retry_count ON webhook_events(retry_count);',
        'CREATE INDEX IF NOT EXISTS idx_credit_balances_user_id ON credit_balances(user_id);',
        'CREATE INDEX IF NOT EXISTS idx_credit_purchases_user_id ON credit_purchases(user_id);',
        'CREATE INDEX IF NOT EXISTS idx_credit_purchases_payment_id ON credit_purchases(payment_id);',
        'CREATE INDEX IF NOT EXISTS idx_credit_purchases_package_type ON credit_purchases(package_type);',
        'CREATE INDEX IF NOT EXISTS idx_credit_purchases_status ON credit_purchases(status);',
        'CREATE INDEX IF NOT EXISTS idx_credit_usages_user_id ON credit_usages(user_id);',
        'CREATE INDEX IF NOT EXISTS idx_credit_usages_transaction_id ON credit_usages(transaction_id);',
        'CREATE INDEX IF NOT EXISTS idx_credit_usages_usage_type ON credit_usages(usage_type);',
        'CREATE INDEX IF NOT EXISTS idx_credit_usages_reference ON credit_usages(reference_id, reference_type);',
        'CREATE INDEX IF NOT EXISTS idx_auto_topups_user_id ON auto_topups(user_id);',
        'CREATE INDEX IF NOT EXISTS idx_auto_topups_status ON auto_topups(status);',
        'CREATE INDEX IF NOT EXISTS idx_credit_notifications_user_id ON credit_notifications(user_id);',
        'CREATE INDEX IF NOT EXISTS idx_credit_notifications_type ON credit_notifications(notification_type);',
        'CREATE INDEX IF NOT EXISTS idx_credit_transactions_status ON credit_transactions(status);',
        'CREATE INDEX IF NOT EXISTS idx_credit_transactions_reference ON credit_transactions(reference_id, reference_type);',
        'CREATE INDEX IF NOT EXISTS idx_credit_transactions_expires_at ON credit_transactions(expires_at);'
      ];

      for (const indexQuery of paymentIndexes) {
        try {
          await this.query(indexQuery);
        } catch (error: any) {
          logger.warn(`Index might already exist: ${error.message}`);
        }
      }

      logger.info('Payment indexes created successfully');
    } catch (error) {
      logger.error('Failed to create payment indexes:', error);
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
          marketplace_job_id INTEGER,
          source_type VARCHAR(20) DEFAULT 'direct',
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

      await this.query('DROP TABLE IF EXISTS client_marketplace_stats CASCADE');
      await this.query('DROP TABLE IF EXISTS tradie_marketplace_stats CASCADE');
      await this.query('DROP TABLE IF EXISTS marketplace_analytics CASCADE');
      await this.query('DROP TABLE IF EXISTS marketplace_notifications CASCADE');
      await this.query('DROP TABLE IF EXISTS marketplace_job_assignments CASCADE');
      await this.query('DROP TABLE IF EXISTS job_applications CASCADE');
      await this.query('DROP TABLE IF EXISTS marketplace_jobs CASCADE');
      await this.query('DROP TABLE IF EXISTS webhook_events CASCADE');
      await this.query('DROP TABLE IF EXISTS credit_notifications CASCADE');
      await this.query('DROP TABLE IF EXISTS auto_topups CASCADE');
      await this.query('DROP TABLE IF EXISTS credit_usages CASCADE');
      await this.query('DROP TABLE IF EXISTS credit_purchases CASCADE');
      await this.query('DROP TABLE IF EXISTS credit_balances CASCADE');
      await this.query('DROP TABLE IF EXISTS credit_transactions CASCADE');
      await this.query('DROP TABLE IF EXISTS subscriptions CASCADE');
      await this.query('DROP TABLE IF EXISTS refunds CASCADE');
      await this.query('DROP TABLE IF EXISTS invoices CASCADE');
      await this.query('DROP TABLE IF EXISTS payment_methods CASCADE');
      await this.query('DROP TABLE IF EXISTS payments CASCADE');
      await this.query('DROP TABLE IF EXISTS quote_items CASCADE');
      await this.query('DROP TABLE IF EXISTS quotes CASCADE');
      await this.query('DROP TABLE IF EXISTS job_attachments CASCADE');
      await this.query('DROP TABLE IF EXISTS materials CASCADE');
      await this.query('DROP TABLE IF EXISTS jobs CASCADE');
      await this.query('DROP TABLE IF EXISTS clients CASCADE');
      await this.query('DROP TABLE IF EXISTS sessions CASCADE');
      await this.query('DROP TABLE IF EXISTS profiles CASCADE');
      await this.query('DROP TABLE IF EXISTS users CASCADE');

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
      
      if (this.firebaseApp) {
        try {
          await deleteApp(this.firebaseApp);
          this.isFirestoreConnected = false;
          logger.info('Firebase/Firestore connection closed');
        } catch (firebaseError) {
          logger.warn('Firebase disconnect failed:', firebaseError);
        }
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

  getFirestoreClient(): Firestore | null {
    return this.firestore;
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

  async firestoreHealthCheck(): Promise<boolean> {
    try {
      if (!this.firestore) {
        return false;
      }
      
      await this.firestore.collection('_health').doc('check').set({
        timestamp: new Date(),
        status: 'connected'
      });
      
      return true;
    } catch (error) {
      logger.error('Firestore health check failed:', error);
      return false;
    }
  }

  isHealthy(): boolean {
    return this.isConnected;
  }
}

export const database = new DatabaseConnection();

export const getDbConnection = (): DatabaseConnection => {
  return database;
};

export const connectDatabase = async (): Promise<void> => {
  try {
    const isHealthy = await database.healthCheck();
    if (!isHealthy) {
      throw new Error('Database health check failed');
    }
    
    const isFirestoreHealthy = await database.firestoreHealthCheck();
    if (!isFirestoreHealthy) {
      logger.warn('Firestore health check failed - continuing without Firestore');
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
    
    const isFirestoreHealthy = await database.firestoreHealthCheck();
    if (isFirestoreHealthy) {
      logger.info('Firestore initialized successfully');
    } else {
      logger.warn('Firestore initialization failed - continuing without Firestore');
    }
    
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



