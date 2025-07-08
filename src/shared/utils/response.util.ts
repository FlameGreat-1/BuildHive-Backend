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
  errors?: ValidationError[]
): Response => {
  const requestId = res.locals.requestId || '';
  
  const response = createResponse(false, message, undefined, errors);
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
  statusCode: number = HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
): Response => {
  return sendError(res, message, statusCode);
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
