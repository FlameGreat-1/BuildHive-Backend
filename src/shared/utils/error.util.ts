import { Request, Response, NextFunction } from 'express';
import { ValidationError, ErrorResponse } from '../types';
import { ERROR_CODES, HTTP_STATUS_CODES } from '../../config/auth';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly timestamp: string;
  public readonly requestId?: string;

  constructor(
    message: string,
    statusCode: number = HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
    code: string = ERROR_CODES.INTERNAL_ERROR,
    isOperational: boolean = true,
    requestId?: string
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    this.requestId = requestId;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationAppError extends AppError {
  public readonly errors: ValidationError[];

  constructor(
    message: string,
    errors: ValidationError[],
    requestId?: string
  ) {
    super(
      message,
      HTTP_STATUS_CODES.UNPROCESSABLE_ENTITY,
      ERROR_CODES.VALIDATION_ERROR,
      true,
      requestId
    );
    this.errors = errors;
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code: string = ERROR_CODES.USER_EXISTS, requestId?: string) {
    super(message, HTTP_STATUS_CODES.CONFLICT, code, true, requestId);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests', requestId?: string) {
    super(
      message,
      HTTP_STATUS_CODES.TOO_MANY_REQUESTS,
      ERROR_CODES.RATE_LIMIT_EXCEEDED,
      true,
      requestId
    );
  }
}

export class JobNotFoundError extends AppError {
  constructor(message: string = 'Job not found', requestId?: string) {
    super(message, HTTP_STATUS_CODES.NOT_FOUND, 'JOB_NOT_FOUND', true, requestId);
  }
}

export class UnauthorizedJobAccessError extends AppError {
  constructor(message: string = 'Unauthorized access to job', requestId?: string) {
    super(message, HTTP_STATUS_CODES.FORBIDDEN, 'UNAUTHORIZED_JOB_ACCESS', true, requestId);
  }
}

export class JobValidationError extends ValidationAppError {
  constructor(message: string, errors: ValidationError[], requestId?: string) {
    super(message, errors, requestId);
  }
}

export class ClientNotFoundError extends AppError {
  constructor(message: string = 'Client not found', requestId?: string) {
    super(message, HTTP_STATUS_CODES.NOT_FOUND, 'CLIENT_NOT_FOUND', true, requestId);
  }
}

export class MaterialValidationError extends ValidationAppError {
  constructor(message: string, errors: ValidationError[], requestId?: string) {
    super(message, errors, requestId);
  }
}

export class FileUploadError extends AppError {
  constructor(message: string = 'File upload failed', requestId?: string) {
    super(message, HTTP_STATUS_CODES.BAD_REQUEST, 'FILE_UPLOAD_ERROR', true, requestId);
  }
}

export class QuoteNotFoundError extends AppError {
  constructor(message: string = 'Quote not found', requestId?: string) {
    super(message, HTTP_STATUS_CODES.NOT_FOUND, 'QUOTE_NOT_FOUND', true, requestId);
  }
}

export class UnauthorizedQuoteAccessError extends AppError {
  constructor(message: string = 'Unauthorized access to quote', requestId?: string) {
    super(message, HTTP_STATUS_CODES.FORBIDDEN, 'UNAUTHORIZED_QUOTE_ACCESS', true, requestId);
  }
}

export class QuoteValidationError extends ValidationAppError {
  constructor(message: string, errors: ValidationError[], requestId?: string) {
    super(message, errors, requestId);
  }
}

export class QuoteExpiredError extends AppError {
  constructor(message: string = 'Quote has expired', requestId?: string) {
    super(message, HTTP_STATUS_CODES.BAD_REQUEST, 'QUOTE_EXPIRED', true, requestId);
  }
}

export class QuoteStatusError extends AppError {
  constructor(message: string = 'Invalid quote status transition', requestId?: string) {
    super(message, HTTP_STATUS_CODES.BAD_REQUEST, 'INVALID_QUOTE_STATUS', true, requestId);
  }
}

export class AIPricingError extends AppError {
  constructor(message: string = 'AI pricing service unavailable', requestId?: string) {
    super(message, HTTP_STATUS_CODES.SERVICE_UNAVAILABLE, 'AI_PRICING_ERROR', true, requestId);
  }
}

export class QuoteDeliveryError extends AppError {
  constructor(message: string = 'Quote delivery failed', requestId?: string) {
    super(message, HTTP_STATUS_CODES.BAD_REQUEST, 'QUOTE_DELIVERY_ERROR', true, requestId);
  }
}

export const createErrorResponse = (
  error: AppError,
  requestId: string
): ErrorResponse => {
  return {
    success: false,
    message: error.message,
    errors: error instanceof ValidationAppError ? error.errors : undefined,
    timestamp: error.timestamp,
    requestId: error.requestId || requestId,
    statusCode: error.statusCode
  };
};

export const isOperationalError = (error: Error): boolean => {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
};

export const handleAsyncError = (fn: Function) => {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const asyncErrorHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export class PaymentNotFoundError extends AppError {
  constructor(message: string = 'Payment not found', requestId?: string) {
    super(message, HTTP_STATUS_CODES.NOT_FOUND, 'PAYMENT_NOT_FOUND', true, requestId);
  }
}

export class PaymentValidationError extends ValidationAppError {
  constructor(message: string, errors: ValidationError[], requestId?: string) {
    super(message, errors, requestId);
  }
}

export class PaymentProcessingError extends AppError {
  constructor(message: string = 'Payment processing failed', requestId?: string) {
    super(message, HTTP_STATUS_CODES.BAD_REQUEST, 'PAYMENT_PROCESSING_ERROR', true, requestId);
  }
}

export class InsufficientCreditsError extends AppError {
  constructor(message: string = 'Insufficient credits', requestId?: string) {
    super(message, HTTP_STATUS_CODES.BAD_REQUEST, 'INSUFFICIENT_CREDITS', true, requestId);
  }
}

export class StripeError extends AppError {
  constructor(message: string = 'Stripe service error', requestId?: string) {
    super(message, HTTP_STATUS_CODES.BAD_REQUEST, 'STRIPE_ERROR', true, requestId);
  }
}

export class WebhookValidationError extends AppError {
  constructor(message: string = 'Webhook validation failed', requestId?: string) {
    super(message, HTTP_STATUS_CODES.BAD_REQUEST, 'WEBHOOK_VALIDATION_ERROR', true, requestId);
  }
}

export class SubscriptionNotFoundError extends AppError {
  constructor(message: string = 'Subscription not found', requestId?: string) {
    super(message, HTTP_STATUS_CODES.NOT_FOUND, 'SUBSCRIPTION_NOT_FOUND', true, requestId);
  }
}

export class InvoiceNotFoundError extends AppError {
  constructor(message: string = 'Invoice not found', requestId?: string) {
    super(message, HTTP_STATUS_CODES.NOT_FOUND, 'INVOICE_NOT_FOUND', true, requestId);
  }
}

export class RefundNotFoundError extends AppError {
  constructor(message: string = 'Refund not found', requestId?: string) {
    super(message, HTTP_STATUS_CODES.NOT_FOUND, 'REFUND_NOT_FOUND', true, requestId);
  }
}

export class PaymentMethodNotFoundError extends AppError {
  constructor(message: string = 'Payment method not found', requestId?: string) {
    super(message, HTTP_STATUS_CODES.NOT_FOUND, 'PAYMENT_METHOD_NOT_FOUND', true, requestId);
  }
}

export class RefundProcessingError extends AppError {
  constructor(message: string = 'Refund processing failed', requestId?: string) {
    super(message, HTTP_STATUS_CODES.BAD_REQUEST, 'REFUND_PROCESSING_ERROR', true, requestId);
  }
}

export class SubscriptionStatusError extends AppError {
  constructor(message: string = 'Invalid subscription status', requestId?: string) {
    super(message, HTTP_STATUS_CODES.BAD_REQUEST, 'INVALID_SUBSCRIPTION_STATUS', true, requestId);
  }
}

export class CreditNotFoundError extends AppError {
  constructor(message: string = 'Credit record not found', requestId?: string) {
    super(message, HTTP_STATUS_CODES.NOT_FOUND, 'CREDIT_NOT_FOUND', true, requestId);
  }
}

export class CreditValidationError extends ValidationAppError {
  constructor(message: string, errors: ValidationError[], requestId?: string) {
    super(message, errors, requestId);
  }
}

export class CreditTransactionError extends AppError {
  constructor(message: string = 'Credit transaction failed', requestId?: string) {
    super(message, HTTP_STATUS_CODES.BAD_REQUEST, 'CREDIT_TRANSACTION_ERROR', true, requestId);
  }
}

export class CreditPurchaseError extends AppError {
  constructor(message: string = 'Credit purchase failed', requestId?: string) {
    super(message, HTTP_STATUS_CODES.BAD_REQUEST, 'CREDIT_PURCHASE_ERROR', true, requestId);
  }
}

export class CreditUsageError extends AppError {
  constructor(message: string = 'Credit usage failed', requestId?: string) {
    super(message, HTTP_STATUS_CODES.BAD_REQUEST, 'CREDIT_USAGE_ERROR', true, requestId);
  }
}

export class CreditRefundError extends AppError {
  constructor(message: string = 'Credit refund failed', requestId?: string) {
    super(message, HTTP_STATUS_CODES.BAD_REQUEST, 'CREDIT_REFUND_ERROR', true, requestId);
  }
}

export class CreditExpiredError extends AppError {
  constructor(message: string = 'Credits have expired', requestId?: string) {
    super(message, HTTP_STATUS_CODES.BAD_REQUEST, 'CREDIT_EXPIRED', true, requestId);
  }
}

export class AutoTopupError extends AppError {
  constructor(message: string = 'Auto topup failed', requestId?: string) {
    super(message, HTTP_STATUS_CODES.BAD_REQUEST, 'AUTO_TOPUP_ERROR', true, requestId);
  }
}

export class CreditPackageNotFoundError extends AppError {
  constructor(message: string = 'Credit package not found', requestId?: string) {
    super(message, HTTP_STATUS_CODES.NOT_FOUND, 'CREDIT_PACKAGE_NOT_FOUND', true, requestId);
  }
}

export class CreditBalanceError extends AppError {
  constructor(message: string = 'Credit balance operation failed', requestId?: string) {
    super(message, HTTP_STATUS_CODES.BAD_REQUEST, 'CREDIT_BALANCE_ERROR', true, requestId);
  }
}
