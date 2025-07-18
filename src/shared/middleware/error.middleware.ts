import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationAppError, createErrorResponse, isOperationalError } from '../utils';
import { HTTP_STATUS_CODES } from '../../config/auth';
import { logger } from '../utils';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  const requestId = res.locals.requestId || 'unknown';

  if (error instanceof ValidationAppError) {
    logger.warn('Validation error occurred', {
      requestId,
      path: req.path,
      method: req.method,
      errors: error.errors
    });

    const errorResponse = createErrorResponse(error, requestId);
    return res.status(error.statusCode).json(errorResponse);
  }

  if (error instanceof AppError) {
    logger.error('Application error occurred', {
      requestId,
      path: req.path,
      method: req.method,
      message: error.message,
      code: error.code,
      statusCode: error.statusCode
    });

    const errorResponse = createErrorResponse(error, requestId);
    return res.status(error.statusCode).json(errorResponse);
  }

  logger.error('Unexpected error occurred', {
    requestId,
    path: req.path,
    method: req.method,
    message: error.message,
    stack: error.stack
  });

  const genericError = new AppError(
    'Internal server error',
    HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
    'INTERNAL_ERROR',
    false,
    requestId
  );

  const errorResponse = createErrorResponse(genericError, requestId);
  return res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json(errorResponse);
};

export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): Response => {
  const requestId = res.locals.requestId || 'unknown';
  
  logger.warn('Route not found', {
    requestId,
    path: req.path,
    method: req.method
  });

  const error = new AppError(
    `Route ${req.method} ${req.path} not found`,
    HTTP_STATUS_CODES.NOT_FOUND,
    'ROUTE_NOT_FOUND',
    true,
    requestId
  );

  const errorResponse = createErrorResponse(error, requestId);
  return res.status(HTTP_STATUS_CODES.NOT_FOUND).json(errorResponse);
};

export const asyncErrorHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const jobErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  const requestId = res.locals.requestId || 'unknown';
  const userId = req.user?.id;

  if (error.message.includes('Job not found')) {
    logger.warn('Job not found error', {
      requestId,
      userId,
      path: req.path,
      method: req.method,
      jobId: req.params.jobId
    });

    const jobError = new AppError(
      'Job not found',
      HTTP_STATUS_CODES.NOT_FOUND,
      'JOB_NOT_FOUND',
      true,
      requestId
    );

    const errorResponse = createErrorResponse(jobError, requestId);
    return res.status(HTTP_STATUS_CODES.NOT_FOUND).json(errorResponse);
  }

  if (error.message.includes('Unauthorized access')) {
    logger.warn('Unauthorized job access attempt', {
      requestId,
      userId,
      path: req.path,
      method: req.method,
      jobId: req.params.jobId
    });

    const authError = new AppError(
      'Unauthorized access to job',
      HTTP_STATUS_CODES.FORBIDDEN,
      'UNAUTHORIZED_JOB_ACCESS',
      true,
      requestId
    );

    const errorResponse = createErrorResponse(authError, requestId);
    return res.status(HTTP_STATUS_CODES.FORBIDDEN).json(errorResponse);
  }

  return errorHandler(error, req, res, next);
};

export const clientErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  const requestId = res.locals.requestId || 'unknown';
  const userId = req.user?.id;

  if (error.message.includes('Client not found')) {
    logger.warn('Client not found error', {
      requestId,
      userId,
      path: req.path,
      method: req.method,
      clientId: req.params.clientId
    });

    const clientError = new AppError(
      'Client not found',
      HTTP_STATUS_CODES.NOT_FOUND,
      'CLIENT_NOT_FOUND',
      true,
      requestId
    );

    const errorResponse = createErrorResponse(clientError, requestId);
    return res.status(HTTP_STATUS_CODES.NOT_FOUND).json(errorResponse);
  }

  return errorHandler(error, req, res, next);
};

