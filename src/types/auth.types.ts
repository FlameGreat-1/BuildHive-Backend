
import { UserType, UserStatus } from '@prisma/client';

export { UserType, UserStatus };

export enum VerificationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  RESUBMISSION_REQUIRED = 'RESUBMISSION_REQUIRED'
}

export enum DocumentType {
  ID_DOCUMENT = 'ID_DOCUMENT',
  SELFIE_PHOTO = 'SELFIE_PHOTO',
  ABN_CERTIFICATE = 'ABN_CERTIFICATE',
  TRADE_QUALIFICATION = 'TRADE_QUALIFICATION',
  INSURANCE_CERTIFICATE = 'INSURANCE_CERTIFICATE',
  LICENSE = 'LICENSE',
  COMPANY_REGISTRATION = 'COMPANY_REGISTRATION',
  DIRECTORS_ID = 'DIRECTORS_ID'
}

export interface BaseUser {
  id: string;
  email: string;
  userType: UserType;
  status: UserStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserCredentials {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  userType: UserType;
  acceptTerms: boolean;
  marketingConsent?: boolean;
  source?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  userType?: UserType;
  rememberMe?: boolean;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  user?: any;
  tokens?: any;
  session?: any;
  permissions?: string[];
  profileCompleteness?: number;
  nextStep?: string;
}

export interface VerificationRequest {
  userId: string;
  code?: string;
  token?: string;
  type?: 'email' | 'sms';
}

export interface PasswordResetRequest {
  email: string;
  token?: string;
  newPassword?: string;
}

export interface DocumentUpload {
  userId: string;
  documentType: DocumentType;
  fileName: string;
  fileUrl: string;
  uploadedAt: Date;
}

export interface ClientProfile {
  userId: string;
  location: string;
  preferences?: Record<string, any>;
}

export interface TradieProfile {
  userId: string;
  abn: string;
  tradeTypes: string[];
  serviceAreas: string[];
  hourlyRates: Record<string, number>;
  availability: Record<string, any>;
  verificationStatus: VerificationStatus;
  profileCompleteness: number;
}

export interface EnterpriseProfile {
  userId: string;
  companyName: string;
  abn: string;
  businessAddress: Record<string, any>;
  adminPermissions: string[];
  verificationStatus: VerificationStatus;
}

export interface JWTPayload {
  userId: string;
  email: string;
  userType: UserType;
  status: UserStatus;
  permissions: string[];
  sessionId?: string;
  iat: number;
  exp: number;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    token?: string;
    user?: Partial<BaseUser>;
    requiresOnboarding?: boolean;
    nextStep?: string;
  };
}

export interface VerificationResponse {
  success: boolean;
  verified: boolean;
  nextStep?: string;
  message: string;
}

export interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  status?: UserStatus;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  metadata?: Record<string, any>;
}

export interface AuthError {
  code: string;
  message: string;
  field?: string;
  severity: 'error' | 'warning' | 'info';
  statusCode: number;
  name: string;
}
