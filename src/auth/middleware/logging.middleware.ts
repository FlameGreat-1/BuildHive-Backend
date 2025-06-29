import { Request, Response, NextFunction } from 'express';
import { buildHiveLogger } from '../../shared';
import { performance } from 'perf_hooks';

export interface LoggingOptions {
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  logBody?: boolean;
  logHeaders?: boolean;
  logQuery?: boolean;
  logResponse?: boolean;
  excludePaths?: string[];
  excludeHeaders?: string[];
  maxBodySize?: number;
  sensitiveFields?: string[];
}

interface ExtendedRequest extends Request {
  requestId?: string;
  user?: {
    id: string;
    email?: string;
    role?: string;
  };
}

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      user?: {
        id: string;
        email?: string;
        role?: string;
      };
    }
  }
}

export class LoggingMiddleware {
  private readonly logger = buildHiveLogger;
  private readonly defaultOptions: LoggingOptions = {
    logLevel: 'info',
    logBody: true,
    logHeaders: false,
    logQuery: true,
    logResponse: false,
    excludePaths: ['/health', '/favicon.ico'],
    excludeHeaders: ['authorization', 'cookie', 'x-api-key'],
    maxBodySize: 1024,
    sensitiveFields: ['password', 'token', 'secret', 'key', 'authorization']
  };

