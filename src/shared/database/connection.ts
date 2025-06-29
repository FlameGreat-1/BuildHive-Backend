import mongoose from 'mongoose';
import { createClient, RedisClientType } from 'redis';
import { getDatabaseConfig, getRedisConfig, isProduction } from '../../config/auth';
import { buildHiveLogger } from '../utils/logger.util';
import type { DatabaseConnectionStatus, DatabaseHealthMetrics } from '../types/database.types';

// Database connection manager implementing Singleton pattern
class DatabaseConnection {
  private static instance: DatabaseConnection;
  private mongoConnection: typeof mongoose | null = null;
  private redisClient: RedisClientType | null = null;
  private isConnecting = false;
  private connectionAttempts = 0;
  private readonly maxRetries = 5;
  private readonly retryDelay = 5000; // 5 seconds

  private constructor() {}

  // Singleton pattern implementation
  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  // Initialize all database connections
  public async connect(): Promise<void> {
    if (this.isConnecting) {
      throw new Error('Database connection already in progress');
    }

    if (this.isConnected()) {
      buildHiveLogger.info('Database connections already established');
      return;
    }

    this.isConnecting = true;
    buildHiveLogger.info('🔄 Initializing BuildHive database connections...');

    try {
      // Connect to both databases concurrently
      await Promise.all([
        this.connectMongoDB(),
        this.connectRedis(),
      ]);

      this.isConnecting = false;
      this.connectionAttempts = 0;
      buildHiveLogger.info('✅ BuildHive database connections established successfully');
    } catch (error) {
      this.isConnecting = false;
      buildHiveLogger.error('❌ Failed to establish database connections', error);
      throw error;
    }
  }

  // Connect to MongoDB
  private async connectMongoDB(): Promise<void> {
    const config = getDatabaseConfig();
    
    try {
      buildHiveLogger.info('🔄 Connecting to MongoDB...');

      // Set up connection event listeners before connecting
      this.setupMongoEventListeners();

      // Connect to MongoDB
      this.mongoConnection = await mongoose.connect(config.url, {
        ...config.options,
        dbName: config.name,
      });

      // Verify connection
      await mongoose.connection.db.admin().ping();
      buildHiveLogger.info('✅ MongoDB connected successfully', {
        database: config.name,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
      });

    } catch (error) {
      buildHiveLogger.error('❌ MongoDB connection failed', error);
      throw new Error(`MongoDB connection failed: ${error}`);
    }
  }

