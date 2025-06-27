import winston from 'winston';
import { LogLevel, Environment, LogContext } from '@/types/common.types';
import { MONITORING_CONSTANTS, ENVIRONMENT_CONSTANTS } from './constants';

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
} as const;

const LOG_COLORS = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
} as const;

const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS',
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      service: 'BuildHive-API',
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      pid: process.pid,
      hostname: process.env.HOSTNAME || 'localhost',
      ...meta,
    };

    return JSON.stringify(logEntry);
  })
);

const consoleFormat = winston.format.combine(
  winston.format.colorize({ colors: LOG_COLORS }),
  winston.format.timestamp({
    format: 'HH:mm:ss',
  }),
  winston.format.printf((info) => {
    const { timestamp, level, message, requestId, userId, ...meta } = info;
    
    let logMessage = `${timestamp} [${level}]`;
    
    if (requestId) logMessage += ` [${requestId}]`;
    if (userId) logMessage += ` [User:${userId}]`;
    
    logMessage += `: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta)}`;
    }
    
    return logMessage;
  })
);

class EnterpriseLogger {
  private logger: winston.Logger;
  private environment: string;
  private defaultContext?: LogContext;

  constructor() {
    this.environment = process.env.NODE_ENV || 'development';
    this.logger = this.createLogger();
  }

  private createLogger(): winston.Logger {
    const transports: winston.transport[] = [];

    transports.push(
      new winston.transports.Console({
        level: this.getLogLevel(),
        format: this.environment === 'production' ? customFormat : consoleFormat,
        handleExceptions: true,
        handleRejections: true,
      })
    );

    if (this.environment !== 'development') {
      transports.push(
        new winston.transports.File({
          filename: 'logs/app.log',
          level: 'info',
          format: customFormat,
          maxsize: 10 * 1024 * 1024,
          maxFiles: 10,
          tailable: true,
        })
      );

      transports.push(
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          format: customFormat,
          maxsize: 10 * 1024 * 1024,
          maxFiles: 10,
          tailable: true,
        })
      );

