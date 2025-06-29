import type { BaseApiResponse, ApiResponse, PaginatedApiResponse, BaseUser, UserRole, UserStatus, VerificationStatus, BaseQueryParams, Address, BusinessInfo, ContactInfo, AuditInfo, Optional, RequiredFields } from '../../shared/types';
import type { PlatformType, AuthProvider, DeviceInfo, LocationInfo } from './auth.types';

export interface CreateUserRequest {
  username: string;
  email?: string;
  phone?: string;
  password?: string;
  role: UserRole;
  platform: PlatformType;
  authProvider: AuthProvider;
  firstName: string;
  lastName: string;
  acceptTerms: boolean;
  marketingConsent?: boolean;
  registrationIP?: string;
  googleId?: string;
  googleEmail?: string;
  googleAvatar?: string;
}

export interface UpdateUserRequest {
  username?: string;
  email?: string;
  phone?: string;
  status?: UserStatus;
  marketingConsent?: boolean;
  updatedBy?: string;
}

export interface UpdateUserPasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  logoutOtherSessions?: boolean;
}

export interface UpdateUserStatusRequest {
  status: UserStatus;
  reason?: string;
  updatedBy: string;
  notifyUser?: boolean;
}

export interface UserProfile extends BaseUser {
  username: string;
  phone?: string;
  platform: PlatformType;
  authProvider: AuthProvider;
  googleId?: string;
  googleEmail?: string;
  googleAvatar?: string;
  isPhoneVerified: boolean;
  verificationStatus: VerificationStatus;
  lastLogin?: Date;
  lastLoginIP?: string;
  lastLoginPlatform?: PlatformType;
  profileId?: string;
  registrationIP?: string;
  marketingConsent: boolean;
  loginAttempts?: number;
  isLocked?: boolean;
  lockUntil?: Date;
  passwordChangedAt?: Date;
}

export interface DetailedUserProfile extends UserProfile {
  subscription: {
    plan: 'free' | 'pro' | 'enterprise';
    status: 'active' | 'cancelled' | 'expired';
    startDate?: Date;
    endDate?: Date;
    autoRenew: boolean;
    billingCycle?: 'monthly' | 'yearly';
  };
  credits: number;
  creditHistory: Array<{
    amount: number;
    type: 'purchase' | 'usage' | 'refund' | 'bonus';
    description: string;
    timestamp: Date;
  }>;
  enterpriseTeam?: {
    isOwner: boolean;
    ownerId?: string;
    teamMembers: string[];
    permissions: string[];
    invitationCode?: string;
  };
  devices: Array<{
    deviceId: string;
    platform: PlatformType;
    deviceInfo: string;
    lastActive: Date;
    pushToken?: string;
  }>;
  statistics: {
    totalLogins: number;
    profileViews: number;
    lastActiveDate: Date;
    joinDate: Date;
  };
  preferences: {
    notifications: {
      email: boolean;
      sms: boolean;
      push: boolean;
    };
    privacy: {
      profileVisibility: 'public' | 'registered_users' | 'private';
      showContactInfo: boolean;
    };
  };
}

export interface UserListItem {
  id: string;
  username: string;
  email?: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  verificationStatus: VerificationStatus;
  platform: PlatformType;
  authProvider: AuthProvider;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  lastLogin?: Date;
  createdAt: Date;
  profileCompletion?: number;
  subscription?: {
    plan: string;
    status: string;
  };
  credits?: number;
}

export interface UserQueryParams extends BaseQueryParams {
  role?: UserRole;
  status?: UserStatus;
  verificationStatus?: VerificationStatus;
  platform?: PlatformType;
  authProvider?: AuthProvider;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  hasActiveSubscription?: boolean;
  minCredits?: number;
  lastLoginFrom?: string;
  lastLoginTo?: string;
  registeredFrom?: string;
  registeredTo?: string;
}

export interface UserFilterOptions {
  roles?: UserRole[];
  statuses?: UserStatus[];
  platforms?: PlatformType[];
  authProviders?: AuthProvider[];
  verificationStatuses?: VerificationStatus[];
  isVerified?: boolean;
  hasSubscription?: boolean;
  dateRange?: {
    field: 'createdAt' | 'lastLogin' | 'updatedAt';
    from: Date;
    to: Date;
  };
  searchFields?: Array<'username' | 'email' | 'phone' | 'firstName' | 'lastName'>;
}

export interface UserStatistics {
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  usersByRole: Record<UserRole, number>;
  usersByStatus: Record<UserStatus, number>;
  usersByPlatform: Record<PlatformType, number>;
  usersByAuthProvider: Record<AuthProvider, number>;
  verificationStats: {
    fullyVerified: number;
    emailVerified: number;
    phoneVerified: number;
    unverified: number;
    pending: number;
    rejected: number;
  };
  subscriptionStats: {
    free: number;
    pro: number;
    enterprise: number;
    activeSubscriptions: number;
    expiredSubscriptions: number;
  };
  loginStats: {
    dailyActiveUsers: number;
    weeklyActiveUsers: number;
    monthlyActiveUsers: number;
    averageSessionDuration: number;
  };
}

export interface UserActivitySummary {
  userId: string;
  username: string;
  role: UserRole;
  totalLogins: number;
  lastLogin: Date;
  averageSessionDuration: number;
  devicesUsed: number;
  locationsAccessed: number;
  securityEvents: number;
  profileUpdates: number;
  creditsUsed: number;
  subscriptionChanges: number;
}

export interface UpdateSubscriptionRequest {
  plan: 'free' | 'pro' | 'enterprise';
  billingCycle?: 'monthly' | 'yearly';
  autoRenew?: boolean;
  startDate?: Date;
  endDate?: Date;
  updatedBy: string;
}