  // Connect to Redis
  private async connectRedis(): Promise<void> {
    const config = getRedisConfig();

    try {
      buildHiveLogger.info('🔄 Connecting to Redis...');

      // Create Redis client
      this.redisClient = createClient({
        url: config.url,
        password: config.password,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > this.maxRetries) {
              buildHiveLogger.error('❌ Redis max reconnection attempts reached');
              return false;
            }
            const delay = Math.min(retries * 100, 3000);
            buildHiveLogger.warn(`🔄 Redis reconnecting in ${delay}ms (attempt ${retries})`);
            return delay;
          },
          connectTimeout: 10000,
        },
        lazyConnect: true,
      });

      // Set up Redis event listeners
      this.setupRedisEventListeners();

      // Connect to Redis
      await this.redisClient.connect();

      // Test Redis connection
      await this.redisClient.ping();
      buildHiveLogger.info('✅ Redis connected successfully');

    } catch (error) {
      buildHiveLogger.error('❌ Redis connection failed', error);
      throw new Error(`Redis connection failed: ${error}`);
    }
  }

  // Set up MongoDB event listeners
  private setupMongoEventListeners(): void {
    mongoose.connection.on('connected', () => {
      buildHiveLogger.info('📡 MongoDB connection established');
    });

    mongoose.connection.on('error', (error) => {
      buildHiveLogger.error('❌ MongoDB connection error', error);
    });

    mongoose.connection.on('disconnected', () => {
      buildHiveLogger.warn('⚠️ MongoDB disconnected');
      this.handleMongoReconnection();
    });

    mongoose.connection.on('reconnected', () => {
      buildHiveLogger.info('🔄 MongoDB reconnected');
    });

    // Graceful shutdown handling
    process.on('SIGINT', this.gracefulShutdown.bind(this));
    process.on('SIGTERM', this.gracefulShutdown.bind(this));
  }

  // Set up Redis event listeners
  private setupRedisEventListeners(): void {
    if (!this.redisClient) return;

    this.redisClient.on('connect', () => {
      buildHiveLogger.info('📡 Redis connection established');
    });

    this.redisClient.on('ready', () => {
      buildHiveLogger.info('✅ Redis ready for operations');
    });

    this.redisClient.on('error', (error) => {
      buildHiveLogger.error('❌ Redis connection error', error);
    });

    this.redisClient.on('end', () => {
      buildHiveLogger.warn('⚠️ Redis connection ended');
    });

    this.redisClient.on('reconnecting', () => {
      buildHiveLogger.info('🔄 Redis reconnecting...');
    });
  }

  // Handle MongoDB reconnection
  private async handleMongoReconnection(): Promise<void> {
    if (this.connectionAttempts >= this.maxRetries) {
      buildHiveLogger.error('❌ MongoDB max reconnection attempts reached');
      return;
    }

    this.connectionAttempts++;
    buildHiveLogger.info(`🔄 Attempting MongoDB reconnection (${this.connectionAttempts}/${this.maxRetries})`);

    setTimeout(async () => {
      try {
        await this.connectMongoDB();
        this.connectionAttempts = 0;
      } catch (error) {
        buildHiveLogger.error('❌ MongoDB reconnection failed', error);
      }
    }, this.retryDelay);
  }

  // Check if databases are connected
  public isConnected(): boolean {
    const mongoConnected = this.mongoConnection && mongoose.connection.readyState === 1;
    const redisConnected = this.redisClient && this.redisClient.isReady;
    return Boolean(mongoConnected && redisConnected);
  }

  // Get connection status
  public getConnectionStatus(): DatabaseConnectionStatus {
    return {
      mongodb: {
        connected: Boolean(this.mongoConnection && mongoose.connection.readyState === 1),
        readyState: mongoose.connection.readyState,
        host: mongoose.connection.host,
        name: mongoose.connection.name,
      },
      redis: {
        connected: Boolean(this.redisClient && this.redisClient.isReady),
        status: this.redisClient?.status || 'disconnected',
        host: this.redisClient?.options?.socket?.host,
      },
    };
  }

  // Health check for databases
  public async getHealthMetrics(): Promise<DatabaseHealthMetrics> {
    const startTime = Date.now();
    
    const health: DatabaseHealthMetrics = {
      mongodb: {
        connected: false,
        responseTime: 0,
        activeConnections: 0,
        availableConnections: 0,
      },
      redis: {
        connected: false,
        responseTime: 0,
        memoryUsage: 0,
        connectedClients: 0,
        commandsProcessed: 0,
      },
    };

    // Check MongoDB health
    try {
      if (this.mongoConnection && mongoose.connection.readyState === 1) {
        const mongoStart = Date.now();
        await mongoose.connection.db.admin().ping();
        health.mongodb.responseTime = Date.now() - mongoStart;
        health.mongodb.connected = true;
        
        // Get connection pool stats
        const stats = mongoose.connection.db.stats();
        health.mongodb.activeConnections = mongoose.connections.length;
        health.mongodb.availableConnections = 20; // From config
      }
    } catch (error) {
      buildHiveLogger.error('MongoDB health check failed', error);
    }

    // Check Redis health
    try {
      if (this.redisClient && this.redisClient.isReady) {
        const redisStart = Date.now();
        await this.redisClient.ping();
        health.redis.responseTime = Date.now() - redisStart;
        health.redis.connected = true;

        // Get Redis info
        const info = await this.redisClient.info();
        const lines = info.split('\r\n');
        
        for (const line of lines) {
          if (line.startsWith('used_memory:')) {
            health.redis.memoryUsage = parseInt(line.split(':')[1]);
          }
          if (line.startsWith('connected_clients:')) {
            health.redis.connectedClients = parseInt(line.split(':')[1]);
          }
          if (line.startsWith('total_commands_processed:')) {
            health.redis.commandsProcessed = parseInt(line.split(':')[1]);
          }
        }
      }
    } catch (error) {
      buildHiveLogger.error('Redis health check failed', error);
    }

    return health;
  }

  // Get MongoDB connection
  public getMongoConnection(): typeof mongoose | null {
    return this.mongoConnection;
  }

  // Get Redis client
  public getRedisClient(): RedisClientType | null {
    return this.redisClient;
  }

  // Disconnect from all databases
  public async disconnect(): Promise<void> {
    buildHiveLogger.info('🔒 Closing BuildHive database connections...');

    const disconnectPromises: Promise<void>[] = [];

    // Disconnect MongoDB
    if (this.mongoConnection) {
      disconnectPromises.push(
        mongoose.connection.close().then(() => {
          this.mongoConnection = null;
          buildHiveLogger.info('🔒 MongoDB connection closed');
        })
      );
    }

    // Disconnect Redis
    if (this.redisClient) {
      disconnectPromises.push(
        this.redisClient.quit().then(() => {
          this.redisClient = null;
          buildHiveLogger.info('🔒 Redis connection closed');
        })
      );
    }

    await Promise.all(disconnectPromises);
    buildHiveLogger.info('✅ All BuildHive database connections closed');
  }

  // Graceful shutdown handler
  private async gracefulShutdown(signal: string): Promise<void> {
    buildHiveLogger.info(`🛑 Received ${signal}. Starting graceful shutdown...`);
    
    try {
      await this.disconnect();
      buildHiveLogger.info('✅ Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      buildHiveLogger.error('❌ Error during graceful shutdown', error);
      process.exit(1);
    }
  }

  // Start database transaction (MongoDB)
  public async startTransaction(): Promise<mongoose.ClientSession> {
    if (!this.mongoConnection) {
      throw new Error('MongoDB not connected');
    }
    
    const session = await mongoose.startSession();
    session.startTransaction();
    return session;
  }

  // Commit transaction
  public async commitTransaction(session: mongoose.ClientSession): Promise<void> {
    await session.commitTransaction();
    await session.endSession();
  }

  // Abort transaction
  public async abortTransaction(session: mongoose.ClientSession): Promise<void> {
    await session.abortTransaction();
    await session.endSession();
  }
}

// Export singleton instance
export const databaseConnection = DatabaseConnection.getInstance();

// Export convenience functions
export const connectDatabase = () => databaseConnection.connect();
export const disconnectDatabase = () => databaseConnection.disconnect();
export const getDatabaseHealth = () => databaseConnection.getHealthMetrics();
export const getDatabaseStatus = () => databaseConnection.getConnectionStatus();
export const getMongoConnection = () => databaseConnection.getMongoConnection();
export const getRedisClient = () => databaseConnection.getRedisClient();
export const startTransaction = () => databaseConnection.startTransaction();
export const commitTransaction = (session: mongoose.ClientSession) => databaseConnection.commitTransaction(session);
export const abortTransaction = (session: mongoose.ClientSession) => databaseConnection.abortTransaction(session);

export default databaseConnection;
