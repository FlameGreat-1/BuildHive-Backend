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

export const validateQuoteOwnership = (
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
      message: 'Insufficient permissions for quote operations',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  next();
};

export const validateQuoteData = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { title, description, items, totalAmount, validUntil } = req.body;

  if (title && typeof title === 'string' && title.length > 200) {
    res.status(400).json({
      success: false,
      message: 'Quote title cannot exceed 200 characters',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (description && typeof description === 'string' && description.length > 2000) {
    res.status(400).json({
      success: false,
      message: 'Quote description cannot exceed 2000 characters',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (items && Array.isArray(items)) {
    for (const item of items) {
      if (item.description && typeof item.description === 'string' && item.description.length > 500) {
        res.status(400).json({
          success: false,
          message: 'Quote item description cannot exceed 500 characters',
          timestamp: new Date().toISOString(),
          requestId: res.locals.requestId || 'unknown'
        });
        return;
      }

      if (item.quantity && (typeof item.quantity !== 'number' || item.quantity <= 0)) {
        res.status(400).json({
          success: false,
          message: 'Quote item quantity must be a positive number',
          timestamp: new Date().toISOString(),
          requestId: res.locals.requestId || 'unknown'
        });
        return;
      }

      if (item.unitPrice && (typeof item.unitPrice !== 'number' || item.unitPrice < 0)) {
        res.status(400).json({
          success: false,
          message: 'Quote item unit price must be a non-negative number',
          timestamp: new Date().toISOString(),
          requestId: res.locals.requestId || 'unknown'
        });
        return;
      }
    }
  }

  if (totalAmount && (typeof totalAmount !== 'number' || totalAmount < 0)) {
    res.status(400).json({
      success: false,
      message: 'Quote total amount must be a non-negative number',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (validUntil && typeof validUntil === 'string') {
    const validUntilDate = new Date(validUntil);
    const now = new Date();
    
    if (isNaN(validUntilDate.getTime()) || validUntilDate <= now) {
      res.status(400).json({
        success: false,
        message: 'Quote valid until date must be a future date',
        timestamp: new Date().toISOString(),
        requestId: res.locals.requestId || 'unknown'
      });
      return;
    }
  }

  next();
};

export const sanitizeQuoteInput = (
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

    if (req.body.notes && typeof req.body.notes === 'string') {
      req.body.notes = sanitizeString(req.body.notes.trim());
    }

    if (req.body.termsConditions && typeof req.body.termsConditions === 'string') {
      req.body.termsConditions = sanitizeString(req.body.termsConditions.trim());
    }

    if (req.body.items && Array.isArray(req.body.items)) {
      req.body.items = req.body.items.map((item: any) => ({
        ...item,
        description: typeof item.description === 'string' ? sanitizeString(item.description.trim()) : item.description
      }));
    }

    if (req.body.customMessage && typeof req.body.customMessage === 'string') {
      req.body.customMessage = sanitizeString(req.body.customMessage.trim());
    }
  }

  next();
};

export const validateQuoteStatus = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { status } = req.body;
  const validStatuses = ['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'cancelled'];

  if (status && !validStatuses.includes(status)) {
    res.status(400).json({
      success: false,
      message: 'Invalid quote status',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  next();
};

export const validateQuoteDelivery = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { deliveryMethod, recipientEmail, recipientPhone } = req.body;
  const validMethods = ['email', 'sms', 'pdf', 'portal'];

  if (deliveryMethod && Array.isArray(deliveryMethod)) {
    for (const method of deliveryMethod) {
      if (!validMethods.includes(method)) {
        res.status(400).json({
          success: false,
          message: 'Invalid delivery method',
          timestamp: new Date().toISOString(),
          requestId: res.locals.requestId || 'unknown'
        });
        return;
      }
    }

    if (deliveryMethod.includes('email') && (!recipientEmail || typeof recipientEmail !== 'string')) {
      res.status(400).json({
        success: false,
        message: 'Recipient email is required for email delivery',
        timestamp: new Date().toISOString(),
        requestId: res.locals.requestId || 'unknown'
      });
      return;
    }

    if (deliveryMethod.includes('sms') && (!recipientPhone || typeof recipientPhone !== 'string')) {
      res.status(400).json({
        success: false,
        message: 'Recipient phone is required for SMS delivery',
        timestamp: new Date().toISOString(),
        requestId: res.locals.requestId || 'unknown'
      });
      return;
    }

    if (recipientEmail && typeof recipientEmail === 'string') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(recipientEmail)) {
        res.status(400).json({
          success: false,
          message: 'Invalid recipient email format',
          timestamp: new Date().toISOString(),
          requestId: res.locals.requestId || 'unknown'
        });
        return;
      }
    }

    if (recipientPhone && typeof recipientPhone === 'string') {
      const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
      if (!phoneRegex.test(recipientPhone)) {
        res.status(400).json({
          success: false,
          message: 'Invalid recipient phone format',
          timestamp: new Date().toISOString(),
          requestId: res.locals.requestId || 'unknown'
        });
        return;
      }
    }
  }

  next();
};

export const validateAIPricingRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { jobDescription, jobType, tradieHourlyRate } = req.body;

  if (!jobDescription || typeof jobDescription !== 'string' || jobDescription.trim().length < 10) {
    res.status(400).json({
      success: false,
      message: 'Job description must be at least 10 characters long',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (!jobType || typeof jobType !== 'string') {
    res.status(400).json({
      success: false,
      message: 'Job type is required',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (!tradieHourlyRate || typeof tradieHourlyRate !== 'number' || tradieHourlyRate <= 0) {
    res.status(400).json({
      success: false,
      message: 'Valid tradie hourly rate is required',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  next();
};

export const validatePaymentAccess = (
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

  if (userRole !== 'tradie' && userRole !== 'enterprise' && userRole !== 'client') {
    res.status(403).json({
      success: false,
      message: 'Insufficient permissions for payment operations',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  next();
};

export const validatePaymentData = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { amount, currency, paymentMethod } = req.body;

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    res.status(400).json({
      success: false,
      message: 'Valid payment amount is required',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (amount > 100000) {
    res.status(400).json({
      success: false,
      message: 'Payment amount exceeds maximum limit',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (!currency || typeof currency !== 'string' || !['AUD', 'USD'].includes(currency)) {
    res.status(400).json({
      success: false,
      message: 'Valid currency is required',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  const validPaymentMethods = ['stripe_card', 'apple_pay', 'google_pay'];
  if (!paymentMethod || !validPaymentMethods.includes(paymentMethod)) {
    res.status(400).json({
      success: false,
      message: 'Valid payment method is required',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  next();
};

export const sanitizePaymentInput = (
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

    if (req.body.description && typeof req.body.description === 'string') {
      req.body.description = sanitizeString(req.body.description.trim());
    }

    if (req.body.reason && typeof req.body.reason === 'string') {
      req.body.reason = sanitizeString(req.body.reason.trim());
    }

    if (req.body.metadata && typeof req.body.metadata === 'object') {
      Object.keys(req.body.metadata).forEach(key => {
        if (typeof req.body.metadata[key] === 'string') {
          req.body.metadata[key] = sanitizeString(req.body.metadata[key]);
        }
      });
    }
  }

  next();
};

export const validateWebhookSignature = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const signature = req.headers['stripe-signature'];

  if (!signature) {
    res.status(400).json({
      success: false,
      message: 'Missing webhook signature',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  next();
};

export const validateSubscriptionData = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { plan } = req.body;
  const validPlans = ['basic', 'pro', 'enterprise'];

  if (!plan || !validPlans.includes(plan)) {
    res.status(400).json({
      success: false,
      message: 'Valid subscription plan is required',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  next();
};

export const validateCreditPurchase = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { credits } = req.body;

  if (!credits || typeof credits !== 'number' || credits <= 0) {
    res.status(400).json({
      success: false,
      message: 'Valid credit amount is required',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (credits > 1000) {
    res.status(400).json({
      success: false,
      message: 'Credit purchase exceeds maximum limit',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  next();
};

export const validateRefundData = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { paymentId, amount } = req.body;

  if (!paymentId || typeof paymentId !== 'number') {
    res.status(400).json({
      success: false,
      message: 'Valid payment ID is required',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (amount && (typeof amount !== 'number' || amount <= 0)) {
    res.status(400).json({
      success: false,
      message: 'Refund amount must be a positive number',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  next();
};

export const validateInvoiceData = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { amount, currency, dueDate } = req.body;

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    res.status(400).json({
      success: false,
      message: 'Valid invoice amount is required',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (!currency || typeof currency !== 'string' || !['AUD', 'USD'].includes(currency)) {
    res.status(400).json({
      success: false,
      message: 'Valid currency is required',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (dueDate && typeof dueDate === 'string') {
    const dueDateObj = new Date(dueDate);
    const now = new Date();
    
    if (isNaN(dueDateObj.getTime()) || dueDateObj <= now) {
      res.status(400).json({
        success: false,
        message: 'Invoice due date must be a future date',
        timestamp: new Date().toISOString(),
        requestId: res.locals.requestId || 'unknown'
      });
      return;
    }
  }

  next();
};

export const validatePaymentMethodData = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { stripePaymentMethodId, type } = req.body;
  const validTypes = ['stripe_card', 'apple_pay', 'google_pay'];

  if (!stripePaymentMethodId || typeof stripePaymentMethodId !== 'string') {
    res.status(400).json({
      success: false,
      message: 'Valid Stripe payment method ID is required',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (!type || !validTypes.includes(type)) {
    res.status(400).json({
      success: false,
      message: 'Valid payment method type is required',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  next();
};

export const validateCreditAccess = (
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

  if (userRole !== 'tradie' && userRole !== 'enterprise' && userRole !== 'client') {
    res.status(403).json({
      success: false,
      message: 'Insufficient permissions for credit operations',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  next();
};

export const validateCreditPurchaseData = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { packageType, paymentMethodId } = req.body;
  const validPackageTypes = ['starter', 'standard', 'premium', 'enterprise'];

  if (!packageType || !validPackageTypes.includes(packageType)) {
    res.status(400).json({
      success: false,
      message: 'Valid credit package type is required',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (paymentMethodId && typeof paymentMethodId !== 'number') {
    res.status(400).json({
      success: false,
      message: 'Payment method ID must be a valid number',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  next();
};

export const validateCreditUsageData = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { usageType, creditsToUse, description } = req.body;
  const validUsageTypes = ['job_application', 'profile_boost', 'premium_job_unlock', 'direct_message', 'featured_listing'];

  if (!usageType || !validUsageTypes.includes(usageType)) {
    res.status(400).json({
      success: false,
      message: 'Valid credit usage type is required',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (!creditsToUse || typeof creditsToUse !== 'number' || creditsToUse <= 0) {
    res.status(400).json({
      success: false,
      message: 'Valid credit amount is required',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (creditsToUse > 100) {
    res.status(400).json({
      success: false,
      message: 'Credit usage exceeds maximum limit per transaction',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (!description || typeof description !== 'string' || description.trim().length < 3) {
    res.status(400).json({
      success: false,
      message: 'Valid usage description is required',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  next();
};

export const validateAutoTopupData = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { enabled, triggerBalance, topupAmount, packageType, paymentMethodId } = req.body;
  const validPackageTypes = ['starter', 'standard', 'premium', 'enterprise'];

  if (typeof enabled !== 'boolean') {
    res.status(400).json({
      success: false,
      message: 'Auto topup enabled status must be a boolean',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (enabled) {
    if (!triggerBalance || typeof triggerBalance !== 'number' || triggerBalance < 0) {
      res.status(400).json({
        success: false,
        message: 'Valid trigger balance is required',
        timestamp: new Date().toISOString(),
        requestId: res.locals.requestId || 'unknown'
      });
      return;
    }

    if (!topupAmount || typeof topupAmount !== 'number' || topupAmount <= 0) {
      res.status(400).json({
        success: false,
        message: 'Valid topup amount is required',
        timestamp: new Date().toISOString(),
        requestId: res.locals.requestId || 'unknown'
      });
      return;
    }

    if (!packageType || !validPackageTypes.includes(packageType)) {
      res.status(400).json({
        success: false,
        message: 'Valid package type is required',
        timestamp: new Date().toISOString(),
        requestId: res.locals.requestId || 'unknown'
      });
      return;
    }

    if (!paymentMethodId || typeof paymentMethodId !== 'number') {
      res.status(400).json({
        success: false,
        message: 'Valid payment method ID is required',
        timestamp: new Date().toISOString(),
        requestId: res.locals.requestId || 'unknown'
      });
      return;
    }
  }

  next();
};

export const validateCreditRefundData = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { transactionId, reason } = req.body;

  if (!transactionId || typeof transactionId !== 'number') {
    res.status(400).json({
      success: false,
      message: 'Valid transaction ID is required',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
    res.status(400).json({
      success: false,
      message: 'Valid refund reason is required (minimum 5 characters)',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (reason.length > 500) {
    res.status(400).json({
      success: false,
      message: 'Refund reason cannot exceed 500 characters',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  next();
};

export const validateJobApplicationCreditData = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { jobId, creditsRequired } = req.body;

  if (!jobId || typeof jobId !== 'number') {
    res.status(400).json({
      success: false,
      message: 'Valid job ID is required',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (!creditsRequired || typeof creditsRequired !== 'number' || creditsRequired <= 0) {
    res.status(400).json({
      success: false,
      message: 'Valid credits required amount is needed',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (creditsRequired > 10) {
    res.status(400).json({
      success: false,
      message: 'Job application credits exceed maximum limit',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  next();
};

export const validateProfileBoostData = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { boostType, duration, creditsRequired } = req.body;
  const validBoostTypes = ['basic', 'premium', 'featured'];

  if (!boostType || !validBoostTypes.includes(boostType)) {
    res.status(400).json({
      success: false,
      message: 'Valid boost type is required',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (!duration || typeof duration !== 'number' || duration <= 0) {
    res.status(400).json({
      success: false,
      message: 'Valid boost duration is required',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (duration > 30) {
    res.status(400).json({
      success: false,
      message: 'Boost duration cannot exceed 30 days',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (!creditsRequired || typeof creditsRequired !== 'number' || creditsRequired <= 0) {
    res.status(400).json({
      success: false,
      message: 'Valid credits required amount is needed',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  next();
};

export const validatePremiumJobUnlockData = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { jobId, creditsRequired } = req.body;

  if (!jobId || typeof jobId !== 'number') {
    res.status(400).json({
      success: false,
      message: 'Valid job ID is required',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (!creditsRequired || typeof creditsRequired !== 'number' || creditsRequired <= 0) {
    res.status(400).json({
      success: false,
      message: 'Valid credits required amount is needed',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (creditsRequired > 20) {
    res.status(400).json({
      success: false,
      message: 'Premium unlock credits exceed maximum limit',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  next();
};

export const sanitizeCreditInput = (
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

    if (req.body.description && typeof req.body.description === 'string') {
      req.body.description = sanitizeString(req.body.description.trim());
    }

    if (req.body.reason && typeof req.body.reason === 'string') {
      req.body.reason = sanitizeString(req.body.reason.trim());
    }

    if (req.body.boostType && typeof req.body.boostType === 'string') {
      req.body.boostType = sanitizeString(req.body.boostType.trim());
    }

    if (req.body.metadata && typeof req.body.metadata === 'object') {
      Object.keys(req.body.metadata).forEach(key => {
        if (typeof req.body.metadata[key] === 'string') {
          req.body.metadata[key] = sanitizeString(req.body.metadata[key]);
        }
      });
    }
  }

  next();
};

export const validateMarketplaceJobAccess = (
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

  if (userRole !== 'client' && userRole !== 'tradie' && userRole !== 'enterprise') {
    res.status(403).json({
      success: false,
      message: 'Insufficient permissions for marketplace operations',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  next();
};

export const validateMarketplaceJobData = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { title, description, location, estimatedBudget, dateRequired, urgencyLevel } = req.body;

  if (!title || typeof title !== 'string' || title.trim().length < 5) {
    res.status(400).json({
      success: false,
      message: 'Job title must be at least 5 characters long',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (title.length > 200) {
    res.status(400).json({
      success: false,
      message: 'Job title cannot exceed 200 characters',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (!description || typeof description !== 'string' || description.trim().length < 20) {
    res.status(400).json({
      success: false,
      message: 'Job description must be at least 20 characters long',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (description.length > 2000) {
    res.status(400).json({
      success: false,
      message: 'Job description cannot exceed 2000 characters',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (!location || typeof location !== 'string' || location.trim().length < 3) {
    res.status(400).json({
      success: false,
      message: 'Valid location is required',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (estimatedBudget && (typeof estimatedBudget !== 'number' || estimatedBudget <= 0)) {
    res.status(400).json({
      success: false,
      message: 'Estimated budget must be a positive number',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (estimatedBudget && estimatedBudget > 1000000) {
    res.status(400).json({
      success: false,
      message: 'Estimated budget exceeds maximum limit',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (!dateRequired || typeof dateRequired !== 'string') {
    res.status(400).json({
      success: false,
      message: 'Date required is mandatory',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  const dateRequiredObj = new Date(dateRequired);
  const now = new Date();
  if (isNaN(dateRequiredObj.getTime()) || dateRequiredObj <= now) {
    res.status(400).json({
      success: false,
      message: 'Date required must be a future date',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  const validUrgencyLevels = ['low', 'medium', 'high', 'urgent'];
  if (urgencyLevel && !validUrgencyLevels.includes(urgencyLevel)) {
    res.status(400).json({
      success: false,
      message: 'Invalid urgency level',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  next();
};

export const sanitizeMarketplaceJobInput = (
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

    if (req.body.location && typeof req.body.location === 'string') {
      req.body.location = sanitizeString(req.body.location.trim());
    }

    if (req.body.clientName && typeof req.body.clientName === 'string') {
      req.body.clientName = sanitizeString(req.body.clientName.trim());
    }

    if (req.body.clientCompany && typeof req.body.clientCompany === 'string') {
      req.body.clientCompany = sanitizeString(req.body.clientCompany.trim());
    }
  }

  next();
};

export const validateJobApplicationData = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { marketplaceJobId, customQuote, proposedTimeline, approachDescription, availabilityDates } = req.body;

  if (!marketplaceJobId || typeof marketplaceJobId !== 'number') {
    res.status(400).json({
      success: false,
      message: 'Valid marketplace job ID is required',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (!customQuote || typeof customQuote !== 'number' || customQuote <= 0) {
    res.status(400).json({
      success: false,
      message: 'Valid custom quote is required',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (customQuote > 1000000) {
    res.status(400).json({
      success: false,
      message: 'Custom quote exceeds maximum limit',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (!proposedTimeline || typeof proposedTimeline !== 'string' || proposedTimeline.trim().length < 10) {
    res.status(400).json({
      success: false,
      message: 'Proposed timeline must be at least 10 characters long',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (!approachDescription || typeof approachDescription !== 'string' || approachDescription.trim().length < 20) {
    res.status(400).json({
      success: false,
      message: 'Approach description must be at least 20 characters long',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (approachDescription.length > 1000) {
    res.status(400).json({
      success: false,
      message: 'Approach description cannot exceed 1000 characters',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (!availabilityDates || !Array.isArray(availabilityDates) || availabilityDates.length === 0) {
    res.status(400).json({
      success: false,
      message: 'At least one availability date is required',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  for (const date of availabilityDates) {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      res.status(400).json({
        success: false,
        message: 'Invalid availability date format',
        timestamp: new Date().toISOString(),
        requestId: res.locals.requestId || 'unknown'
      });
      return;
    }
  }

  next();
};

export const sanitizeJobApplicationInput = (
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

    if (req.body.proposedTimeline && typeof req.body.proposedTimeline === 'string') {
      req.body.proposedTimeline = sanitizeString(req.body.proposedTimeline.trim());
    }

    if (req.body.approachDescription && typeof req.body.approachDescription === 'string') {
      req.body.approachDescription = sanitizeString(req.body.approachDescription.trim());
    }

    if (req.body.materialsList && typeof req.body.materialsList === 'string') {
      req.body.materialsList = sanitizeString(req.body.materialsList.trim());
    }

    if (req.body.coverMessage && typeof req.body.coverMessage === 'string') {
      req.body.coverMessage = sanitizeString(req.body.coverMessage.trim());
    }

    if (req.body.relevantExperience && typeof req.body.relevantExperience === 'string') {
      req.body.relevantExperience = sanitizeString(req.body.relevantExperience.trim());
    }

    if (req.body.questionsForClient && typeof req.body.questionsForClient === 'string') {
      req.body.questionsForClient = sanitizeString(req.body.questionsForClient.trim());
    }

    if (req.body.specialOffers && typeof req.body.specialOffers === 'string') {
      req.body.specialOffers = sanitizeString(req.body.specialOffers.trim());
    }
  }

  next();
};

export const validateTradieAccess = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const userRole = req.user?.role;

  if (userRole !== 'tradie' && userRole !== 'enterprise') {
    res.status(403).json({
      success: false,
      message: 'Tradie access required',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  next();
};

export const validateClientAccess = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const userRole = req.user?.role;

  if (userRole !== 'client' && userRole !== 'enterprise') {
    res.status(403).json({
      success: false,
      message: 'Client access required',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  next();
};

export const validateTradieSelectionData = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { marketplaceJobId, selectedApplicationId, selectionReason, negotiatedQuote } = req.body;

  if (!marketplaceJobId || typeof marketplaceJobId !== 'number') {
    res.status(400).json({
      success: false,
      message: 'Valid marketplace job ID is required',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (!selectedApplicationId || typeof selectedApplicationId !== 'number') {
    res.status(400).json({
      success: false,
      message: 'Valid application ID is required',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (selectionReason && typeof selectionReason === 'string' && selectionReason.length > 500) {
    res.status(400).json({
      success: false,
      message: 'Selection reason cannot exceed 500 characters',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (negotiatedQuote && (typeof negotiatedQuote !== 'number' || negotiatedQuote <= 0)) {
    res.status(400).json({
      success: false,
      message: 'Negotiated quote must be a positive number',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (negotiatedQuote && negotiatedQuote > 1000000) {
    res.status(400).json({
      success: false,
      message: 'Negotiated quote exceeds maximum limit',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  next();
};

export const validateApplicationStatusData = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { status, reason, feedback } = req.body;
  const validStatuses = ['submitted', 'under_review', 'selected', 'rejected', 'withdrawn'];

  if (!status || !validStatuses.includes(status)) {
    res.status(400).json({
      success: false,
      message: 'Valid application status is required',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (reason && typeof reason === 'string' && reason.length > 500) {
    res.status(400).json({
      success: false,
      message: 'Status reason cannot exceed 500 characters',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (feedback && typeof feedback === 'string' && feedback.length > 1000) {
    res.status(400).json({
      success: false,
      message: 'Feedback cannot exceed 1000 characters',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  next();
};

export const validateMarketplaceSearchData = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { query, minBudget, maxBudget, dateRange } = req.query;

  if (query && typeof query === 'string' && query.length > 100) {
    res.status(400).json({
      success: false,
      message: 'Search query cannot exceed 100 characters',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (minBudget && (isNaN(Number(minBudget)) || Number(minBudget) < 0)) {
    res.status(400).json({
      success: false,
      message: 'Minimum budget must be a non-negative number',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (maxBudget && (isNaN(Number(maxBudget)) || Number(maxBudget) < 0)) {
    res.status(400).json({
      success: false,
      message: 'Maximum budget must be a non-negative number',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (minBudget && maxBudget && Number(minBudget) > Number(maxBudget)) {
    res.status(400).json({
      success: false,
      message: 'Minimum budget cannot be greater than maximum budget',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  next();
};

export const validateMarketplaceApplicationCreditData = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { marketplaceJobId, applicationData } = req.body;

  if (!marketplaceJobId || typeof marketplaceJobId !== 'number') {
    res.status(400).json({
      success: false,
      message: 'Valid marketplace job ID is required',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  if (!applicationData || typeof applicationData !== 'object') {
    res.status(400).json({
      success: false,
      message: 'Valid application data is required',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  next();
};

export const validateCreditCostCalculationData = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { marketplaceJobId, jobType, urgencyLevel } = req.body;

  if (!marketplaceJobId || typeof marketplaceJobId !== 'number') {
    res.status(400).json({
      success: false,
      message: 'Valid marketplace job ID is required',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  const validJobTypes = ['electrical', 'plumbing', 'carpentry', 'painting', 'roofing', 'hvac', 'landscaping', 'cleaning', 'handyman', 'general'];
  if (jobType && !validJobTypes.includes(jobType)) {
    res.status(400).json({
      success: false,
      message: 'Invalid job type',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  const validUrgencyLevels = ['low', 'medium', 'high', 'urgent'];
  if (urgencyLevel && !validUrgencyLevels.includes(urgencyLevel)) {
    res.status(400).json({
      success: false,
      message: 'Invalid urgency level',
      timestamp: new Date().toISOString(),
      requestId: res.locals.requestId || 'unknown'
    });
    return;
  }

  next();
};

export const sanitizeMarketplaceInput = (
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

    if (req.body.selectionReason && typeof req.body.selectionReason === 'string') {
      req.body.selectionReason = sanitizeString(req.body.selectionReason.trim());
    }

    if (req.body.reason && typeof req.body.reason === 'string') {
      req.body.reason = sanitizeString(req.body.reason.trim());
    }

    if (req.body.feedback && typeof req.body.feedback === 'string') {
      req.body.feedback = sanitizeString(req.body.feedback.trim());
    }

    if (req.body.message && typeof req.body.message === 'string') {
      req.body.message = sanitizeString(req.body.message.trim());
    }
  }

  next();
};

