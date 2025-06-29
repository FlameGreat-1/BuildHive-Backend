import winston from 'winston';
import { env, isProduction, isDevelopment } from '../../config/auth';

// Log levels configuration
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
} as const;

// Custom log format for BuildHive
const buildHiveFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, service, userId, action, ...meta }) => {
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      service: service || 'BuildHive-Auth',
      message,
      ...(userId && { userId }),
      ...(action && { action }),
      ...(Object.keys(meta).length > 0 && { meta }),
    };
    
    return JSON.stringify(logEntry);
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss',
  }),
  winston.format.printf(({ timestamp, level, message, service }) => {
    return `[${timestamp}] ${level} [${service || 'BuildHive'}]: ${message}`;
  })
);

// Create Winston logger instance
const logger = winston.createLogger({
  levels: LOG_LEVELS,
  level: env.LOG_LEVEL,
  format: buildHiveFormat,
  defaultMeta: {
    service: 'BuildHive-Auth',
    environment: env.NODE_ENV,
  },
  transports: [
    // Error logs - separate file
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    
    // Combined logs
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 10,
    }),
  ],
  
  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({
      filename: 'logs/exceptions.log',
      maxsize: 5242880, // 5MB
      maxFiles: 3,
    }),
  ],
  
  // Handle unhandled promise rejections
  rejectionHandlers: [
    new winston.transports.File({
      filename: 'logs/rejections.log',
      maxsize: 5242880, // 5MB
      maxFiles: 3,
    }),
  ],
});

// Add console transport for development
if (isDevelopment()) {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
  }));
}

// Logger interface for type safety
interface LogContext {
  userId?: string;
  action?: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  duration?: number;
  statusCode?: number;
  [key: string]: any;
}

// Enhanced logger class with BuildHive-specific methods
class BuildHiveLogger {
  private logger: winston.Logger;

  constructor(logger: winston.Logger) {
    this.logger = logger;
  }

  // Authentication specific logging
  auth = {
    login: (userId: string, ip: string, success: boolean, context?: LogContext) => {
      const level = success ? 'info' : 'warn';
      const message = success ? 'User login successful' : 'User login failed';
      
      this.logger.log(level, message, {
        action: 'AUTH_LOGIN',
        userId,
        ip,
        success,
        ...context,
      });
    },

    register: (email: string, role: string, ip: string, context?: LogContext) => {
      this.logger.info('User registration initiated', {
        action: 'AUTH_REGISTER',
        email,
        role,
        ip,
        ...context,
      });
    },

    logout: (userId: string, ip: string, context?: LogContext) => {
      this.logger.info('User logout', {
        action: 'AUTH_LOGOUT',
        userId,
        ip,
        ...context,
      });
    },

    passwordReset: (email: string, ip: string, context?: LogContext) => {
      this.logger.info('Password reset requested', {
        action: 'AUTH_PASSWORD_RESET',
        email,
        ip,
        ...context,
      });
    },

    emailVerification: (userId: string, email: string, success: boolean, context?: LogContext) => {
      const level = success ? 'info' : 'warn';
      const message = success ? 'Email verification successful' : 'Email verification failed';
      
      this.logger.log(level, message, {
        action: 'AUTH_EMAIL_VERIFY',
        userId,
        email,
        success,
        ...context,
      });
    },
  };

  // Profile specific logging
  profile = {
    update: (userId: string, fields: string[], context?: LogContext) => {
      this.logger.info('Profile updated', {
        action: 'PROFILE_UPDATE',
        userId,
        updatedFields: fields,
        ...context,
      });
    },

    imageUpload: (userId: string, fileName: string, fileSize: number, context?: LogContext) => {
      this.logger.info('Profile image uploaded', {
        action: 'PROFILE_IMAGE_UPLOAD',
        userId,
        fileName,
        fileSize,
        ...context,
      });
    },

    verification: (userId: string, verificationType: string, status: string, context?: LogContext) => {
      this.logger.info('Profile verification status changed', {
        action: 'PROFILE_VERIFICATION',
        userId,
        verificationType,
        status,
        ...context,
      });
    },
  };

  // Security logging
  security = {
    suspiciousActivity: (userId: string, activity: string, ip: string, context?: LogContext) => {
      this.logger.warn('Suspicious activity detected', {
        action: 'SECURITY_SUSPICIOUS',
        userId,
        activity,
        ip,
        ...context,
      });
    },

    rateLimitExceeded: (ip: string, endpoint: string, context?: LogContext) => {
      this.logger.warn('Rate limit exceeded', {
        action: 'SECURITY_RATE_LIMIT',
        ip,
        endpoint,
        ...context,
      });
    },

    invalidToken: (token: string, ip: string, context?: LogContext) => {
      this.logger.warn('Invalid token used', {
        action: 'SECURITY_INVALID_TOKEN',
        token: token.substring(0, 10) + '...',
        ip,
        ...context,
      });
    },
  };

  // API request logging
  api = {
    request: (method: string, url: string, statusCode: number, duration: number, context?: LogContext) => {
      const level = statusCode >= 400 ? 'warn' : 'info';
      
      this.logger.log(level, 'API request', {
        action: 'API_REQUEST',
        method,
        url,
        statusCode,
        duration,
        ...context,
      });
    },

    error: (error: Error, context?: LogContext) => {
      this.logger.error('API error', {
        action: 'API_ERROR',
        error: error.message,
        stack: error.stack,
        ...context,
      });
    },
  };

  // Database logging
  database = {
    connection: (database: string, status: 'connected' | 'disconnected' | 'error', context?: LogContext) => {
      const level = status === 'error' ? 'error' : 'info';
      
      this.logger.log(level, `Database ${status}`, {
        action: 'DATABASE_CONNECTION',
        database,
        status,
        ...context,
      });
    },

    query: (collection: string, operation: string, duration: number, context?: LogContext) => {
      this.logger.debug('Database query', {
        action: 'DATABASE_QUERY',
        collection,
        operation,
        duration,
        ...context,
      });
    },
  };

  // Standard logging methods
  info(message: string, context?: LogContext): void {
    this.logger.info(message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.logger.warn(message, context);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.logger.error(message, {
      ...(error && { error: error.message, stack: error.stack }),
      ...context,
    });
  }

  debug(message: string, context?: LogContext): void {
    this.logger.debug(message, context);
  }
}

// Create and export BuildHive logger instance
export const buildHiveLogger = new BuildHiveLogger(logger);

// Export for direct winston access if needed
export { logger as winstonLogger };

export default buildHiveLogger;