      transports.push(
        new winston.transports.File({
          filename: 'logs/audit.log',
          level: 'info',
          format: customFormat,
          maxsize: 50 * 1024 * 1024,
          maxFiles: 50,
          tailable: true,
        })
      );
    }

    return winston.createLogger({
      levels: LOG_LEVELS,
      level: this.getLogLevel(),
      format: customFormat,
      transports,
      exitOnError: false,
      silent: process.env.NODE_ENV === 'test',
    });
  }

  private getLogLevel(): string {
    const env = this.environment as keyof typeof ENVIRONMENT_CONSTANTS;
    return ENVIRONMENT_CONSTANTS[env]?.LOG_LEVEL || 'info';
  }

  private mergeContext(context?: LogContext): LogContext {
    return { ...this.defaultContext, ...context };
  }

  public error(message: string, context?: LogContext): void {
    this.logger.error(message, {
      ...this.mergeContext(context),
      severity: 'high',
      alertRequired: true,
    });
  }

  public warn(message: string, context?: LogContext): void {
    this.logger.warn(message, {
      ...this.mergeContext(context),
      severity: 'medium',
    });
  }

  public info(message: string, context?: LogContext): void {
    this.logger.info(message, {
      ...this.mergeContext(context),
      severity: 'low',
    });
  }

  public debug(message: string, context?: LogContext): void {
    this.logger.debug(message, {
      ...this.mergeContext(context),
      severity: 'low',
    });
  }

  public audit(action: string, resource: string, context: LogContext): void {
    this.logger.info(`AUDIT: ${action} ${resource}`, {
      ...this.mergeContext(context),
      type: 'audit',
      action,
      resource,
      severity: 'medium',
      compliance: true,
    });
  }

  public security(event: string, context: LogContext): void {
    this.logger.warn(`SECURITY: ${event}`, {
      ...this.mergeContext(context),
      type: 'security',
      event,
      severity: 'high',
      alertRequired: true,
      compliance: true,
    });
  }

  public performance(operation: string, duration: number, context?: LogContext): void {
    const severity = duration > MONITORING_CONSTANTS.ALERTS.RESPONSE_TIME_THRESHOLD ? 'medium' : 'low';
    
    this.logger.info(`PERFORMANCE: ${operation} completed in ${duration}ms`, {
      ...this.mergeContext(context),
      type: 'performance',
      operation,
      duration,
      severity,
      alertRequired: severity === 'medium',
    });
  }

  public business(event: string, context: LogContext): void {
    this.logger.info(`BUSINESS: ${event}`, {
      ...this.mergeContext(context),
      type: 'business',
      event,
      severity: 'low',
    });
  }

  public request(method: string, url: string, statusCode: number, responseTime: number, context?: LogContext): void {
    const level = statusCode >= 400 ? 'warn' : 'info';
    const severity = statusCode >= 500 ? 'high' : statusCode >= 400 ? 'medium' : 'low';
    
    this.logger[level](`${method} ${url} ${statusCode} - ${responseTime}ms`, {
      ...this.mergeContext(context),
      type: 'request',
      method,
      url,
      statusCode,
      responseTime,
      severity,
    });
  }

  public database(operation: string, table: string, duration: number, context?: LogContext): void {
    this.logger.debug(`DB: ${operation} on ${table} - ${duration}ms`, {
      ...this.mergeContext(context),
      type: 'database',
      operation,
      table,
      duration,
      severity: 'low',
    });
  }

  public external(service: string, operation: string, success: boolean, responseTime: number, context?: LogContext): void {
    const level = success ? 'info' : 'warn';
    const severity = success ? 'low' : 'medium';
    
    this.logger[level](`EXTERNAL: ${service} ${operation} ${success ? 'SUCCESS' : 'FAILED'} - ${responseTime}ms`, {
      ...this.mergeContext(context),
      type: 'external',
      service,
      operation,
      success,
      responseTime,
      severity,
    });
  }

  public health(service: string, status: 'healthy' | 'degraded' | 'unhealthy', responseTime?: number): void {
    const level = status === 'healthy' ? 'info' : status === 'degraded' ? 'warn' : 'error';
    const severity = status === 'healthy' ? 'low' : status === 'degraded' ? 'medium' : 'high';
    
    this.logger[level](`HEALTH: ${service} is ${status.toUpperCase()}`, {
      type: 'health',
      service,
      status,
      responseTime,
      severity,
      alertRequired: status === 'unhealthy',
    });
  }

  public logError(error: Error, context?: LogContext): void {
    this.logger.error(error.message, {
      ...this.mergeContext(context),
      type: 'error',
      errorName: error.name,
      errorMessage: error.message,
      stackTrace: error.stack,
      severity: 'high',
      alertRequired: true,
    });
  }

  public withCorrelation(correlationId: string): EnterpriseLogger {
    const correlatedLogger = Object.create(this);
    correlatedLogger.defaultContext = { ...this.defaultContext, correlationId };
    return correlatedLogger;
  }

  public withUser(userId: string, userType?: string): EnterpriseLogger {
    const userLogger = Object.create(this);
    userLogger.defaultContext = { ...this.defaultContext, userId, userType };
    return userLogger;
  }

  public withRequest(requestId: string, method: string, url: string, ipAddress?: string): EnterpriseLogger {
    const requestLogger = Object.create(this);
    requestLogger.defaultContext = { ...this.defaultContext, requestId, method, url, ipAddress };
    return requestLogger;
  }
}

export const logger = new EnterpriseLogger();

export class LogContextBuilder {
  private context: LogContext = {};

  public withUser(userId: string, userType?: string): LogContextBuilder {
    this.context.userId = userId;
    if (userType) this.context.metadata = { ...this.context.metadata, userType };
    return this;
  }

  public withRequest(requestId: string, method: string, url: string): LogContextBuilder {
    this.context.requestId = requestId;
    this.context.method = method;
    this.context.url = url;
    return this;
  }

  public withError(errorCode: string, stackTrace?: string): LogContextBuilder {
    this.context.errorMessage = errorCode;
    if (stackTrace) this.context.stack = stackTrace;
    return this;
  }

  public withMetadata(metadata: Record<string, any>): LogContextBuilder {
    this.context.metadata = { ...this.context.metadata, ...metadata };
    return this;
  }

  public build(): LogContext {
    return { ...this.context };
  }
}

export const createLogContext = (): LogContextBuilder => new LogContextBuilder();