export const fileUploadErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  const requestId = res.locals.requestId || 'unknown';
  const userId = req.user?.id;

  if (error.message.includes('File too large')) {
    logger.warn('File upload size error', {
      requestId,
      userId,
      path: req.path,
      method: req.method,
      fileSize: req.file?.size
    });

    const fileError = new AppError(
      'File size exceeds maximum allowed limit',
      HTTP_STATUS_CODES.BAD_REQUEST,
      'FILE_TOO_LARGE',
      true,
      requestId
    );

    const errorResponse = createErrorResponse(fileError, requestId);
    return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json(errorResponse);
  }

  if (error.message.includes('Invalid file type')) {
    logger.warn('File upload type error', {
      requestId,
      userId,
      path: req.path,
      method: req.method,
      fileType: req.file?.mimetype
    });

    const fileError = new AppError(
      'Invalid file type. Only images and documents are allowed',
      HTTP_STATUS_CODES.BAD_REQUEST,
      'INVALID_FILE_TYPE',
      true,
      requestId
    );

    const errorResponse = createErrorResponse(fileError, requestId);
    return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json(errorResponse);
  }

  return errorHandler(error, req, res, next);
};

export const quoteErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  const requestId = res.locals.requestId || 'unknown';
  const userId = req.user?.id;

  if (error.message.includes('Quote not found')) {
    logger.warn('Quote not found error', {
      requestId,
      userId,
      path: req.path,
      method: req.method,
      quoteId: req.params.quoteId
    });

    const quoteError = new AppError(
      'Quote not found',
      HTTP_STATUS_CODES.NOT_FOUND,
      'QUOTE_NOT_FOUND',
      true,
      requestId
    );

    const errorResponse = createErrorResponse(quoteError, requestId);
    return res.status(HTTP_STATUS_CODES.NOT_FOUND).json(errorResponse);
  }

  if (error.message.includes('Unauthorized quote access')) {
    logger.warn('Unauthorized quote access attempt', {
      requestId,
      userId,
      path: req.path,
      method: req.method,
      quoteId: req.params.quoteId
    });

    const authError = new AppError(
      'Unauthorized access to quote',
      HTTP_STATUS_CODES.FORBIDDEN,
      'UNAUTHORIZED_QUOTE_ACCESS',
      true,
      requestId
    );

    const errorResponse = createErrorResponse(authError, requestId);
    return res.status(HTTP_STATUS_CODES.FORBIDDEN).json(errorResponse);
  }

  if (error.message.includes('Quote expired')) {
    logger.warn('Quote expired error', {
      requestId,
      userId,
      path: req.path,
      method: req.method,
      quoteId: req.params.quoteId
    });

    const expiredError = new AppError(
      'Quote has expired',
      HTTP_STATUS_CODES.BAD_REQUEST,
      'QUOTE_EXPIRED',
      true,
      requestId
    );

    const errorResponse = createErrorResponse(expiredError, requestId);
    return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json(errorResponse);
  }

  if (error.message.includes('Invalid quote status')) {
    logger.warn('Invalid quote status transition', {
      requestId,
      userId,
      path: req.path,
      method: req.method,
      quoteId: req.params.quoteId
    });

    const statusError = new AppError(
      'Invalid quote status transition',
      HTTP_STATUS_CODES.BAD_REQUEST,
      'INVALID_QUOTE_STATUS',
      true,
      requestId
    );

    const errorResponse = createErrorResponse(statusError, requestId);
    return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json(errorResponse);
  }

  if (error.message.includes('AI pricing unavailable')) {
    logger.warn('AI pricing service error', {
      requestId,
      userId,
      path: req.path,
      method: req.method
    });

    const aiError = new AppError(
      'AI pricing service unavailable',
      HTTP_STATUS_CODES.SERVICE_UNAVAILABLE,
      'AI_PRICING_ERROR',
      true,
      requestId
    );

    const errorResponse = createErrorResponse(aiError, requestId);
    return res.status(HTTP_STATUS_CODES.SERVICE_UNAVAILABLE).json(errorResponse);
  }

  if (error.message.includes('Quote delivery failed')) {
    logger.warn('Quote delivery error', {
      requestId,
      userId,
      path: req.path,
      method: req.method,
      quoteId: req.params.quoteId
    });

    const deliveryError = new AppError(
      'Quote delivery failed',
      HTTP_STATUS_CODES.BAD_REQUEST,
      'QUOTE_DELIVERY_ERROR',
      true,
      requestId
    );

    const errorResponse = createErrorResponse(deliveryError, requestId);
    return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json(errorResponse);
  }

  return errorHandler(error, req, res, next);
};

