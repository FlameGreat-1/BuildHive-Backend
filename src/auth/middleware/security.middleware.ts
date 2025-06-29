import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { buildHiveLogger, buildHiveResponse } from '../../shared';

interface ExtendedRequest extends Request {
  requestId?: string;
}

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export class SecurityMiddleware {
  private readonly logger = buildHiveLogger;

  corsMiddleware = cors({
    origin: (origin, callback) => {
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://buildhive.com.au',
        'https://app.buildhive.com.au',
        'https://admin.buildhive.com.au'
      ];

      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        this.logger.warn('CORS blocked request', {
          origin,
          allowedOrigins,
          timestamp: new Date().toISOString()
        });
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-API-Key',
      'X-Client-Version',
      'X-Request-ID'
    ],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'X-Request-ID'
    ],
    maxAge: 86400
  });

  helmetMiddleware = helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", "https://api.buildhive.com.au"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        manifestSrc: ["'self'"],
        workerSrc: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    noSniff: true,
    frameguard: { action: 'deny' },
    xssFilter: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" }
  });

  sanitizeRequest = (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (req.body && typeof req.body === 'object') {
        req.body = this.sanitizeObject(req.body);
      }

      if (req.query && typeof req.query === 'object') {
        req.query = this.sanitizeObject(req.query);
      }

      if (req.params && typeof req.params === 'object') {
        req.params = this.sanitizeObject(req.params);
      }

      next();

    } catch (error) {
      this.logger.error('Request sanitization failed', error as Error, {
        path: req.path,
        method: req.method,
        ip: req.ip
      });

      res.status(400).json(buildHiveResponse.error(
        'Invalid request data',
        'INVALID_REQUEST_DATA'
      ));
    }
  };

  ipFilter = (req: Request, res: Response, next: NextFunction): void => {
    const clientIP = this.getClientIP(req);
    
    const blacklistedIPs = process.env.BLACKLISTED_IPS?.split(',') || [];
    if (blacklistedIPs.includes(clientIP)) {
      this.logger.warn('Blocked blacklisted IP', {
        ip: clientIP,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent')
      });

      return res.status(403).json(buildHiveResponse.error(
        'Access denied',
        'IP_BLOCKED'
      ));
    }

    const whitelistedIPs = process.env.WHITELISTED_IPS?.split(',') || [];
    if (whitelistedIPs.length > 0 && !whitelistedIPs.includes(clientIP)) {
      this.logger.warn('Blocked non-whitelisted IP', {
        ip: clientIP,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent')
      });

      return res.status(403).json(buildHiveResponse.error(
        'Access denied',
        'IP_NOT_WHITELISTED'
      ));
    }

    next();
  };

  requestSizeLimiter = (maxSize: string = '10mb') => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const contentLength = req.get('Content-Length');
      
      if (contentLength) {
        const sizeInBytes = parseInt(contentLength);
        const maxSizeInBytes = this.parseSize(maxSize);
        
        if (sizeInBytes > maxSizeInBytes) {
          this.logger.warn('Request size exceeded limit', {
            contentLength: sizeInBytes,
            maxSize: maxSizeInBytes,
            path: req.path,
            method: req.method,
            ip: req.ip
          });

          return res.status(413).json(buildHiveResponse.error(
            'Request entity too large',
            'REQUEST_TOO_LARGE',
            { maxSize, currentSize: contentLength }
          ));
        }
      }

      next();
    };
  };

  validateApiKey = (req: Request, res: Response, next: NextFunction): void => {
    const apiKey = req.get('X-API-Key');
    
    if (!apiKey) {
      return res.status(401).json(buildHiveResponse.error(
        'API key required',
        'API_KEY_REQUIRED'
      ));
    }

    const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];
    
    if (!validApiKeys.includes(apiKey)) {
      this.logger.warn('Invalid API key used', {
        apiKey: this.maskApiKey(apiKey),
        ip: req.ip,
        path: req.path,
        method: req.method
      });

      return res.status(401).json(buildHiveResponse.error(
        'Invalid API key',
        'INVALID_API_KEY'
      ));
    }

    this.logger.debug('API key validated', {
      apiKey: this.maskApiKey(apiKey),
      ip: req.ip,
      path: req.path
    });

    next();
  };

  generateRequestId = (req: ExtendedRequest, res: Response, next: NextFunction): void => {
    const requestId = req.get('X-Request-ID') || this.generateUUID();
    
    req.requestId = requestId;
    res.set('X-Request-ID', requestId);
    
    next();
  };

  securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
    res.removeHeader('X-Powered-By');
    
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
      'X-BuildHive-Version': process.env.APP_VERSION || '1.0.0'
    });

    next();
  };

  private sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return this.sanitizeValue(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = this.sanitizeValue(key);
      sanitized[sanitizedKey] = this.sanitizeObject(value);
    }

    return sanitized;
  }

  private sanitizeValue(value: any): any {
    if (typeof value !== 'string') {
      return value;
    }

    return value
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/[<>]/g, '')
      .trim();
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

  private parseSize(size: string): number {
    const units: { [key: string]: number } = {
      'b': 1,
      'kb': 1024,
      'mb': 1024 * 1024,
      'gb': 1024 * 1024 * 1024
    };

    const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
    if (!match) {
      throw new Error(`Invalid size format: ${size}`);
    }

    const value = parseFloat(match[1]);
    const unit = match[2] || 'b';

    return Math.floor(value * units[unit]);
  }

  private maskApiKey(apiKey: string): string {
    if (apiKey.length <= 8) {
      return '*'.repeat(apiKey.length);
    }
    return apiKey.substring(0, 4) + '*'.repeat(apiKey.length - 8) + apiKey.substring(apiKey.length - 4);
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

export function createSecurityMiddleware(): SecurityMiddleware {
  return new SecurityMiddleware();
}

export function createSecurityMiddlewareFunctions() {
  const securityMiddleware = new SecurityMiddleware();
  
  return {
    cors: securityMiddleware.corsMiddleware,
    helmet: securityMiddleware.helmetMiddleware,
    sanitizeRequest: securityMiddleware.sanitizeRequest,
    ipFilter: securityMiddleware.ipFilter,
    requestSizeLimiter: securityMiddleware.requestSizeLimiter,
    validateApiKey: securityMiddleware.validateApiKey,
    generateRequestId: securityMiddleware.generateRequestId,
    securityHeaders: securityMiddleware.securityHeaders
  };
}

export default SecurityMiddleware;
