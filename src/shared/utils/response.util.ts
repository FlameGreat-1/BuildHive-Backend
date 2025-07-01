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