export const paymentErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  const requestId = res.locals.requestId || 'unknown';
  const userId = req.user?.id;

  if (error.message.includes('Payment not found')) {
    logger.warn('Payment not found error', {
      requestId,
      userId,
      path: req.path,
      method: req.method,
      paymentId: req.params.paymentId
    });

    const paymentError = new AppError(
      'Payment not found',
      HTTP_STATUS_CODES.NOT_FOUND,
      'PAYMENT_NOT_FOUND',
      true,
      requestId
    );

    const errorResponse = createErrorResponse(paymentError, requestId);
    return res.status(HTTP_STATUS_CODES.NOT_FOUND).json(errorResponse);
  }

  if (error.message.includes('Payment processing failed')) {
    logger.warn('Payment processing error', {
      requestId,
      userId,
      path: req.path,
      method: req.method,
      paymentId: req.params.paymentId
    });

    const processingError = new AppError(
      'Payment processing failed',
      HTTP_STATUS_CODES.BAD_REQUEST,
      'PAYMENT_PROCESSING_ERROR',
      true,
      requestId
    );

    const errorResponse = createErrorResponse(processingError, requestId);
    return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json(errorResponse);
  }

  if (error.message.includes('Insufficient credits')) {
    logger.warn('Insufficient credits error', {
      requestId,
      userId,
      path: req.path,
      method: req.method
    });

    const creditsError = new AppError(
      'Insufficient credits',
      HTTP_STATUS_CODES.BAD_REQUEST,
      'INSUFFICIENT_CREDITS',
      true,
      requestId
    );

    const errorResponse = createErrorResponse(creditsError, requestId);
    return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json(errorResponse);
  }

  if (error.message.includes('Stripe service error')) {
    logger.warn('Stripe service error', {
      requestId,
      userId,
      path: req.path,
      method: req.method
    });

    const stripeError = new AppError(
      'Stripe service error',
      HTTP_STATUS_CODES.BAD_REQUEST,
      'STRIPE_ERROR',
      true,
      requestId
    );

    const errorResponse = createErrorResponse(stripeError, requestId);
    return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json(errorResponse);
  }

  if (error.message.includes('Webhook validation failed')) {
    logger.warn('Webhook validation error', {
      requestId,
      userId,
      path: req.path,
      method: req.method
    });

    const webhookError = new AppError(
      'Webhook validation failed',
      HTTP_STATUS_CODES.BAD_REQUEST,
      'WEBHOOK_VALIDATION_ERROR',
      true,
      requestId
    );

    const errorResponse = createErrorResponse(webhookError, requestId);
    return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json(errorResponse);
  }

  return errorHandler(error, req, res, next);
};

export const subscriptionErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  const requestId = res.locals.requestId || 'unknown';
  const userId = req.user?.id;

  if (error.message.includes('Subscription not found')) {
    logger.warn('Subscription not found error', {
      requestId,
      userId,
      path: req.path,
      method: req.method,
      subscriptionId: req.params.subscriptionId
    });

    const subscriptionError = new AppError(
      'Subscription not found',
      HTTP_STATUS_CODES.NOT_FOUND,
      'SUBSCRIPTION_NOT_FOUND',
      true,
      requestId
    );

    const errorResponse = createErrorResponse(subscriptionError, requestId);
    return res.status(HTTP_STATUS_CODES.NOT_FOUND).json(errorResponse);
  }

  if (error.message.includes('Invalid subscription status')) {
    logger.warn('Invalid subscription status error', {
      requestId,
      userId,
      path: req.path,
      method: req.method,
      subscriptionId: req.params.subscriptionId
    });

    const statusError = new AppError(
      'Invalid subscription status',
      HTTP_STATUS_CODES.BAD_REQUEST,
      'INVALID_SUBSCRIPTION_STATUS',
      true,
      requestId
    );

    const errorResponse = createErrorResponse(statusError, requestId);
    return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json(errorResponse);
  }

  return errorHandler(error, req, res, next);
};

