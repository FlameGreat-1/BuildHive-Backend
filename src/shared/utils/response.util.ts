import { Response } from 'express';
import { ApiResponse, ValidationError } from '../types';
import { HTTP_STATUS_CODES } from '../../config/auth';

export const createResponse = <T = any>(
  success: boolean,
  message: string,
  data?: T,
  errors?: ValidationError[]
): ApiResponse<T> => {
  return {
    success,
    message,
    data,
    errors,
    timestamp: new Date().toISOString(),
    requestId: ''
  };
};

export const sendSuccess = <T = any>(
  res: Response,
  message: string,
  data?: T,
  statusCode: number = HTTP_STATUS_CODES.OK
): Response => {
  const requestId = res.locals.requestId || '';
  
  const response = createResponse(true, message, data);
  response.requestId = requestId;
  
  return res.status(statusCode).json(response);
};

export const sendCreated = <T = any>(
  res: Response,
  message: string,
  data?: T
): Response => {
  return sendSuccess(res, message, data, HTTP_STATUS_CODES.CREATED);
};

export const sendError = (
  res: Response,
  message: string,
  statusCode: number = HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
  errors?: ValidationError[],
  data?: any
): Response => {
  const requestId = res.locals.requestId || '';
  
  const response = createResponse(false, message, data, errors);
  response.requestId = requestId;
  
  return res.status(statusCode).json(response);
};

export const sendValidationError = (
  res: Response,
  message: string,
  errors: ValidationError[]
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.UNPROCESSABLE_ENTITY, errors);
};

export const sendConflictError = (
  res: Response,
  message: string
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.CONFLICT);
};

export const sendRateLimitError = (
  res: Response,
  message: string = 'Too many requests, please try again later'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.TOO_MANY_REQUESTS);
};

export const attachRequestId = (res: Response, requestId: string): void => {
  res.locals.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
};

export const sendJobSuccess = <T = any>(
  res: Response,
  message: string,
  data?: T,
  statusCode: number = HTTP_STATUS_CODES.OK
): Response => {
  return sendSuccess(res, message, data, statusCode);
};

export const sendJobCreated = <T = any>(
  res: Response,
  message: string,
  data?: T
): Response => {
  return sendCreated(res, message, data);
};

export const sendJobNotFound = (
  res: Response,
  message: string = 'Job not found'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.NOT_FOUND);
};

export const sendUnauthorizedJobAccess = (
  res: Response,
  message: string = 'Unauthorized access to job'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.FORBIDDEN);
};

export const sendJobValidationError = (
  res: Response,
  message: string,
  errors: ValidationError[]
): Response => {
  return sendValidationError(res, message, errors);
};

export const sendClientNotFound = (
  res: Response,
  message: string = 'Client not found'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.NOT_FOUND);
};

export const sendFileUploadError = (
  res: Response,
  message: string = 'File upload failed'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.BAD_REQUEST);
};

export const sendJobListResponse = <T = any>(
  res: Response,
  message: string,
  jobs: T[],
  summary: any
): Response => {
  return sendSuccess(res, message, { jobs, summary });
};

export const sendPaginatedJobResponse = <T = any>(
  res: Response,
  message: string,
  jobs: T[],
  meta: any
): Response => {
  return sendSuccess(res, message, { jobs, meta });
};

export const sendSuccessResponse = <T = any>(
  res: Response,
  message: string,
  data?: T,
  statusCode: number = HTTP_STATUS_CODES.OK
): Response => {
  return sendSuccess(res, message, data, statusCode);
};

export const sendErrorResponse = (
  res: Response,
  message: string,
  statusCode: number = HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
  data?: any
): Response => {
  return sendError(res, message, statusCode, undefined, data);
};

export const sendNotFoundResponse = (
  res: Response,
  message: string = 'Resource not found'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.NOT_FOUND);
};

export const sendQuoteSuccess = <T = any>(
  res: Response,
  message: string,
  data?: T,
  statusCode: number = HTTP_STATUS_CODES.OK
): Response => {
  return sendSuccess(res, message, data, statusCode);
};

export const sendQuoteCreated = <T = any>(
  res: Response,
  message: string,
  data?: T
): Response => {
  return sendCreated(res, message, data);
};

export const sendQuoteNotFound = (
  res: Response,
  message: string = 'Quote not found'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.NOT_FOUND);
};

export const sendUnauthorizedQuoteAccess = (
  res: Response,
  message: string = 'Unauthorized access to quote'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.FORBIDDEN);
};