  requestLogger = (options: LoggingOptions = {}) => {
    const config = { ...this.defaultOptions, ...options };

    return (req: ExtendedRequest, res: Response, next: NextFunction): void => {
      const startTime = performance.now();
      const requestId = req.requestId || this.generateRequestId();

      if (config.excludePaths?.some(path => req.path.includes(path))) {
        return next();
      }

      this.logIncomingRequest(req, requestId, config);

      const originalJson = res.json.bind(res);
      let responseBody: any = null;

      res.json = function(body: any) {
        responseBody = body;
        return originalJson(body);
      };

      res.on('finish', () => {
        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);

        this.logOutgoingResponse(req, res, responseBody, duration, requestId, config);
      });

      next();
    };
  };

  errorLogger = (error: any, req: ExtendedRequest, res: Response, next: NextFunction): void => {
    const requestId = req.requestId || this.generateRequestId();

    this.logger.error('Request error occurred', error as Error, {
      requestId,
      method: req.method,
      path: req.path,
      ip: this.getClientIP(req),
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      statusCode: res.statusCode,
      stack: error?.stack,
      timestamp: new Date().toISOString()
    });

    next(error);
  };

  auditLogger = (operation: string, details?: any) => {
    return (req: ExtendedRequest, res: Response, next: NextFunction): void => {
      const requestId = req.requestId || this.generateRequestId();
      const userId = req.user?.id;

      this.logger.info('Audit log - Operation started', {
        requestId,
        operation,
        userId,
        method: req.method,
        path: req.path,
        ip: this.getClientIP(req),
        userAgent: req.get('User-Agent'),
        details: this.sanitizeData(details),
        timestamp: new Date().toISOString()
      });

      const originalJson = res.json.bind(res);
      res.json = function(body: any) {
        buildHiveLogger.info('Audit log - Operation completed', {
          requestId,
          operation,
          userId,
          statusCode: res.statusCode,
          success: res.statusCode < 400,
          responseData: body?.success ? 'success' : 'failed',
          timestamp: new Date().toISOString()
        });

        return originalJson(body);
      };

      next();
    };
  };

  performanceLogger = (req: ExtendedRequest, res: Response, next: NextFunction): void => {
    const startTime = performance.now();
    const requestId = req.requestId || this.generateRequestId();

    res.on('finish', () => {
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      if (duration > 1000) {
        this.logger.warn('Slow request detected', {
          requestId,
          method: req.method,
          path: req.path,
          duration: `${duration}ms`,
          ip: this.getClientIP(req),
          userId: req.user?.id,
          statusCode: res.statusCode,
          timestamp: new Date().toISOString()
        });
      }

      this.logger.debug('Request performance', {
        requestId,
        method: req.method,
        path: req.path,
        duration: `${duration}ms`,
        statusCode: res.statusCode,
        contentLength: res.get('Content-Length'),
        timestamp: new Date().toISOString()
      });
    });

    next();
  };

  securityLogger = (event: string, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium') => {
    return (req: ExtendedRequest, res: Response, next: NextFunction): void => {
      const requestId = req.requestId || this.generateRequestId();

      this.logger.warn('Security event detected', {
        requestId,
        event,
        severity,
        method: req.method,
        path: req.path,
        ip: this.getClientIP(req),
        userAgent: req.get('User-Agent'),
        userId: req.user?.id,
        headers: this.sanitizeHeaders(req.headers),
        timestamp: new Date().toISOString()
      });

      next();
    };
  };

  dbOperationLogger = (operation: string, table: string) => {
    return (req: ExtendedRequest, res: Response, next: NextFunction): void => {
      const requestId = req.requestId || this.generateRequestId();
      const userId = req.user?.id;

      this.logger.debug('Database operation', {
        requestId,
        operation,
        table,
        userId,
        method: req.method,
        path: req.path,
        timestamp: new Date().toISOString()
      });

      next();
    };
  };

  private logIncomingRequest(req: ExtendedRequest, requestId: string, config: LoggingOptions): void {
    const logData: any = {
      requestId,
      method: req.method,
      path: req.path,
      ip: this.getClientIP(req),
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    };

    if (config.logQuery && Object.keys(req.query).length > 0) {
      logData.query = this.sanitizeData(req.query);
    }

    if (config.logHeaders) {
      logData.headers = this.sanitizeHeaders(req.headers);
    }

    if (config.logBody && req.body && Object.keys(req.body).length > 0) {
      const bodyString = JSON.stringify(req.body);
      if (bodyString.length <= (config.maxBodySize || 1024)) {
        logData.body = this.sanitizeData(req.body);
      } else {
        logData.body = '[Body too large to log]';
        logData.bodySize = bodyString.length;
      }
    }

    this.logger.info('Incoming request', logData);
  }

  private logOutgoingResponse(
    req: ExtendedRequest, 
    res: Response, 
    responseBody: any, 
    duration: number, 
    requestId: string, 
    config: LoggingOptions
  ): void {
    const logData: any = {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length'),
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    };

    if (config.logResponse && responseBody) {
      const responseString = JSON.stringify(responseBody);
      if (responseString.length <= (config.maxBodySize || 1024)) {
        logData.response = this.sanitizeData(responseBody);
      } else {
        logData.response = '[Response too large to log]';
        logData.responseSize = responseString.length;
      }
    }

    if (res.statusCode >= 500) {
      this.logger.error('Outgoing response - Server Error', logData);
    } else if (res.statusCode >= 400) {
      this.logger.warn('Outgoing response - Client Error', logData);
    } else {
      this.logger.info('Outgoing response - Success', logData);
    }
  }

  private sanitizeData(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item));
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (this.defaultOptions.sensitiveFields?.some(field => 
        key.toLowerCase().includes(field.toLowerCase())
      )) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = this.sanitizeData(value);
      }
    }

    return sanitized;
  }

  private sanitizeHeaders(headers: any): any {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(headers)) {
      if (this.defaultOptions.excludeHeaders?.some(header => 
        key.toLowerCase().includes(header.toLowerCase())
      )) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  private getClientIP(req: Request): string {
    return (
      req.get('CF-Connecting-IP') ||
      req.get('X-Forwarded-For')?.split(',')[0] ||
      req.get('X-Real-IP') ||
      (req.connection as any)?.remoteAddress ||
      (req.socket as any)?.remoteAddress ||
      req.ip ||
      'unknown'
    );
  }

  private generateRequestId(): string {
    return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}

export function createLoggingMiddleware(): LoggingMiddleware {
  return new LoggingMiddleware();
}

export function createLoggingMiddlewareFunctions() {
  const loggingMiddleware = new LoggingMiddleware();
  
  return {
    requestLogger: loggingMiddleware.requestLogger,
    errorLogger: loggingMiddleware.errorLogger,
    auditLogger: loggingMiddleware.auditLogger,
    performanceLogger: loggingMiddleware.performanceLogger,
    securityLogger: loggingMiddleware.securityLogger,
    dbOperationLogger: loggingMiddleware.dbOperationLogger
  };
}

export default LoggingMiddleware;
