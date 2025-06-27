export enum UserType {
  CLIENT = 'client',
  TRADIE = 'tradie',
  ENTERPRISE = 'enterprise'
}

export enum UserStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  REJECTED = 'rejected',
  PENDING_VERIFICATION = 'pending_verification'
}

export enum VerificationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  RESUBMISSION_REQUIRED = 'resubmission_required'
}

export enum DocumentType {
  ID_DOCUMENT = 'id_document',
  SELFIE_PHOTO = 'selfie_photo',
  ABN_CERTIFICATE = 'abn_certificate',
  TRADE_QUALIFICATION = 'trade_qualification',
  INSURANCE_CERTIFICATE = 'insurance_certificate',
  LICENSE = 'license',
  COMPANY_REGISTRATION = 'company_registration',
  DIRECTORS_ID = 'directors_id'
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
  permissions?: string[];
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

export interface AuthError {
  code: string;
  message: string;
  field?: string;
}
