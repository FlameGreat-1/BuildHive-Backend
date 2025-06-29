// Shared Utilities Export Module
// Centralized export for all shared utility functions

// Logger utility
export { buildHiveLogger, winstonLogger } from './logger.util';

// Response utility
export { buildHiveResponse } from './response.util';
export type { ApiResponse, PaginatedResponse, PaginationMeta } from './response.util';

// Error utility
export { BuildHiveAuthError, AuthErrorFactory, AuthErrorHandler, AUTH_ERROR_CODES } from './error.util';

// Default exports
export { default as logger } from './logger.util';
export { default as response } from './response.util';
export { default as errorFactory } from './error.util';

// Re-export for convenience
export const utils = {
  logger: buildHiveLogger,
  response: buildHiveResponse,
  error: AuthErrorFactory,
  errorHandler: AuthErrorHandler,
};

export default utils;
