export { User } from './User.model';
export { Profile } from './Profile.model';
export { Session } from './Session.model';

export type { IUserDocument } from './User.model';
export type { IProfileDocument } from './Profile.model';
export type { ISessionDocument } from './Session.model';

export type PlatformType = 'web' | 'mobile';
export type AuthProvider = 'local' | 'google';
export type ServiceCategory = 'electrical' | 'plumbing' | 'carpentry' | 'painting' | 'roofing' | 'landscaping' | 'cleaning' | 'handyman' | 'tiling' | 'flooring' | 'hvac' | 'security' | 'other';
export type AvailabilityStatus = 'available' | 'busy' | 'unavailable' | 'vacation';
export type SessionPlatform = 'web' | 'mobile' | 'desktop';
export type SessionStatus = 'active' | 'expired' | 'revoked' | 'invalid';

export interface DeviceInfo {
  userAgent: string;
  ipAddress: string;
  deviceType: 'mobile' | 'desktop' | 'tablet';
  location?: LocationInfo;
}

export interface LocationInfo {
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

export const SERVICE_CATEGORIES = {
  ELECTRICAL: 'electrical' as const,
  PLUMBING: 'plumbing' as const,
  CARPENTRY: 'carpentry' as const,
  PAINTING: 'painting' as const,
  ROOFING: 'roofing' as const,
  LANDSCAPING: 'landscaping' as const,
  CLEANING: 'cleaning' as const,
  HANDYMAN: 'handyman' as const,
  TILING: 'tiling' as const,
  FLOORING: 'flooring' as const,
  HVAC: 'hvac' as const,
  SECURITY: 'security' as const,
  OTHER: 'other' as const,
};

export const AVAILABILITY_STATUS = {
  AVAILABLE: 'available' as const,
  BUSY: 'busy' as const,
  UNAVAILABLE: 'unavailable' as const,
  VACATION: 'vacation' as const,
};

export const authModels = {
  User,
  Profile,
  Session,
};

export interface IAuthModels {
  User: typeof User;
  Profile: typeof Profile;
  Session: typeof Session;
}

export const getServiceCategoryLabel = (category: ServiceCategory): string => {
  const labels: Record<ServiceCategory, string> = {
    [SERVICE_CATEGORIES.ELECTRICAL]: 'Electrical Services',
    [SERVICE_CATEGORIES.PLUMBING]: 'Plumbing Services',
    [SERVICE_CATEGORIES.CARPENTRY]: 'Carpentry & Woodwork',
    [SERVICE_CATEGORIES.PAINTING]: 'Painting & Decorating',
    [SERVICE_CATEGORIES.ROOFING]: 'Roofing Services',
    [SERVICE_CATEGORIES.LANDSCAPING]: 'Landscaping & Gardening',
    [SERVICE_CATEGORIES.CLEANING]: 'Cleaning Services',
    [SERVICE_CATEGORIES.HANDYMAN]: 'Handyman Services',
    [SERVICE_CATEGORIES.TILING]: 'Tiling & Flooring',
    [SERVICE_CATEGORIES.FLOORING]: 'Flooring Installation',
    [SERVICE_CATEGORIES.HVAC]: 'HVAC Services',
    [SERVICE_CATEGORIES.SECURITY]: 'Security Systems',
    [SERVICE_CATEGORIES.OTHER]: 'Other Services',
  };
  
  return labels[category] || category;
};

export const getAvailabilityStatusLabel = (status: AvailabilityStatus): string => {
  const labels: Record<AvailabilityStatus, string> = {
    [AVAILABILITY_STATUS.AVAILABLE]: 'Available for Work',
    [AVAILABILITY_STATUS.BUSY]: 'Currently Busy',
    [AVAILABILITY_STATUS.UNAVAILABLE]: 'Unavailable',
    [AVAILABILITY_STATUS.VACATION]: 'On Vacation',
  };
  
  return labels[status] || status;
};

export const getPlatformLabel = (platform: PlatformType): string => {
  const labels: Record<PlatformType, string> = {
    web: 'Web Application',
    mobile: 'Mobile Application',
  };
  
  return labels[platform] || platform;
};

export const getAuthProviderLabel = (provider: AuthProvider): string => {
  const labels: Record<AuthProvider, string> = {
    local: 'Email/Phone & Password',
    google: 'Google OAuth',
  };
  
  return labels[provider] || provider;
};

export const getSessionStatusLabel = (status: SessionStatus): string => {
  const labels: Record<SessionStatus, string> = {
    active: 'Active Session',
    expired: 'Expired Session',
    revoked: 'Revoked Session',
    invalid: 'Invalid Session',
  };
  
  return labels[status] || status;
};

export const isValidServiceCategory = (category: string): category is ServiceCategory => {
  return Object.values(SERVICE_CATEGORIES).includes(category as ServiceCategory);
};

export const isValidAvailabilityStatus = (status: string): status is AvailabilityStatus => {
  return Object.values(AVAILABILITY_STATUS).includes(status as AvailabilityStatus);
};

export const isValidPlatformType = (platform: string): platform is PlatformType => {
  return ['web', 'mobile'].includes(platform);
};

export const isValidAuthProvider = (provider: string): provider is AuthProvider => {
  return ['local', 'google'].includes(provider);
};

export const isValidSessionStatus = (status: string): status is SessionStatus => {
  return ['active', 'expired', 'revoked', 'invalid'].includes(status);
};

export const createUserModel = () => User;
export const createProfileModel = () => Profile;
export const createSessionModel = () => Session;

export const getModelNames = (): string[] => {
  return ['User', 'Profile', 'Session'];
};

export const getModelCollections = (): string[] => {
  return ['users', 'profiles', 'sessions'];
};

export const SERVICE_CATEGORIES_ARRAY = Object.values(SERVICE_CATEGORIES);
export const AVAILABILITY_STATUS_ARRAY = Object.values(AVAILABILITY_STATUS);

export const AUSTRALIAN_STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'] as const;
export type AustralianState = typeof AUSTRALIAN_STATES[number];

export const getStateLabel = (state: AustralianState): string => {
  const labels: Record<AustralianState, string> = {
    NSW: 'New South Wales',
    VIC: 'Victoria',
    QLD: 'Queensland',
    WA: 'Western Australia',
    SA: 'South Australia',
    TAS: 'Tasmania',
    ACT: 'Australian Capital Territory',
    NT: 'Northern Territory',
  };
  
  return labels[state] || state;
};

export const isValidAustralianState = (state: string): state is AustralianState => {
  return AUSTRALIAN_STATES.includes(state as AustralianState);
};

export const BUSINESS_TYPES = ['sole_trader', 'partnership', 'company', 'trust'] as const;
export type BusinessType = typeof BUSINESS_TYPES[number];

export const getBusinessTypeLabel = (type: BusinessType): string => {
  const labels: Record<BusinessType, string> = {
    sole_trader: 'Sole Trader',
    partnership: 'Partnership',
    company: 'Company',
    trust: 'Trust',
  };
  
  return labels[type] || type;
};

export const ENTERPRISE_ACCESS_LEVELS = ['owner', 'admin', 'member', 'viewer'] as const;
export type EnterpriseAccessLevel = typeof ENTERPRISE_ACCESS_LEVELS[number];

export const getAccessLevelLabel = (level: EnterpriseAccessLevel): string => {
  const labels: Record<EnterpriseAccessLevel, string> = {
    owner: 'Team Owner',
    admin: 'Administrator',
    member: 'Team Member',
    viewer: 'Viewer',
  };
  
  return labels[level] || level;
};

export const ENTERPRISE_PERMISSIONS = [
  'manage_team',
  'assign_jobs',
  'view_analytics',
  'manage_billing',
  'manage_settings',
  'view_reports',
  'manage_users',
  'approve_jobs',
] as const;

export type EnterprisePermission = typeof ENTERPRISE_PERMISSIONS[number];

export const getPermissionLabel = (permission: EnterprisePermission): string => {
  const labels: Record<EnterprisePermission, string> = {
    manage_team: 'Manage Team Members',
    assign_jobs: 'Assign Jobs',
    view_analytics: 'View Analytics',
    manage_billing: 'Manage Billing',
    manage_settings: 'Manage Settings',
    view_reports: 'View Reports',
    manage_users: 'Manage Users',
    approve_jobs: 'Approve Jobs',
  };
  
  return labels[permission] || permission;
};

export const checkModelsHealth = async (): Promise<{
  status: 'healthy' | 'unhealthy';
  models: Record<string, boolean>;
}> => {
  const modelChecks = {
    User: false,
    Profile: false,
    Session: false,
  };
  
  try {
    modelChecks.User = !!User.collection;
    modelChecks.Profile = !!Profile.collection;
    modelChecks.Session = !!Session.collection;
    
    const allHealthy = Object.values(modelChecks).every(Boolean);
    
    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      models: modelChecks,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      models: modelChecks,
    };
  }
};

export default {
  User,
  Profile,
  Session,
  SERVICE_CATEGORIES,
  AVAILABILITY_STATUS,
  AUSTRALIAN_STATES,
  BUSINESS_TYPES,
  ENTERPRISE_ACCESS_LEVELS,
  ENTERPRISE_PERMISSIONS,
  getServiceCategoryLabel,
  getAvailabilityStatusLabel,
  getPlatformLabel,
  getAuthProviderLabel,
  getSessionStatusLabel,
  getStateLabel,
  getBusinessTypeLabel,
  getAccessLevelLabel,
  getPermissionLabel,
  isValidServiceCategory,
  isValidAvailabilityStatus,
  isValidPlatformType,
  isValidAuthProvider,
  isValidSessionStatus,
  isValidAustralianState,
  checkModelsHealth,
  getModelNames,
  getModelCollections,
};
