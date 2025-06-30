export type {
  PlatformType,
  AuthProvider,
  TokenType,
  DeviceInfo,
  LocationInfo,
  RegisterRequest,
  LoginRequest,
  RefreshTokenRequest,
  LogoutRequest,
  EmailVerificationRequest,
  PhoneVerificationRequest,
  ResendVerificationRequest,
  PasswordResetRequest,
  PasswordResetConfirmRequest,
  ChangePasswordRequest,
  TokenPayload,
  RefreshTokenPayload,
  TokenPair,
  AuthUser,
  RegisterResponse,
  LoginResponse,
  RefreshTokenResponse,
  LogoutResponse,
  VerificationResponse,
  PasswordResetResponse,
  SessionData,
  ActiveSession,
  SessionListResponse,
  SecurityContext,
  AuthValidationResult,
  ClientAuthData,
  TradieAuthData,
  EnterpriseAuthData,
  AuthEvent,
  RateLimitContext,
  RateLimitResult,
  AuthAuditLog,
  MFASetupRequest,
  MFAVerifyRequest,
  MFAResponse,
  AuthRequestType,
  AuthResponseType,
  VerificationRequestType,
} from './auth.types';

export type {
  CreateUserRequest,
  UpdateUserRequest,
  UpdateUserPasswordRequest,
  UpdateUserStatusRequest,
  VerifyEmailRequest,
  VerifyPhoneRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  UserAvailabilityCheck,
  UserVerificationStatus,
  UserProfile,
  DetailedUserProfile,
  UserListItem,
  UserQueryParams,
  UserFilterOptions,
  UserStatistics,
  UserActivitySummary,
  UpdateSubscriptionRequest,
  CreditTransactionRequest,
  CreditBalance,
  TeamMember,
  EnterpriseTeam,
  TeamInvitationRequest,
  TeamMemberUpdateRequest,
  UserDevice,
  DeviceManagementRequest,
  UserPreferences,
  UpdatePreferencesRequest,
  BulkUserOperation,
  BulkOperationResult,
  UserImportData,
  UserExportOptions,
  ValidationResponse,
  AuthResponse,
  UserResponse,
  DetailedUserResponse,
  UserListResponse,
  UserStatisticsResponse,
  CreditBalanceResponse,
  EnterpriseTeamResponse,
  UserDevicesResponse,
  UserPreferencesResponse,
  BulkOperationResponse,
  UserRequestType,
  UserResponseType,
  TeamManagementType,
  UserManagementType,
  VerificationRequestType as UserVerificationRequestType,
  PasswordRequestType,
} from './user.types';

export type {
  ServiceCategory,
  AvailabilityStatus,
  AustralianState,
  BusinessType,
  PropertyType,
  CompanySize,
  ProfileAddress,
  ProfileBusinessInfo,
  ProfileMedia,
  VerificationDocument,
  ProfileRatings,
  ProfileStatistics,
  ProfileCompletion,
  QualityScore,
  TradieQualification,
  TradieInsurance,
  TradieAvailability,
  QuotingPreferences,
  PortfolioItem,
  ClientCommunicationPreferences,
  ClientJobHistory,
  EnterpriseTeamStructure,
  EnterpriseServiceArea,
  EnterpriseCertification,
  EnterpriseOperationalPreferences,
  EnterpriseClientPortfolio,
  CreateProfileRequest,
  CreateTradieProfileRequest,
  CreateClientProfileRequest,
  CreateEnterpriseProfileRequest,
  UpdateProfileRequest,
  ProfileQueryParams,
  ProfileSearchRequest,
  ProfileData,
  TradieProfile,
  ClientProfile,
  EnterpriseProfile,
  ProfileResponse,
  ProfileListResponse,
  ProfileType,
  CreateProfileRequestType,
  ProfileRequestType,
  ProfileResponseType,
} from './profile.types';

export type User = AuthUser;

export interface BaseApiResponse {
  success: boolean;
  message: string;
  timestamp?: string;
}

export interface ApiSuccessResponse<T = any> extends BaseApiResponse {
  success: true;
  data: T;
  meta?: {
    timestamp: string;
    requestId?: string;
    version: string;
  };
}

