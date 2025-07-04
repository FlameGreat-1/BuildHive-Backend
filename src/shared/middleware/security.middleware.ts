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
      res.status(403).json({
        success: false,
        message: 'Forbidden: Invalid origin',
        timestamp: new Date().toISOString(),
        requestId: res.locals.requestId || 'unknown'
      });
      return;
    }
  }

  next();
};

export const validateJobOwnership = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId) {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (userRole !== 'tradie' && userRole !== 'enterprise') {
    res.status(403).json({
      success: false,
      message: 'Insufficient permissions for job operations',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  next();
};

export const validateFileUpload = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  const maxFileSize = 10 * 1024 * 1024; // 10MB

  if (req.file) {
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      res.status(400).json({
        success: false,
        message: 'Invalid file type. Only images and documents are allowed',
        timestamp: new Date().toISOString(),
        requestId: res.locals.requestId || 'unknown'
      });
      return;
    }

    if (req.file.size > maxFileSize) {
      res.status(400).json({
        success: false,
        message: 'File size exceeds maximum allowed limit of 10MB',
        timestamp: new Date().toISOString(),
        requestId: res.locals.requestId || 'unknown'
      });
      return;
    }
  }

  next();
};

export const validateJobData = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { title, description, clientEmail, siteAddress } = req.body;

  if (title && typeof title === 'string' && title.length > 200) {
    res.status(400).json({
      success: false,
      message: 'Job title cannot exceed 200 characters',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (description && typeof description === 'string' && description.length > 2000) {
    res.status(400).json({
      success: false,
      message: 'Job description cannot exceed 2000 characters',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (clientEmail && typeof clientEmail === 'string') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clientEmail)) {
      res.status(400).json({
        success: false,
        message: 'Invalid email format',
        timestamp: new Date().toISOString(),
        requestId: res.locals.requestId || 'unknown'
      });
      return;
    }
  }

  next();
};

export const sanitizeJobInput = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.body) {
    const sanitizeString = (str: string): string => {
      return str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+\s*=/gi, '');
    };

    if (req.body.title && typeof req.body.title === 'string') {
      req.body.title = sanitizeString(req.body.title.trim());
    }

    if (req.body.description && typeof req.body.description === 'string') {
      req.body.description = sanitizeString(req.body.description.trim());
    }

    if (req.body.clientName && typeof req.body.clientName === 'string') {
      req.body.clientName = sanitizeString(req.body.clientName.trim());
    }

    if (req.body.siteAddress && typeof req.body.siteAddress === 'string') {
      req.body.siteAddress = sanitizeString(req.body.siteAddress.trim());
    }

    if (req.body.notes && Array.isArray(req.body.notes)) {
      req.body.notes = req.body.notes.map((note: string) => 
        typeof note === 'string' ? sanitizeString(note.trim()) : note
      );
    }
  }

  next();
};

export const validateEnterpriseAccess = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const userRole = req.user?.role;

  if (userRole !== 'enterprise') {
    res.status(403).json({
      success: false,
      message: 'Enterprise access required',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  next();
};
