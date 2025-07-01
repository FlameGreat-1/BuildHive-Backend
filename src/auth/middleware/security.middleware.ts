import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { environment } from '../../config/auth';

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

export const corsOptions = cors({
  origin: (origin, callback) => {
    const allowedOrigins = environment.CORS_ORIGIN.split(',').map(o => o.trim());
    
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-Request-ID'
  ],
  credentials: true,
  maxAge: 86400
});

export const preventXSS = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
};

export const preventClickjacking = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  res.setHeader('X-Frame-Options', 'DENY');
  next();
};

export const preventMimeSniffing = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
};

export const addSecurityHeaders = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  res.setHeader('X-Powered-By', 'BuildHive');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
};

export const validateOrigin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  
  if (environment.NODE_ENV === 'production') {
    const allowedOrigins = environment.CORS_ORIGIN.split(',').map(o => o.trim());
    
    if (origin && !allowedOrigins.includes('*') && !allowedOrigins.includes(origin)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Invalid origin',
        timestamp: new Date().toISOString(),
        requestId: res.locals.requestId || 'unknown'
      });
    }
  }

  next();
};
