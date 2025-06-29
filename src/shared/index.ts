// Shared Module Export
// Main entry point for all shared functionality across BuildHive

// Utilities
export {
  buildHiveLogger,
  winstonLogger,
  buildHiveResponse,
  BuildHiveAuthError,
  AuthErrorFactory,
  AuthErrorHandler,
  AUTH_ERROR_CODES,
  utils,
} from './utils';

// Middleware
export {
  errorHandler,
  asyncHandler,
  notFoundHandler,
  validationErrorHandler,
  ErrorMiddleware,
  authRateLimit,
  profileRateLimit,
  generalRateLimit,
  strictRateLimit,
  dynamicRateLimit,
  customRateLimit,
  skipRateLimitIf,
  rateLimitHealthCheck,
  RateLimitMiddleware,
  middleware,
} from './middleware';

// Types
export type {
  BaseApiResponse,
  ApiSuccessResponse,
  ApiErrorResponse,
  ApiResponse,
  PaginationMeta,
  PaginatedApiResponse,
  BaseQueryParams,
  FilterParams,
  QueryParams,
  FileUploadResponse,
  BulkOperationResponse,
  HealthCheckResponse,
  UserRole,
  UserStatus,
  VerificationStatus,
  BaseUser,
  BaseProfile,
  Address,
  BusinessInfo,
  ContactInfo,
  AuditInfo,
  SearchResult,
  NotificationData,
  ActivityLog,
  RateLimitInfo,
  ValidationError,
  ApiErrorDetail,
  RequestContext,
  SessionInfo,
  Optional,
  RequiredFields,
  PartialExcept,
  ID,
  Timestamps,
  SoftDelete,
  BaseEntity,
  BaseEntityWithSoftDelete,
  ObjectId,
  BaseDocument,
  BaseDocumentWithSoftDelete,
  DatabaseConnectionStatus,
  QueryOptions,
  PopulateOptions,
  PaginationOptions,
  PaginatedResult,
  AggregationStage,
  IndexDefinition,
  SchemaOptions,
  TransactionOptions,
  BulkWriteOperation,
  BulkWriteResult,
  DatabaseValidationError,
  DatabaseErrorType,
  DatabaseOperationResult,
  CacheConfig,
  RedisKeyPatterns,
  RedisPubSubMessage,
  DatabaseHealthMetrics,
  AuditTrailDocument,
  SessionDocument,
  FileDocument,
  NotificationDocument,
  Repository,
  DatabaseService,
  DocumentArray,
  Mixed,
  Decimal128,
  sharedTypes,
} from './types';

// Database
export {
  databaseConnection,
  connectDatabase,
  disconnectDatabase,
  getDatabaseHealth,
  getDatabaseStatus,
  getMongoConnection,
  getRedisClient,
  startTransaction,
  commitTransaction,
  abortTransaction,
  database,
} from './database';

// Default exports for convenience
export { default as logger } from './utils/logger.util';
export { default as response } from './utils/response.util';
export { default as errorFactory } from './utils/error.util';
export { default as ErrorMiddleware } from './middleware/error.middleware';
export { default as RateLimitMiddleware } from './middleware/rate-limit.middleware';
export { default as types } from './types';
export { default as db } from './database';

// Combined shared object for easy access
export const shared = {
  utils: {
    logger: buildHiveLogger,
    response: buildHiveResponse,
    error: AuthErrorFactory,
    errorHandler: AuthErrorHandler,
  },
  middleware: {
    error: ErrorMiddleware,
    rateLimit: RateLimitMiddleware,
  },
  database: {
    connection: databaseConnection,
    connect: connectDatabase,
    disconnect: disconnectDatabase,
    health: getDatabaseHealth,
    status: getDatabaseStatus,
    mongo: getMongoConnection,
    redis: getRedisClient,
    transaction: {
      start: startTransaction,
      commit: commitTransaction,
      abort: abortTransaction,
    },
  },
  types: sharedTypes,
};

export default shared;
