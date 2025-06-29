// Shared API Types for BuildHive Application
// Common interfaces and types used across all modules

import { USER_ROLES, USER_STATUS, VERIFICATION_STATUS } from '../../config/auth';

// Base API Response Structure
export interface BaseApiResponse {
  success: boolean;
  message: string;
  meta: {
    timestamp: string;
    requestId?: string;
    version: string;
  };
}

// Success Response
export interface ApiSuccessResponse<T = any> extends BaseApiResponse {
  success: true;
  data: T;
}

// Error Response
export interface ApiErrorResponse extends BaseApiResponse {
  success: false;
  error?: string;
  errors?: Record<string, string[]>;
}

// Combined API Response Type
export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

// Pagination Metadata
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Paginated Response
export interface PaginatedApiResponse<T = any> extends ApiSuccessResponse<T[]> {
  pagination: PaginationMeta;
}

// Request Query Parameters
export interface BaseQueryParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
}

// Filter Parameters
export interface FilterParams {
  status?: string;
  role?: string;
  verified?: boolean;
  createdFrom?: string;
  createdTo?: string;
}

// Combined Query Parameters
export interface QueryParams extends BaseQueryParams, FilterParams {}

// File Upload Response
export interface FileUploadResponse {
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
  uploadedAt: Date;
}

// Bulk Operation Response
export interface BulkOperationResponse {
  total: number;
  successful: number;
  failed: number;
  errors?: Array<{
    id: string;
    error: string;
  }>;
}

// Health Check Response
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
  services: {
    database: {
      mongodb: boolean;
      redis: boolean;
    };
    external: {
      email: boolean;
      sms?: boolean;
    };
  };
  uptime: number;
  version: string;
}

// User Role Types (from constants)
export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];
export type UserStatus = typeof USER_STATUS[keyof typeof USER_STATUS];
export type VerificationStatus = typeof VERIFICATION_STATUS[keyof typeof VERIFICATION_STATUS];

// Base User Information (shared across modules)
export interface BaseUser {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Base Profile Information
export interface BaseProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
  verificationStatus: VerificationStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Address Information (Australian format)
export interface Address {
  street: string;
  suburb: string;
  state: string;
  postcode: string;
  country: string;
}

// Business Information (for Tradies and Enterprise)
export interface BusinessInfo {
  businessName?: string;
  abn?: string;
  acn?: string;
  address?: Address;
  website?: string;
  description?: string;
}

// Contact Information
export interface ContactInfo {
  email: string;
  phone?: string;
  alternatePhone?: string;
  preferredContact: 'email' | 'phone' | 'sms';
}

// Audit Trail Information
export interface AuditInfo {
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
  version?: number;
}

// Search Result
export interface SearchResult<T = any> {
  items: T[];
  total: number;
  query: string;
  filters?: Record<string, any>;
  suggestions?: string[];
}

// Notification Types
export interface NotificationData {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  data?: Record<string, any>;
  read: boolean;
  createdAt: Date;
}

// Activity Log
export interface ActivityLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
  ip: string;
  userAgent: string;
  timestamp: Date;
}

// Rate Limit Information
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  retryAfter?: number;
}

// Validation Error Detail
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
  code?: string;
}

// API Error Detail
export interface ApiErrorDetail {
  code: string;
  message: string;
  field?: string;
  context?: Record<string, any>;
}

// Request Context (for logging and tracking)
export interface RequestContext {
  requestId: string;
  userId?: string;
  userRole?: UserRole;
  ip: string;
  userAgent: string;
  method: string;
  url: string;
  timestamp: Date;
}

// Session Information
export interface SessionInfo {
  id: string;
  userId: string;
  ip: string;
  userAgent: string;
  isActive: boolean;
  lastActivity: Date;
  expiresAt: Date;
  createdAt: Date;
}

// Export utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type PartialExcept<T, K extends keyof T> = Partial<T> & Pick<T, K>;

// Generic ID type
export type ID = string;

// Generic timestamp fields
export interface Timestamps {
  createdAt: Date;
  updatedAt: Date;
}

// Generic soft delete fields
export interface SoftDelete {
  deletedAt?: Date;
  isDeleted: boolean;
}

// Complete base entity
export interface BaseEntity extends Timestamps {
  id: ID;
}

// Complete base entity with soft delete
export interface BaseEntityWithSoftDelete extends BaseEntity, SoftDelete {}

export default {
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
  BaseEntity,
  BaseEntityWithSoftDelete,
};
