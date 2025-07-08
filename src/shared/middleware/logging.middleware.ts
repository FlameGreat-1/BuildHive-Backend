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