export interface ApiErrorResponse extends BaseApiResponse {
  success: false;
  error?: string;
  errors?: Record<string, string[]>;
  meta?: {
    timestamp: string;
    requestId?: string;
    version: string;
  };
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedApiResponse<T = any> extends ApiSuccessResponse<T[]> {
  pagination: PaginationMeta;
}

export interface BaseQueryParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface FilterParams {
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}

export type QueryParams = BaseQueryParams & FilterParams;

export interface FileUploadResponse {
  filename: string;
  originalName: string;
  size: number;
  mimetype: string;
  url: string;
}

export interface BulkOperationResponse {
  total: number;
  successful: number;
  failed: number;
  errors?: string[];
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  services: Record<string, boolean>;
}

export type UserRole = 'client' | 'tradie' | 'enterprise' | 'admin';
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending';
export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export interface BaseUser {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BaseProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
  isComplete: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Address {
  street: string;
  suburb: string;
  state: AustralianState;
  postcode: string;
  country: string;
}

export interface BusinessInfo {
  name: string;
  abn?: string;
  acn?: string;
  type: BusinessType;
  description?: string;
}

export interface ContactInfo {
  email: string;
  phone: string;
  website?: string;
  socialMedia?: Record<string, string>;
}

export interface AuditInfo {
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchResult<T = any> {
  items: T[];
  total: number;
  pagination: PaginationMeta;
}

export interface NotificationData {
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
}

export interface ActivityLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  details?: Record<string, any>;
  timestamp: Date;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  retryAfter?: number;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  field?: string;
}

export interface RequestContext {
  requestId: string;
  userId?: string;
  ip: string;
  userAgent: string;
  timestamp: Date;
}

export interface SessionInfo {
  id: string;
  userId: string;
  deviceInfo: DeviceInfo;
  expiresAt: Date;
  isActive: boolean;
}

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type PartialExcept<T, K extends keyof T> = Partial<T> & Pick<T, K>;
export type ID = string;

export interface Timestamps {
  createdAt: Date;
  updatedAt: Date;
}

export interface SoftDelete {
  deletedAt?: Date;
  isDeleted: boolean;
}

export interface BaseEntity extends Timestamps {
  id: ID;
}

export interface BaseEntityWithSoftDelete extends BaseEntity, SoftDelete {}

export type ObjectId = string;

export interface BaseDocument extends BaseEntity {
  _id: ObjectId;
}

export interface BaseDocumentWithSoftDelete extends BaseDocument, SoftDelete {}

export type DatabaseConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

export interface QueryOptions {
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1>;
  select?: string | Record<string, 1 | 0>;
}

export interface PopulateOptions {
  path: string;
  select?: string;
  model?: string;
  populate?: PopulateOptions;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sort?: Record<string, 1 | -1>;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface AggregationStage {
  [key: string]: any;
}

export interface IndexDefinition {
  [key: string]: 1 | -1 | 'text' | '2d' | '2dsphere';
}

export interface SchemaOptions {
  timestamps?: boolean;
  versionKey?: boolean | string;
  collection?: string;
}

export interface TransactionOptions {
  readConcern?: string;
  writeConcern?: { w: number | string; j?: boolean; wtimeout?: number };
  readPreference?: string;
}

export interface BulkWriteOperation {
  insertOne?: { document: any };
  updateOne?: { filter: any; update: any; upsert?: boolean };
  updateMany?: { filter: any; update: any; upsert?: boolean };
  deleteOne?: { filter: any };
  deleteMany?: { filter: any };
  replaceOne?: { filter: any; replacement: any; upsert?: boolean };
}

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

export interface DatabaseValidationError {
  field: string;
  message: string;
  value: any;
}

export type DatabaseErrorType = 'validation' | 'duplicate' | 'cast' | 'connection' | 'timeout' | 'unknown';

export interface DatabaseOperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errorType?: DatabaseErrorType;
}

export interface CacheConfig {
  ttl: number;
  maxSize?: number;
  strategy?: 'lru' | 'fifo' | 'lfu';
}

export interface RedisKeyPatterns {
  session: (sessionId: string) => string;
  user: (userId: string) => string;
  rateLimit: (key: string) => string;
  cache: (key: string) => string;
}

export interface RedisPubSubMessage {
  channel: string;
  pattern?: string;
  message: string;
  data?: any;
}

export interface DatabaseHealthMetrics {
  status: DatabaseConnectionStatus;
  responseTime: number;
  activeConnections: number;
  totalQueries: number;
  errorRate: number;
}

export interface AuditTrailDocument extends BaseDocument {
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  changes?: Record<string, { old: any; new: any }>;
  metadata?: Record<string, any>;
}

export interface SessionDocument extends BaseDocument {
  userId: string;
  token: string;
  deviceInfo: DeviceInfo;
  expiresAt: Date;
  isActive: boolean;
}

export interface FileDocument extends BaseDocument {
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  path: string;
  url: string;
  uploadedBy: string;
}

export interface NotificationDocument extends BaseDocument {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  isRead: boolean;
  readAt?: Date;
}

export interface Repository<T> {
  create(data: Partial<T>): Promise<T>;
  findById(id: string): Promise<T | null>;
  findOne(filter: Record<string, any>): Promise<T | null>;
  find(filter: Record<string, any>, options?: QueryOptions): Promise<T[]>;
  update(id: string, data: Partial<T>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
  count(filter: Record<string, any>): Promise<number>;
}

export interface DatabaseService {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getHealth(): Promise<DatabaseHealthMetrics>;
}

export type DocumentArray<T> = T[] & {
  push(...items: T[]): number;
  pop(): T | undefined;
  id(id: string): T | null;
};

export type Mixed = any;
export type Decimal128 = number;

export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

export const AUTH_TYPES = {
  PLATFORM: {
    WEB: 'web' as const,
    MOBILE: 'mobile' as const,
  },
  AUTH_PROVIDER: {
    LOCAL: 'local' as const,
    GOOGLE: 'google' as const,
  },
  TOKEN: {
    ACCESS: 'access' as const,
    REFRESH: 'refresh' as const,
    EMAIL_VERIFICATION: 'email_verification' as const,
    PHONE_VERIFICATION: 'phone_verification' as const,
    PASSWORD_RESET: 'password_reset' as const,
  },
} as const;

export const PROFILE_TYPES = {
  SERVICE_CATEGORIES: {
    ELECTRICAL: 'electrical' as const,
    PLUMBING: 'plumbing' as const,
    CARPENTRY: 'carpentry' as const,
    PAINTING: 'painting' as const,
    ROOFING: 'roofing' as const,
    LANDSCAPING: 'landscaping' as const,
    TILING: 'tiling' as const,
    FLOORING: 'flooring' as const,
    HANDYMAN: 'handyman' as const,
    CLEANING: 'cleaning' as const,
    HVAC: 'hvac' as const,
    SECURITY: 'security' as const,
    OTHER: 'other' as const,
  },
  AVAILABILITY: {
    AVAILABLE: 'available' as const,
    BUSY: 'busy' as const,
    UNAVAILABLE: 'unavailable' as const,
    VACATION: 'vacation' as const,
  },
  AUSTRALIAN_STATES: {
    NSW: 'NSW' as const,
    VIC: 'VIC' as const,
    QLD: 'QLD' as const,
    WA: 'WA' as const,
    SA: 'SA' as const,
    TAS: 'TAS' as const,
    ACT: 'ACT' as const,
    NT: 'NT' as const,
  },
  BUSINESS_TYPES: {
    SOLE_TRADER: 'sole_trader' as const,
    PARTNERSHIP: 'partnership' as const,
    COMPANY: 'company' as const,
    TRUST: 'trust' as const,
  },
  PROPERTY_TYPES: {
    RESIDENTIAL: 'residential' as const,
    COMMERCIAL: 'commercial' as const,
    INDUSTRIAL: 'industrial' as const,
  },
  COMPANY_SIZES: {
    STARTUP: 'startup' as const,
    SMALL: 'small' as const,
    MEDIUM: 'medium' as const,
    LARGE: 'large' as const,
    ENTERPRISE: 'enterprise' as const,
  },
} as const;

export { AUTH_TYPES, PROFILE_TYPES };

export const sharedTypes = {
  AUTH_TYPES,
  PROFILE_TYPES,
};

export default sharedTypes;
