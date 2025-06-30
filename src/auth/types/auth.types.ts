// Authentication Types for BuildHive Application
// Core authentication interfaces, DTOs, and type definitions

import type {
  BaseApiResponse,
  ApiResponse,
  UserRole,
  UserStatus,
  VerificationStatus,
  BaseUser,
  RequestContext,
  ValidationError,
} from '../../shared/types';

// Platform and Provider Types
export type PlatformType = 'web' | 'mobile';
export type AuthProvider = 'local' | 'google';
export type TokenType = 'access' | 'refresh' | 'email_verification' | 'phone_verification' | 'password_reset';

// Device Information Interface
export interface DeviceInfo {
  deviceId: string;
  platform: PlatformType;
  userAgent: string;
  ipAddress?: string;
  browser?: string;
  browserVersion?: string;
  os?: string;
  osVersion?: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  isMobile: boolean;
  pushToken?: string;
}

// Location Information Interface
export interface LocationInfo {
  ip: string;
  country?: string;
  region?: string;
  city?: string;
  timezone?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

// Authentication Request DTOs
export interface RegisterRequest {
  username: string;
  email?: string;
  phone?: string;
  password?: string;
  role: UserRole;
  platform: PlatformType;
  authProvider: AuthProvider;
  firstName: string;
  lastName: string;
  gender?: string; 
  acceptTerms: boolean;
  marketingConsent?: boolean;
  deviceInfo: DeviceInfo;
  locationInfo: LocationInfo;
  googleId?: string;
  googleEmail?: string;
  googleAvatar?: string;
  businessInfo?: {
    businessName?: string;
    abn?: string;
    tradingName?: string;
  };
}

export interface LoginRequest {
  identifier: string;
  password?: string;
  platform: PlatformType;
  authProvider: AuthProvider;
  rememberMe?: boolean;
  deviceInfo: DeviceInfo;
  locationInfo: LocationInfo;
  googleId?: string;
  googleEmail?: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
  deviceInfo: DeviceInfo;
  locationInfo: LocationInfo;
}

export interface LogoutRequest {
  refreshToken?: string;
  sessionId?: string;  
  logoutAll?: boolean;
  deviceId?: string;
}

// Verification Request DTOs
export interface EmailVerificationRequest {
  token: string;
  email: string;
}

export interface PhoneVerificationRequest {
  code: string;
  phone: string;
  userId: string;
}

export interface ResendVerificationRequest {
  type: 'email' | 'phone';
  identifier: string;
  userId?: string;
  email?: string;  
  phone?: string;  
}

export interface PasswordResetRequest {
  email: string;
  platform: PlatformType;
}

export interface PasswordResetConfirmRequest {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  metadata?: {  
    userAgent?: string;
    ipAddress?: string;
    timestamp?: Date;
  };
}

// Token Interfaces
export interface TokenPayload {
  userId: string;
  username: string;
  email?: string;
  role: UserRole;
  status: UserStatus;
  verificationStatus: VerificationStatus;
  platform: PlatformType;
  sessionId: string;
  deviceId: string;
  iat: number;
  exp: number;
  jti: string;
}

export interface RefreshTokenPayload {
  userId: string;
  sessionId: string;
  deviceId: string;
  tokenVersion: number;
  iat: number;
  exp: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
  tokenType: 'Bearer';
}

// Authentication Response DTOs
export interface AuthUser extends BaseUser {
  username: string;
  phone?: string;
  platform: PlatformType;
  authProvider: AuthProvider;
  isPhoneVerified: boolean;
  verificationStatus: VerificationStatus;
  lastLogin?: Date;
  profileId?: string;
  subscription?: {
    plan: 'free' | 'pro' | 'enterprise';
    status: 'active' | 'cancelled' | 'expired';
    endDate?: Date;
  };
  credits: number;
  canApplyToJobs?: boolean;
  canPostJobs?: boolean;
  canManageTeam?: boolean;
}

export interface RegisterResponse extends BaseApiResponse {
  success: true;
  data: {
    user: AuthUser;
    tokens: TokenPair;
    requiresVerification: {
      email: boolean;
      phone: boolean;
    };
    nextSteps: string[];
  };
}

export interface LoginResponse extends BaseApiResponse {
  success: true;
  data: {
    user: AuthUser;
    tokens: TokenPair;
    session: {
      id: string;
      expiresAt: Date;
      isNewDevice: boolean;
    };
    requiresVerification?: {
      email: boolean;
      phone: boolean;
    };
  };
}

export interface RefreshTokenResponse extends BaseApiResponse {
  success: true;
  data: {
    tokens: TokenPair;
    user: Pick<AuthUser, 'id' | 'username' | 'role' | 'status' | 'verificationStatus'>;
  };
}

export interface LogoutResponse extends BaseApiResponse {
  success: true;
  data: {
    message: string;
    sessionsTerminated: number;
  };
}

export interface VerificationResponse extends BaseApiResponse {
  success: true;
  data: {
    verified: boolean;
    type: 'email' | 'phone';
    user: Pick<AuthUser, 'id' | 'verificationStatus' | 'isEmailVerified' | 'isPhoneVerified'>;
    isFullyVerified: boolean;
  };
}

export interface PasswordResetResponse extends BaseApiResponse {
  success: true;
  data: {
    message: string;
    resetTokenSent: boolean;
    expiresIn: number;
  };
}

// Session Management Types
export interface SessionData {
  id: string;
  userId: string;
  deviceInfo: DeviceInfo;
  locationInfo: LocationInfo;
  isActive: boolean;
  isTrusted: boolean;
  lastActivity: Date;
  expiresAt: Date;
  createdAt: Date;
}

export interface ActiveSession {
  id: string;
  deviceInfo: Pick<DeviceInfo, 'platform' | 'browser' | 'os' | 'deviceType'>;
  location: Pick<LocationInfo, 'city' | 'country'>;
  lastActivity: Date;
  isCurrent: boolean;
  isTrusted: boolean;
}

export interface SessionListResponse extends BaseApiResponse {
  success: true;
  data: {
    sessions: ActiveSession[];
    total: number;
    currentSessionId: string;
  };
}

// Security and Validation Types
export interface SecurityContext {
  userId: string;
  sessionId: string;
  deviceId: string;
  ipAddress: string;
  userAgent: string;
  platform: PlatformType;
  isSecure: boolean;
  isTrusted: boolean;
  requiresMFA: boolean;
  lastSecurityCheck: Date;
}

export interface AuthValidationResult {
  isValid: boolean;
  user?: AuthUser;
  session?: SessionData;
  securityContext?: SecurityContext;
  errors?: ValidationError[];
  requiresAction?: {
    type: 'email_verification' | 'phone_verification' | 'password_change' | 'mfa_setup';
    message: string;
  };
}

// Role-Specific Authentication Data
export interface ClientAuthData {
  propertyType?: 'residential' | 'commercial' | 'industrial';
  preferredTradies: string[];
  budgetRange?: {
    min: number;
    max: number;
    currency: string;
  };
}

export interface TradieAuthData {
  serviceCategories: string[];
  hourlyRate?: {
    min: number;
    max: number;
    currency: string;
  };
  serviceRadius: number;
  availability: 'available' | 'busy' | 'unavailable';
  isVerified: boolean;
  completedJobs: number;
  rating: number;
}

export interface EnterpriseAuthData {
  teamSize: number;
  isOwner: boolean;
  permissions: string[];
  teamMembers: string[];
  serviceAreas: string[];
  companySize: 'startup' | 'small' | 'medium' | 'large' | 'enterprise';
}

// Event Types for Redis Pub/Sub
export interface AuthEvent {
  type: 'user.registered' | 'user.login' | 'user.logout' | 'user.verified' | 'session.created' | 'session.revoked';
  userId: string;
  sessionId?: string;
  timestamp: Date;
  metadata: {
    platform: PlatformType;
    ip: string;
    userAgent: string;
    deviceId: string;
  };
  data?: Record<string, any>;
}

// Rate Limiting Types
export interface RateLimitContext {
  ip: string;
  userId?: string;
  action: 'login' | 'register' | 'password_reset' | 'verification';
  platform: PlatformType;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}

// Audit Trail Types
export interface AuthAuditLog {
  userId: string;
  action: string;
  resource: 'user' | 'session' | 'token' | 'verification';
  resourceId?: string;
  result: 'success' | 'failure' | 'blocked';
  reason?: string;
  metadata: {
    ip: string;
    userAgent: string;
    platform: PlatformType;
    deviceId: string;
    location?: LocationInfo;
  };
  timestamp: Date;
}

// Multi-Factor Authentication Types
export interface MFASetupRequest {
  method: 'sms' | 'email' | 'totp';
  phone?: string;
  email?: string;
}

export interface MFAVerifyRequest {
  method: 'sms' | 'email' | 'totp';
  code: string;
  sessionId: string;
}

export interface MFAResponse extends BaseApiResponse {
  success: true;
  data: {
    verified: boolean;
    method: 'sms' | 'email' | 'totp';
    backupCodes?: string[];
  };
}

// Type Guards and Utilities
export type AuthRequestType = RegisterRequest | LoginRequest | RefreshTokenRequest | LogoutRequest;
export type AuthResponseType = RegisterResponse | LoginResponse | RefreshTokenResponse | LogoutResponse;
export type VerificationRequestType = EmailVerificationRequest | PhoneVerificationRequest | ResendVerificationRequest;

// Export all types
export type {
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
};
