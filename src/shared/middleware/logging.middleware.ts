import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils';
import { attachRequestId } from '../utils';

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = uuidv4();
  const startTime = Date.now();

  attachRequestId(res, requestId);

  const logData = {
    requestId,
    method: req.method,
    url: req.url,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  };

  logger.info('Incoming request', logData);

  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    
    logger.info('Request completed', {
      ...logData,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      responseSize: data ? Buffer.byteLength(data, 'utf8') : 0
    });

    return originalSend.call(this, data);
  };

  next();
};

export const sensitiveDataFilter = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const originalBody = req.body;
  
  if (originalBody) {
    const filteredBody = { ...originalBody };
    
    if (filteredBody.password) {
      filteredBody.password = '[FILTERED]';
    }
    
    if (filteredBody.confirmPassword) {
      filteredBody.confirmPassword = '[FILTERED]';
    }
    
    if (filteredBody.socialData?.accessToken) {
      filteredBody.socialData.accessToken = '[FILTERED]';
    }

    if (filteredBody.clientPhone) {
      filteredBody.clientPhone = filteredBody.clientPhone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2');
    }

    if (filteredBody.materials) {
      filteredBody.materials = filteredBody.materials.map((material: any) => ({
        ...material,
        unitCost: material.unitCost ? '[FILTERED]' : material.unitCost
      }));
    }

    if (filteredBody.items) {
      filteredBody.items = filteredBody.items.map((item: any) => ({
        ...item,
        unitPrice: item.unitPrice ? '[FILTERED]' : item.unitPrice
      }));
    }

    if (filteredBody.totalAmount) {
      filteredBody.totalAmount = '[FILTERED]';
    }

    if (filteredBody.subtotal) {
      filteredBody.subtotal = '[FILTERED]';
    }

    if (filteredBody.gstAmount) {
      filteredBody.gstAmount = '[FILTERED]';
    }

    req.body = filteredBody;
  }

  next();
};

export const errorLogger = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = res.locals.requestId || 'unknown';

  logger.error('Request error occurred', {
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });

  next(error);
};

export const jobOperationLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = res.locals.requestId || 'unknown';
  const userId = req.user?.id;
  const jobId = req.params.jobId;

  if (req.path.includes('/jobs')) {
    const operation = req.method === 'POST' ? 'create' : 
                     req.method === 'PUT' ? 'update' : 
                     req.method === 'DELETE' ? 'delete' : 'read';

    logger.info('Job operation initiated', {
      requestId,
      userId,
      jobId,
      operation,
      method: req.method,
      path: req.path,
      timestamp: new Date().toISOString()
    });
  }

  next();
};

export const clientOperationLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = res.locals.requestId || 'unknown';
  const userId = req.user?.id;
  const clientId = req.params.clientId;

  if (req.path.includes('/clients')) {
    const operation = req.method === 'POST' ? 'create' : 
                     req.method === 'PUT' ? 'update' : 
                     req.method === 'DELETE' ? 'delete' : 'read';

    logger.info('Client operation initiated', {
      requestId,
      userId,
      clientId,
      operation,
      method: req.method,
      path: req.path,
      timestamp: new Date().toISOString()
    });
  }

  next();
};

export const fileUploadLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = res.locals.requestId || 'unknown';
  const userId = req.user?.id;

  if (req.file) {
    logger.info('File upload initiated', {
      requestId,
      userId,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      timestamp: new Date().toISOString()
    });
  }

  next();
};

export const materialOperationLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = res.locals.requestId || 'unknown';
  const userId = req.user?.id;
  const jobId = req.params.jobId;

  if (req.body.materials && Array.isArray(req.body.materials)) {
    logger.info('Material operation initiated', {
      requestId,
      userId,
      jobId,
      materialCount: req.body.materials.length,
      operation: req.method === 'POST' ? 'add' : 'update',
      timestamp: new Date().toISOString()
    });
  }

  next();
};

export const jobStatusChangeLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = res.locals.requestId || 'unknown';
  const userId = req.user?.id;
  const jobId = req.params.jobId;

  if (req.body.status && req.method === 'PUT') {
    logger.info('Job status change initiated', {
      requestId,
      userId,
      jobId,
      newStatus: req.body.status,
      timestamp: new Date().toISOString()
    });
  }

  next();
};

