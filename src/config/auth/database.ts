import mongoose from 'mongoose';
import { createClient } from 'redis';
import { getDatabaseConfig, getRedisConfig, env, isProduction } from './environment';
import { COLLECTIONS } from './constants';

// Database connection interface
interface DatabaseConnection {
  mongodb: typeof mongoose;
  redis: ReturnType<typeof createClient>;
}

// MongoDB connection configuration
const mongoConfig = getDatabaseConfig();
const redisConfig = getRedisConfig();

// MongoDB connection options
const mongoOptions: mongoose.ConnectOptions = {
  ...mongoConfig.options,
  dbName: mongoConfig.name,
  // Production optimizations
  bufferCommands: false,
  bufferMaxEntries: 0,
  // Connection pool settings
  maxPoolSize: isProduction() ? 20 : 5,
  minPoolSize: isProduction() ? 5 : 1,
  // Timeout settings
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
  // Monitoring
  monitorCommands: !isProduction(),
};

// Redis client configuration
const redisClient = createClient({
  url: redisConfig.url,
  password: redisConfig.password,
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 1000),
    connectTimeout: 10000,
  },
  // Production optimizations
  lazyConnect: true,
  maxRetriesPerRequest: redisConfig.maxRetriesPerRequest,
});

// Database connection class implementing Singleton pattern
class DatabaseManager {
  private static instance: DatabaseManager;
  private mongoConnection: typeof mongoose | null = null;
  private redisConnection: ReturnType<typeof createClient> | null = null;
  private isConnecting = false;

  private constructor() {}

  // Singleton pattern implementation
  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  // Connect to MongoDB
  private async connectMongoDB(): Promise<typeof mongoose> {
    try {
      console.log('🔄 Connecting to MongoDB...');
      
      const connection = await mongoose.connect(mongoConfig.url, mongoOptions);
      
      // Connection event listeners
      mongoose.connection.on('connected', () => {
        console.log('✅ MongoDB connected successfully');
      });

      mongoose.connection.on('error', (error) => {
        console.error('❌ MongoDB connection error:', error);
      });

      mongoose.connection.on('disconnected', () => {
        console.log('⚠️ MongoDB disconnected');
      });

      // Graceful shutdown handling
      process.on('SIGINT', async () => {
        await mongoose.connection.close();
        console.log('🔒 MongoDB connection closed through app termination');
        process.exit(0);
      });

      this.mongoConnection = connection;
      return connection;
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error);
      throw new Error(`MongoDB connection failed: ${error}`);
    }
  }

  // Connect to Redis
  private async connectRedis(): Promise<ReturnType<typeof createClient>> {
    try {
      console.log('🔄 Connecting to Redis...');

      // Event listeners
      redisClient.on('connect', () => {
        console.log('✅ Redis connected successfully');
      });

      redisClient.on('error', (error) => {
        console.error('❌ Redis connection error:', error);
      });

      redisClient.on('end', () => {
        console.log('⚠️ Redis connection ended');
      });

      redisClient.on('reconnecting', () => {
        console.log('🔄 Redis reconnecting...');
      });

      await redisClient.connect();
      
      // Test Redis connection
      await redisClient.ping();
      
      this.redisConnection = redisClient;
      return redisClient;
    } catch (error) {
      console.error('❌ Redis connection failed:', error);
      throw new Error(`Redis connection failed: ${error}`);
    }
  }

  // Initialize all database connections
  public async connect(): Promise<DatabaseConnection> {
    if (this.isConnecting) {
      throw new Error('Database connection already in progress');
    }

    if (this.mongoConnection && this.redisConnection) {
      return {
        mongodb: this.mongoConnection,
        redis: this.redisConnection,
      };
    }

    this.isConnecting = true;

    try {
      // Connect to both databases concurrently
      const [mongodb, redis] = await Promise.all([
        this.mongoConnection || this.connectMongoDB(),
        this.redisConnection || this.connectRedis(),
      ]);

      this.isConnecting = false;

      return { mongodb, redis };
    } catch (error) {
      this.isConnecting = false;
      throw error;
    }
  }

  // Disconnect from all databases
  public async disconnect(): Promise<void> {
    const disconnectPromises: Promise<void>[] = [];

    if (this.mongoConnection) {
      disconnectPromises.push(mongoose.connection.close());
      this.mongoConnection = null;
    }

    if (this.redisConnection) {
      disconnectPromises.push(this.redisConnection.quit());
      this.redisConnection = null;
    }

    await Promise.all(disconnectPromises);
    console.log('🔒 All database connections closed');
  }

  // Health check for databases
  public async healthCheck(): Promise<{
    mongodb: boolean;
    redis: boolean;
    timestamp: Date;
  }> {
    const health = {
      mongodb: false,
      redis: false,
      timestamp: new Date(),
    };

    try {
      // Check MongoDB
      if (this.mongoConnection && mongoose.connection.readyState === 1) {
        await mongoose.connection.db.admin().ping();
        health.mongodb = true;
      }
    } catch (error) {
      console.error('MongoDB health check failed:', error);
    }

    try {
      // Check Redis
      if (this.redisConnection && this.redisConnection.isReady) {
        await this.redisConnection.ping();
        health.redis = true;
      }
    } catch (error) {
      console.error('Redis health check failed:', error);
    }

    return health;
  }

  // Get current connections
  public getConnections(): {
    mongodb: typeof mongoose | null;
    redis: ReturnType<typeof createClient> | null;
  } {
    return {
      mongodb: this.mongoConnection,
      redis: this.redisConnection,
    };
  }
}

// Export singleton instance
export const databaseManager = DatabaseManager.getInstance();

// Export individual connections for direct access
export const connectDatabase = () => databaseManager.connect();
export const disconnectDatabase = () => databaseManager.disconnect();
export const getDatabaseHealth = () => databaseManager.healthCheck();

// MongoDB schema options for consistent configuration
export const getSchemaOptions = () => ({
  timestamps: true,
  versionKey: false,
  toJSON: {
    transform: (_doc: any, ret: any) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
  toObject: {
    transform: (_doc: any, ret: any) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
});

// Collection name constants for type safety
export const collections = COLLECTIONS;

// Export Redis client for pub/sub operations
export { redisClient };

export default databaseManager;