export const sendQuoteValidationError = (
  res: Response,
  message: string,
  errors: ValidationError[]
): Response => {
  return sendValidationError(res, message, errors);
};

export const sendQuoteExpiredError = (
  res: Response,
  message: string = 'Quote has expired'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.BAD_REQUEST);
};

export const sendQuoteStatusError = (
  res: Response,
  message: string = 'Invalid quote status transition'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.BAD_REQUEST);
};

export const sendAIPricingError = (
  res: Response,
  message: string = 'AI pricing service unavailable'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.SERVICE_UNAVAILABLE);
};

export const sendQuoteDeliveryError = (
  res: Response,
  message: string = 'Quote delivery failed'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.BAD_REQUEST);
};

export const sendQuoteListResponse = <T = any>(
  res: Response,
  message: string,
  quotes: T[],
  summary: any
): Response => {
  return sendSuccess(res, message, { quotes, summary });
};

export const sendPaginatedQuoteResponse = <T = any>(
  res: Response,
  message: string,
  quotes: T[],
  meta: any
): Response => {
  return sendSuccess(res, message, { quotes, meta });
};

export const sendAIPricingResponse = <T = any>(
  res: Response,
  message: string,
  data?: T
): Response => {
  return sendSuccess(res, message, data);
};

export const sendQuoteDeliveryResponse = <T = any>(
  res: Response,
  message: string,
  data?: T
): Response => {
  return sendSuccess(res, message, data);
};

export const sendPaymentSuccess = <T = any>(
  res: Response,
  message: string,
  data?: T,
  statusCode: number = HTTP_STATUS_CODES.OK
): Response => {
  return sendSuccess(res, message, data, statusCode);
};

export const sendPaymentCreated = <T = any>(
  res: Response,
  message: string,
  data?: T
): Response => {
  return sendCreated(res, message, data);
};

export const sendPaymentNotFound = (
  res: Response,
  message: string = 'Payment not found'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.NOT_FOUND);
};

export const sendPaymentValidationError = (
  res: Response,
  message: string,
  errors: ValidationError[]
): Response => {
  return sendValidationError(res, message, errors);
};

export const sendPaymentProcessingError = (
  res: Response,
  message: string = 'Payment processing failed'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.BAD_REQUEST);
};

export const sendInsufficientCreditsError = (
  res: Response,
  message: string = 'Insufficient credits'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.BAD_REQUEST);
};

export const sendStripeError = (
  res: Response,
  message: string = 'Stripe service error'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.BAD_REQUEST);
};

export const sendWebhookValidationError = (
  res: Response,
  message: string = 'Webhook validation failed'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.BAD_REQUEST);
};

export const sendSubscriptionNotFound = (
  res: Response,
  message: string = 'Subscription not found'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.NOT_FOUND);
};

export const sendInvoiceNotFound = (
  res: Response,
  message: string = 'Invoice not found'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.NOT_FOUND);
};

export const sendRefundNotFound = (
  res: Response,
  message: string = 'Refund not found'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.NOT_FOUND);
};

export const sendPaymentMethodNotFound = (
  res: Response,
  message: string = 'Payment method not found'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.NOT_FOUND);
};

export const sendRefundProcessingError = (
  res: Response,
  message: string = 'Refund processing failed'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.BAD_REQUEST);
};

export const sendSubscriptionStatusError = (
  res: Response,
  message: string = 'Invalid subscription status'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.BAD_REQUEST);
};

export const sendPaymentListResponse = <T = any>(
  res: Response,
  message: string,
  payments: T[],
  summary: any
): Response => {
  return sendSuccess(res, message, { payments, summary });
};

export const sendPaginatedPaymentResponse = <T = any>(
  res: Response,
  message: string,
  payments: T[],
  meta: any
): Response => {
  return sendSuccess(res, message, { payments, meta });
};

export const sendCreditBalanceResponse = <T = any>(
  res: Response,
  message: string,
  data?: T
): Response => {
  return sendSuccess(res, message, data);
};

export const sendPaymentLinkResponse = <T = any>(
  res: Response,
  message: string,
  data?: T
): Response => {
  return sendSuccess(res, message, data);
};

export const sendCreditSuccess = <T = any>(
  res: Response,
  message: string,
  data?: T,
  statusCode: number = HTTP_STATUS_CODES.OK
): Response => {
  return sendSuccess(res, message, data, statusCode);
};