export const invoiceErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  const requestId = res.locals.requestId || 'unknown';
  const userId = req.user?.id;

  if (error.message.includes('Invoice not found')) {
    logger.warn('Invoice not found error', {
      requestId,
      userId,
      path: req.path,
      method: req.method,
      invoiceId: req.params.invoiceId
    });

    const invoiceError = new AppError(
      'Invoice not found',
      HTTP_STATUS_CODES.NOT_FOUND,
      'INVOICE_NOT_FOUND',
      true,
      requestId
    );

    const errorResponse = createErrorResponse(invoiceError, requestId);
    return res.status(HTTP_STATUS_CODES.NOT_FOUND).json(errorResponse);
  }

  return errorHandler(error, req, res, next);
};

export const refundErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  const requestId = res.locals.requestId || 'unknown';
  const userId = req.user?.id;

  if (error.message.includes('Refund not found')) {
    logger.warn('Refund not found error', {
      requestId,
      userId,
      path: req.path,
      method: req.method,
      refundId: req.params.refundId
    });

    const refundError = new AppError(
      'Refund not found',
      HTTP_STATUS_CODES.NOT_FOUND,
      'REFUND_NOT_FOUND',
      true,
      requestId
    );

    const errorResponse = createErrorResponse(refundError, requestId);
    return res.status(HTTP_STATUS_CODES.NOT_FOUND).json(errorResponse);
  }

  if (error.message.includes('Refund processing failed')) {
    logger.warn('Refund processing error', {
      requestId,
      userId,
      path: req.path,
      method: req.method,
      refundId: req.params.refundId
    });

    const processingError = new AppError(
      'Refund processing failed',
      HTTP_STATUS_CODES.BAD_REQUEST,
      'REFUND_PROCESSING_ERROR',
      true,
      requestId
    );

    const errorResponse = createErrorResponse(processingError, requestId);
    return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json(errorResponse);
  }

  return errorHandler(error, req, res, next);
};

export const paymentMethodErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  const requestId = res.locals.requestId || 'unknown';
  const userId = req.user?.id;

  if (error.message.includes('Payment method not found')) {
    logger.warn('Payment method not found error', {
      requestId,
      userId,
      path: req.path,
      method: req.method,
      paymentMethodId: req.params.paymentMethodId
    });

    const paymentMethodError = new AppError(
      'Payment method not found',
      HTTP_STATUS_CODES.NOT_FOUND,
      'PAYMENT_METHOD_NOT_FOUND',
      true,
      requestId
    );

    const errorResponse = createErrorResponse(paymentMethodError, requestId);
    return res.status(HTTP_STATUS_CODES.NOT_FOUND).json(errorResponse);
  }

  return errorHandler(error, req, res, next);
};

