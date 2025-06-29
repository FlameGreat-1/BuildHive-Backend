// Auth Models Module Export
// Main entry point for all authentication-related models, types, and constants

// Model Exports
export { User, IUserDocument } from './User.model';
export { Profile, IProfileDocument } from './Profile.model';
export { Session, ISessionDocument } from './Session.model';

// Type Exports from User Model
export type {
  PlatformType,
  AuthProvider,
} from './User.model';

// Type Exports from Profile Model
export type {
  ServiceCategory,
  AvailabilityStatus,
} from './Profile.model';

// Constants from Profile Model
export {
  SERVICE_CATEGORIES,
  AVAILABILITY_STATUS,
} from './Profile.model';

// Type Exports from Session Model
export type {
  SessionPlatform,
  SessionStatus,
  DeviceInfo,
  LocationInfo,
} from './Session.model';

// Default model exports for convenience
export { default as UserModel } from './User.model';
export { default as ProfileModel } from './Profile.model';
export { default as SessionModel } from './Session.model';

// Combined models object for easy access
export const authModels = {
  User,
  Profile,
  Session,
};

// Model interfaces for dependency injection and testing
export interface IAuthModels {
  User: typeof User;
  Profile: typeof Profile;
  Session: typeof Session;
}

// Service categories helper functions
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

// Availability status helper functions
export const getAvailabilityStatusLabel = (status: AvailabilityStatus): string => {
  const labels: Record<AvailabilityStatus, string> = {
    [AVAILABILITY_STATUS.AVAILABLE]: 'Available for Work',
    [AVAILABILITY_STATUS.BUSY]: 'Currently Busy',
    [AVAILABILITY_STATUS.UNAVAILABLE]: 'Unavailable',
    [AVAILABILITY_STATUS.VACATION]: 'On Vacation',
  };
  
  return labels[status] || status;
};

// Platform type helper functions
export const getPlatformLabel = (platform: PlatformType): string => {
  const labels: Record<PlatformType, string> = {
    web: 'Web Application',
    mobile: 'Mobile Application',
  };
  
  return labels[platform] || platform;
};

// Auth provider helper functions
export const getAuthProviderLabel = (provider: AuthProvider): string => {
  const labels: Record<AuthProvider, string> = {
    local: 'Email/Phone & Password',
    google: 'Google OAuth',
  };
  
  return labels[provider] || provider;
};

// Session status helper functions
export const getSessionStatusLabel = (status: SessionStatus): string => {
  const labels: Record<SessionStatus, string> = {
    active: 'Active Session',
    expired: 'Expired Session',
    revoked: 'Revoked Session',
    invalid: 'Invalid Session',
  };
  
  return labels[status] || status;
};

// Model validation helpers
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

// Model factory functions for testing and dependency injection
export const createUserModel = () => User;
export const createProfileModel = () => Profile;
export const createSessionModel = () => Session;

// Model connection helpers
export const getModelNames = (): string[] => {
  return ['User', 'Profile', 'Session'];
};

export const getModelCollections = (): string[] => {
  return ['users', 'profiles', 'sessions'];
};

// Export all service categories as array for validation
export const SERVICE_CATEGORIES_ARRAY = Object.values(SERVICE_CATEGORIES);
export const AVAILABILITY_STATUS_ARRAY = Object.values(AVAILABILITY_STATUS);

// Australian-specific helpers for Profile model
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

// Business type helpers
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

// Enterprise access level helpers
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

// Enterprise permissions
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

// Model health check function
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
    // Check if models are properly initialized
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

// Default export for the entire models module
export default {
  // Models
  User,
  Profile,
  Session,
  
  // Constants
  SERVICE_CATEGORIES,
  AVAILABILITY_STATUS,
  AUSTRALIAN_STATES,
  BUSINESS_TYPES,
  ENTERPRISE_ACCESS_LEVELS,
  ENTERPRISE_PERMISSIONS,
  
  // Helper functions
  getServiceCategoryLabel,
  getAvailabilityStatusLabel,
  getPlatformLabel,
  getAuthProviderLabel,
  getSessionStatusLabel,
  getStateLabel,
  getBusinessTypeLabel,
  getAccessLevelLabel,
  getPermissionLabel,
  
  // Validation functions
  isValidServiceCategory,
  isValidAvailabilityStatus,
  isValidPlatformType,
  isValidAuthProvider,
  isValidSessionStatus,
  isValidAustralianState,
  
  // Utility functions
  checkModelsHealth,
  getModelNames,
  getModelCollections,
};