export const sendCreditCreated = <T = any>(
  res: Response,
  message: string,
  data?: T
): Response => {
  return sendCreated(res, message, data);
};

export const sendCreditNotFound = (
  res: Response,
  message: string = 'Credit record not found'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.NOT_FOUND);
};

export const sendCreditValidationError = (
  res: Response,
  message: string,
  errors: ValidationError[]
): Response => {
  return sendValidationError(res, message, errors);
};

export const sendCreditTransactionError = (
  res: Response,
  message: string = 'Credit transaction failed'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.BAD_REQUEST);
};

export const sendCreditPurchaseError = (
  res: Response,
  message: string = 'Credit purchase failed'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.BAD_REQUEST);
};

export const sendCreditUsageError = (
  res: Response,
  message: string = 'Credit usage failed'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.BAD_REQUEST);
};

export const sendCreditRefundError = (
  res: Response,
  message: string = 'Credit refund failed'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.BAD_REQUEST);
};

export const sendCreditExpiredError = (
  res: Response,
  message: string = 'Credits have expired'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.BAD_REQUEST);
};

export const sendAutoTopupError = (
  res: Response,
  message: string = 'Auto topup failed'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.BAD_REQUEST);
};

export const sendCreditPackageNotFound = (
  res: Response,
  message: string = 'Credit package not found'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.NOT_FOUND);
};

export const sendCreditBalanceError = (
  res: Response,
  message: string = 'Credit balance operation failed'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.BAD_REQUEST);
};

export const sendCreditDashboardResponse = <T = any>(
  res: Response,
  message: string,
  data?: T
): Response => {
  return sendSuccess(res, message, data);
};

export const sendCreditTransactionListResponse = <T = any>(
  res: Response,
  message: string,
  transactions: T[],
  summary: any
): Response => {
  return sendSuccess(res, message, { transactions, summary });
};

export const sendPaginatedCreditResponse = <T = any>(
  res: Response,
  message: string,
  transactions: T[],
  meta: any
): Response => {
  return sendSuccess(res, message, { transactions, meta });
};

export const sendCreditPackageListResponse = <T = any>(
  res: Response,
  message: string,
  packages: T[],
  currentBalance: number,
  recommendedPackage?: string
): Response => {
  return sendSuccess(res, message, { packages, currentBalance, recommendedPackage });
};

export const sendAutoTopupResponse = <T = any>(
  res: Response,
  message: string,
  data?: T
): Response => {
  return sendSuccess(res, message, data);
};

export const sendJobApplicationCreditResponse = <T = any>(
  res: Response,
  message: string,
  data?: T
): Response => {
  return sendSuccess(res, message, data);
};

export const sendProfileBoostResponse = <T = any>(
  res: Response,
  message: string,
  data?: T
): Response => {
  return sendSuccess(res, message, data);
};

export const sendPremiumJobUnlockResponse = <T = any>(
  res: Response,
  message: string,
  data?: T
): Response => {
  return sendSuccess(res, message, data);
};

export const sendNotFoundError = (
  res: Response,
  message: string = 'Resource not found'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.NOT_FOUND);
};

export const sendBadRequestError = (
  res: Response,
  message: string = 'Bad request'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.BAD_REQUEST);
};

export const sendInternalServerError = (
  res: Response,
  message: string = 'Internal server error'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR);
};


// ==================== MARKETPLACE JOB RESPONSES ====================

export const sendMarketplaceJobSuccess = <T = any>(
  res: Response,
  message: string,
  data?: T,
  statusCode: number = HTTP_STATUS_CODES.OK
): Response => {
  return sendSuccess(res, message, data, statusCode);
};

export const sendMarketplaceJobCreated = <T = any>(
  res: Response,
  message: string,
  data?: T
): Response => {
  return sendCreated(res, message, data);
};

export const sendMarketplaceJobNotFound = (
  res: Response,
  message: string = 'Marketplace job not found'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.NOT_FOUND);
};

export const sendMarketplaceJobListResponse = <T = any>(
  res: Response,
  message: string,
  jobs: T[],
  summary: any
): Response => {
  return sendSuccess(res, message, { jobs, summary });
};

export const sendMarketplaceJobValidationError = (
  res: Response,
  message: string,
  errors: ValidationError[]
): Response => {
  return sendValidationError(res, message, errors);
};

export const sendMarketplaceJobExpiredError = (
  res: Response,
  message: string = 'Marketplace job has expired'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.BAD_REQUEST);
};

// ==================== JOB APPLICATION RESPONSES ====================

