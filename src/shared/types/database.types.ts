// Shared Database Types for BuildHive Application
// MongoDB/Mongoose specific types and interfaces

import { Document, Types, Schema } from 'mongoose';
import { BaseEntity, BaseEntityWithSoftDelete, Timestamps, SoftDelete } from './api.types';

// MongoDB ObjectId type
export type ObjectId = Types.ObjectId;

// Base MongoDB Document interface
export interface BaseDocument extends Document, Timestamps {
  _id: ObjectId;
  id: string;
}

// Base MongoDB Document with soft delete
export interface BaseDocumentWithSoftDelete extends BaseDocument, SoftDelete {}

// Database connection status
export interface DatabaseConnectionStatus {
  mongodb: {
    connected: boolean;
    readyState: number;
    host?: string;
    name?: string;
  };
  redis: {
    connected: boolean;
    status: string;
    host?: string;
  };
}

// Query options for database operations
export interface QueryOptions {
  select?: string | string[];
  populate?: string | PopulateOptions | PopulateOptions[];
  sort?: string | Record<string, 1 | -1>;
  limit?: number;
  skip?: number;
  lean?: boolean;
  session?: any;
}

// Populate options for MongoDB
export interface PopulateOptions {
  path: string;
  select?: string;
  model?: string;
  match?: Record<string, any>;
  populate?: PopulateOptions | PopulateOptions[];
}

// Pagination options for database queries
export interface PaginationOptions {
  page: number;
  limit: number;
  sort?: Record<string, 1 | -1>;
  select?: string;
  populate?: PopulateOptions[];
}

// Paginated result from database
export interface PaginatedResult<T> {
  docs: T[];
  totalDocs: number;
  limit: number;
  page: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  nextPage?: number;
  prevPage?: number;
  pagingCounter: number;
}

// Aggregation pipeline stage
export interface AggregationStage {
  [key: string]: any;
}

// Index definition for MongoDB
export interface IndexDefinition {
  fields: Record<string, 1 | -1 | 'text' | '2dsphere'>;
  options?: {
    unique?: boolean;
    sparse?: boolean;
    background?: boolean;
    name?: string;
    expireAfterSeconds?: number;
    partialFilterExpression?: Record<string, any>;
  };
}

// Schema options for Mongoose
export interface SchemaOptions {
  timestamps?: boolean;
  versionKey?: boolean | string;
  collection?: string;
  discriminatorKey?: string;
  toJSON?: {
    transform?: (doc: any, ret: any) => any;
    virtuals?: boolean;
    getters?: boolean;
    minimize?: boolean;
  };
  toObject?: {
    transform?: (doc: any, ret: any) => any;
    virtuals?: boolean;
    getters?: boolean;
    minimize?: boolean;
  };
}

// Transaction options
export interface TransactionOptions {
  readConcern?: {
    level: 'local' | 'available' | 'majority' | 'linearizable' | 'snapshot';
  };
  writeConcern?: {
    w?: number | 'majority';
    j?: boolean;
    wtimeout?: number;
  };
  readPreference?: 'primary' | 'primaryPreferred' | 'secondary' | 'secondaryPreferred' | 'nearest';
}

// Bulk write operation types
export interface BulkWriteOperation<T> {
  insertOne?: { document: T };
  updateOne?: { filter: Record<string, any>; update: Record<string, any>; upsert?: boolean };
  updateMany?: { filter: Record<string, any>; update: Record<string, any>; upsert?: boolean };
  deleteOne?: { filter: Record<string, any> };
  deleteMany?: { filter: Record<string, any> };
  replaceOne?: { filter: Record<string, any>; replacement: T; upsert?: boolean };
}

// Bulk write result
export interface BulkWriteResult {
  acknowledged: boolean;
  insertedCount: number;
  insertedIds: Record<number, ObjectId>;
  matchedCount: number;
  modifiedCount: number;
  deletedCount: number;
  upsertedCount: number;
  upsertedIds: Record<number, ObjectId>;
}

// Database validation error
export interface DatabaseValidationError {
  field: string;
  message: string;
  value: any;
  kind: string;
  path: string;
}

