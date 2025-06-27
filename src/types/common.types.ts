export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: ApiError[];
  meta?: ResponseMeta;
  timestamp: string;
  requestId: string;
}

export class ApiError extends Error {
  public code: string;
  public field?: string;
  public severity: ErrorSeverity;
  public details?: Record<string, any>;
  public statusCode: number;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    field?: string,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.severity = severity;
    this.field = field;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export interface LogContext {
  // User and session context
  userId?: string;
  userType?: string;
  sessionId?: string;
  requestId?: string;
  correlationId?: string;
  
  // Request context
  ipAddress?: string;
  userAgent?: string;
  method?: string;
  url?: string;
  
  // Application context
  phase?: string;
  environment?: string;
  processId?: number;
  baseUrl?: string;
  version?: string;
  port?: number;
  
  // Error context
  error?: string;
  errorMessage?: string;
  code?: string;
  severity?: string;
  stack?: string;
  reason?: string;
  
  // Performance context
  duration?: number;
  connectionTime?: number;
  startupTime?: number;
  shutdownDuration?: number;
  uptime?: number;
  
  // System context
  address?: string;
  signal?: string;
  cacheHit?: boolean;
  
  // Business context
  nextStep?: string;
  rememberMe?: boolean;
  token?: string;
  email?: string;
  userRole?: string;
  userPermissions?: string[];
  clientId?: string;
  currentCompleteness?: number;
  profileCompleteness?: number;
  contentLength?: number;
  
  // CORS and security context
  rejectedOrigin?: string;
  allowedOrigins?: string[];
  ip?: string;
  
  // Generic metadata
  metadata?: Record<string, any>;
  
  // Allow any additional properties
  [key: string]: any;
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
  deviceId?: string;
  userAgent?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface FilterParams {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string[];
  [key: string]: any;
}

export interface ResponseMeta {
  pagination?: PaginationMeta;
  filters?: FilterParams;
  executionTime?: number;
  version: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  severity: AuditSeverity;
}

export enum AuditSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export interface FileUpload {
  id: string;
  originalName: string;
  fileName: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedBy: string;
  uploadedAt: Date;
  virusScanned: boolean;
  scanResult?: string;
  metadata?: Record<string, any>;
}

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  version: number;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
}

export interface AppConfig {
  app: {
    name: string;
    version: string;
    environment: Environment;
    port: number;
    apiPrefix: string;
  };
  security: {
    jwtSecret: string;
    jwtExpiresIn: string;
    bcryptRounds: number;
    rateLimitWindow: number;
    rateLimitMax: number;
  };
  database: {
    url: string;
    maxConnections: number;
    connectionTimeout: number;
  };
  redis: {
    url: string;
    keyPrefix: string;
    defaultTTL: number;
  };
  aws: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    s3Bucket: string;
  };
  monitoring: {
    enableMetrics: boolean;
    enableTracing: boolean;
    logLevel: LogLevel;
  };
}

export enum Environment {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production'
}

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

export interface ValidationRule {
  field: string;
  rules: string[];
  message?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
  severity: ErrorSeverity;
  statusCode: number;
  name: string;
}

export interface DomainEvent {
  id: string;
  type: string;
  aggregateId: string;
  aggregateType: string;
  data: Record<string, any>;
  metadata: EventMetadata;
  timestamp: Date;
  version: number;
}

export interface EventMetadata {
  userId?: string;
  correlationId: string;
  causationId?: string;
  source: string;
  ipAddress?: string;
}

export interface HealthCheck {
  status: HealthStatus;
  timestamp: Date;
  services: ServiceHealth[];
  version: string;
  uptime: number;
}

export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy'
}

export interface ServiceHealth {
  name: string;
  status: HealthStatus;
  responseTime?: number;
  error?: string;
  lastChecked: Date;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  compress?: boolean;
  serialize?: boolean;
}

// Additional interfaces for auth controller compatibility
export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    user?: any;
    tokens?: {
      accessToken: string;
      refreshToken: string;
    };
    requiresTwoFactor?: boolean;
    nextStep?: string;
  };
  errors?: ApiError[];
  timestamp: string;
  requestId: string;
}

export interface TokenPayload {
  userId: string;
  email: string;
  userType: string;
  sessionId: string;
  iat: number;
  exp: number;
}

// Database transaction types
export interface TransactionOptions {
  isolationLevel?: 'ReadUncommitted' | 'ReadCommitted' | 'RepeatableRead' | 'Serializable';
  maxWait?: number;
  timeout?: number;
}

// Redis connection types
export interface RedisConfig {
  url: string;
  keyPrefix: string;
  defaultTTL: number;
  maxRetries: number;
  retryDelayOnFailover: number;
  enableReadyCheck: boolean;
  maxRetriesPerRequest: number;
}

// Logger types
export interface LoggerConfig {
  level: LogLevel;
  format: 'json' | 'text';
  enableConsole: boolean;
  enableFile: boolean;
  filePath?: string;
  maxFileSize?: string;
  maxFiles?: number;
}

// Export utility types
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type PartialFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
