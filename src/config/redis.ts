import { createClient, RedisClientType, RedisClientOptions } from 'redis';
import { logger, createLogContext } from '@/utils/logger';
import { CACHE_CONSTANTS, ERROR_CODES, MONITORING_CONSTANTS } from '@/utils/constants';
import { HealthStatus, ServiceHealth, CacheOptions } from '@/types/common.types';

interface RedisConfig {
  url: string;
  keyPrefix: string;
  defaultTTL: number;
  maxRetries: number;
  retryDelayOnFailover: number;
  enableOfflineQueue: boolean;
  connectTimeout: number;
  commandTimeout: number;
  enableReadyCheck: boolean;
  maxRetriesPerRequest: number;
}

class RedisManager {
  private static instance: RedisManager;
  private client: RedisClientType | null = null;
  private subscriber: RedisClientType | null = null;
  private publisher: RedisClientType | null = null;
  private config: RedisConfig;
  private connectionAttempts: number = 0;
  private isConnected: boolean = false;
  private isSubscriberConnected: boolean = false;
  private isPublisherConnected: boolean = false;

  private constructor() {
    this.config = this.loadConfiguration();
  }

  public static getInstance(): RedisManager {
    if (!RedisManager.instance) {
      RedisManager.instance = new RedisManager();
    }
    return RedisManager.instance;
  }