export const quoteOperationLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = res.locals.requestId || 'unknown';
  const userId = req.user?.id;
  const quoteId = req.params.quoteId;

  if (req.path.includes('/quotes')) {
    const operation = req.method === 'POST' ? 'create' : 
                     req.method === 'PUT' ? 'update' : 
                     req.method === 'DELETE' ? 'delete' : 'read';

    logger.info('Quote operation initiated', {
      requestId,
      userId,
      quoteId,
      operation,
      method: req.method,
      path: req.path,
      timestamp: new Date().toISOString()
    });
  }

  next();
};

export const quoteStatusChangeLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = res.locals.requestId || 'unknown';
  const userId = req.user?.id;
  const quoteId = req.params.quoteId;

  if (req.body.status && req.method === 'PUT' && req.path.includes('/quotes')) {
    logger.info('Quote status change initiated', {
      requestId,
      userId,
      quoteId,
      newStatus: req.body.status,
      timestamp: new Date().toISOString()
    });
  }

  next();
};

export const quoteItemsLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = res.locals.requestId || 'unknown';
  const userId = req.user?.id;
  const quoteId = req.params.quoteId;

  if (req.body.items && Array.isArray(req.body.items) && req.path.includes('/quotes')) {
    logger.info('Quote items operation initiated', {
      requestId,
      userId,
      quoteId,
      itemCount: req.body.items.length,
      operation: req.method === 'POST' ? 'add' : 'update',
      timestamp: new Date().toISOString()
    });
  }

  next();
};

export const quoteSendLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = res.locals.requestId || 'unknown';
  const userId = req.user?.id;
  const quoteId = req.params.quoteId;

  if (req.path.includes('/quotes') && req.path.includes('/send')) {
    logger.info('Quote send operation initiated', {
      requestId,
      userId,
      quoteId,
      deliveryMethods: req.body.deliveryMethod,
      recipientEmail: req.body.recipientEmail ? '[FILTERED]' : undefined,
      recipientPhone: req.body.recipientPhone ? '[FILTERED]' : undefined,
      timestamp: new Date().toISOString()
    });
  }

  next();
};

export const aiPricingLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = res.locals.requestId || 'unknown';
  const userId = req.user?.id;

  if (req.path.includes('/ai-pricing')) {
    logger.info('AI pricing request initiated', {
      requestId,
      userId,
      jobType: req.body.jobType,
      estimatedDuration: req.body.estimatedDuration,
      timestamp: new Date().toISOString()
    });
  }

  next();
};

export const quoteViewLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = res.locals.requestId || 'unknown';
  const quoteId = req.params.quoteId;

  if (req.path.includes('/quotes') && req.path.includes('/view') && req.method === 'GET') {
    logger.info('Quote view initiated', {
      requestId,
      quoteId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
  }

  next();
};

export const paymentOperationLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = res.locals.requestId || 'unknown';
  const userId = req.user?.id;
  const paymentId = req.params.paymentId;

  if (req.path.includes('/payments')) {
    const operation = req.method === 'POST' ? 'create' : 
                     req.method === 'PUT' ? 'update' : 
                     req.method === 'DELETE' ? 'delete' : 'read';

    logger.info('Payment operation initiated', {
      requestId,
      userId,
      paymentId,
      operation,
      method: req.method,
      path: req.path,
      timestamp: new Date().toISOString()
    });
  }

  next();
};

export const paymentSensitiveDataFilter = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const originalBody = req.body;
  
  if (originalBody) {
    const filteredBody = { ...originalBody };
    
    if (filteredBody.amount) {
      filteredBody.amount = '[FILTERED]';
    }
    
    if (filteredBody.stripePaymentMethodId) {
      filteredBody.stripePaymentMethodId = '[FILTERED]';
    }
    
    if (filteredBody.paymentToken) {
      filteredBody.paymentToken = '[FILTERED]';
    }

    if (filteredBody.cardNumber) {
      filteredBody.cardNumber = '[FILTERED]';
    }

    if (filteredBody.cvv) {
      filteredBody.cvv = '[FILTERED]';
    }

    if (filteredBody.stripeCustomerId) {
      filteredBody.stripeCustomerId = '[FILTERED]';
    }

    if (filteredBody.clientSecret) {
      filteredBody.clientSecret = '[FILTERED]';
    }

    req.body = filteredBody;
  }

  next();
};

