// Shared Types Export Module
// Centralized export for all shared type definitions

// API types
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
} from './api.types';

// Database types
export type {
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
} from './database.types';

// Re-export default objects
export { default as apiTypes } from './api.types';
export { default as databaseTypes } from './database.types';

// Combined types object for convenience
export const sharedTypes = {
  api: apiTypes,
  database: databaseTypes,
};

export default sharedTypes;