export const sendJobApplicationSuccess = <T = any>(
  res: Response,
  message: string,
  data?: T,
  statusCode: number = HTTP_STATUS_CODES.OK
): Response => {
  return sendSuccess(res, message, data, statusCode);
};

export const sendJobApplicationCreated = <T = any>(
  res: Response,
  message: string,
  data?: T
): Response => {
  return sendCreated(res, message, data);
};

export const sendJobApplicationNotFound = (
  res: Response,
  message: string = 'Job application not found'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.NOT_FOUND);
};

export const sendJobApplicationValidationError = (
  res: Response,
  message: string,
  errors: ValidationError[]
): Response => {
  return sendValidationError(res, message, errors);
};

export const sendJobApplicationListResponse = <T = any>(
  res: Response,
  message: string,
  applications: T[],
  summary: any
): Response => {
  return sendSuccess(res, message, { applications, summary });
};

export const sendDuplicateApplicationError = (
  res: Response,
  message: string = 'You have already applied to this job'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.CONFLICT);
};

export const sendApplicationStatusUpdateError = (
  res: Response,
  message: string = 'Application status update failed'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.BAD_REQUEST);
};

// ==================== CLIENT REVIEW & SELECTION RESPONSES ====================

export const sendClientReviewResponse = <T = any>(
  res: Response,
  message: string,
  data?: T
): Response => {
  return sendSuccess(res, message, data);
};

export const sendTradieSelectionSuccess = <T = any>(
  res: Response,
  message: string,
  data?: T
): Response => {
  return sendSuccess(res, message, data);
};

export const sendTradieSelectionError = (
  res: Response,
  message: string = 'Tradie selection failed'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.BAD_REQUEST);
};

export const sendUnauthorizedSelectionError = (
  res: Response,
  message: string = 'Unauthorized to select tradie for this job'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.FORBIDDEN);
};

// ==================== MARKETPLACE ANALYTICS RESPONSES ====================

export const sendMarketplaceAnalyticsResponse = <T = any>(
  res: Response,
  message: string,
  data?: T
): Response => {
  return sendSuccess(res, message, data);
};

export const sendTradieStatsResponse = <T = any>(
  res: Response,
  message: string,
  data?: T
): Response => {
  return sendSuccess(res, message, data);
};

export const sendClientStatsResponse = <T = any>(
  res: Response,
  message: string,
  data?: T
): Response => {
  return sendSuccess(res, message, data);
};

// ==================== MARKETPLACE SEARCH RESPONSES ====================

export const sendMarketplaceSearchResponse = <T = any>(
  res: Response,
  message: string,
  data?: T
): Response => {
  return sendSuccess(res, message, data);
};

export const sendMarketplaceSearchError = (
  res: Response,
  message: string = 'Search operation failed'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.BAD_REQUEST);
};

// ==================== MARKETPLACE DASHBOARD RESPONSES ====================

export const sendClientDashboardResponse = <T = any>(
  res: Response,
  message: string,
  data?: T
): Response => {
  return sendSuccess(res, message, data);
};

export const sendTradieDashboardResponse = <T = any>(
  res: Response,
  message: string,
  data?: T
): Response => {
  return sendSuccess(res, message, data);
};

// ==================== MARKETPLACE CREDIT RESPONSES ====================

export const sendMarketplaceCreditCostResponse = <T = any>(
  res: Response,
  message: string,
  data?: T
): Response => {
  return sendSuccess(res, message, data);
};

export const sendMarketplaceApplicationCreditResponse = <T = any>(
  res: Response,
  message: string,
  data?: T
): Response => {
  return sendSuccess(res, message, data);
};

export const sendMarketplaceCreditError = (
  res: Response,
  message: string = 'Marketplace credit operation failed'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.BAD_REQUEST);
};

// ==================== MARKETPLACE NOTIFICATION RESPONSES ====================

export const sendMarketplaceNotificationResponse = <T = any>(
  res: Response,
  message: string,
  data?: T
): Response => {
  return sendSuccess(res, message, data);
};

export const sendMarketplaceNotificationListResponse = <T = any>(
  res: Response,
  message: string,
  notifications: T[],
  meta?: any
): Response => {
  return sendSuccess(res, message, { notifications, meta });
};

export const sendMarketplaceNotificationError = (
  res: Response,
  message: string = 'Notification operation failed'
): Response => {
  return sendError(res, message, HTTP_STATUS_CODES.BAD_REQUEST);
};