export const webhookLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = res.locals.requestId || 'unknown';

  if (req.path.includes('/webhook')) {
    logger.info('Webhook received', {
      requestId,
      eventType: req.body?.type,
      eventId: req.body?.id,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
  }

  next();
};

export const creditTransactionLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = res.locals.requestId || 'unknown';
  const userId = req.user?.id;

  if (req.path.includes('/credits')) {
    logger.info('Credit transaction initiated', {
      requestId,
      userId,
      credits: req.body.credits,
      transactionType: req.body.transactionType || 'purchase',
      method: req.method,
      path: req.path,
      timestamp: new Date().toISOString()
    });
  }

  next();
};

export const subscriptionOperationLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = res.locals.requestId || 'unknown';
  const userId = req.user?.id;
  const subscriptionId = req.params.subscriptionId;

  if (req.path.includes('/subscriptions')) {
    const operation = req.method === 'POST' ? 'create' : 
                     req.method === 'PUT' ? 'update' : 
                     req.method === 'DELETE' ? 'cancel' : 'read';

    logger.info('Subscription operation initiated', {
      requestId,
      userId,
      subscriptionId,
      operation,
      plan: req.body.plan,
      method: req.method,
      path: req.path,
      timestamp: new Date().toISOString()
    });
  }

  next();
};

export const invoiceOperationLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = res.locals.requestId || 'unknown';
  const userId = req.user?.id;
  const invoiceId = req.params.invoiceId;

  if (req.path.includes('/invoices')) {
    const operation = req.method === 'POST' ? 'create' : 
                     req.method === 'PUT' ? 'update' : 
                     req.method === 'DELETE' ? 'delete' : 'read';

    logger.info('Invoice operation initiated', {
      requestId,
      userId,
      invoiceId,
      operation,
      method: req.method,
      path: req.path,
      timestamp: new Date().toISOString()
    });
  }

  next();
};

export const refundOperationLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = res.locals.requestId || 'unknown';
  const userId = req.user?.id;
  const refundId = req.params.refundId;

  if (req.path.includes('/refunds')) {
    const operation = req.method === 'POST' ? 'create' : 
                     req.method === 'PUT' ? 'update' : 'read';

    logger.info('Refund operation initiated', {
      requestId,
      userId,
      refundId,
      operation,
      paymentId: req.body.paymentId,
      method: req.method,
      path: req.path,
      timestamp: new Date().toISOString()
    });
  }

  next();
};

export const paymentMethodLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = res.locals.requestId || 'unknown';
  const userId = req.user?.id;
  const paymentMethodId = req.params.paymentMethodId;

  if (req.path.includes('/payment-methods')) {
    const operation = req.method === 'POST' ? 'add' : 
                     req.method === 'PUT' ? 'update' : 
                     req.method === 'DELETE' ? 'remove' : 'read';

    logger.info('Payment method operation initiated', {
      requestId,
      userId,
      paymentMethodId,
      operation,
      type: req.body.type,
      method: req.method,
      path: req.path,
      timestamp: new Date().toISOString()
    });
  }

  next();
};

export const applePayLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = res.locals.requestId || 'unknown';
  const userId = req.user?.id;

  if (req.path.includes('/apple-pay')) {
    logger.info('Apple Pay operation initiated', {
      requestId,
      userId,
      operation: req.path.includes('/session') ? 'session' : 'payment',
      method: req.method,
      path: req.path,
      timestamp: new Date().toISOString()
    });
  }

  next();
};

export const googlePayLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = res.locals.requestId || 'unknown';
  const userId = req.user?.id;

  if (req.path.includes('/google-pay')) {
    logger.info('Google Pay operation initiated', {
      requestId,
      userId,
      operation: 'payment',
      method: req.method,
      path: req.path,
      timestamp: new Date().toISOString()
    });
  }

  next();
};