export const creditErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  const requestId = res.locals.requestId || 'unknown';
  const userId = req.user?.id;

  if (error.message.includes('Credit record not found')) {
    logger.warn('Credit not found error', {
      requestId,
      userId,
      path: req.path,
      method: req.method,
      creditId: req.params.creditId
    });

    const creditError = new AppError(
      'Credit record not found',
      HTTP_STATUS_CODES.NOT_FOUND,
      'CREDIT_NOT_FOUND',
      true,
      requestId
    );

    const errorResponse = createErrorResponse(creditError, requestId);
    return res.status(HTTP_STATUS_CODES.NOT_FOUND).json(errorResponse);
  }

  if (error.message.includes('Credit transaction failed')) {
    logger.warn('Credit transaction error', {
      requestId,
      userId,
      path: req.path,
      method: req.method,
      transactionId: req.params.transactionId
    });

    const transactionError = new AppError(
      'Credit transaction failed',
      HTTP_STATUS_CODES.BAD_REQUEST,
      'CREDIT_TRANSACTION_ERROR',
      true,
      requestId
    );

    const errorResponse = createErrorResponse(transactionError, requestId);
    return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json(errorResponse);
  }

  if (error.message.includes('Credit purchase failed')) {
    logger.warn('Credit purchase error', {
      requestId,
      userId,
      path: req.path,
      method: req.method,
      packageType: req.body?.packageType
    });

    const purchaseError = new AppError(
      'Credit purchase failed',
      HTTP_STATUS_CODES.BAD_REQUEST,
      'CREDIT_PURCHASE_ERROR',
      true,
      requestId
    );

    const errorResponse = createErrorResponse(purchaseError, requestId);
    return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json(errorResponse);
  }

  if (error.message.includes('Credit usage failed')) {
    logger.warn('Credit usage error', {
      requestId,
      userId,
      path: req.path,
      method: req.method,
      usageType: req.body?.usageType
    });

    const usageError = new AppError(
      'Credit usage failed',
      HTTP_STATUS_CODES.BAD_REQUEST,
      'CREDIT_USAGE_ERROR',
      true,
      requestId
    );

    const errorResponse = createErrorResponse(usageError, requestId);
    return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json(errorResponse);
  }

  if (error.message.includes('Credit refund failed')) {
    logger.warn('Credit refund error', {
      requestId,
      userId,
      path: req.path,
      method: req.method,
      transactionId: req.params.transactionId
    });

    const refundError = new AppError(
      'Credit refund failed',
      HTTP_STATUS_CODES.BAD_REQUEST,
      'CREDIT_REFUND_ERROR',
      true,
      requestId
    );

    const errorResponse = createErrorResponse(refundError, requestId);
    return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json(errorResponse);
  }

  if (error.message.includes('Credits have expired')) {
    logger.warn('Credit expired error', {
      requestId,
      userId,
      path: req.path,
      method: req.method
    });

    const expiredError = new AppError(
      'Credits have expired',
      HTTP_STATUS_CODES.BAD_REQUEST,
      'CREDIT_EXPIRED',
      true,
      requestId
    );

    const errorResponse = createErrorResponse(expiredError, requestId);
    return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json(errorResponse);
  }

  if (error.message.includes('Auto topup failed')) {
    logger.warn('Auto topup error', {
      requestId,
      userId,
      path: req.path,
      method: req.method
    });

    const topupError = new AppError(
      'Auto topup failed',
      HTTP_STATUS_CODES.BAD_REQUEST,
      'AUTO_TOPUP_ERROR',
      true,
      requestId
    );

    const errorResponse = createErrorResponse(topupError, requestId);
    return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json(errorResponse);
  }

  if (error.message.includes('Credit package not found')) {
    logger.warn('Credit package not found error', {
      requestId,
      userId,
      path: req.path,
      method: req.method,
      packageType: req.params.packageType
    });

    const packageError = new AppError(
      'Credit package not found',
      HTTP_STATUS_CODES.NOT_FOUND,
      'CREDIT_PACKAGE_NOT_FOUND',
      true,
      requestId
    );

    const errorResponse = createErrorResponse(packageError, requestId);
    return res.status(HTTP_STATUS_CODES.NOT_FOUND).json(errorResponse);
  }

  if (error.message.includes('Credit balance operation failed')) {
    logger.warn('Credit balance error', {
      requestId,
      userId,
      path: req.path,
      method: req.method
    });

    const balanceError = new AppError(
      'Credit balance operation failed',
      HTTP_STATUS_CODES.BAD_REQUEST,
      'CREDIT_BALANCE_ERROR',
      true,
      requestId
    );

    const errorResponse = createErrorResponse(balanceError, requestId);
    return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json(errorResponse);
  }

  return errorHandler(error, req, res, next);
};