export interface CreditTransactionRequest {
  userId: string;
  amount: number;
  type: 'purchase' | 'usage' | 'refund' | 'bonus';
  description: string;
  reference?: string;
  processedBy: string;
}

export interface CreditBalance {
  userId: string;
  currentBalance: number;
  totalPurchased: number;
  totalUsed: number;
  totalRefunded: number;
  lastTransaction?: {
    amount: number;
    type: string;
    description: string;
    timestamp: Date;
  };
}

export interface TeamMember {
  userId: string;
  username: string;
  email?: string;
  role: UserRole;
  status: UserStatus;
  permissions: string[];
  joinedAt: Date;
  lastActive?: Date;
  isActive: boolean;
}

export interface EnterpriseTeam {
  ownerId: string;
  ownerUsername: string;
  teamMembers: TeamMember[];
  totalMembers: number;
  activeMembers: number;
  invitationCode: string;
  permissions: {
    manage_team: boolean;
    assign_jobs: boolean;
    view_analytics: boolean;
    manage_billing: boolean;
    manage_settings: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamInvitationRequest {
  invitationCode: string;
  email?: string;
  phone?: string;
  permissions: string[];
  invitedBy: string;
  expiresAt?: Date;
}

export interface TeamMemberUpdateRequest {
  userId: string;
  permissions?: string[];
  status?: 'active' | 'inactive' | 'suspended';
  updatedBy: string;
}

export interface UserDevice {
  deviceId: string;
  platform: PlatformType;
  deviceInfo: string;
  browser?: string;
  os?: string;
  lastActive: Date;
  isActive: boolean;
  isTrusted: boolean;
  pushToken?: string;
  location?: {
    country?: string;
    city?: string;
  };
  firstSeen: Date;
}

export interface DeviceManagementRequest {
  deviceId: string;
  action: 'trust' | 'untrust' | 'remove' | 'update_push_token';
  pushToken?: string;
  updatedBy: string;
}

export interface UserPreferences {
  notifications: {
    email: {
      marketing: boolean;
      security: boolean;
      jobUpdates: boolean;
      systemUpdates: boolean;
    };
    sms: {
      security: boolean;
      jobAlerts: boolean;
      paymentAlerts: boolean;
    };
    push: {
      jobUpdates: boolean;
      messages: boolean;
      security: boolean;
      marketing: boolean;
    };
  };
  privacy: {
    profileVisibility: 'public' | 'registered_users' | 'private';
    showContactInfo: boolean;
    showLocation: boolean;
    allowDirectContact: boolean;
    showOnlineStatus: boolean;
  };
  communication: {
    preferredLanguage: string;
    timezone: string;
    preferredContact: 'email' | 'phone' | 'sms' | 'app';
  };
  security: {
    twoFactorEnabled: boolean;
    loginNotifications: boolean;
    sessionTimeout: number;
    requirePasswordChange: boolean;
  };
}

export interface UpdatePreferencesRequest {
  notifications?: Partial<UserPreferences['notifications']>;
  privacy?: Partial<UserPreferences['privacy']>;
  communication?: Partial<UserPreferences['communication']>;
  security?: Partial<UserPreferences['security']>;
  updatedBy: string;
}

export interface BulkUserOperation {
  userIds: string[];
  operation: 'activate' | 'deactivate' | 'suspend' | 'verify' | 'delete' | 'update_role';
  data?: {
    status?: UserStatus;
    role?: UserRole;
    reason?: string;
  };
  performedBy: string;
}

export interface BulkOperationResult {
  total: number;
  successful: number;
  failed: number;
  results: Array<{
    userId: string;
    success: boolean;
    error?: string;
  }>;
}

export interface UserImportData {
  username: string;
  email?: string;
  phone?: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  platform: PlatformType;
  businessInfo?: {
    businessName?: string;
    abn?: string;
  };
}

export interface UserExportOptions {
  format: 'csv' | 'json' | 'xlsx';
  fields: string[];
  filters?: UserFilterOptions;
  includeDeleted?: boolean;
  dateRange?: {
    from: Date;
    to: Date;
  };
}

export interface UserResponse extends BaseApiResponse {
  success: true;
  data: UserProfile;
}

export interface DetailedUserResponse extends BaseApiResponse {
  success: true;
  data: DetailedUserProfile;
}

export interface UserListResponse extends PaginatedApiResponse<UserListItem> {
  filters?: UserFilterOptions;
  statistics?: {
    totalByRole: Record<UserRole, number>;
    totalByStatus: Record<UserStatus, number>;
  };
}

export interface UserStatisticsResponse extends BaseApiResponse {
  success: true;
  data: UserStatistics;
}

export interface CreditBalanceResponse extends BaseApiResponse {
  success: true;
  data: CreditBalance;
}

export interface EnterpriseTeamResponse extends BaseApiResponse {
  success: true;
  data: EnterpriseTeam;
}

export interface UserDevicesResponse extends BaseApiResponse {
  success: true;
  data: {
    devices: UserDevice[];
    total: number;
    activeDevices: number;
  };
}

export interface UserPreferencesResponse extends BaseApiResponse {
  success: true;
  data: UserPreferences;
}

export interface BulkOperationResponse extends BaseApiResponse {
  success: true;
  data: BulkOperationResult;
}

export type UserRequestType = CreateUserRequest | UpdateUserRequest | UpdateUserPasswordRequest | UpdateUserStatusRequest;
export type UserResponseType = UserResponse | DetailedUserResponse | UserListResponse | UserStatisticsResponse;
export type TeamManagementType = TeamInvitationRequest | TeamMemberUpdateRequest | EnterpriseTeamResponse;
export type UserManagementType = BulkUserOperation | UserImportData | UserExportOptions;
