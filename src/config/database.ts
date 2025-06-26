// src/config/database.ts

import { PrismaClient } from '@prisma/client';
import { logger, createLogContext } from '@/utils/logger';
import { DATABASE_CONSTANTS, ERROR_CODES } from '@/utils/constants';
import { HealthStatus, ServiceHealth } from '@/types/common.types';

// Enterprise database configuration interface
interface DatabaseConfig {
  url: string;
  maxConnections: number;
  connectionTimeout: number;
  statementTimeout: number;
  idleTimeout: number;
  enableLogging: boolean;
  enableMetrics: boolean;
}

// Enterprise database connection manager
class DatabaseManager {
  private static instance: DatabaseManager;
  private prisma: PrismaClient | null = null;
  private config: DatabaseConfig;
  private connectionAttempts: number = 0;
  private maxRetries: number = 3;
  private isConnected: boolean = false;

  private constructor() {
    this.config = this.loadConfiguration();
  }

  // Singleton pattern for enterprise database management
  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  // Load database configuration with enterprise defaults
  private loadConfiguration(): DatabaseConfig {
    return {
      url: process.env.DATABASE_URL || '',
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || String(DATABASE_CONSTANTS.CONNECTION.MAX_CONNECTIONS)),
      connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || String(DATABASE_CONSTANTS.CONNECTION.CONNECTION_TIMEOUT)),
      statementTimeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || String(DATABASE_CONSTANTS.CONNECTION.STATEMENT_TIMEOUT)),
      idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || String(DATABASE_CONSTANTS.CONNECTION.IDLE_TIMEOUT)),
      enableLogging: process.env.NODE_ENV !== 'production',
      enableMetrics: process.env.ENABLE_DB_METRICS === 'true',
    };
  }

  // Enterprise database connection with retry logic
  public async connect(): Promise<PrismaClient> {
    if (this.prisma && this.isConnected) {
      return this.prisma;
    }

    const startTime = Date.now();
    const logContext = createLogContext()
      .withMetadata({ 
        attempt: this.connectionAttempts + 1,
        maxRetries: this.maxRetries,
        config: {
          maxConnections: this.config.maxConnections,
          connectionTimeout: this.config.connectionTimeout,
        }
      })
      .build();

    try {
      logger.info('Attempting database connection', logContext);

      // Validate configuration
      this.validateConfiguration();

      // Create Prisma client with enterprise configuration
      this.prisma = new PrismaClient({
        datasources: {
          db: {
            url: this.config.url,
          },
        },
        log: this.config.enableLogging ? [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'error' },
          { emit: 'event', level: 'info' },
          { emit: 'event', level: 'warn' },
        ] : [],
        errorFormat: 'pretty',
      });

      // Set up enterprise logging for database operations
      if (this.config.enableLogging) {
        this.setupDatabaseLogging();
      }

      // Test connection with timeout
      await Promise.race([
        this.prisma.$connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), this.config.connectionTimeout)
        ),
      ]);

      // Verify connection with a simple query
      await this.prisma.$queryRaw`SELECT 1`;

      this.isConnected = true;
      this.connectionAttempts = 0;

      const connectionTime = Date.now() - startTime;
      logger.info('Database connection established successfully', {
        ...logContext,
        connectionTime,
      });

      logger.performance('database_connection', connectionTime, logContext);

      return this.prisma;

    } catch (error) {
      this.connectionAttempts++;
      const connectionTime = Date.now() - startTime;

      logger.error('Database connection failed', {
        ...logContext,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        connectionTime,
        errorCode: ERROR_CODES.SYS_DATABASE_ERROR,
      });

      // Retry logic for enterprise resilience
      if (this.connectionAttempts < this.maxRetries) {
        const retryDelay = Math.pow(2, this.connectionAttempts) * 1000; // Exponential backoff
        logger.info(`Retrying database connection in ${retryDelay}ms`, logContext);
        
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.connect();
      }

      // Max retries exceeded
      logger.error('Database connection failed after maximum retries', {
        ...logContext,
        errorCode: ERROR_CODES.SYS_DATABASE_ERROR,
        severity: 'critical',
      });

      throw new Error(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Enterprise configuration validation
  private validateConfiguration(): void {
    if (!this.config.url) {
      throw new Error('DATABASE_URL is required');
    }

    if (this.config.maxConnections <= 0) {
      throw new Error('Max connections must be greater than 0');
    }

    if (this.config.connectionTimeout <= 0) {
      throw new Error('Connection timeout must be greater than 0');
    }

    logger.debug('Database configuration validated', {
      metadata: {
        maxConnections: this.config.maxConnections,
        connectionTimeout: this.config.connectionTimeout,
        enableLogging: this.config.enableLogging,
      }
    });
  }

  // Enterprise database logging setup
  private setupDatabaseLogging(): void {
    if (!this.prisma) return;

    this.prisma.$on('query', (event) => {
      logger.database(
        'QUERY',
        event.target || 'unknown',
        event.duration,
        createLogContext()
          .withMetadata({
            query: event.query,
            params: event.params,
            duration: event.duration,
          })
          .build()
      );
    });

    this.prisma.$on('error', (event) => {
      logger.error('Database error occurred', 
        createLogContext()
          .withError(ERROR_CODES.SYS_DATABASE_ERROR)
          .withMetadata({
            target: event.target,
            message: event.message,
          })
          .build()
      );
    });

    this.prisma.$on('info', (event) => {
      logger.info('Database info', 
        createLogContext()
          .withMetadata({
            target: event.target,
            message: event.message,
          })
          .build()
      );
    });

    this.prisma.$on('warn', (event) => {
      logger.warn('Database warning', 
        createLogContext()
          .withMetadata({
            target: event.target,
            message: event.message,
          })
          .build()
      );
    });
  }

  // Enterprise health check for database
  public async healthCheck(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      if (!this.prisma || !this.isConnected) {
        return {
          name: 'database',
          status: HealthStatus.UNHEALTHY,
          error: 'Database not connected',
          lastChecked: new Date(),
        };
      }

      // Simple health check query
      await this.prisma.$queryRaw`SELECT 1`;
      
      const responseTime = Date.now() - startTime;
      
      logger.health('database', 'healthy', responseTime);
      
      return {
        name: 'database',
        status: HealthStatus.HEALTHY,
        responseTime,
        lastChecked: new Date(),
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.health('database', 'unhealthy', responseTime);
      
      return {
        name: 'database',
        status: HealthStatus.UNHEALTHY,
        responseTime,
        error: errorMessage,
        lastChecked: new Date(),
      };
    }
  }

  // Enterprise graceful disconnect
  public async disconnect(): Promise<void> {
    if (this.prisma && this.isConnected) {
      const logContext = createLogContext()
        .withMetadata({ reason: 'graceful_shutdown' })
        .build();

      try {
        logger.info('Disconnecting from database', logContext);
        
        await this.prisma.$disconnect();
        this.isConnected = false;
        
        logger.info('Database disconnected successfully', logContext);
        
      } catch (error) {
        logger.error('Error during database disconnection', {
          ...logContext,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          errorCode: ERROR_CODES.SYS_DATABASE_ERROR,
        });
        
        throw error;
      }
    }
  }

  // Get database client (with connection check)
  public getClient(): PrismaClient {
    if (!this.prisma || !this.isConnected) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.prisma;
  }

  // Enterprise transaction wrapper with logging
  public async transaction<T>(
    operation: (prisma: PrismaClient) => Promise<T>,
    options?: { timeout?: number; isolationLevel?: string }
  ): Promise<T> {
    if (!this.prisma || !this.isConnected) {
      throw new Error('Database not connected');
    }

    const startTime = Date.now();
    const logContext = createLogContext()
      .withMetadata({
        operation: 'transaction',
        timeout: options?.timeout,
        isolationLevel: options?.isolationLevel,
      })
      .build();

    try {
      logger.debug('Starting database transaction', logContext);

      const result = await this.prisma.$transaction(
        operation,
        {
          timeout: options?.timeout || DATABASE_CONSTANTS.CONNECTION.STATEMENT_TIMEOUT,
          isolationLevel: options?.isolationLevel as any,
        }
      );

      const duration = Date.now() - startTime;
      logger.performance('database_transaction', duration, logContext);

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Database transaction failed', {
        ...logContext,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        duration,
        errorCode: ERROR_CODES.SYS_DATABASE_ERROR,
      });

      throw error;
    }
  }

  // Enterprise connection status
  public isHealthy(): boolean {
    return this.isConnected && this.prisma !== null;
  }

  // Enterprise metrics (if enabled)
  public getMetrics(): Record<string, any> {
    return {
      isConnected: this.isConnected,
      connectionAttempts: this.connectionAttempts,
      maxConnections: this.config.maxConnections,
      enableLogging: this.config.enableLogging,
      enableMetrics: this.config.enableMetrics,
    };
  }
}

// Export singleton instance and connection function
export const databaseManager = DatabaseManager.getInstance();

// Enterprise database connection helper
export const connectDatabase = async (): Promise<PrismaClient> => {
  return await databaseManager.connect();
};

// Enterprise database health check helper
export const checkDatabaseHealth = async (): Promise<ServiceHealth> => {
  return await databaseManager.healthCheck();
};

// Enterprise database client getter
export const getDatabase = (): PrismaClient => {
  return databaseManager.getClient();
};

// Enterprise transaction helper
export const executeTransaction = async <T>(
  operation: (prisma: PrismaClient) => Promise<T>,
  options?: { timeout?: number; isolationLevel?: string }
): Promise<T> => {
  return await databaseManager.transaction(operation, options);
};
