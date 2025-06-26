// src/config/api.ts 

import { logger, createLogContext } from '@/utils/logger';

export interface ApiServiceConfig {
  baseUrl: string;
  version: string;
  serviceName: string;
  environment: string;
  port: number;
  corsOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  maxRequestSize: string;
  requestTimeout: number;
  rateLimiting: {
    enabled: boolean;
    maxRequests: number;
    windowMs: number;
  };
  security: {
    enableHelmet: boolean;
    enableCompression: boolean;
    cookieSecret: string;
    trustProxy: boolean;
  };
}

class ApiConfig {
  private static instance: ApiConfig;
  private config: ApiServiceConfig;

  private constructor() {
    this.config = this.loadProductionConfiguration();
  }

  public static getInstance(): ApiConfig {
    if (!ApiConfig.instance) {
      ApiConfig.instance = new ApiConfig();
    }
    return ApiConfig.instance;
  }

  private loadProductionConfiguration(): ApiServiceConfig {
    // Production-only configuration
    const config: ApiServiceConfig = {
      baseUrl: process.env.API_BASE_URL || 'https://api.tradeconnect.com',
      version: process.env.API_VERSION || 'v1',
      serviceName: process.env.SERVICE_NAME || 'tradeconnect-auth-service',
      environment: process.env.NODE_ENV || 'production',
      port: parseInt(process.env.PORT || '443'),
      corsOrigins: this.getProductionCorsOrigins(),
      allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-Access-Token',
        'X-Device-Fingerprint',
        'X-Request-ID'
      ],
      maxRequestSize: process.env.MAX_REQUEST_SIZE || '10mb',
      requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000'),
      rateLimiting: {
        enabled: true,
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '100'),
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'),
      },
      security: {
        enableHelmet: true,
        enableCompression: true,
        cookieSecret: process.env.COOKIE_SECRET!,
        trustProxy: true,
      },
    };

    // Validate required production environment variables
    this.validateProductionConfig(config);

    logger.info('Production API configuration loaded', 
      createLogContext()
        .withMetadata({ 
          baseUrl: config.baseUrl,
          version: config.version,
          environment: config.environment,
          serviceName: config.serviceName
        })
        .build()
    );

    return config;
  }

  private getProductionCorsOrigins(): string[] {
    if (!process.env.CORS_ORIGINS) {
      throw new Error('CORS_ORIGINS environment variable is required in production');
    }
    
    return process.env.CORS_ORIGINS.split(',').map(origin => origin.trim());
  }

  private validateProductionConfig(config: ApiServiceConfig): void {
    const requiredEnvVars = [
      'API_BASE_URL',
      'CORS_ORIGINS',
      'COOKIE_SECRET',
      'JWT_SECRET',
      'DATABASE_URL',
      'REDIS_URL'
    ];

    const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
    }

    if (config.security.cookieSecret === 'default-secret-change-in-production') {
      throw new Error('COOKIE_SECRET must be set in production');
    }
  }

  public getConfig(): Readonly<ApiServiceConfig> {
    return { ...this.config };
  }

  public getFullUrl(path: string): string {
    return `${this.config.baseUrl}${path}`;
  }
}

export const apiConfig = ApiConfig.getInstance();
export const getApiConfig = (): Readonly<ApiServiceConfig> => apiConfig.getConfig();
export const getFullApiUrl = (path: string): string => apiConfig.getFullUrl(path);
