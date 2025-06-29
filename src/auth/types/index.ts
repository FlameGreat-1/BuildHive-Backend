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

// ADD THESE MISSING ALIASES THAT THE CONTROLLER EXPECTS:
export type ForgotPasswordRequest = PasswordResetRequest;
export type ResetPasswordRequest = PasswordResetConfirmRequest;
export type AuthResponse = LoginResponse | RegisterResponse | RefreshTokenResponse;
export type User = AuthUser;

// ADD MISSING VALIDATION TYPES
export interface VerifyEmailRequest {
  token: string;
  email: string;
}

export interface VerifyPhoneRequest {
  code: string;
  phone: string;
  userId: string;
}

export interface ProfileSearchRequest {
  query?: string;
  category?: ServiceCategory;
  location?: string;
  radius?: number;
  minRating?: number;
  availability?: AvailabilityStatus;
  priceRange?: {
    min: number;
    max: number;
  };
  sortBy?: 'rating' | 'distance' | 'price' | 'reviews';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface ValidationResponse {
  success: boolean;
  message: string;
  data?: any;
  errors?: ValidationError[];
}

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

export default {
  AUTH_TYPES,
  PROFILE_TYPES,
};