// Database error types
export type DatabaseErrorType = 
  | 'ValidationError'
  | 'CastError'
  | 'DuplicateKeyError'
  | 'ConnectionError'
  | 'TimeoutError'
  | 'UnknownError';

// Database operation result
export interface DatabaseOperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: {
    type: DatabaseErrorType;
    message: string;
    details?: any;
  };
  metadata?: {
    executionTime: number;
    affectedDocuments?: number;
  };
}

// Cache configuration
export interface CacheConfig {
  ttl: number; // Time to live in seconds
  key: string;
  tags?: string[];
  compress?: boolean;
}

// Redis key patterns
export interface RedisKeyPatterns {
  session: (userId: string) => string;
  userProfile: (userId: string) => string;
  emailVerification: (email: string) => string;
  passwordReset: (email: string) => string;
  rateLimit: (ip: string, action: string) => string;
  cache: (resource: string, id: string) => string;
}

// Redis pub/sub message
export interface RedisPubSubMessage {
  channel: string;
  pattern?: string;
  data: any;
  timestamp: Date;
}

// Database health metrics
export interface DatabaseHealthMetrics {
  mongodb: {
    connected: boolean;
    responseTime: number;
    activeConnections: number;
    availableConnections: number;
    serverStatus?: any;
  };
  redis: {
    connected: boolean;
    responseTime: number;
    memoryUsage: number;
    connectedClients: number;
    commandsProcessed: number;
  };
}

// Audit trail document structure
export interface AuditTrailDocument extends BaseDocument {
  userId: ObjectId;
  action: string;
  resource: string;
  resourceId?: ObjectId;
  changes?: {
    before?: Record<string, any>;
    after?: Record<string, any>;
  };
  metadata: {
    ip: string;
    userAgent: string;
    timestamp: Date;
  };
}

// Session document structure
export interface SessionDocument extends BaseDocument {
  userId: ObjectId;
  token: string;
  refreshToken?: string;
  ip: string;
  userAgent: string;
  isActive: boolean;
  lastActivity: Date;
  expiresAt: Date;
  deviceInfo?: {
    browser?: string;
    os?: string;
    device?: string;
  };
}

// File document structure
export interface FileDocument extends BaseDocument {
  userId: ObjectId;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  path: string;
  url: string;
  metadata?: Record<string, any>;
  tags?: string[];
}

// Notification document structure
export interface NotificationDocument extends BaseDocument {
  userId: ObjectId;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  data?: Record<string, any>;
  read: boolean;
  readAt?: Date;
  expiresAt?: Date;
}

// Generic repository interface
export interface Repository<T extends BaseDocument> {
  create(data: Partial<T>): Promise<T>;
  findById(id: string | ObjectId, options?: QueryOptions): Promise<T | null>;
  findOne(filter: Record<string, any>, options?: QueryOptions): Promise<T | null>;
  find(filter: Record<string, any>, options?: QueryOptions): Promise<T[]>;
  findPaginated(filter: Record<string, any>, options: PaginationOptions): Promise<PaginatedResult<T>>;
  update(id: string | ObjectId, data: Partial<T>): Promise<T | null>;
  updateMany(filter: Record<string, any>, data: Partial<T>): Promise<{ matchedCount: number; modifiedCount: number }>;
  delete(id: string | ObjectId): Promise<boolean>;
  deleteMany(filter: Record<string, any>): Promise<{ deletedCount: number }>;
  count(filter: Record<string, any>): Promise<number>;
  exists(filter: Record<string, any>): Promise<boolean>;
  aggregate(pipeline: AggregationStage[]): Promise<any[]>;
  bulkWrite(operations: BulkWriteOperation<T>[]): Promise<BulkWriteResult>;
}

// Database service interface
export interface DatabaseService {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getHealth(): Promise<DatabaseHealthMetrics>;
  startTransaction(): Promise<any>;
  commitTransaction(session: any): Promise<void>;
  abortTransaction(session: any): Promise<void>;
}

// Export utility types
export type DocumentArray<T> = Types.DocumentArray<T>;
export type Mixed = Schema.Types.Mixed;
export type Decimal128 = Schema.Types.Decimal128;

export default {
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
};