  private loadConfiguration(): RedisConfig {
    return {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'buildhive:',
      defaultTTL: parseInt(process.env.REDIS_DEFAULT_TTL || String(CACHE_CONSTANTS.TTL.MEDIUM)),
      maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
      retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100'),
      enableOfflineQueue: process.env.REDIS_OFFLINE_QUEUE !== 'false',
      connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000'),
      commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000'),
      enableReadyCheck: process.env.REDIS_READY_CHECK !== 'false',
      maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES_PER_REQUEST || '3'),
    };
  }

  private createRedisClient(purpose: 'main' | 'subscriber' | 'publisher'): RedisClientType {
    const clientOptions: RedisClientOptions = {
      url: this.config.url,
      socket: {
        connectTimeout: this.config.connectTimeout,
        commandTimeout: this.config.commandTimeout,
        reconnectStrategy: (retries: number): number | Error => {
          if (retries > this.config.maxRetries) {
            logger.error('Redis max retries exceeded', 
              createLogContext()
                .withMetadata({ 
                  errorCode: ERROR_CODES.SYS_REDIS_ERROR,
                  purpose, 
                  retries, 
                  maxRetries: this.config.maxRetries 
                })
                .build()
            );
            return new Error('Max retries exceeded');
          }
          const delay = Math.min(retries * this.config.retryDelayOnFailover, 3000);
          logger.warn(`Redis reconnecting in ${delay}ms`, 
            createLogContext()
              .withMetadata({ purpose, retries, delay })
              .build()
          );
          return delay;
        },
      },
      database: purpose === 'subscriber' ? 1 : purpose === 'publisher' ? 2 : 0,
    };

    const client = createClient(clientOptions) as RedisClientType;

    client.on('connect', () => {
      logger.info(`Redis ${purpose} client connecting`, 
        createLogContext().withMetadata({ purpose }).build()
      );
    });

    client.on('ready', () => {
      logger.info(`Redis ${purpose} client ready`, 
        createLogContext().withMetadata({ purpose }).build()
      );
    });

    client.on('error', (error: Error) => {
      logger.error(`Redis ${purpose} client error`, 
        createLogContext()
          .withMetadata({ 
            errorCode: ERROR_CODES.SYS_REDIS_ERROR,
            purpose, 
            errorMessage: error.message,
            errorStack: error.stack 
          })
          .build()
      );
    });

    client.on('end', () => {
      logger.warn(`Redis ${purpose} client connection ended`, 
        createLogContext().withMetadata({ purpose }).build()
      );
    });

    client.on('reconnecting', () => {
      logger.info(`Redis ${purpose} client reconnecting`, 
        createLogContext().withMetadata({ purpose }).build()
      );
    });

    return client;
  }

  public async connect(): Promise<void> {
    const startTime = Date.now();
    const logContext = createLogContext()
      .withMetadata({
        attempt: this.connectionAttempts + 1,
        maxRetries: this.config.maxRetries,
      })
      .build();

    try {
      logger.info('Connecting to Redis', logContext);

      if (!this.client) {
        this.client = this.createRedisClient('main');
      }

      if (!this.subscriber) {
        this.subscriber = this.createRedisClient('subscriber');
      }

      if (!this.publisher) {
        this.publisher = this.createRedisClient('publisher');
      }

      const connections = await Promise.allSettled([
        this.client.connect(),
        this.subscriber.connect(),
        this.publisher.connect(),
      ]);

      const failures = connections.filter(result => result.status === 'rejected');
      if (failures.length > 0) {
        throw new Error(`Redis connection failures: ${failures.length}`);
      }

      await Promise.all([
        this.client.ping(),
        this.subscriber.ping(),
        this.publisher.ping(),
      ]);

      this.isConnected = true;
      this.isSubscriberConnected = true;
      this.isPublisherConnected = true;
      this.connectionAttempts = 0;

      const connectionTime = Date.now() - startTime;
      logger.info('Redis connected successfully', {
        ...logContext,
        connectionTime,
      });

      logger.performance('redis_connection', connectionTime, logContext);

    } catch (error) {
      this.connectionAttempts++;
      const connectionTime = Date.now() - startTime;

      logger.error('Redis connection failed', {
        ...logContext,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        connectionTime,
        errorCode: ERROR_CODES.SYS_REDIS_ERROR,
      });

      throw error;
    }
  }

  public async set(key: string, value: any, options?: CacheOptions): Promise<void> {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis not connected');
    }

    const startTime = Date.now();
    const fullKey = this.config.keyPrefix + key;
    const ttl = options?.ttl || this.config.defaultTTL;

    try {
      const serializedValue = options?.serialize !== false ? JSON.stringify(value) : value;
      
      if (ttl > 0) {
        await this.client.setEx(fullKey, ttl, serializedValue);
      } else {
        await this.client.set(fullKey, serializedValue);
      }

      const duration = Date.now() - startTime;
      logger.debug('Redis SET operation', 
        createLogContext()
          .withMetadata({ key: fullKey, ttl, duration })
          .build()
      );

    } catch (error) {
      logger.error('Redis SET failed', 
        createLogContext()
          .withMetadata({ 
            errorCode: ERROR_CODES.SYS_REDIS_ERROR,
            key: fullKey, 
            errorMessage: error instanceof Error ? error.message : 'Unknown error' 
          })
          .build()
      );
      throw error;
    }
  }

  public async get<T = any>(key: string, options?: CacheOptions): Promise<T | null> {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis not connected');
    }

    const startTime = Date.now();
    const fullKey = this.config.keyPrefix + key;

    try {
      const value = await this.client.get(fullKey);
      
      if (value === null) {
        return null;
      }

      const duration = Date.now() - startTime;
      logger.debug('Redis GET operation', 
        createLogContext()
          .withMetadata({ key: fullKey, duration, hit: true })
          .build()
      );

      return options?.serialize !== false ? JSON.parse(value) : value;

    } catch (error) {
      logger.error('Redis GET failed', 
        createLogContext()
          .withMetadata({ 
            errorCode: ERROR_CODES.SYS_REDIS_ERROR,
            key: fullKey, 
            errorMessage: error instanceof Error ? error.message : 'Unknown error' 
          })
          .build()
      );
      throw error;
    }
  }

  public async delete(key: string): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis not connected');
    }

    const fullKey = this.config.keyPrefix + key;

    try {
      const result = await this.client.del(fullKey);
      
      logger.debug('Redis DELETE operation', 
        createLogContext()
          .withMetadata({ key: fullKey, deleted: result > 0 })
          .build()
      );

      return result > 0;

    } catch (error) {
      logger.error('Redis DELETE failed', 
        createLogContext()
          .withMetadata({ 
            errorCode: ERROR_CODES.SYS_REDIS_ERROR,
            key: fullKey, 
            errorMessage: error instanceof Error ? error.message : 'Unknown error' 
          })
          .build()
      );
      throw error;
    }
  }

  public async publish(channel: string, message: any): Promise<void> {
    if (!this.publisher || !this.isPublisherConnected) {
      throw new Error('Redis publisher not connected');
    }

    try {
      const serializedMessage = JSON.stringify(message);
      await this.publisher.publish(channel, serializedMessage);

      logger.debug('Redis PUBLISH operation', 
        createLogContext()
          .withMetadata({ channel, messageSize: serializedMessage.length })
          .build()
      );

    } catch (error) {
      logger.error('Redis PUBLISH failed', 
        createLogContext()
          .withMetadata({ 
            errorCode: ERROR_CODES.SYS_REDIS_ERROR,
            channel, 
            errorMessage: error instanceof Error ? error.message : 'Unknown error' 
          })
          .build()
      );
      throw error;
    }
  }

  public async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
    if (!this.subscriber || !this.isSubscriberConnected) {
      throw new Error('Redis subscriber not connected');
    }

    try {
      await this.subscriber.subscribe(channel, (message: string) => {
        try {
          const parsedMessage = JSON.parse(message);
          callback(parsedMessage);

          logger.debug('Redis message received', 
            createLogContext()
              .withMetadata({ channel, messageSize: message.length })
              .build()
          );

        } catch (error) {
          logger.error('Redis message parsing failed', 
            createLogContext()
              .withMetadata({ 
                errorCode: ERROR_CODES.SYS_REDIS_ERROR,
                channel, 
                message, 
                errorMessage: error instanceof Error ? error.message : 'Unknown error' 
              })
              .build()
          );
        }
      });

      logger.info('Redis subscription established', 
        createLogContext().withMetadata({ channel }).build()
      );

    } catch (error) {
      logger.error('Redis SUBSCRIBE failed', 
        createLogContext()
          .withMetadata({ 
            errorCode: ERROR_CODES.SYS_REDIS_ERROR,
            channel, 
            errorMessage: error instanceof Error ? error.message : 'Unknown error' 
          })
          .build()
      );
      throw error;
    }
  }

  public async healthCheck(): Promise<ServiceHealth> {
    const startTime = Date.now();

    try {
      if (!this.client || !this.isConnected) {
        return {
          name: 'redis',
          status: HealthStatus.UNHEALTHY,
          error: 'Redis not connected',
          lastChecked: new Date(),
        };
      }

      await this.client.ping();
      
      const responseTime = Date.now() - startTime;
      
      logger.health('redis', 'healthy', responseTime);
      
      return {
        name: 'redis',
        status: HealthStatus.HEALTHY,
        responseTime,
        lastChecked: new Date(),
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.health('redis', 'unhealthy', responseTime);
      
      return {
        name: 'redis',
        status: HealthStatus.UNHEALTHY,
        responseTime,
        error: errorMessage,
        lastChecked: new Date(),
      };
    }
  }

  public async disconnect(): Promise<void> {
    const logContext = createLogContext()
      .withMetadata({ reason: 'graceful_shutdown' })
      .build();

    try {
      logger.info('Disconnecting from Redis', logContext);

      const disconnectPromises = [];
      
      if (this.client && this.isConnected) {
        disconnectPromises.push(this.client.disconnect());
      }
      
      if (this.subscriber && this.isSubscriberConnected) {
        disconnectPromises.push(this.subscriber.disconnect());
      }
      
      if (this.publisher && this.isPublisherConnected) {
        disconnectPromises.push(this.publisher.disconnect());
      }

      await Promise.all(disconnectPromises);

      this.isConnected = false;
      this.isSubscriberConnected = false;
      this.isPublisherConnected = false;
      
      logger.info('Redis disconnected successfully', logContext);

    } catch (error) {
      logger.error('Error during Redis disconnection', {
        ...logContext,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorCode: ERROR_CODES.SYS_REDIS_ERROR,
      });
      
      throw error;
    }
  }

  public isHealthy(): boolean {
    return this.isConnected && this.isSubscriberConnected && this.isPublisherConnected;
  }

  public getMetrics(): Record<string, any> {
    return {
      isConnected: this.isConnected,
      isSubscriberConnected: this.isSubscriberConnected,
      isPublisherConnected: this.isPublisherConnected,
      connectionAttempts: this.connectionAttempts,
      keyPrefix: this.config.keyPrefix,
      defaultTTL: this.config.defaultTTL,
    };
  }

  public async ping(): Promise<string> {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis not connected');
    }
    return await this.client.ping();
  }
}

export const redisManager = RedisManager.getInstance();

export const connectRedis = async (): Promise<void> => {
  return await redisManager.connect();
};

export const checkRedisHealth = async (): Promise<ServiceHealth> => {
  return await redisManager.healthCheck();
};

export const setCache = async (key: string, value: any, options?: CacheOptions): Promise<void> => {
  return await redisManager.set(key, value, options);
};

export const getCache = async <T = any>(key: string, options?: CacheOptions): Promise<T | null> => {
  return await redisManager.get<T>(key, options);
};

export const deleteCache = async (key: string): Promise<boolean> => {
  return await redisManager.delete(key);
};

export const publishEvent = async (channel: string, message: any): Promise<void> => {
  return await redisManager.publish(channel, message);
};

export const subscribeToEvents = async (channel: string, callback: (message: any) => void): Promise<void> => {
  return await redisManager.subscribe(channel, callback);
};

export const redis = redisManager;
